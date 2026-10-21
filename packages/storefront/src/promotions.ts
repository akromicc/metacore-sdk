/**
 * Promotion presentation: turns `Cart.promotions` (computed by OPS) into the
 * labels and bar states a storefront shows. Pure functions, no DOM.
 *
 * The shop never computes a discount here: `remaining`, `percent`, `reached`
 * and `percent_of_max` are the server's. The only arithmetic is clamping a
 * server percentage into 0-100 for `aria-valuenow`.
 */
import { availabilityLocale, formatAvailabilityMessage, type AvailabilityLocale } from './availability.js'
import { formatMoney } from './money.js'
import type { CartPromotions, Money, PromotionReward } from './types.js'

export type PromotionLocale = AvailabilityLocale

export type PromotionMessageKey =
  | 'discount.next'
  | 'discount.next_upgrade'
  | 'discount.applied'
  | 'discount.max'
  | 'discount.suppressed'
  | 'discount.unlocks'
  | 'discount.remaining'
  | 'shipping.progress'
  | 'shipping.reached'
  | 'shipping.always'
  | 'reward.free_shipping'
  | 'bar.discount'
  | 'bar.shipping'
  | 'popup.close'
  | 'popup.valid_until'
  | 'popup.limited_time'
  | 'popup.discount_tier'
  | 'popup.free_shipping_min'
  | 'popup.free_shipping_always'
  | 'upsell.title'
  | 'upsell.subtitle'
  | 'upsell.next_level'
  | 'upsell.you_miss'
  | 'upsell.unlocks_reward'
  | 'upsell.total_saved'
  | 'upsell.current_benefit'
  | 'upsell.status'
  | 'upsell.status_pending'
  | 'upsell.status_active'
  | 'upsell.next_reward'
  | 'upsell.suggestions'
  | 'upsell.add'
  | 'upsell.adding'
  | 'upsell.flavor'
  | 'upsell.unlocks_badge'
  | 'upsell.unlocked'
  | 'upsell.best'
  | 'upsell.skip'
  | 'upsell.continue'
  | 'upsell.footer'
  | 'upsell.sold_out'
  | 'upsell.error'
  | 'note.label'
  | 'note.placeholder'
  | 'note.save'
  | 'note.saving'
  | 'note.saved'
  | 'note.error'
  | 'note.counter'

export type PromotionMessages = Record<PromotionMessageKey, string>

const ES: PromotionMessages = {
  'discount.next': 'Añade {remaining} para activar tu descuento automático',
  'discount.next_upgrade': 'Añade {remaining} para subir a {reward}',
  'discount.applied': '¡Tienes {reward} de descuento!',
  'discount.max': '¡Tienes {reward} de descuento, el máximo!',
  'discount.suppressed': 'Tu código de descuento ya te da un mejor precio.',
  'discount.unlocks': 'Desbloqueas {reward} de descuento',
  'discount.remaining': 'Te faltan {remaining}',
  'shipping.progress': 'Añade {remaining} para envío gratis',
  'shipping.reached': '¡Felicidades! Tienes envío gratis',
  'shipping.always': 'Envío gratis en todo tu pedido',
  'reward.free_shipping': 'Envío gratis',
  'bar.discount': 'Progreso del descuento automático',
  'bar.shipping': 'Progreso del envío gratis',
  'popup.close': 'Cerrar',
  'popup.valid_until': 'Válido hasta el {date}',
  'popup.limited_time': 'Por tiempo limitado',
  'popup.discount_tier': '{reward} comprando {threshold}',
  'popup.free_shipping_min': 'Envío gratis desde {threshold}',
  'popup.free_shipping_always': 'Envíos gratis sin mínimo de compra',
  'upsell.title': 'Completa tu compra y desbloquea más',
  'upsell.subtitle': 'Descuento automático',
  'upsell.next_level': 'Siguiente nivel',
  'upsell.you_miss': 'Te faltan {remaining}',
  'upsell.unlocks_reward': 'Desbloqueas {reward} de descuento',
  'upsell.total_saved': 'Total ahorrado',
  'upsell.current_benefit': 'Beneficio actual',
  'upsell.status': 'Estado',
  'upsell.status_pending': 'Pendiente',
  'upsell.status_active': 'Activo',
  'upsell.next_reward': 'Siguiente recompensa {reward} · {threshold}',
  'upsell.suggestions': 'Suma y desbloquea · Productos que pueden interesarte',
  'upsell.add': 'Agregar y avanzar +',
  'upsell.adding': 'Agregando…',
  'upsell.flavor': 'Sabor',
  'upsell.unlocks_badge': 'Desbloquea tu {reward}',
  'upsell.unlocked': '¡Desbloqueaste {reward}!',
  'upsell.best': 'Tienes el mejor descuento: {reward}',
  'upsell.skip': 'Continuar sin agregar',
  'upsell.continue': 'Continuar al pago',
  'upsell.footer': 'Tu mejor descuento se aplica automáticamente',
  'upsell.sold_out': 'Se agotó este sabor, elige otro.',
  'upsell.error': 'No pudimos agregarlo. Intenta de nuevo.',
  'note.label': 'Añadir nota',
  'note.placeholder': 'Instrucciones para tu pedido',
  'note.save': 'Guardar nota',
  'note.saving': 'Guardando…',
  'note.saved': 'Guardada',
  'note.error': 'No se pudo guardar la nota. Intenta de nuevo.',
  'note.counter': '{n} de {max} caracteres',
}

