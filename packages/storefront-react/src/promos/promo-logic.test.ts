import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROMO_TRIGGER,
  frequencyAllows,
  isCrawler,
  isExcludedPath,
  memorySeenStore,
  parseSeen,
  resolveTrigger,
  safeInternalPath,
  scrollDepthPercent,
  serializeSeen,
  stripMarketPrefix,
  withinWindow,
} from './promo-logic.js'

const DAY = 86_400_000

describe('isExcludedPath', () => {
  it.each([
    ['/', false],
    ['/mx', false],
    ['/mx/colecciones/proteinas', false],
    ['/productos/whey', false],
    ['/carrito', true],
    ['/mx/carrito', true],
    ['/MX/Carrito/', true],
    ['/cart', true],
    ['/pagar', true],
    ['/pagar/gracias', true],
    ['/mx/pagar/gracias', true],
    ['/checkout/step', true],
    ['/cuenta/pedidos', true],
    ['/iniciar-sesion', true],
    ['/terminos', true],
    ['/mx/privacidad', true],
    ['/preview/home', true],
    ['/carritos-de-regalo', true], // `*` is a prefix: documented trade-off, shops can pass exact patterns
    ['/carrito?x=1', true],
  ])('%s -> %s', (path, excluded) => expect(isExcludedPath(path)).toBe(excluded))

  it('custom patterns: exact, prefix and regex', () => {
    const p = ['/promo-landing', '/blog/*', /^\/mx\/secreto/]
    expect(isExcludedPath('/promo-landing', p)).toBe(true)
    expect(isExcludedPath('/promo-landing/x', p)).toBe(false)
    expect(isExcludedPath('/blog/post', p)).toBe(true)
    expect(isExcludedPath('/mx/secreto/a', p)).toBe(true)
    expect(isExcludedPath('/carrito', p)).toBe(false) // custom list replaces the defaults
  })
  it.each([
    ['/mx/carrito', '/carrito'],
    ['/en-us/cart', '/cart'],
    ['/mx', '/'],
    ['/carrito', '/carrito'],
    ['/productos', '/productos'],
  ])('stripMarketPrefix(%s) = %s', (a, b) => expect(stripMarketPrefix(a)).toBe(b))
})

describe('isCrawler', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36', false, false],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604.1', false, false],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', false, true],
    ['Mozilla/5.0 AppleWebKit Chrome-Lighthouse', false, true],
    ['HeadlessChrome/120', false, true],
    ['Mozilla/5.0 Chrome/120', true, true],
    ['', false, false],
    [undefined, false, false],
  ])('%s webdriver=%s -> %s', (ua, wd, bot) => expect(isCrawler(ua, wd)).toBe(bot))
})

describe('frequencyAllows', () => {
  const base = { id: 'a1', version: 1, now: 100 * DAY }
  it.each([
    ['never seen', { frequency: 'days' as const, seen: null }, true],
    ['days: 3 days ago', { frequency: 'days' as const, seen: { id: 'a1', version: 1, at: 97 * DAY } }, false],
    ['days: exactly 7 days ago', { frequency: 'days' as const, seen: { id: 'a1', version: 1, at: 93 * DAY } }, true],
    ['days: 8 days ago', { frequency: 'days' as const, seen: { id: 'a1', version: 1, at: 92 * DAY } }, true],
    ['days window 30: 8 days ago', { frequency: 'days' as const, days: 30, seen: { id: 'a1', version: 1, at: 92 * DAY } }, false],
    ['new version shows again', { frequency: 'days' as const, seen: { id: 'a1', version: 0, at: 99 * DAY } }, true],
    ['another announcement shows', { frequency: 'campaign' as const, seen: { id: 'zzz', version: 1, at: 99 * DAY } }, true],
    ['campaign: seen long ago', { frequency: 'campaign' as const, seen: { id: 'a1', version: 1, at: 1 * DAY } }, false],
    ['session: seen', { frequency: 'session' as const, seen: { id: 'a1', version: 1, at: 99 * DAY } }, false],
  ])('%s -> %s', (_n, extra, ok) => expect(frequencyAllows({ ...base, ...extra })).toBe(ok))
})

describe('seen record, window, trigger, scroll, cta', () => {
  it('roundtrips and rejects garbage', () => {
    const r = { id: 'camp:1', version: 3, at: 1234567 }
    expect(parseSeen(serializeSeen(r))).toEqual(r)
    expect(parseSeen('nope')).toBeNull()
    expect(parseSeen(null)).toBeNull()
  })
  it.each([
    [{ starts_at: '2026-10-20T00:00:00Z', ends_at: '2026-10-31T23:59:59Z' }, '2026-10-25T12:00:00Z', true],
    [{ starts_at: '2026-10-20T00:00:00Z', ends_at: '2026-10-31T23:59:59Z' }, '2026-10-19T12:00:00Z', false],
    [{ starts_at: '2026-10-20T00:00:00Z', ends_at: '2026-10-31T23:59:59Z' }, '2026-11-01T00:00:00Z', false],
    [{ ends_at: null }, '2030-01-01T00:00:00Z', true],
    [{ ends_at: 'garbage' }, '2030-01-01T00:00:00Z', true],
  ])('withinWindow %j at %s -> %s', (w, at, ok) => expect(withinWindow(w, Date.parse(at))).toBe(ok))
  it('trigger defaults and overrides', () => {
    expect(resolveTrigger()).toEqual(DEFAULT_PROMO_TRIGGER)
    expect(resolveTrigger({ delayMs: false, scrollPercent: 60 })).toEqual({ delayMs: false, pageviews: 2, scrollPercent: 60 })
  })
  it.each([
    [0, 800, 2000, 0],
    [600, 800, 2000, 50],
    [1200, 800, 2000, 100],
    [5000, 800, 2000, 100],
    [100, 800, 800, 0], // page shorter than the viewport
  ])('scrollDepthPercent(%s,%s,%s) = %s', (y, vh, dh, pct) => expect(scrollDepthPercent(y, vh, dh)).toBe(pct))
  it.each([
    ['/colecciones/whey', '/colecciones/whey'],
    ['//evil.com', null],
    ['https://evil.com', null],
    ['javascript:alert(1)', null],
    ['/a\\b', null],
    [null, null],
    ['', null],
  ])('safeInternalPath(%s)', (h, out) => expect(safeInternalPath(h)).toBe(out))
  it('memory store roundtrips', () => {
    const s = memorySeenStore()
    s.set('k', 'v', {})
    expect(s.get('k')).toBe('v')
    expect(s.get('x')).toBeNull()
  })
})
