# @asteby/metacore-lib

Pure utilities shared across the Metacore ecosystem. No React, no DOM.

Covers:

- **date** — `formatDate`, `formatDistance`, `formatRelative`, `getAllTimezones`
- **format** — `formatNumber`, `formatPercentage`, `truncate`
- **currency** — `formatCurrency`, `parseCurrency`, `getCurrencySymbol`, `SPANISH_SYMBOLS`
- **errors** — `handleServerError(error, toast?, { labels?, logger? })`

Cookie helpers live in `@asteby/metacore-ui/lib` (`getCookie`, `setCookie`, `removeCookie`).

## Install

```bash
pnpm add @asteby/metacore-lib date-fns
# sonner is an optional peer for the error handler
pnpm add sonner
```

## Usage

```ts
import { formatCurrency, parseCurrency } from '@asteby/metacore-lib/currency'
import { formatDate, formatDistance } from '@asteby/metacore-lib/date'
import { formatNumber, truncate } from '@asteby/metacore-lib/format'
import { handleServerError } from '@asteby/metacore-lib/errors'
import { toast } from 'sonner'

formatCurrency(1234.56, 'USD', 'en') // "$1,234.56"
parseCurrency('S/ 1.234,56') // 1234.56
formatDate('2024-01-15', 'dd/MM/yyyy') // "15/01/2024"
formatDistance('2024-01-01') // "about 2 years ago"
formatNumber(1234.5, { locale: 'es' }) // "1.234,5"
truncate('hello world', 5) // "hello…"

try {
  // ...
} catch (err) {
  handleServerError(err, toast, {
    labels: {
      unauthorized: 'Sesión expirada',
      forbidden: 'No tienes permisos',
      notFound: 'Recurso no encontrado',
    },
  })
}
```

## Money (exact amounts)

`@asteby/metacore-lib/money` is the TypeScript twin of the kernel's `money`
package: integer minor units in `bigint`, explicit rounding modes, no floats.
Its behaviour is pinned by `src/__fixtures__/money.golden.json`, a byte-for-byte
copy of the kernel's `money/testdata/golden.json`.

```ts
import { MoneyValue, formatMoney, inverseRate } from '@asteby/metacore-lib/money'

const total = MoneyValue.parse('1899.00', 'MXN') // PrecisionError on '1.005'
total.mulDecimal('0.16').toString() // "303.84"
MoneyValue.parse('100.00', 'MXN').allocate([1, 1, 1]).map(String) // ["33.34", "33.33", "33.33"]
MoneyValue.parse('12.33', 'CHF').roundCash().toString() // "12.35"

const usdMxn = { base: 'USD', quote: 'MXN', value: '17.2345' } // MXN per 1 USD
MoneyValue.parse('100.00', 'USD').convert(usdMxn, 'MXN').toJSON() // { amount: "1723.45", currency_code: "MXN" }
inverseRate(usdMxn).value // "0.058023151237"

formatMoney({ amount: '1000', currency_code: 'JPY' }, { locale: 'en-US' }) // "¥1,000"
```

## Error labels

`handleServerError` accepts an injected `toast` so consumers decide the UI binding, and an optional `labels` map for localization.

```ts
interface ErrorLabels {
  generic: string
  notFound: string
  unauthorized: string
  forbidden: string
  network: string
  timeout: string
}
```

## License

Apache-2.0
