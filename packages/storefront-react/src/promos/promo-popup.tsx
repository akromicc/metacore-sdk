import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  formatMoney,
  promotionMessages,
  rewardLabel,
  formatAvailabilityMessage,
  type PromotionAnnouncement,
  type PromotionMessages,
} from '@asteby/storefront'
import { useModalDialog, type DialogCloseReason } from '../dialog.js'
import { useResolvedLocale } from '../locale.js'
import {
  browserSeenStore,
  frequencyAllows,
  isCrawler,
  isExcludedPath,
  memorySeenStore,
  parseSeen,
  PROMO_COOKIE,
  resolveTrigger,
  safeInternalPath,
  scrollDepthPercent,
  serializeSeen,
  withinWindow,
  type PathPattern,
  type PromoFrequency,
  type PromoSeenStore,
  type PromoTrigger,
} from './promo-logic.js'

export type PromoPopupEvent =
  | { type: 'view'; id: string; version: number; via: 'delay' | 'pageviews' | 'scroll' }
  | { type: 'close'; id: string; how: 'esc' | 'x' | 'backdrop' }
  | { type: 'cta'; id: string }

export type PromoPopupProps = {
  /** Content as data from `GET /storefront/promotions`. `null`/absent: nothing happens. Amounts are the engine's. */
  announcement: PromotionAnnouncement | null | undefined
  /** Current path, from the router (so route changes are seen). Default: `location.pathname`. */
  pathname?: string
  /** Paths where the pop-up never appears. Default: cart, payment, thanks, account, auth, legal, editor. */
  excludePaths?: readonly PathPattern[]
  /** Overrides `announcement.frequency` (default `days`). */
  frequency?: PromoFrequency
  /** Window for `days` (default `announcement.frequency_days` or 7). */
  frequencyDays?: number
  /** Overrides `announcement.trigger`. Defaults: 5 s, second page view or 40 % scroll, whichever comes first. */
  trigger?: PromoTrigger
  locale?: string
  messages?: Partial<PromotionMessages>
  /** Where "already seen" is remembered. Default: cookie `sf_promo` (7 days) or sessionStorage for `session`. */
  store?: PromoSeenStore
  /** Analytics hook: view, close (how) and CTA. No personal data. */
  onEvent?: (event: PromoPopupEvent) => void
  /** Renders the CTA (use your router's `Link`). Default: a plain `<a href>`. */
  renderCta?: (props: { href: string; label: string; onClick: () => void; className?: string }) => ReactNode
  /** Test hooks. */
  now?: () => number
  userAgent?: string
  webdriver?: boolean
  className?: string
}

const PAGEVIEW_KEY = 'sf_promo_pv'

/**
 * Entry pop-up mechanism. The CONTENT is data (`announcement`); this component only decides when to show it.
 *
 * - Client only: it renders nothing on the server and on the first client render, so SSR/SEO and hydration
 *   are untouched and the pop-up never delays the LCP.
 * - Shown at most per `frequency` (session / every N days / once per campaign version), never on excluded
 *   paths, to crawlers or outside the campaign dates.
 * - Accessible: native `<dialog>` (focus trap, inert background), Esc, a 44x44 close button, labelled title,
 *   focus returns to where it was, no entry animation (nothing to disable for `prefers-reduced-motion`).
 */
