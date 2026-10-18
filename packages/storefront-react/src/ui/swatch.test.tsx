import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createSwatchResolver, defaultColors, optionHasSwatches, parseSwatchAttribute, resolveSwatch, resolveSwatchSpec, swatchBackground } from './swatch-colors'
import { Swatch } from './swatch'

describe('colores básicos', () => {
  it('resuelve con acentos, mayúsculas y plurales', () => {
    expect(resolveSwatch('ROJO')).toEqual(['#e0262d'])
    expect(resolveSwatch('Café')).toEqual(['#7a4a2b'])
    expect(resolveSwatch('Negros')).toEqual(['#111111'])
  })
  it('la frase más larga gana: "azul marino" no es "azul"', () => {
    expect(resolveSwatch('Azul marino')).toEqual(['#14213d'])
  })
  it('combinaciones en orden de lectura, con cualquier conector', () => {
    expect(resolveSwatch('Rojo / Negro')).toEqual(['#e0262d', '#111111'])
    expect(resolveSwatch('Blanco y azul')).toEqual(['#ffffff', '#2f5bea'])
    expect(resolveSwatch('Gris - Verde')).toEqual(['#9aa0a8', '#2fa84f'])
    expect(resolveSwatch('Black and White')).toEqual(['#111111', '#ffffff'])
  })
  it('acepta hex y limita a 4 colores', () => {
    expect(resolveSwatch('#ff8800')).toEqual(['#ff8800'])
    expect(resolveSwatch('rojo / azul / verde / negro / blanco')).toHaveLength(4)
  })
  it('null si no reconoce nada; el SDK no trae vocabulario de ningún giro', () => {
    expect(resolveSwatch('Talla M')).toBeNull()
    expect(resolveSwatch('')).toBeNull()
    expect(resolveSwatch('Fresa')).toBeNull()
  })
  it('optionHasSwatches exige que todos los valores tengan muestra', () => {
    expect(optionHasSwatches(['Rojo', 'Negro', 'Rojo / Blanco'])).toBe(true)
    expect(optionHasSwatches(['Rojo', 'XL'])).toBe(false)
    expect(optionHasSwatches(['Rojo', 'XL'], parseSwatchAttribute('XL:🧢'))).toBe(true)
  })
})

describe('createSwatchResolver: el diccionario lo inyecta la tienda', () => {
  const resolver = createSwatchResolver({
    colors: [...defaultColors, ['fresa', '#ff4d6d'], ['crema', '#f4ead2'], ['cookies and cream', ['#3b2a22', '#f4ead2']]],
    emojis: [['cookies and cream', '🍪🥛'], ['fresa', '🍓'], ['crema', '🍦'], ['kiwi', '🥝']],
    prefer: 'emoji',
  })
  it('frases con conector se resuelven como frase', () => {
    expect(resolver.colors('COOKIES AND CREAM')).toEqual(['#3b2a22', '#f4ead2'])
    expect(resolver.emoji('COOKIES AND CREAM')).toBe('🍪🥛')
  })
  it('mezclas llevan varios emoji en orden de lectura, sin repetir y con plurales', () => {
    expect(resolver.emoji('FRESAS CON CREMA')).toBe('🍓🍦')
    expect(resolver.emoji('Fresa Kiwi')).toBe('🍓🥝')
    expect(resolver.emoji('Talla M')).toBeNull()
  })
  it('prefer decide entre emoji y color; el color de ropa sigue sirviendo', () => {
    expect(resolver.resolve('Fresa')).toEqual({ emoji: '🍓' })
    expect(resolver.resolve('Rojo')).toEqual({ colors: ['#e0262d'] })
    expect(createSwatchResolver({ colors: [['fresa', '#ff4d6d']], emojis: [['fresa', '🍓']], prefer: 'color' }).resolve('Fresa')).toEqual({ colors: ['#ff4d6d'] })
  })
  it('el catálogo manda sobre cualquier diccionario', () => {
    const attr = parseSwatchAttribute('Fresa:#aa0000|Natural:🥛')
    expect(resolver.resolve('FRESA', attr)).toEqual({ colors: ['#aa0000'] })
    expect(resolver.resolve('natural', attr)).toEqual({ emoji: '🥛' })
  })
  it('hasSwatches', () => {
    expect(resolver.hasSwatches(['Fresa', 'Kiwi', 'Rojo'])).toBe(true)
    expect(resolver.hasSwatches(['Fresa', 'Talla M'])).toBe(false)
  })
})

describe('atributo del catálogo', () => {
  const attr = parseSwatchAttribute('Mora Azul:#3d4fd6|Fresa Kiwi:#ff4d6d+#8bc34a|Natural:🥛|Roto:nada')
  it('lee hex, combinaciones y emojis; ignora lo inválido', () => {
    expect(attr.get('mora azul')).toEqual({ colors: ['#3d4fd6'] })
    expect(attr.get('fresa kiwi')).toEqual({ colors: ['#ff4d6d', '#8bc34a'] })
    expect(attr.get('natural')).toEqual({ emoji: '🥛' })
    expect(attr.has('roto')).toBe(false)
    expect(parseSwatchAttribute(undefined).size).toBe(0)
  })
  it('resolveSwatchSpec: catálogo primero, luego colores básicos', () => {
    expect(resolveSwatchSpec('NATURAL', attr)).toEqual({ emoji: '🥛' })
    expect(resolveSwatchSpec('Rojo', attr)).toEqual({ colors: ['#e0262d'] })
    expect(resolveSwatchSpec('Talla M', attr)).toBeNull()
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
  it('no pinta nada si no reconoce el color y respeta la muestra ya resuelta', () => {
    expect(renderToString(<Swatch value="Talla M" />)).toBe('')
    expect(renderToString(<Swatch value="Talla M" spec={{ colors: ['#ff0000'] }} />)).toContain('#ff0000')
  })
  it('emoji y mezclas de emoji en su propia baldosa', () => {
    const one = renderToString(<Swatch spec={{ emoji: '🍓' }} />)
    expect(one).toContain('data-kind="emoji"')
    expect(one).toContain('🍓')
    const mix = renderToString(<Swatch spec={{ emoji: '🍓🍦' }} />)
    expect(mix.indexOf('🍓')).toBeGreaterThan(-1)
    expect(mix.indexOf('🍦')).toBeGreaterThan(mix.indexOf('🍓'))
    expect(mix).toContain('margin-inline-start:-0.34em')
  })
})
