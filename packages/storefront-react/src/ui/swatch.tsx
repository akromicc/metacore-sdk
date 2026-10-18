import type { CSSProperties } from 'react'
import { luminance, pastelBackground, resolveSwatchSpec, swatchBackground, type SwatchSpec } from './swatch-colors'

export type SwatchProps = {
  /** Nombre de la variante; se resuelve con los colores básicos del SDK. Para vocabulario propio resuelve tú con `createSwatchResolver` y pasa `spec`. */
  value?: string
  /** Lo que se dibuja (color(es) o emoji), ya resuelto: del catálogo (`parseSwatchAttribute`) o de tu `createSwatchResolver`. Manda sobre `value`. */
  spec?: SwatchSpec | null
  size?: number
  shape?: 'circle' | 'square'
  className?: string
}

/**
 * Muestra de color 2D para variantes: plana, sin sombras ni brillos y sin borde, salvo un aro mínimo cuando el color
 * se perdería contra el fondo (blanco en tema claro, negro en tema oscuro). Las combinaciones se dibujan en partes iguales.
 * Es decorativa (aria-hidden): el nombre de la variante debe ir siempre como texto junto a ella.
 * Con `spec.emoji` dibuja el emoji. Devuelve null si no reconoce nada, para que el llamador muestre solo el texto.
 */
export function Swatch({ value = '', spec, size = 20, shape = 'circle', className = '' }: SwatchProps) {
  const resolved = spec ?? resolveSwatchSpec(value)
  if (!resolved) return null
  const colors = resolved.colors ?? []
  if (resolved.emoji) {
    // Badge: círculo (un emoji) o píldora (mezcla) con fondo pastel de los colores del sabor y el emoji encima; sin colores, fondo
    // neutro de superficie. En la mezcla los emoji se montan un poco, el primero arriba. Así se ve qué emoji forman cada grupo.
    const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(resolved.emoji)].map((g) => g.segment)
    const mixed = parts.length > 1
    const style: CSSProperties = {
      minWidth: size,
      height: size,
      fontSize: Math.round(size * (mixed ? 0.56 : 0.6)),
      ...(colors.length > 0 ? { background: pastelBackground(colors), ['--sw-ring' as string]: colors[0] } : {}),
    }
    return (
      <span aria-hidden="true" data-swatch="" data-kind="emoji" data-mixed={mixed || undefined} data-colored={colors.length > 0 || undefined} data-shape={shape} className={className || undefined} style={style}>
        {parts.map((emoji, i) => (
          <span key={`${emoji}-${i}`} style={i > 0 ? { marginInlineStart: '-0.3em', zIndex: parts.length - i } : { zIndex: parts.length }}>
            {emoji}
          </span>
        ))}
      </span>
    )
  }
  if (colors.length === 0) return null
  const lums = colors.map(luminance)
  const edge = lums.some((l) => l > 0.82) ? 'light' : lums.some((l) => l < 0.04) ? 'dark' : undefined
  const style: CSSProperties = { width: size, height: size, background: swatchBackground(colors) }
  return <span aria-hidden="true" data-swatch="" data-edge={edge} data-shape={shape} className={className || undefined} style={style} />
}
