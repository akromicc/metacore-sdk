import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  formatAvailabilityMessage,
  formatMoney,
  promoProgressView,
  promotionMessages,
  rewardLabel,
  type CartPromotions,
  type CartRecommendation,
  type Money,
  type PromotionMessages,
} from '@asteby/storefront'
import { useModalDialog, type DialogCloseReason } from '../dialog.js'
import { useResolvedLocale } from '../locale.js'
import { PromoProgressBar } from './cart-progress-bars.js'

export type CrossSellAddResult = void | { ok?: boolean; error?: 'sold_out' | 'failed' }

export type CrossSellModalProps = {
  open: boolean
  /** `Cart.promotions` of the CURRENT cart; after an add, pass the new cart's and the modal updates. */
  promotions: CartPromotions | null | undefined
  recommendations: CartRecommendation[]
  /** Total saved so far, from the server (`cart.cost.discount`). */
  totalSaved: Money
  /**
   * The shop adds the variant (server action / fetcher) and then re-renders with the new `promotions` and
   * `recommendations`. Return `{ error: 'sold_out' }` for a 409 so the card tells the buyer to pick another flavor.
   */
  onAdd: (input: { productId: string; variantId: string; recommendation: CartRecommendation }) => Promise<CrossSellAddResult> | CrossSellAddResult
  /** "Continuar al pago". The shop navigates to payment. */
  onContinue: () => void
  /** "Continuar sin agregar", X, Esc or backdrop. The shop marks the modal as seen and navigates to payment. */
  onSkip: (reason: 'skip' | 'esc' | 'x' | 'backdrop') => void
  locale?: string
  messages?: Partial<PromotionMessages>
  /** Renders a card image (use your `Image`). Default: a lazy `<img>` of the featured image. */
  renderImage?: (rec: CartRecommendation) => ReactNode
  className?: string
}

/**
 * Pre-payment upsell modal ("Completa tu compra y desbloquea más").
 *
 * Mechanism only: the shop decides when to open it (once per cart, JS only) and what "continue" means.
 * Every number comes from the server: remaining amount, rewards, progress, total saved, and the
 * "Desbloquea tu 5 %" tag (`unlocks`). Add errors stay on their card; the rest stays usable.
 * Accessible: native dialog, labelled title, focus starts on the title (not on a buy button), Esc = skip,
 * `role="progressbar"` with spoken remaining amount, level changes announced via `aria-live`.
 */
export function CrossSellModal(props: CrossSellModalProps) {
  const { open, promotions, recommendations, totalSaved, onAdd, onContinue, onSkip, messages, renderImage, className } = props
  const locale = useResolvedLocale(props.locale)
  const m = promotionMessages(locale, messages)
  const titleId = useId()
  const descId = useId()
  const view = useMemo(() => promoProgressView(promotions, locale, messages).discount, [promotions, locale, messages])
  const { ref, onBackdropClick } = useModalDialog({ open, onClose: (r: DialogCloseReason) => onSkip(r === 'esc' ? 'esc' : r === 'x' ? 'x' : 'backdrop') })
  const nextTier = promotions?.next_tier ?? null
  const max = !!promotions && !nextTier && !!promotions.applied

  if (!open) return null

  const f = formatAvailabilityMessage
  return (
    <dialog ref={ref} className={className} aria-labelledby={titleId} aria-describedby={descId} onClick={onBackdropClick} data-sf-crosssell>
      <div data-sf-crosssell-body>
        <button type="button" onClick={() => onSkip('x')} aria-label={m['popup.close']} data-sf-crosssell-close style={{ minWidth: 44, minHeight: 44 }}>
          <span aria-hidden="true">×</span>
        </button>
        <p data-sf-crosssell-eyebrow>{m['upsell.subtitle']}</p>
        <h2 id={titleId} tabIndex={-1} data-sf-autofocus>
          {m['upsell.title']}
        </h2>

        <section id={descId} data-sf-crosssell-level aria-live="polite">
          {nextTier ? (
            <>
              <p data-sf-crosssell-next>{m['upsell.next_level']}</p>
              <p>
                <strong>{f(m['upsell.you_miss'], { remaining: formatMoney(nextTier.remaining, locale, { withoutTrailingZeros: true }) })}</strong>
              </p>
              <p>{f(m['upsell.unlocks_reward'], { reward: rewardLabel(nextTier.reward, locale, messages) })}</p>
            </>
          ) : max && promotions?.applied ? (
            <p data-sf-crosssell-best>{f(m['upsell.best'], { reward: rewardLabel(promotions.applied.reward, locale, messages) })}</p>
          ) : null}
          {promotions?.applied && nextTier && <p data-sf-crosssell-unlocked>{f(m['upsell.unlocked'], { reward: rewardLabel(promotions.applied.reward, locale, messages) })}</p>}
        </section>

        <dl data-sf-crosssell-summary>
          <div>
            <dt>{m['upsell.total_saved']}</dt>
            <dd>{formatMoney(totalSaved, locale, { withoutTrailingZeros: true })}</dd>
          </div>
          <div>
            <dt>{m['upsell.current_benefit']}</dt>
            <dd>{rewardLabel(promotions?.applied?.reward ?? { kind: 'percent', percent: '0' }, locale, messages)}</dd>
          </div>
          <div>
            <dt>{m['upsell.status']}</dt>
            <dd>{promotions?.applied ? m['upsell.status_active'] : m['upsell.status_pending']}</dd>
          </div>
        </dl>

        {view && <PromoProgressBar kind="discount" state={view.state} text={view.text} percent={view.percent} label={m['bar.discount']} milestones={view.tiers} />}
        {nextTier && (
          <p data-sf-crosssell-next-reward>
            {f(m['upsell.next_reward'], {
              reward: rewardLabel(nextTier.reward, locale, messages),
              threshold: formatMoney(nextTier.threshold, locale, { withoutTrailingZeros: true }),
            })}
          </p>
        )}

        {!max && recommendations.length > 0 && (
          <section aria-label={m['upsell.suggestions']}>
            <h3>{m['upsell.suggestions']}</h3>
            <ul data-sf-crosssell-cards>
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.product.id} rec={rec} onAdd={onAdd} locale={locale} messages={messages} {...(renderImage ? { renderImage } : {})} />
              ))}
            </ul>
          </section>
        )}

        <p data-sf-crosssell-footer>{m['upsell.footer']}</p>
        <div data-sf-crosssell-actions>
          <button type="button" onClick={() => onSkip('skip')} style={{ minHeight: 44 }} data-sf-crosssell-skip>
            {m['upsell.skip']}
          </button>
          <button type="button" onClick={onContinue} style={{ minHeight: 44 }} data-sf-crosssell-continue>
            {m['upsell.continue']} →
          </button>
        </div>
      </div>
    </dialog>
  )
}

