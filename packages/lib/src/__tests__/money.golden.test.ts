import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MoneyError,
  MoneyValue,
  ROUNDING_MODES,
  canonicalDecimal,
  decimalMul,
  decimalQuo,
  inverseRate,
  isoCurrencyCodes,
  isoCurrencySpec,
  type Money,
  type RoundingMode,
} from '../money'

/**
 * sha256 of the kernel's money/testdata/golden.json (metacore-kernel, pinned
 * there as GoldenSHA256). src/__fixtures__/money.golden.json must be a
 * byte-for-byte copy: never edit it here, regenerate it in the kernel and copy.
 */
const KERNEL_GOLDEN_SHA256 = '8394487d835e0ecf7d336af3a66de6a69e7fc13debb32ba59d48fb08af07711c'

const raw = readFileSync(new URL('../__fixtures__/money.golden.json', import.meta.url))
const golden: any = JSON.parse(raw.toString('utf8'))

type Expect = { amount?: string; error?: string }

function code(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    if (e instanceof MoneyError) return e.code
    throw e
  }
  return ''
}

function m(v: Money): MoneyValue {
  return MoneyValue.fromJSON(v)
}

/** Runs fn and compares with the expected amount or error code. */
function check(name: string, fn: () => MoneyValue, want: Expect): void {
  if (want.error) {
    expect(code(fn), name).toBe(want.error)
    return
  }
  expect(fn().toString(), name).toBe(want.amount)
}

describe('money golden (shared with the kernel)', () => {
  it('is the same file as the kernel', () => {
    expect(createHash('sha256').update(raw).digest('hex')).toBe(KERNEL_GOLDEN_SHA256)
    expect(golden.version).toBe(1)
  })

  it('has the same ISO table and rounding modes', () => {
    const codes: string[] = []
    for (const e of golden.iso) {
      codes.push(e.code)
      const s = isoCurrencySpec(e.code)
      expect(s, e.code).toBeDefined()
      expect(s?.minorUnits, e.code).toBe(e.minor_units)
      expect(s?.cashIncrement ?? 0, e.code).toBe(e.cash_increment_minor)
    }
    expect(isoCurrencyCodes()).toEqual(codes)
    expect([...ROUNDING_MODES]).toEqual(golden.rounding_modes)
  })

  it('runs every vector', () => {
    const c = golden.cases
    let n = 0

    for (const tc of c.parse_decimal) {
      n++
      if (tc.error) expect(code(() => canonicalDecimal(tc.input)), JSON.stringify(tc.input)).toBe(tc.error)
      else expect(canonicalDecimal(tc.input), tc.input).toBe(tc.string)
    }
    for (const tc of c.parse) {
      n++
      check(`parse ${tc.name}`, () => MoneyValue.parse(tc.input, tc.currency_code), tc)
      if (tc.minor) expect(MoneyValue.parse(tc.input, tc.currency_code).minor.toString()).toBe(tc.minor)
    }
    for (const tc of c.parse_round) {
      n++
      check(`parse_round ${tc.name}`, () => MoneyValue.parseRound(tc.input, tc.currency_code, tc.mode), tc)
    }
    for (const tc of c.add) {
      n++
      check(`add ${tc.name}`, () => m(tc.a).add(m(tc.b)), tc)
    }
    for (const tc of c.sub) {
      n++
      check(`sub ${tc.name}`, () => m(tc.a).sub(m(tc.b)), tc)
    }
    for (const tc of c.neg) {
      n++
      check(`neg ${tc.name}`, () => m(tc.money).neg(), tc)
    }
    for (const tc of c.mul_decimal) {
      n++
      check(`mul_decimal ${tc.name}`, () => m(tc.money).mulDecimal(tc.factor, tc.mode), tc)
    }
    for (const tc of c.allocate) {
      n++
      const run = () => m(tc.money).allocate(tc.weights)
      if (tc.error) expect(code(run), `allocate ${tc.name}`).toBe(tc.error)
      else expect(run().map(String), `allocate ${tc.name}`).toEqual(tc.parts)
    }
    for (const tc of c.round_cash) {
      n++
      check(`round_cash ${tc.name}`, () => m(tc.money).roundCash(tc.mode), tc)
    }
    for (const tc of c.sum_round_cash) {
      n++
      const sum = (tc.lines as string[]).reduce(
        (acc, l) => acc.add(MoneyValue.parse(l, tc.currency_code)),
        MoneyValue.zero(tc.currency_code),
      )
      expect(sum.toString()).toBe(tc.sum)
      expect(sum.roundCash(tc.mode).toString()).toBe(tc.cash)
    }
    for (const tc of c.decimal_quo) {
      n++
      const run = () => decimalQuo(tc.a, tc.b, tc.scale, tc.mode)
      if (tc.error) expect(code(run)).toBe(tc.error)
      else expect(run(), `${tc.a}/${tc.b}`).toBe(tc.result)
    }
    for (const tc of c.decimal_mul) {
      n++
      expect(decimalMul(tc.a, tc.b)).toBe(tc.result)
    }
    for (const tc of c.inverse) {
      n++
      const r = { id: 'r1', base: 'USD', quote: 'MXN', value: tc.value, kind: 'mid' }
      const run = () => inverseRate(r, tc.scale)
      if (tc.error) {
        expect(code(run), `inverse ${tc.value}`).toBe(tc.error)
        continue
      }
      expect(run()).toEqual({
        id: 'r1',
        base: 'MXN',
        quote: 'USD',
        value: tc.inverse,
        kind: 'mid',
        inverted: true,
        derived: true,
      })
    }
    for (const tc of c.convert) {
      n++
      check(`convert ${tc.name}`, () => m(tc.money).convert(tc.rate, tc.to, tc.mode as RoundingMode), tc)
      if (!tc.error) expect(m(tc.money).convert(tc.rate, tc.to, tc.mode).currency).toBe(tc.to)
    }
    for (const tc of c.json) {
      n++
      expect(JSON.stringify(m(tc.money))).toBe(tc.json)
      expect(MoneyValue.fromJSON(JSON.parse(tc.json)).equals(m(tc.money))).toBe(true)
    }
    for (const tc of c.json_decode) {
      n++
      const run = () => MoneyValue.fromJSON(JSON.parse(tc.json))
      if (tc.error) {
        expect(code(run), tc.json).toBe(tc.error)
        continue
      }
      expect(run().toJSON()).toEqual({ amount: tc.amount, currency_code: tc.currency_code })
    }
    expect(n).toBeGreaterThanOrEqual(300)
  })
})
