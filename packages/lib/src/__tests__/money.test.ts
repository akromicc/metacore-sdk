import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../currency'
import {
  CurrencyMismatchError,
  MoneyValue,
  OverflowError,
  PrecisionError,
  ROUNDING_MODES,
  currencySpec,
  formatMoney,
  inverseRate,
  type CurrencySpec,
  type RoundingMode,
} from '../money'

// fast-check is not installed in the workspace: seeded xorshift64* instead, so
// failures are reproducible.
function rng(seed: bigint) {
  let s = seed
  const next = (): bigint => {
    s ^= s >> 12n
    s ^= (s << 25n) & 0xffffffffffffffffn
    s ^= s >> 27n
    return (s * 0x2545f4914f6cdd1dn) & 0xffffffffffffffffn
  }
  return {
    below: (n: bigint): bigint => next() % n,
    int: (n: number): number => Number(next() % BigInt(n)),
  }
}

const SPECS = ['MXN', 'JPY', 'KWD', 'CLF', 'CHF', 'SEK'].map((c) => currencySpec(c))
const RUNS = 3000

function arbMoney(r: ReturnType<typeof rng>, spec?: CurrencySpec): MoneyValue {
  const s = spec ?? (SPECS[r.int(SPECS.length)] as CurrencySpec)
  const kind = r.int(4)
  const minor =
    kind === 0 ? r.below(1000n) - 500n : kind === 1 ? r.below(10n ** 12n) - 5n * 10n ** 11n : r.below(1n << 60n) - (1n << 59n)
  return MoneyValue.fromMinor(minor, s)
}

function arbMode(r: ReturnType<typeof rng>): RoundingMode {
  return ROUNDING_MODES[r.int(ROUNDING_MODES.length)] as RoundingMode
}

