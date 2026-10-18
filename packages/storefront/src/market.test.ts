import { describe, expect, it } from 'vitest'
import { hreflangLinks, negotiateLocale, preferredLanguages, suggestMarket, visitorCountry, type MarketInfo } from './market'

const MX: MarketInfo = { code: 'mx', countries: ['MX'], locale: 'es-MX', currency: 'MXN', host: 'godsnutrition.com.mx' }
const US: MarketInfo = { code: 'us', countries: ['US'], locale: 'en-US', currency: 'USD', host: 'godsnutrition.com' }
const h = (init: Record<string, string>) => new Headers(init)

describe('visitorCountry', () => {
  it('lee la cabecera del CDN en mayúsculas', () => {
    expect(visitorCountry(h({ 'cf-ipcountry': 'us' }))).toBe('US')
    expect(visitorCountry(h({ 'x-vercel-ip-country': 'MX' }))).toBe('MX')
  })
  it('ignora desconocido, Tor, basura y proxies no confiables', () => {
    expect(visitorCountry(h({ 'cf-ipcountry': 'XX' }))).toBeNull()
    expect(visitorCountry(h({ 'cf-ipcountry': 'T1' }))).toBeNull()
    expect(visitorCountry(h({ 'cf-ipcountry': 'USA' }))).toBeNull()
    expect(visitorCountry(h({ 'cf-ipcountry': 'US' }), { trustProxy: false })).toBeNull()
  })
})

describe('idiomas', () => {
  it('ordena por q y respeta el orden de empate', () => {
    expect(preferredLanguages('es-MX;q=0.5, en-US, fr;q=0.8, *;q=0.1')).toEqual(['en-us', 'fr', 'es-mx'])
    expect(preferredLanguages('en;q=0')).toEqual([])
  })
  it('negocia exacto, luego idioma base, luego respaldo', () => {
    expect(negotiateLocale('en-US,en;q=0.9', ['es-MX', 'en-US'], 'es-MX')).toBe('en-US')
    expect(negotiateLocale('en-GB', ['es-MX', 'en-US'], 'es-MX')).toBe('en-US')
    expect(negotiateLocale('fr-FR', ['es-MX', 'en-US'], 'es-MX')).toBe('es-MX')
    expect(negotiateLocale(null, ['es-MX'], 'es-MX')).toBe('es-MX')
  })
})

describe('suggestMarket', () => {
  const base = { markets: [MX, US], current: 'mx' }
  it('país del CDN en otro mercado: sugiere', () => {
    expect(suggestMarket({ ...base, headers: h({ 'cf-ipcountry': 'US' }) })).toEqual({ market: US, reason: 'country' })
  })
  it('país del mercado actual, o sin mercado para ese país: no sugiere', () => {
    expect(suggestMarket({ ...base, headers: h({ 'cf-ipcountry': 'MX' }) })).toBeNull()
    expect(suggestMarket({ ...base, headers: h({ 'cf-ipcountry': 'BR' }) })).toBeNull()
  })
  it('el país manda sobre el idioma', () => {
    expect(suggestMarket({ ...base, headers: h({ 'cf-ipcountry': 'MX', 'accept-language': 'en-US' }) })).toBeNull()
  })
  it('sin país usa la región del idioma, como pista débil', () => {
    expect(suggestMarket({ ...base, headers: h({ 'accept-language': 'en-US,en;q=0.9' }) })).toEqual({ market: US, reason: 'language' })
    expect(suggestMarket({ ...base, headers: h({ 'accept-language': 'en' }) })).toBeNull()
  })
  it('nunca a rastreadores ni a quien ya eligió; ni con un solo mercado', () => {
    expect(suggestMarket({ ...base, headers: h({ 'cf-ipcountry': 'US', 'user-agent': 'Googlebot/2.1' }) })).toBeNull()
    expect(suggestMarket({ ...base, chosen: 'mx', headers: h({ 'cf-ipcountry': 'US' }) })).toBeNull()
    expect(suggestMarket({ markets: [MX], current: 'mx', headers: h({ 'cf-ipcountry': 'US' }) })).toBeNull()
  })
})

describe('hreflangLinks', () => {
  it('un alterno por mercado con dominio y x-default', () => {
    expect(hreflangLinks([MX, US], '/productos/whey', 'mx')).toEqual([
      { hrefLang: 'es-MX', href: 'https://godsnutrition.com.mx/productos/whey' },
      { hrefLang: 'en-US', href: 'https://godsnutrition.com/productos/whey' },
      { hrefLang: 'x-default', href: 'https://godsnutrition.com.mx/productos/whey' },
    ])
  })
  it('sin dominios no inventa enlaces', () => {
    expect(hreflangLinks([{ ...MX, host: undefined }], '/', 'mx')).toEqual([])
  })
})