const EN: PromotionMessages = {
  'discount.next': 'Add {remaining} to unlock your automatic discount',
  'discount.next_upgrade': 'Add {remaining} to move up to {reward}',
  'discount.applied': 'You have {reward} off!',
  'discount.max': 'You have {reward} off, the maximum!',
  'discount.suppressed': 'Your discount code already gives you a better price.',
  'discount.unlocks': 'Unlock {reward} off',
  'discount.remaining': '{remaining} to go',
  'shipping.progress': 'Add {remaining} for free shipping',
  'shipping.reached': 'Congratulations! You get free shipping',
  'shipping.always': 'Free shipping on your whole order',
  'reward.free_shipping': 'Free shipping',
  'bar.discount': 'Automatic discount progress',
  'bar.shipping': 'Free shipping progress',
  'popup.close': 'Close',
  'popup.valid_until': 'Valid until {date}',
  'popup.limited_time': 'Limited time',
  'popup.discount_tier': '{reward} when you spend {threshold}',
  'popup.free_shipping_min': 'Free shipping from {threshold}',
  'popup.free_shipping_always': 'Free shipping, no minimum purchase',
  'upsell.title': 'Complete your purchase and unlock more',
  'upsell.subtitle': 'Automatic discount',
  'upsell.next_level': 'Next level',
  'upsell.you_miss': '{remaining} to go',
  'upsell.unlocks_reward': 'Unlock {reward} off',
  'upsell.total_saved': 'Total saved',
  'upsell.current_benefit': 'Current benefit',
  'upsell.status': 'Status',
  'upsell.status_pending': 'Pending',
  'upsell.status_active': 'Active',
  'upsell.next_reward': 'Next reward {reward} · {threshold}',
  'upsell.suggestions': 'Add and unlock · Products you may like',
  'upsell.add': 'Add and move up +',
  'upsell.adding': 'Adding…',
  'upsell.flavor': 'Flavor',
  'upsell.unlocks_badge': 'Unlocks your {reward}',
  'upsell.unlocked': 'You unlocked {reward}!',
  'upsell.best': 'You have the best discount: {reward}',
  'upsell.skip': 'Continue without adding',
  'upsell.continue': 'Continue to payment',
  'upsell.footer': 'Your best discount is applied automatically',
  'upsell.sold_out': 'This flavor sold out, pick another one.',
  'upsell.error': 'We could not add it. Please try again.',
  'note.label': 'Add a note',
  'note.placeholder': 'Instructions for your order',
  'note.save': 'Save note',
  'note.saving': 'Saving…',
  'note.saved': 'Saved',
  'note.error': 'The note could not be saved. Please try again.',
  'note.counter': '{n} of {max} characters',
}

const CATALOG: Record<PromotionLocale, PromotionMessages> = { es: ES, en: EN }

/** Catalog for a locale with the shop's per-key overrides applied. */
export function promotionMessages(locale: string | null | undefined, overrides?: Partial<PromotionMessages> | null): PromotionMessages {
  const base = CATALOG[availabilityLocale(locale)]
  if (!overrides) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(overrides)) if (typeof v === 'string' && k in base) out[k as PromotionMessageKey] = v
  return out
}

/** Order-note limit enforced by the server (`validateNote`). */
export const NOTE_MAX_LENGTH = 1000

/** Trims and caps a note; empty becomes `null` (the server clears the note). */
export function normalizeNote(note: string | null | undefined): string | null {
  const t = (note ?? '').trim()
  return t ? t.slice(0, NOTE_MAX_LENGTH) : null
}

