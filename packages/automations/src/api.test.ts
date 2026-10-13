import { describe, expect, it, vi } from 'vitest'
import { createAutomationsApi } from './api'
import { automationUIActionHandler } from './ui-actions'

const http = () => ({
  get: vi.fn(async () => ({ data: { success: true, data: [] } })),
  post: vi.fn(async () => ({ data: { success: true, data: { id: 'a1' } } })),
  patch: vi.fn(async () => ({ data: { success: true, data: { id: 'a1' } } })),
  delete: vi.fn(async () => ({ data: { success: true, data: { id: 'a1' } } })),
})

describe('createAutomationsApi', () => {
  it('builds the REST calls', async () => {
    const h = http()
    const api = createAutomationsApi(h, { basePath: '/api/automations/' })
    await api.list({ status: 'active', all: true })
    expect(h.get).toHaveBeenCalledWith('/api/automations?status=active&all=1')
    await api.confirm('x/y')
    expect(h.post).toHaveBeenCalledWith('/api/automations/x%2Fy/confirm')
    await api.run('a1')
    expect(h.post).toHaveBeenLastCalledWith('/api/automations/a1/run', { dry_run: true })
    await api.archive('a1')
    expect(h.delete).toHaveBeenCalledWith('/api/automations/a1')
  })

  it('maps genui actions to the API and ignores foreign ones', async () => {
    const h = http()
    const onDone = vi.fn()
    const handle = automationUIActionHandler(createAutomationsApi(h), { onDone })
    expect(await handle({ id: 'automations.confirm', params: { id: 'a1' }, values: {} })).toBe(true)
    expect(h.post).toHaveBeenCalledWith('/automations/a1/confirm')
    expect(onDone).toHaveBeenCalledWith('a1', 'automations.confirm')
    expect(await handle({ id: 'otra.cosa', params: { id: 'a1' }, values: {} })).toBe(false)
    expect(await handle({ id: 'automations.confirm', params: {}, values: {} })).toBe(false)
  })
})
