/**
 * Pure mechanics of the entry pop-up (frequency, exclusions, crawlers, triggers). No DOM, no React:
 * every function takes its inputs, so each rule is a row in a table test.
 */
export type PromoFrequency = 'session' | 'days' | 'campaign'

/** Paths where a promotional pop-up is never shown (cart, payment, thanks, account, auth, legal, editor previews). */
export const DEFAULT_PROMO_EXCLUDED_PATHS: readonly string[] = [
  '/carrito*',
  '/cart*',
  '/pagar*',
  '/checkout*',
  '/gracias*',
  '/cuenta*',
  '/account*',
  '/login*',
  '/iniciar-sesion*',
  '/registro*',
  '/terminos*',
  '/privacidad*',
  '/legal*',
  '/preview*',
  '/editor*',
]

export type PathPattern = string | RegExp

/** `/mx/carrito` and `/carrito` both reduce to `/carrito` (an optional 2-letter market/locale segment is ignored). */
export function stripMarketPrefix(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i, '') || '/'
}

function matches(path: string, pattern: PathPattern): boolean {
  if (pattern instanceof RegExp) return pattern.test(path)
  const p = pattern.toLowerCase()
  if (p.endsWith('*')) {
    const prefix = p.slice(0, -1)
    return path === prefix.replace(/\/$/, '') || path.startsWith(prefix)
  }
  return path === p || path === p.replace(/\/$/, '')
}

/** True when the pop-up must not appear on `pathname`. Case-insensitive; the market prefix does not matter. */
export function isExcludedPath(pathname: string, patterns: readonly PathPattern[] = DEFAULT_PROMO_EXCLUDED_PATHS): boolean {
  const path = (pathname || '/').split(/[?#]/)[0]!.toLowerCase().replace(/\/+$/, '') || '/'
  const bare = stripMarketPrefix(path)
  return patterns.some((p) => matches(path, p) || matches(bare, p))
}

const CRAWLER = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|outbrain|pinterest|vkshare|w3c_validator|lighthouse|headless|prerender|google-structured-data|gtmetrix|pingdom/i

/** Known crawlers and automation (`navigator.webdriver`). They never get the pop-up. */
export function isCrawler(userAgent: string | null | undefined, webdriver?: boolean): boolean {
  return webdriver === true || CRAWLER.test(userAgent ?? '')
}

/** Storage seam: cookie for cross-tab memory, sessionStorage for "once per session". Replaceable in tests and shops. */
export type PromoSeenStore = {
  get(name: string): string | null
  set(name: string, value: string, options: { days?: number; session?: boolean }): void
}

export const PROMO_COOKIE = 'sf_promo'

export function memorySeenStore(): PromoSeenStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: (n) => data.get(n) ?? null, set: (n, v) => void data.set(n, v) }
}

/** Default store: `sessionStorage` for session frequency, a first-party cookie otherwise. Fails closed to memory. */
export function browserSeenStore(): PromoSeenStore {
  const fallback = memorySeenStore()
  return {
    get(name) {
      try {
        const fromSession = sessionStorage.getItem(name)
        if (fromSession) return fromSession
      } catch {
        /* blocked */
      }
      try {
        const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
        if (m) return decodeURIComponent(m.slice(name.length + 1))
      } catch {
        /* blocked */
      }
      return fallback.get(name)
    },
    set(name, value, { days, session }) {
      fallback.set(name, value, {})
      if (session) {
        try {
          sessionStorage.setItem(name, value)
        } catch {
          /* memory only */
        }
        return
      }
      try {
        const maxAge = Math.round((days ?? 7) * 86400)
        document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      } catch {
        /* memory only */
      }
    },
  }
}

export type SeenRecord = { id: string; version: number; at: number }

export function serializeSeen(r: SeenRecord): string {
  return `${r.id}:${r.version}:${r.at}`
}

export function parseSeen(raw: string | null | undefined): SeenRecord | null {
  if (!raw) return null
  const m = /^(.+):(\d+):(\d+)$/.exec(raw)
  if (!m) return null
  return { id: m[1]!, version: Number(m[2]), at: Number(m[3]) }
}

export type FrequencyInput = {
  id: string
  version: number
  frequency: PromoFrequency
  /** Window for `days` (default 7). */
  days?: number
  seen: SeenRecord | null
  now: number
}

/**
 * Frequency rule. A new `version` of the same announcement shows again.
 * - `session`: once per browser session (the store is the session store).
 * - `days`: once every N days.
 * - `campaign`: once per campaign version.
 */
export function frequencyAllows({ id, version, frequency, days = 7, seen, now }: FrequencyInput): boolean {
  if (!seen || seen.id !== id || seen.version !== version) return true
  if (frequency === 'days') return now - seen.at >= days * 86_400_000
  return false
}

export type PromoWindow = { starts_at?: string | null; ends_at?: string | null }

/** Inside the campaign dates (unparseable dates are ignored: the server decides, not the clock of a bad value). */
export function withinWindow({ starts_at, ends_at }: PromoWindow, now: number): boolean {
  const s = starts_at ? Date.parse(starts_at) : NaN
  const e = ends_at ? Date.parse(ends_at) : NaN
  if (Number.isFinite(s) && now < s) return false
  if (Number.isFinite(e) && now > e) return false
  return true
}

export type PromoTrigger = {
  /** Show after N ms. `false` disables the timer. Default 5000. */
  delayMs?: number | false
  /** Show on the Nth page view of the session. `false` disables. Default 2. */
  pageviews?: number | false
  /** Show after scrolling this share of the page (0-100). `false` disables. Default 40. */
  scrollPercent?: number | false
}

export const DEFAULT_PROMO_TRIGGER: Required<PromoTrigger> = { delayMs: 5000, pageviews: 2, scrollPercent: 40 }

export function resolveTrigger(t?: PromoTrigger | null): Required<PromoTrigger> {
  return { ...DEFAULT_PROMO_TRIGGER, ...(t ?? {}) }
}

/** Scroll depth as a percentage of the scrollable height (UI measure only). */
export function scrollDepthPercent(scrollY: number, viewportHeight: number, docHeight: number): number {
  const scrollable = docHeight - viewportHeight
  if (!(scrollable > 0)) return 0
  return Math.min(100, Math.max(0, (scrollY / scrollable) * 100))
}

/** Only same-site paths are valid CTAs (`/colecciones/x`). Anything else (`//evil`, `https:`, `javascript:`) is dropped. */
export function safeInternalPath(href: string | null | undefined): string | null {
  if (!href || !href.startsWith('/') || href.startsWith('//') || /[\\\u0000-\u001f]/.test(href)) return null
  return href
}