function decimals(s: string): number {
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

describe('MoneyValue properties (seeded)', () => {
  it('allocate parts add up to the total', () => {
    const r = rng(20261019n)
    for (let i = 0; i < RUNS; i++) {
      const m = arbMoney(r)
      const n = 1 + r.int(12)
      const w = Array.from({ length: n }, () => {
        const k = r.int(4)
        return k === 0 ? 0n : k === 1 ? r.below(2n ** 59n) : r.below(100n)
      })
      w[r.int(n)]! += 1n
      const parts = m.allocate(w)
      const sum = parts.reduce((a, p) => a.add(p), MoneyValue.zero(m.spec))
      expect(sum.equals(m), `${m} ${w}`).toBe(true)
      parts.forEach((p, j) => {
        if (w[j] === 0n) expect(p.isZero()).toBe(true)
        expect(p.sign() * m.sign()).toBeGreaterThanOrEqual(0)
      })
    }
  })

  it('parse(toString(m)) == m', () => {
    const r = rng(1n)
    for (let i = 0; i < RUNS; i++) {
      const m = arbMoney(r)
      const s = m.toString()
      expect(decimals(s)).toBe(m.spec.minorUnits)
      expect(MoneyValue.parse(s, m.spec).equals(m)).toBe(true)
    }
    for (const minor of [-(2n ** 63n), 2n ** 63n - 1n]) {
      const m = MoneyValue.fromMinor(minor, 'KWD')
      expect(MoneyValue.parse(m.toString(), 'KWD').equals(m)).toBe(true)
    }
  })

  it('add is commutative and associative', () => {
    const r = rng(2n)
    for (let i = 0; i < RUNS; i++) {
      const x = arbMoney(r)
      const y = arbMoney(r, x.spec)
      const z = arbMoney(r, x.spec)
      expect(x.add(y).equals(y.add(x))).toBe(true)
      expect(x.add(y).add(z).equals(x.add(y.add(z)))).toBe(true)
    }
  })

  it('convert there and back is within one minor unit', () => {
    const r = rng(17n)
    for (let i = 0; i < RUNS; i++) {
      const coef = 1_000_000n + r.below(100_000_000n)
      const value = `${coef / 1_000_000n}.${(coef % 1_000_000n).toString().padStart(6, '0')}`
      const rate = { base: 'USD', quote: 'MXN', value }
      const m = MoneyValue.fromMinor(r.below(2_000_000_000n) - 1_000_000_000n, 'USD')
      const there = m.convert(rate, 'MXN', arbMode(r))
      const back = there.convert(inverseRate(rate), 'USD')
      const d = back.sub(m).minor
      expect(d >= -1n && d <= 1n, `${m} @${value} → ${there} → ${back}`).toBe(true)
    }
  })

  it('roundCash is idempotent and lands on the increment', () => {
    const r = rng(3n)
    for (let i = 0; i < RUNS; i++) {
      const m = arbMoney(r)
      const mode = arbMode(r)
      const once = m.roundCash(mode)
      expect(once.roundCash(mode).equals(once)).toBe(true)
      const inc = BigInt(m.spec.cashIncrement ?? 0)
      if (inc > 1n) expect(once.minor % inc).toBe(0n)
    }
  })

  it('no operation yields more decimals than minorUnits', () => {
    const r = rng(4n)
    for (let i = 0; i < RUNS; i++) {
      const m = arbMoney(r)
      const mode = arbMode(r)
      const out: MoneyValue[] = [m.neg(), m.add(arbMoney(r, m.spec)), m.roundCash(mode)]
      const push = (fn: () => MoneyValue | MoneyValue[]) => {
        try {
          out.push(...([] as MoneyValue[]).concat(fn()))
        } catch (e) {
          if (!(e instanceof OverflowError)) throw e // big amounts may overflow; that is fine
        }
      }
      push(() => m.mulDecimal(`${r.int(1000)}.${r.int(1000000)}`, mode))
      push(() => m.allocate([1n + r.below(10n), r.below(10n), 1n]))
      push(() => m.convert({ base: m.currency, quote: 'KWD', value: `${1 + r.int(1000)}.${r.int(100000)}` }, 'KWD', mode))
      for (const o of out) expect(decimals(o.toString())).toBe(o.spec.minorUnits)
    }
  })

  it('parse never throws untyped errors', () => {
    const r = rng(5n)
    const alphabet = '0123456789.-+e,_ NaInfx'
    for (let i = 0; i < RUNS; i++) {
      const len = r.int(24)
      let s = ''
      for (let j = 0; j < len; j++) s += alphabet[r.int(alphabet.length)]
      try {
        MoneyValue.parseRound(s, 'MXN', 'halfEven')
      } catch (e) {
        expect((e as Error).name).toMatch(/InvalidMoneyError|OverflowError/)
      }
    }
  })
})

describe('MoneyValue API', () => {
  it('throws typed errors', () => {
    expect(() => MoneyValue.parse('10.5', 'JPY')).toThrow(PrecisionError)
    expect(() => MoneyValue.parse('1', 'MXN').add(MoneyValue.parse('1', 'USD'))).toThrow(CurrencyMismatchError)
    expect(() => MoneyValue.fromMinor(2n ** 63n - 1n, 'MXN').add(MoneyValue.fromMinor(1n, 'MXN'))).toThrow(OverflowError)
    expect(() => MoneyValue.parse('1', 'ZZZ')).toThrow(/unknown currency/)
  })

  it('accepts custom specs and org cash rounding', () => {
    const org: CurrencySpec = { ...currencySpec('MXN'), cashIncrement: 50 }
    expect(MoneyValue.parse('12.34', org).roundCash().toString()).toBe('12.50')
    expect(MoneyValue.fromJSON({ amount: '12.34', currency_code: 'MXN' }, org).spec.cashIncrement).toBe(50)
    const token: CurrencySpec = { code: 'PTS', minorUnits: 0 }
    expect(MoneyValue.parse('15', token).toJSON()).toEqual({ amount: '15', currency_code: 'PTS' })
  })

  it('is immutable', () => {
    const m = MoneyValue.parse('1.00', 'MXN')
    expect(Object.isFrozen(m)).toBe(true)
    m.add(MoneyValue.parse('2.00', 'MXN'))
    expect(m.toString()).toBe('1.00')
  })
})

describe('currencySpec', () => {
  it('uses the ISO table', () => {
    expect(currencySpec('mxn')).toEqual({ code: 'MXN', minorUnits: 2 })
    expect(currencySpec('JPY').minorUnits).toBe(0)
    expect(currencySpec('KWD').minorUnits).toBe(3)
    expect(currencySpec('CHF')).toEqual({ code: 'CHF', minorUnits: 2, cashIncrement: 5 })
  })

  it('falls back to Intl for unknown codes and rejects malformed ones', () => {
    expect(currencySpec('XAU').minorUnits).toBe(
      new Intl.NumberFormat('en', { style: 'currency', currency: 'XAU' }).resolvedOptions().maximumFractionDigits,
    )
    expect(currencySpec('ZZZ')).toEqual({ code: 'ZZZ', minorUnits: 2 })
    expect(() => currencySpec('pesos')).toThrow()
  })
})

describe('formatMoney', () => {
  it('uses minorUnits fraction digits', () => {
    expect(formatMoney({ amount: '1899', currency_code: 'MXN' }, { locale: 'es-MX' })).toBe('$1,899.00')
    expect(formatMoney({ amount: '1000', currency_code: 'JPY' }, { locale: 'en-US' })).toBe('¥1,000')
    expect(formatMoney({ amount: '1.55', currency_code: 'KWD' }, { locale: 'en-US', display: 'code' })).toBe(
      'KWD 1.550',
    )
  })

  it('does not go through floats', () => {
    // 2^53 + 1 is not representable as a double.
    expect(formatMoney({ amount: '9007199254740993.00', currency_code: 'USD' }, { locale: 'en-US' })).toBe(
      '$9,007,199,254,740,993.00',
    )
    expect(formatMoney(MoneyValue.parse('1000000000000.00', 'VES'), { locale: 'en-US', display: 'code' })).toBe(
      'VES 1,000,000,000,000.00',
    )
  })

  it('honours symbolPosition and handles bad input', () => {
    const spec: CurrencySpec = { code: 'EUR', minorUnits: 2, symbolPosition: 'after' }
    expect(formatMoney({ amount: '-1234.5', currency_code: 'EUR' }, { locale: 'en-US', spec })).toBe('-1,234.50 €')
    expect(formatMoney({ amount: 'abc', currency_code: 'MXN' })).toBe('')
    expect(formatMoney({ amount: '1', currency_code: 'pesos' })).toBe('1 pesos')
  })

  it('leaves formatCurrency untouched', () => {
    expect(formatCurrency(1234.56, 'USD', 'en')).toBe('$1,234.56')
  })
})
