import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { promoProgressView, promotionMessages, type CartPromotions, type PromotionMessages } from '@asteby/storefront'
import { prefersReducedMotion } from '../dialog.js'
import { useResolvedLocale } from '../locale.js'

export type ProgressBarProps = {
  /** Visible text (also `aria-valuetext`). */
  text: string
  /** 0-100, from the server. */
  percent: number
  label: string
  showBar?: boolean
  milestones?: { id: string; label: string; threshold: string; reached: boolean; position: number }[]
  state: string
  kind: 'discount' | 'shipping'
  className?: string
}

/**
 * One accessible bar: color is never the only signal (text states the remaining amount; milestones are text).
 * The fill width is the server percentage; the transition is off for `prefers-reduced-motion`.
 */
export function PromoProgressBar({ text, percent, label, showBar = true, milestones, state, kind, className }: ProgressBarProps) {
  const id = useId()
  const [reduced, setReduced] = useState(false)
  useEffect(() => setReduced(prefersReducedMotion()), [])
  const fill: CSSProperties = { width: `${percent}%`, transition: reduced ? 'none' : 'width 600ms ease' }
  return (
    <div className={className} data-sf-promo-bar={kind} data-state={state}>
      <p id={`${id}-t`} aria-live="polite" data-sf-promo-bar-text>
        {text}
      </p>
      {showBar && (
        <div role="progressbar" aria-label={label} aria-describedby={`${id}-t`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={text} data-sf-promo-track>
          <div style={fill} data-sf-promo-fill />
        </div>
      )}
      {showBar && milestones && milestones.length > 0 && (
        <ul data-sf-promo-milestones>
          {milestones.map((t) => (
            <li key={t.id} data-reached={t.reached} style={{ left: `${t.position}%` }}>
              <span>{t.label}</span> <span>{t.threshold}</span>
              {t.reached && <span data-sf-sr-only style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> ✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export type CartProgressBarsProps = {
  /** `Cart.promotions` exactly as the server sent it. */
  promotions: CartPromotions | null | undefined
  locale?: string
  messages?: Partial<PromotionMessages>
  /** Show the tier milestones under the discount bar. Default true. */
  showMilestones?: boolean
  className?: string
}

/**
 * Automatic-discount bar and free-shipping bar of the cart (or drawer). Pure view of `Cart.promotions`:
 * `remaining`, `percent` and `reached` come from OPS; the shop never subtracts or divides.
 * Renders nothing without promotions.
 */
export function CartProgressBars({ promotions, locale: localeProp, messages, showMilestones = true, className }: CartProgressBarsProps) {
  const locale = useResolvedLocale(localeProp)
  const view = useMemo(() => promoProgressView(promotions, locale, messages), [promotions, locale, messages])
  const m = promotionMessages(locale, messages)
  if (!view.discount && !view.shipping) return null
  return (
    <div className={className} data-sf-promo-bars>
      {view.discount && (
        <PromoProgressBar
          kind="discount"
          state={view.discount.state}
          text={view.discount.text}
          percent={view.discount.percent}
          label={m['bar.discount']}
          {...(showMilestones ? { milestones: view.discount.tiers } : {})}
        />
      )}
      {view.shipping && (
        <PromoProgressBar kind="shipping" state={view.shipping.state} text={view.shipping.text} percent={view.shipping.percent} label={m['bar.shipping']} showBar={view.shipping.showBar} />
      )}
    </div>
  )
}
