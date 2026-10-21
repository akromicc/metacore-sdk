import { describe, expect, it } from 'vitest'
import {
  humanizeModuleKey,
  moduleLabelFromMeta,
  registerModuleLabel,
  registerModuleLabels,
  resolveAvatarChoice,
} from './visual'

describe('moduleLabelFromMeta: el origen es el nombre traducido del addon', () => {
  it('usa metadata.addon_name del servidor en vez de humanizar la clave', () => {
    // Antes: "Channel Orders" (la clave humanizada) en una UI en español.
    expect(moduleLabelFromMeta({ addon_key: 'channel_orders', addon_name: 'Pedidos de canal' })).toBe(
      'Pedidos de canal',
    )
  })

  it('el nombre registrado por el host (idioma del visor) gana a addon_name y sirve a avisos ya guardados', () => {
    registerModuleLabels({ stored_before_fix: 'Tienda en línea', ignored: undefined })
    expect(moduleLabelFromMeta({ addon_key: 'stored_before_fix' })).toBe('Tienda en línea')
    expect(moduleLabelFromMeta({ addon_key: 'stored_before_fix', addon_name: 'Online Shop' })).toBe(
      'Tienda en línea',
    )
  })

  it('apartado y module explícitos mandan sobre todo', () => {
    registerModuleLabel('whatsapp_x', 'Registrado')
    expect(moduleLabelFromMeta({ addon_key: 'whatsapp_x', apartado: 'WhatsApp' })).toBe('WhatsApp')
    expect(moduleLabelFromMeta({ addon_key: 'whatsapp_x', module: 'Mensajes' })).toBe('Mensajes')
  })

  it('sin nombre conocido cae a la clave humanizada, nunca a la cruda', () => {
    expect(moduleLabelFromMeta({ addon_key: 'unknown_addon_key' })).toBe('Unknown Addon Key')
    expect(moduleLabelFromMeta({ addon_key: 'some-pos_terminal' })).toBe('Some POS Terminal')
  })

  it('los nombres integrados antiguos solo son respaldo', () => {
    expect(moduleLabelFromMeta({ addon_key: 'warehouse' })).toBe('Almacén')
    expect(moduleLabelFromMeta({ addon_key: 'warehouse', addon_name: 'Warehouse' })).toBe('Warehouse')
  })

  it('sin clave ni nombre no hay chip', () => {
    expect(moduleLabelFromMeta({})).toBe('')
  })
})

describe('humanizeModuleKey', () => {
  it('title-case con acrónimos', () => {
    expect(humanizeModuleKey('channel_orders')).toBe('Channel Orders')
    expect(humanizeModuleKey('pos')).toBe('POS')
    expect(humanizeModuleKey('fiscal_mexico')).toBe('Fiscal Mexico')
  })
})

describe('resolveAvatarChoice priority', () => {
  const cases: Array<[string, Parameters<typeof resolveAvatarChoice>[0], unknown]> = [
    ['image beats everything', { image: '/i.png', icon: 'bell', actor: { name: 'A B' }, user: { avatar: '/u.png' } }, { kind: 'image', src: '/i.png' }],
    ['icon beats user avatar and initials', { icon: 'bell', user: { name: 'Usuario Nombre', avatar: '/u.png' } }, { kind: 'icon' }],
    ['metadata.color (object) counts as explicit icon', { metadata: { color: '#f00' }, user: { name: 'Usuario Nombre' } }, { kind: 'icon' }],
    ['metadata.color (JSON string) counts as explicit icon', { metadata: '{"color":"#f00"}', user: { name: 'Usuario Nombre' } }, { kind: 'icon' }],
    ['blank icon/colour is not explicit', { icon: '  ', metadata: { color: ' ' }, user: { name: 'Usuario Nombre' } }, { kind: 'initials', initials: 'UN' }],
    ['actor avatar beats user avatar', { actor: { avatar: '/a.png' }, user: { avatar: '/u.png' } }, { kind: 'image', src: '/a.png' }],
    ['user avatar beats initials', { user: { name: 'Ana Pérez', avatar: '/u.png' } }, { kind: 'image', src: '/u.png' }],
    ['actor initials beat user initials', { actor: { name: 'Ana Pérez' }, user: { name: 'Usuario Nombre' } }, { kind: 'initials', initials: 'AP' }],
    ['empty actor falls back to user', { actor: {}, user: { name: 'Ana Pérez' } }, { kind: 'initials', initials: 'AP' }],
    ['user initials', { user: { name: 'Ana Pérez' } }, { kind: 'initials', initials: 'AP' }],
    ['nothing: type icon', {}, { kind: 'icon' }],
  ]
  it.each(cases)('%s', (_n, input, expected) => {
    expect(resolveAvatarChoice(input)).toEqual(expected)
  })

  it('a failed image falls through to the next level', () => {
    expect(resolveAvatarChoice({ image: '/i.png', icon: 'bell' }, true)).toEqual({ kind: 'icon' })
    expect(resolveAvatarChoice({ image: '/i.png', user: { name: 'Ana Pérez' } }, true)).toEqual({ kind: 'initials', initials: 'AP' })
  })

  it('applies resolveImageUrl', () => {
    expect(resolveAvatarChoice({ image: 'x.png' }, false, (s) => `/cdn/${s}`)).toEqual({ kind: 'image', src: '/cdn/x.png' })
  })
})
