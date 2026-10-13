// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GenerativeUI } from './generative-ui'

afterEach(cleanup)

describe('GenerativeUI', () => {
  it('renders text as text, never as HTML', () => {
    const { container } = render(<GenerativeUI spec={{ version: 'genui/v1', blocks: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy()
  })

  it('renders nothing (or the fallback) for an invalid spec', () => {
    const { container } = render(<GenerativeUI spec={{ version: 'genui/v1', blocks: [{ type: 'iframe' }] }} fallback={<span>inválido</span>} />)
    expect(container.textContent).toBe('inválido')
  })

  it('hands declared actions with params and input values to the host', async () => {
    const onAction = vi.fn()
    render(
      <GenerativeUI
        onAction={onAction}
        spec={{
          version: 'genui/v1',
          blocks: [{
            type: 'confirm', title: '¿Activar?',
            inputs: [{ name: 'hora', label: 'Hora', kind: 'time', value: '07:00' }],
            actions: [{ id: 'automations.confirm', label: 'Confirmar', variant: 'primary', params: { id: 'abc' } }],
          }],
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(onAction).toHaveBeenCalledWith({ id: 'automations.confirm', params: { id: 'abc' }, values: { hora: '08:30' } }))
  })

  it('opens external links safely and internal ones through the router', () => {
    const onNavigate = vi.fn()
    render(
      <GenerativeUI
        onNavigate={onNavigate}
        spec={{ version: 'genui/v1', blocks: [{ type: 'links', items: [{ title: 'Nota', url: 'https://ejemplo.mx' }, { title: 'Hallazgo', url: '/m/findings/1' }] }] }}
      />,
    )
    const ext = screen.getByText('Nota').closest('a')!
    expect(ext.getAttribute('rel')).toContain('noopener')
    expect(ext.getAttribute('target')).toBe('_blank')
    fireEvent.click(screen.getByText('Hallazgo'))
    expect(onNavigate).toHaveBeenCalledWith('/m/findings/1')
  })
})
