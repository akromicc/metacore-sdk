import type { CSSProperties } from 'react'
import { luminance, resolveSwatchSpec, swatchBackground, type SwatchSpec } from './swatch-colors'

export type SwatchProps = {
  /** Nombre de la variante ("Azul marino", "Rojo / Negro", "Fresa Kiwi"). Se resuelve a color solo. */
  value?: string
  /** Lo que el catálogo dice de esta variante (color(es) o emoji). Manda sobre el nombre: ver `parseSwatchAttribute`. */
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
    return (
      <span aria-hidden="true" data-swatch="" data-kind="emoji" data-shape={shape} className={className || undefined} style={{ width: size, height: size, fontSize: Math.round(size * 0.72) }}>
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
