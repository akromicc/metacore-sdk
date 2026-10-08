// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { showNotificationToast } from './toast'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderToast(opts: Parameters<typeof showNotificationToast>[0]) {
  const custom = vi.spyOn(toast, 'custom').mockImplementation(() => 'x')
  showNotificationToast(opts)
  const factory = custom.mock.calls[0]![0] as (id: string | number) => ReactElement
  return render(factory('tid'))
}

describe('showNotificationToast body', () => {
  const hostile = '<img src=x onerror=alert(1)>plain <b>b</b>'

  it('sanitizes rich text by default', () => {
    const { container } = renderToast({ title: 'T', body: hostile })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')?.textContent).toBe('b')
  })

  it('richText=false paints plain escaped text', () => {
    const { container } = renderToast({ title: 'T', body: hostile, richText: false })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain(hostile)
  })

  it('delegates the card click to onClick', () => {
    const onClick = vi.fn()
    const { container } = renderToast({ title: 'T', onClick })
    ;(container.querySelector('button') as HTMLButtonElement).click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
