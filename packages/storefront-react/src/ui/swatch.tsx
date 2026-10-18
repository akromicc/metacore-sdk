import type { CSSProperties } from 'react'
import { luminance, resolveSwatchSpec, swatchBackground, type SwatchSpec } from './swatch-colors'

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
  const colors = resolved.colors
  if (!colors) {
    // Emoji: la forma la pone el sistema; solo se centra en una baldosa neutra del tamaño de las muestras de color.
    // Mezcla ("🍓🍦"): la muestra se ensancha a una píldora y cada emoji se achica para que sigan leyéndose juntos.
    const count = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(resolved.emoji)].length
    return (
      <span
        aria-hidden="true"
        data-swatch=""
        data-kind="emoji"
        data-shape={shape}
        className={className || undefined}
        style={{ minWidth: size, height: size, fontSize: Math.round(size * (count > 1 ? 0.6 : 0.78)) }}
      >
        {resolved.emoji}
      </span>
    )
  }
  const lums = colors.map(luminance)
  const edge = lums.some((l) => l > 0.82) ? 'light' : lums.some((l) => l < 0.04) ? 'dark' : undefined
  const style: CSSProperties = { width: size, height: size, background: swatchBackground(colors) }
  return (
    <span
      aria-hidden="true"
      data-swatch=""
      data-edge={edge}
      data-shape={shape}
      className={className || undefined}
      style={style}
    />
  )
}
