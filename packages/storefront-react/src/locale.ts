import { useOptionalStorefront } from './context.js'

/** Locale of a component: its own prop, else the `StorefrontProvider`'s, else `es-MX`. */
export function useResolvedLocale(locale?: string | null): string {
  const sf = useOptionalStorefront()
  return locale ?? sf?.locale ?? 'es-MX'
}
