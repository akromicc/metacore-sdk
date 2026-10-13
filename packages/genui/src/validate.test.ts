import { describe, expect, it } from 'vitest'
import { isSafeLink, parseUISpec } from './validate'

const ok = {
  version: 'genui/v1',
  blocks: [
    { type: 'text', text: 'Hola', tone: 'muted' },
    { type: 'kpi', items: [{ label: 'Hallazgos', value: '12', trend: 'up' }] },
    { type: 'card', title: 'Noticias', badges: [{ label: 'Propuesta', tone: 'warning' }], fields: [{ label: 'Cuándo', value: '07:00' }], link: '/automatizaciones' },
    { type: 'table', columns: [{ key: 'n', label: 'Nombre' }], rows: [{ n: 'a' }] },
    { type: 'links', items: [{ title: 'Nota', url: 'https://ejemplo.mx/a' }] },
    { type: 'timeline', items: [{ title: 'Corrida', status: 'completed' }] },
    { type: 'chart', kind: 'bar', x: 'd', series: [{ key: 'n', label: 'N' }], rows: [{ d: 'lun', n: 3 }], summary: '3 el lunes' },
    { type: 'confirm', title: '¿Activar?', actions: [{ id: 'automations.confirm', label: 'Confirmar', variant: 'primary', params: { id: 'x' } }] },
  ],
}

describe('parseUISpec', () => {
  it('accepts the whitelist', () => {
    const r = parseUISpec(ok)
    expect(r.ok).toBe(true)
    expect(parseUISpec(JSON.stringify(ok)).ok).toBe(true)
  })

  it.each([
    ['unknown block', { version: 'genui/v1', blocks: [{ type: 'html', text: '<script>' }] }],
    ['foreign field', { version: 'genui/v1', blocks: [{ type: 'text', text: 'x', actions: [{ id: 'a.b', label: 'x' }] }] }],
    ['javascript link', { version: 'genui/v1', blocks: [{ type: 'links', items: [{ title: 'x', url: 'javascript:alert(1)' }] }] }],
    ['protocol-relative', { version: 'genui/v1', blocks: [{ type: 'card', title: 'x', link: '//evil.com' }] }],
    ['bad action id', { version: 'genui/v1', blocks: [{ type: 'confirm', title: 'x', actions: [{ id: 'https://x', label: 'x' }] }] }],
    ['object param', { version: 'genui/v1', blocks: [{ type: 'confirm', title: 'x', actions: [{ id: 'a.b', label: 'x', params: { p: { q: 1 } } }] }] }],
    ['nested cell', { version: 'genui/v1', blocks: [{ type: 'table', columns: [{ key: 'a', label: 'A' }], rows: [{ a: [1] }] }] }],
    ['chart without summary', { version: 'genui/v1', blocks: [{ type: 'chart', kind: 'bar', x: 'd', series: [{ key: 'n', label: 'N' }] }] }],
    ['wrong version', { version: 'genui/v2', blocks: [{ type: 'text', text: 'x' }] }],
    ['extra top-level', { version: 'genui/v1', blocks: [{ type: 'text', text: 'x' }], script: 'x' }],
    ['no blocks', { version: 'genui/v1', blocks: [] }],
  ])('rejects %s', (_name, spec) => {
    expect(parseUISpec(spec).ok).toBe(false)
  })

  it('checks links', () => {
    expect(isSafeLink('/m/findings/1')).toBe(true)
    expect(isSafeLink('https://a.mx')).toBe(true)
    expect(isSafeLink('mailto:a@b.c')).toBe(false)
    expect(isSafeLink('data:text/html,x')).toBe(false)
  })
})