function RecommendationCard({
  rec,
  onAdd,
  locale,
  messages,
  renderImage,
}: {
  rec: CartRecommendation
  onAdd: CrossSellModalProps['onAdd']
  locale?: string | undefined
  messages?: Partial<PromotionMessages> | undefined
  renderImage?: (rec: CartRecommendation) => ReactNode
}) {
  const m = promotionMessages(locale, messages)
  const selectId = useId()
  const [variantId, setVariantId] = useState(rec.variants.some((v) => v.id === rec.default_variant_id) ? rec.default_variant_id : (rec.variants[0]?.id ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const variant = rec.variants.find((v) => v.id === variantId) ?? rec.variants[0]
  const image = rec.product.featured_image

  // Variants refreshed by the server: keep the selection valid.
  if (variant && variant.id !== variantId) setVariantId(variant.id)
  if (!variant) return null

  async function add() {
    if (inFlight.current || !variant) return // double click: one add
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const r = await onAdd({ productId: rec.product.id, variantId: variant.id, recommendation: rec })
      if (r && (r.ok === false || r.error)) setError(r.error === 'sold_out' ? m['upsell.sold_out'] : m['upsell.error'])
    } catch {
      setError(m['upsell.error'])
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <li data-sf-crosssell-card>
      {renderImage ? renderImage(rec) : image ? <img src={image.url} alt={image.alt ?? rec.product.title} width={160} loading="lazy" decoding="async" /> : null}
      {rec.unlocks && <p data-sf-crosssell-unlocks>{formatAvailabilityMessage(m['upsell.unlocks_badge'], { reward: rewardLabel(rec.unlocks.reward, locale, messages) })}</p>}
      <p data-sf-crosssell-name>{rec.product.title}</p>
      <p data-sf-crosssell-price>{formatMoney(variant.price, locale, { withoutTrailingZeros: true })}</p>
      {rec.variants.length > 1 && (
        <>
          <label htmlFor={selectId}>{m['upsell.flavor']}</label>
          <select id={selectId} value={variant.id} onChange={(e) => setVariantId(e.target.value)} style={{ minHeight: 44 }}>
            {rec.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </>
      )}
      <button type="button" onClick={() => void add()} aria-busy={busy} aria-disabled={busy} style={{ minHeight: 44 }} data-sf-crosssell-add>
        {busy ? m['upsell.adding'] : m['upsell.add']}
      </button>
      {error && (
        <p role="alert" data-sf-crosssell-error>
          {error}
        </p>
      )}
    </li>
  )
}
