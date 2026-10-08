/**
 * Safe rich text for notification bodies (bell + toast).
 * Allows a small HTML subset and auto-emphasizes folios / quantities in plain text.
 */

const ALLOWED_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 'mark', 'code', 'br', 'span'])

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Strip dangerous tags/attrs; keep a tiny allowlist for emphasis.
 *
 * Single pass over every `<`: a well-formed allowlisted tag is re-emitted
 * WITHOUT attributes, any other well-formed tag is dropped, and a `<` that
 * does not open a well-formed tag (`<b/onclick=…>`, `<scr<script>`, `<b <img`)
 * is escaped to `&lt;`. So the output never contains a raw `<` except in the
 * rebuilt tags. Still not a substitute for a DOM-based sanitizer: for
 * user-authored content render the body as plain text (`richText={false}`).
 */
export function sanitizeNotificationHtml(input: string): string {
  const s = String(input ?? '').replace(/<!--[\s\S]*?-->/g, '')
  return s.replace(
    /<(\/?)([a-z][a-z0-9]*)(?=[\s/>])[^>]*>|</gi,
    (match, slash: string | undefined, tag: string | undefined) => {
      if (!tag) return '&lt;'
      const t = tag.toLowerCase()
      if (!ALLOWED_TAGS.has(t)) return ''
      if (t === 'br') return '<br/>'
      return slash ? `</${t}>` : `<${t}>`
    },
  )
}

/**
 * Plain-text → light HTML: **markdown**, folios (SO-00044), and qty tokens.
 * Already-escaped so safe to inject after sanitize.
 */
export function enhancePlainNotificationText(text: string): string {
  let s = escapeHtml(String(text ?? ''))
  // **bold**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // _italic_ (avoid matching underscores inside ids)
  s = s.replace(/(^|[\s(])_(.+?)_([\s).,;!]|$)/g, '$1<em>$2</em>$3')
  // Folios / codes: SO-00044, WO-12, INV-0001, …
  s = s.replace(/\b([A-Z]{1,8}-\d{2,})\b/g, '<strong>$1</strong>')
  // Decimal quantities (e.g. -1.0000 → -1) and integers with units (3 ud).
  // The whole numeric run is matched, so a formatted amount (MX$1,060.00) is
  // emphasized as written instead of its "1,060" being read as a decimal comma
  // and shortened to "1,06" (PIT-023).
  s = s.replace(
    /(^|[^\w.,-])(-?\d+(?:[.,]\d+)+)(\s*(?:ud|uds|pz|pzs|kg|g|lt|l|ml|cm|un))?\b/gi,
    (_m, pre: string, num: string, unit: string | undefined) =>
      `${pre}<strong>${isPlainDecimal(pre, num) ? formatQtyDisplay(num) : num}${unit ?? ''}</strong>`,
  )
  s = s.replace(
    /(^|[^\w.,>-])(-?\d+)(\s*(?:ud|uds|pz|pzs|kg|g|lt|l|ml|cm|un))\b/gi,
    (_m, pre: string, num: string, unit: string) =>
      `${pre}<strong>${num}${unit}</strong>`,
  )
  return s
}

/**
 * Only an unambiguous decimal is shortened: one separator, not a money amount
 * (currency symbol before it) and not three digits after the separator, which
 * reads as thousands in one locale and as decimals in another (1,060 · 1.500).
 */
function isPlainDecimal(pre: string, num: string): boolean {
  if (/[$€£¥]$/.test(pre)) return false
  const seps = num.match(/[.,]/g) ?? []
  if (seps.length !== 1) return false
  const fraction = num.slice(num.search(/[.,]/) + 1)
  return fraction.length !== 3
}

/** -1.0000 → -1 · 1,50 → 1,5 · keep meaningful decimals, drop trailing zeros. */
export function formatQtyDisplay(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return trimmed
  const comma = trimmed.includes(',')
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n)) return trimmed
  let out = n.toFixed(4).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
  if (comma) out = out.replace('.', ',')
  return out
}

/** Final HTML string for a notification / toast body. */
export function formatNotificationBodyHtml(raw?: string | null): string {
  const text = (raw || '').trim()
  if (!text) return ''
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text)
  const html = looksLikeHtml ? sanitizeNotificationHtml(text) : enhancePlainNotificationText(text)
  return html
}