export function PromoPopup(props: PromoPopupProps) {
  const { announcement, messages, onEvent, className } = props
  const locale = useResolvedLocale(props.locale)
  const [open, setOpen] = useState(false)
  const shown = useRef<string | null>(null)
  const titleId = useId()
  const m = useMemo(() => promotionMessages(locale, messages), [locale, messages])
  const storeRef = useRef<PromoSeenStore | null>(props.store ?? null)
  const live = useRef(props)
  live.current = props
  const pathname = props.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const excluded = isExcludedPath(pathname, props.excludePaths)

  const annKey = announcement ? `${announcement.id}:${announcement.version}` : null

  // Session page views: one per path, counted once even if the effect re-runs (StrictMode).
  const views = useRef(0)
  const lastCounted = useRef<string | null>(null)
  useEffect(() => {
    if (lastCounted.current === pathname) return
    lastCounted.current = pathname
    try {
      views.current = Number(sessionStorage.getItem(PAGEVIEW_KEY) ?? '0') + 1
      sessionStorage.setItem(PAGEVIEW_KEY, String(views.current))
    } catch {
      views.current += 1
    }
  }, [pathname])

  useEffect(() => {
    const announcement = live.current.announcement
    if (!announcement || excluded) {
      setOpen(false)
      return
    }
    const now = () => (live.current.now ? live.current.now() : Date.now())
    const ua = live.current.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
    const driver = live.current.webdriver ?? (typeof navigator !== 'undefined' ? (navigator as Navigator & { webdriver?: boolean }).webdriver : false)
    if (isCrawler(ua, driver)) return
    if (!withinWindow(announcement, now())) return
    const frequency = live.current.frequency ?? announcement.frequency ?? 'days'
    const store = (storeRef.current ??= typeof window !== 'undefined' ? browserSeenStore() : memorySeenStore())
    const cookieName = PROMO_COOKIE
    const allowed = () =>
      frequencyAllows({
        id: announcement.id,
        version: announcement.version,
        frequency,
        days: live.current.frequencyDays ?? announcement.frequency_days ?? 7,
        seen: parseSeen(store.get(cookieName)),
        now: now(),
      })
    if (!allowed()) return
    if (shown.current === annKey) return

    const trigger = resolveTrigger({ ...(announcement.trigger ? {
      ...(announcement.trigger.delay_ms !== undefined ? { delayMs: announcement.trigger.delay_ms } : {}),
      ...(announcement.trigger.pageviews !== undefined ? { pageviews: announcement.trigger.pageviews } : {}),
      ...(announcement.trigger.scroll_percent !== undefined ? { scrollPercent: announcement.trigger.scroll_percent } : {}),
    } : {}), ...(live.current.trigger ?? {}) })

    let done = false
    const cleanups: (() => void)[] = []
    const fire = (via: 'delay' | 'pageviews' | 'scroll') => {
      if (done || !allowed()) return
      done = true
      cleanups.forEach((c) => c())
      shown.current = annKey
      store.set(cookieName, serializeSeen({ id: announcement.id, version: announcement.version, at: now() }), frequency === 'session' ? { session: true } : { days: frequency === 'campaign' ? 365 : (live.current.frequencyDays ?? announcement.frequency_days ?? 7) })
      setOpen(true)
      live.current.onEvent?.({ type: 'view', id: announcement.id, version: announcement.version, via })
    }

    if (trigger.pageviews !== false && views.current >= trigger.pageviews) {
      // After the effect flush, never in the first paint.
      const t = setTimeout(() => fire('pageviews'), 0)
      cleanups.push(() => clearTimeout(t))
    }
    if (trigger.delayMs !== false) {
      const t = setTimeout(() => fire('delay'), trigger.delayMs)
      cleanups.push(() => clearTimeout(t))
    }
    if (trigger.scrollPercent !== false && typeof window !== 'undefined') {
      const target = trigger.scrollPercent
      const onScroll = () => {
        const depth = scrollDepthPercent(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)
        if (depth >= target) fire('scroll')
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      cleanups.push(() => window.removeEventListener('scroll', onScroll))
    }
    return () => {
      done = true
      cleanups.forEach((c) => c())
    }
  }, [annKey, excluded])

  const close = (how: DialogCloseReason) => {
    setOpen(false)
    if (announcement && how !== 'action') onEvent?.({ type: 'close', id: announcement.id, how })
  }
  const { ref, onBackdropClick } = useModalDialog({ open, onClose: close })

  if (!announcement || !open || excluded) return null

  const cta = safeInternalPath(announcement.cta_url)
  const ctaLabel = announcement.cta_label
  const limited = !!announcement.ends_at
  let validUntil: string | null = null
  if (announcement.ends_at) {
    try {
      validUntil = formatAvailabilityMessage(m['popup.valid_until'], {
        date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(announcement.ends_at)),
      })
    } catch {
      validUntil = null
    }
  }
  const onCta = () => {
    onEvent?.({ type: 'cta', id: announcement.id })
    setOpen(false)
  }

  return (
    <dialog ref={ref} className={className} aria-labelledby={titleId} data-sf-promo-popup onClick={onBackdropClick}>
      <div data-sf-promo-body>
        <button
          type="button"
          onClick={() => close('x')}
          aria-label={m['popup.close']}
          data-sf-promo-close
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <span aria-hidden="true">×</span>
        </button>
        {limited && <p data-sf-promo-eyebrow>{m['popup.limited_time']}</p>}
        <h2 id={titleId} tabIndex={-1} data-sf-autofocus>
          {announcement.headline}
        </h2>
        {announcement.subheadline && <p>{announcement.subheadline}</p>}
        {announcement.image && <img src={announcement.image.url} alt={announcement.image.alt} loading="lazy" decoding="async" />}
        {(announcement.tiers.length > 0 || announcement.free_shipping_threshold) && (
          <ul data-sf-promo-tiers>
            {announcement.tiers.map((t) => (
              <li key={`${t.threshold.amount}-${rewardLabel(t.reward, locale, messages)}`}>
                {formatAvailabilityMessage(m['popup.discount_tier'], {
                  reward: rewardLabel(t.reward, locale, messages),
                  threshold: formatMoney(t.threshold, locale, { withoutTrailingZeros: true }),
                })}
              </li>
            ))}
            {announcement.free_shipping_threshold && (
              <li>
                {Number.parseFloat(announcement.free_shipping_threshold.amount) === 0
                  ? m['popup.free_shipping_always']
                  : formatAvailabilityMessage(m['popup.free_shipping_min'], {
                      threshold: formatMoney(announcement.free_shipping_threshold, locale, { withoutTrailingZeros: true }),
                    })}
              </li>
            )}
          </ul>
        )}
        {cta && ctaLabel &&
          (props.renderCta ? (
            props.renderCta({ href: cta, label: ctaLabel, onClick: onCta })
          ) : (
            <a href={cta} onClick={onCta} data-sf-promo-cta style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
              {ctaLabel}
            </a>
          ))}
        <p data-sf-promo-legal>
          {announcement.legal_text}
          {validUntil && <> {validUntil}.</>}
        </p>
      </div>
    </dialog>
  )
}
