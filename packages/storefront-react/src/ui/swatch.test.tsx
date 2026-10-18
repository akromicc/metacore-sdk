import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { optionHasSwatches, parseSwatchAttribute, resolveSwatch, resolveSwatchSpec, swatchBackground } from './swatch-colors'
import { Swatch } from './swatch'

describe('resolveSwatch', () => {
  it('resuelve colores simples, con acentos y mayúsculas', () => {
    expect(resolveSwatch('ROJO')).toEqual(['#e0262d'])
    expect(resolveSwatch('Café')).toEqual(['#7a4a2b'])
  })
  it('la frase más larga gana: "azul marino" no es "azul"', () => {
    expect(resolveSwatch('Azul marino')).toEqual(['#14213d'])
  })
  it('combinaciones por separador, en orden de lectura', () => {
    expect(resolveSwatch('Rojo / Negro')).toEqual(['#e0262d', '#111111'])
    expect(resolveSwatch('Blanco y azul')).toEqual(['#ffffff', '#2f5bea'])
    expect(resolveSwatch('Gris - Verde')).toEqual(['#9aa0a8', '#2fa84f'])
  })
  it('sabores, también combinados', () => {
    expect(resolveSwatch('Mora Azul')).toEqual(['#3d4fd6'])
    expect(resolveSwatch('FRESA KIWI')).toEqual(['#ff4d6d', '#8bc34a'])
    expect(resolveSwatch('Manzana Verde')).toEqual(['#7cc242'])
  })
  it('acepta hex y limita a 4 colores', () => {
    expect(resolveSwatch('#ff8800')).toEqual(['#ff8800'])
    expect(resolveSwatch('rojo / azul / verde / negro / blanco')).toHaveLength(4)
  })
  it('null si no reconoce nada', () => {
    expect(resolveSwatch('Talla M')).toBeNull()
    expect(resolveSwatch('')).toBeNull()
  })
  it('optionHasSwatches exige que todos los valores tengan color', () => {
    expect(optionHasSwatches(['Rojo', 'Negro', 'Rojo / Blanco'])).toBe(true)
    expect(optionHasSwatches(['Rojo', 'XL'])).toBe(false)
    expect(optionHasSwatches(['Rojo', 'XL'], parseSwatchAttribute('XL:🧢'))).toBe(true)
  })
})

describe('swatchBackground', () => {
  it('liso, mitades y sectores', () => {
    expect(swatchBackground(['#111111'])).toBe('#111111')
    expect(swatchBackground(['#111111', '#ffffff'])).toBe('linear-gradient(90deg, #111111 50%, #ffffff 50%)')
    expect(swatchBackground(['#1', '#2', '#3'])).toContain('conic-gradient(#1 0deg 120deg, #2 120deg 240deg, #3 240deg 360deg)')
  })
})

describe('<Swatch>', () => {
  it('es decorativa, plana y marca el aro solo donde hace falta', () => {
    const white = renderToString(<Swatch value="Blanco" />)
    expect(white).toContain('aria-hidden="true"')
    expect(white).toContain('data-edge="light"')
    expect(renderToString(<Swatch value="Negro" />)).toContain('data-edge="dark"')
    expect(renderToString(<Swatch value="Rojo" />)).not.toContain('data-edge')
    expect(renderToString(<Swatch value="Rojo" />)).not.toContain('box-shadow')
  })
  it('no pinta nada si no reconoce el color y respeta colores explícitos', () => {
    expect(renderToString(<Swatch value="Talla M" />)).toBe('')
    expect(renderToString(<Swatch value="Talla M" spec={{ colors: ['#ff0000'] }} />)).toContain('#ff0000')
  })
})

describe('atributo del catálogo: color o emoji', () => {
  const attr = parseSwatchAttribute('Mora Azul:#3d4fd6|Fresa Kiwi:#ff4d6d+#8bc34a|Natural:🥛|Roto:nada')
  it('lee hex, combinaciones y emojis; ignora lo inválido', () => {
    expect(attr.get('mora azul')).toEqual({ colors: ['#3d4fd6'] })
    expect(attr.get('fresa kiwi')).toEqual({ colors: ['#ff4d6d', '#8bc34a'] })
    expect(attr.get('natural')).toEqual({ emoji: '🥛' })
    expect(attr.has('roto')).toBe(false)
    expect(parseSwatchAttribute(undefined).size).toBe(0)
  })
  it('el catálogo manda sobre el nombre; sin dato, el nombre', () => {
    expect(resolveSwatchSpec('NATURAL', attr)).toEqual({ emoji: '🥛' })
    expect(resolveSwatchSpec('Rojo', attr)).toEqual({ colors: ['#e0262d'] })
    expect(resolveSwatchSpec('Talla M', attr)).toBeNull()
  })
  it('<Swatch> dibuja el emoji en su baldosa', () => {
    const html = renderToString(<Swatch spec={{ emoji: '🍓' }} />)
    expect(html).toContain('data-kind="emoji"')
    expect(html).toContain('🍓')
    expect(html).toContain('aria-hidden="true"')
  })
})