/** `5 %` / `7.5 %` (es) or `5%` (en) / `$250` / `Envío gratis`. The values are the server's. */
export function rewardLabel(reward: PromotionReward, locale?: string | null, overrides?: Partial<PromotionMessages> | null): string {
  const m = promotionMessages(locale, overrides)
  if (reward.kind === 'free_shipping') return m['reward.free_shipping']
  if (reward.kind === 'fixed') return formatMoney(reward.amount, locale ?? undefined, { withoutTrailingZeros: true })
  const n = Number.parseFloat(reward.percent)
  let num = reward.percent
  try {
    if (Number.isFinite(n)) num = new Intl.NumberFormat(locale ?? undefined, { maximumFractionDigits: 4 }).format(n)
  } catch {
    /* keep the raw text */
  }
  return availabilityLocale(locale) === 'en' ? `${num}%` : `${num} %`
}

/** Display clamp for a server percentage (`aria-valuenow`). Not a calculation. */
export function clampPercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

export type DiscountBarState = 'next' | 'upgrade' | 'max' | 'suppressed'

export type DiscountBarView = {
  state: DiscountBarState
  /** Server progress 0-100. */
  percent: number
  text: string
  /** `aria-valuetext`. */
  valueText: string
  remaining: Money | null
  /** Reward of the next tier (or the applied one at max). */
  rewardText: string | null
  appliedText: string | null
  nextText: string | null
  tiers: { id: string; label: string; threshold: string; reached: boolean; position: number }[]
}

export type ShippingBarState = 'progress' | 'reached' | 'always'

export type ShippingBarView = {
  state: ShippingBarState
  percent: number
  text: string
  valueText: string
  remaining: Money | null
  /** `false` for `always`: there is nothing to fill. */
  showBar: boolean
}

export type PromoProgressView = { discount: DiscountBarView | null; shipping: ShippingBarView | null }

const fmt = (money: Money, locale?: string | null) => formatMoney(money, locale ?? undefined, { withoutTrailingZeros: true })

/**
 * Bars of the cart and the pre-payment modal. Both read the same `Cart.promotions`,
 * so they can never disagree. `null`/absent promotions give `{ discount: null, shipping: null }`.
 */
export function promoProgressView(
  promotions: CartPromotions | null | undefined,
  locale?: string | null,
  overrides?: Partial<PromotionMessages> | null,
): PromoProgressView {
  if (!promotions) return { discount: null, shipping: null }
  const m = promotionMessages(locale, overrides)
  const f = (tpl: string, vars: Record<string, string>) => formatAvailabilityMessage(tpl, vars)

  let discount: DiscountBarView | null = null
  const hasTiers = promotions.tiers.length > 0 || promotions.next_tier !== null || promotions.applied !== null
  if (hasTiers) {
    const next = promotions.next_tier
    const applied = promotions.applied
    const appliedReward = applied ? rewardLabel(applied.reward, locale, overrides) : null
    let state: DiscountBarState
    let text: string
    if (promotions.suppressed?.reason === 'code_better' && !applied) {
      state = 'suppressed'
      text = m['discount.suppressed']
    } else if (!next) {
      state = 'max'
      text = appliedReward ? f(m['discount.max'], { reward: appliedReward }) : m['discount.suppressed']
    } else if (applied) {
      state = 'upgrade'
      text = f(m['discount.next_upgrade'], { remaining: fmt(next.remaining, locale), reward: rewardLabel(next.reward, locale, overrides) })
    } else {
      state = 'next'
      text = f(m['discount.next'], { remaining: fmt(next.remaining, locale) })
    }
    discount = {
      state,
      percent: clampPercent(promotions.percent_of_max),
      text,
      valueText: text,
      remaining: next?.remaining ?? null,
      rewardText: next ? rewardLabel(next.reward, locale, overrides) : appliedReward,
      appliedText: appliedReward ? f(m['discount.applied'], { reward: appliedReward }) : null,
      nextText: next ? f(m['discount.unlocks'], { reward: rewardLabel(next.reward, locale, overrides) }) : null,
      tiers: promotions.tiers.map((t) => ({
        id: t.id,
        label: rewardLabel(t.reward, locale, overrides),
        threshold: fmt(t.threshold, locale),
        reached: t.reached,
        position: clampPercent(t.percent_of_max),
      })),
    }
  }

  let shipping: ShippingBarView | null = null
  const fs = promotions.free_shipping
  if (fs) {
    const noMinimum = Number.parseFloat(fs.threshold.amount) === 0
    if (noMinimum) {
      shipping = { state: 'always', percent: 100, text: m['shipping.always'], valueText: m['shipping.always'], remaining: null, showBar: false }
    } else if (fs.reached) {
      shipping = { state: 'reached', percent: 100, text: m['shipping.reached'], valueText: m['shipping.reached'], remaining: null, showBar: true }
    } else {
      const text = f(m['shipping.progress'], { remaining: fmt(fs.remaining, locale) })
      shipping = { state: 'progress', percent: clampPercent(fs.percent), text, valueText: text, remaining: fs.remaining, showBar: true }
    }
  }
  return { discount, shipping }
}
