import { isSafeCssValue } from '../theme.js'

/** CSS custom properties (set by the shop in its stylesheet) -> provider widget variables. */
export const PAYMENT_THEME_TOKENS = {
  '--sf-pay-text': 'textPrimaryColor',
  '--sf-pay-text-muted': 'textSecondaryColor',
  '--sf-pay-background': 'formBackgroundColor',
  '--sf-pay-input-background': 'inputBackgroundColor',
  '--sf-pay-primary': 'baseColor',
  '--sf-pay-primary-contrast': 'buttonTextColor',
  '--sf-pay-error': 'errorColor',
  '--sf-pay-success': 'successColor',
  '--sf-pay-outline': 'outlinePrimaryColor',
  '--sf-pay-radius': 'borderRadiusMedium',
} as const

/**
 * Reads the `--sf-pay-*` tokens from an element's computed style, so the provider form follows the shop's
 * theme without the shop copying colors into JavaScript. Unsafe or empty values are skipped.
 */
export function readPaymentTheme(el: Element | null | undefined, tokens: Record<string, string> = PAYMENT_THEME_TOKENS): Record<string, string> {
  const out: Record<string, string> = {}
  if (!el || typeof getComputedStyle !== 'function') return out
  const style = getComputedStyle(el)
  for (const [cssVar, key] of Object.entries(tokens)) {
    const value = style.getPropertyValue(cssVar).trim()
    if (value && isSafeCssValue(value)) out[key] = value
  }
  return out
}
