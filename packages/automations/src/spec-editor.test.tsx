// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpecEditor } from './spec-editor'
import { makeT } from './messages'
import type { AutomationCatalog } from './types'

afterEach(cleanup)

const schema = {
  properties: { name: { type: 'string', maxLength: 120 }, description: { type: 'string' } },
  $defs: {
    trigger: {
      properties: { type: { enum: ['cron', 'interval', 'once', 'event'] }, cron: { type: 'string' }, timezone: { type: 'string' }, every: { type: 'string' }, at: { type: 'string' }, event: { type: 'string' }, cooldown: { type: 'string' } },
      allOf: [{ if: { properties: { type: { const: 'cron' } } }, then: { required: ['cron'] } }],
    },
    step: {
      properties: {
        type: { enum: ['tool', 'filter', 'condition', 'template', 'summarize', 'deliver'] },
        tool: { type: 'string' }, from: { type: 'string' }, unseen: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 50 },
        template: { type: 'string' }, mode: { enum: ['template', 'llm'] }, instructions: { type: 'string' },
        channels: { type: 'array', items: { enum: ['in_app', 'push', 'email', 'whatsapp'] } },
        title: { type: 'string' }, body: { type: 'string' }, link: { type: 'string' }, items_from: { type: 'string' },
      },
      allOf: [{ if: { properties: { type: { const: 'deliver' } } }, then: { required: ['channels', 'title'] } }],
    },
    condition: { properties: { field: { type: 'string' }, op: { enum: ['eq', 'gt'] }, value: {} } },
  },
}

const catalog: AutomationCatalog = {
  tools: [{ name: 'buscar_hallazgos', title: 'Buscar hallazgos', description: '', parameters: { territorio: { type: 'string', description: 'Municipio' }, limite: { type: 'integer' } } }],
  schema,
  channels: ['in_app', 'push'],
  timezone: 'America/Mexico_City',
  min_interval: '15m0s',
  max_per_user: 20,
  llm_available: false,
}

describe('SpecEditor', () => {
  it('generates the form from the schema and submits a valid spec', () => {
    const onSubmit = vi.fn()
    render(<SpecEditor catalog={catalog} t={makeT()} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Recordatorio' } })
    // Channels are limited to what the host can deliver (no email/whatsapp here).
    expect(screen.queryByLabelText('WhatsApp')).toBeNull()
    fireEvent.click(screen.getByLabelText('Push'))
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Llamar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const [spec, kind] = onSubmit.mock.calls[0]!
    expect(kind).toBe('automation')
    expect(spec).toMatchObject({ schema_version: 'automation/v1', name: 'Recordatorio', trigger: { type: 'cron', cron: '0 7 * * *' } })
    expect(spec.steps[0]).toMatchObject({ type: 'deliver', channels: ['in_app', 'push'], title: 'Llamar' })
  })

  it('renders tool arguments from the catalog parameters', () => {
    render(<SpecEditor catalog={catalog} t={makeT()} onSubmit={() => {}} onCancel={() => {}}
      initial={{ schema_version: 'automation/v1', name: 'x', trigger: { type: 'cron', cron: '0 7 * * *' }, steps: [{ id: 'buscar', type: 'tool', tool: 'buscar_hallazgos', args: {} }] }} />)
    expect(screen.getByLabelText(/territorio — Municipio/)).toBeTruthy()
    expect((screen.getByLabelText(/^limite/) as HTMLInputElement).type).toBe('number')
  })
})
