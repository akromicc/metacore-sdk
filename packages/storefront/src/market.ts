/**
 * Detección de mercado por visita (país + idioma), pura y sin DOM: sirve en el servidor de cualquier tienda.
 *
 * Reglas (mejores prácticas de i18n para comercio):
 * - El mercado canónico lo fija el DOMINIO (OPS liga cada dominio verificado a un mercado: org_domains.market_code).
 *   Esto no lo decide la geolocalización: así cada URL tiene un solo idioma/moneda (SEO, hreflang, caché de CDN).
 * - La geolocalización solo SUGIERE (banner "¿Ver la tienda de Estados Unidos?"); nunca redirige sola, nunca a rastreadores
 *   y respeta la elección guardada del comprador.
 * - Precios, impuestos y envío NO dependen de la IP: dependen del mercado del dominio y de la dirección de entrega.
 * - El país sale de las cabeceras que pone el CDN/proxy (no se puede confiar en ellas si el servidor está expuesto
 *   directo a internet: solo se leen con `trustProxy`).
 */

export type MarketInfo = {
  /** Código del mercado en OPS ("mx", "us"). */
  code: string
  /** ISO 3166-1 alfa-2 a los que vende. */
  countries: string[]
  /** BCP 47 por defecto ("es-MX", "en-US"). */
  locale: string
  /** ISO 4217 ("MXN", "USD"). */
  currency: string
  /** Dominio público del mercado, si es distinto del actual ("godsnutrition.com"). */
  host?: string
}

/** Cabeceras de país de los CDN/proxies más comunes, en orden de preferencia. */
export const COUNTRY_HEADERS = ['cf-ipcountry', 'cloudfront-viewer-country', 'x-vercel-ip-country', 'x-appengine-country', 'x-country-code'] as const

const BOT = /bot|crawl|spider|slurp|bing|facebookexternalhit|embedly|preview|lighthouse|headless|curl|wget/i

/** País del visitante según el CDN. `null` si no viene, es desconocido (XX), Tor (T1) o no es ISO alfa-2. */
export function visitorCountry(headers: Headers, { trustProxy = true }: { trustProxy?: boolean } = {}): string | null {
  if (!trustProxy) return null
  for (const name of COUNTRY_HEADERS) {
    const value = headers.get(name)?.trim().toUpperCase()
    if (value && /^[A-Z]{2}$/.test(value) && value !== 'XX' && value !== 'T1') return value
  }
  return null
}

/** Idiomas de Accept-Language ordenados por q (mayor primero), en minúsculas. */
export function preferredLanguages(acceptLanguage: string | null | undefined): string[] {
  if (!acceptLanguage) return []
  return acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1)
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0, index }
    })
    .filter((l) => l.tag && l.tag !== '*' && l.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((l) => l.tag)
}

/** Mejor idioma entre los que ofrece la tienda: coincidencia exacta, luego por idioma base; si no, el de `fallback`. */
export function negotiateLocale(acceptLanguage: string | null | undefined, available: string[], fallback: string): string {
  const lowered = new Map(available.map((l) => [l.toLowerCase(), l]))
  for (const wanted of preferredLanguages(acceptLanguage)) {
    const exact = lowered.get(wanted)
    if (exact) return exact
    const base = wanted.split('-')[0]
    const sameBase = available.find((l) => l.toLowerCase().split('-')[0] === base)
    if (sameBase) return sameBase
  }
  return fallback
}

export type MarketSuggestion = {
  market: MarketInfo
  /** Qué disparó la sugerencia. El país manda; el idioma solo si el CDN no dio país. */
  reason: 'country' | 'language'
}

/**
 * ¿Conviene sugerir otro mercado a esta visita? `null` si no (ya está en el correcto, rastreador, ya eligió, o no hay otro).
 * `chosen` es el código que el comprador guardó al elegir a mano ("market" en cookie): si existe, no se vuelve a sugerir.
 */
export function suggestMarket({
  headers,
  markets,
  current,
  chosen,
  trustProxy = true,
}: {
  headers: Headers
  markets: MarketInfo[]
  current: string
  chosen?: string | null
  trustProxy?: boolean
}): MarketSuggestion | null {
  if (chosen || markets.length < 2) return null
  if (BOT.test(headers.get('user-agent') ?? '')) return null

  const country = visitorCountry(headers, { trustProxy })
  if (country) {
    const target = markets.find((m) => m.countries.includes(country))
    return target && target.code !== current ? { market: target, reason: 'country' } : null
  }
  // Sin país del CDN: la región del idioma del navegador ("en-US" → US), solo como pista débil.
  for (const tag of preferredLanguages(headers.get('accept-language'))) {
    const region = tag.split('-')[1]?.toUpperCase()
    if (!region) continue
    const target = markets.find((m) => m.countries.includes(region))
    if (target) return target.code !== current ? { market: target, reason: 'language' } : null
  }
  return null
}

/**
 * Enlaces `hreflang` para <head>: un alterno por mercado con dominio propio, más x-default (el mercado por defecto).
 * `path` es la ruta con query actual ("/productos/x"). Es lo que permite a buscadores servir cada país en su idioma.
 */
export function hreflangLinks(markets: MarketInfo[], path: string, defaultMarket: string, protocol = 'https'): { hrefLang: string; href: string }[] {
  const links = markets
    .filter((m) => m.host)
    .map((m) => ({ hrefLang: m.locale, href: `${protocol}://${m.host}${path}` }))
  const fallback = markets.find((m) => m.code === defaultMarket && m.host)
  if (fallback) links.push({ hrefLang: 'x-default', href: `${protocol}://${fallback.host}${path}` })
  return links
}
