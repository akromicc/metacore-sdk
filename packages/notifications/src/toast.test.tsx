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

  describe('multi-line bodies', () => {
    const bodyEl = (c: HTMLElement) =>
      Array.from(c.querySelectorAll('span.text-xs')).find((n) =>
        n.className.includes('text-muted-foreground'),
      ) as HTMLElement

    it('one-line body keeps line-clamp-2 and no pre-line', () => {
      for (const richText of [true, false]) {
        const { container } = renderToast({ title: 'T', body: 'una sola línea', richText })
        const el = bodyEl(container)
        expect(el.className).toContain('line-clamp-2')
        expect(el.className).not.toContain('whitespace-pre-line')
        expect(el.className).not.toContain('line-clamp-6')
        cleanup()
        vi.restoreAllMocks()
      }
    })

    it('3-line body gets pre-line + line-clamp-6 in plain and HTML', () => {
      for (const richText of [true, false]) {
        const { container } = renderToast({ title: 'T', body: 'a\nb\nc', richText })
        const el = bodyEl(container)
        expect(el.className).toContain('whitespace-pre-line')
        expect(el.className).toContain('line-clamp-6')
        expect(el.className).not.toContain('line-clamp-2')
        expect(el.textContent).toBe('a\nb\nc')
        cleanup()
        vi.restoreAllMocks()
      }
    })

    it('hostile multi-line HTML stays neutralized', () => {
      const { container } = renderToast({
        title: 'T',
        body: '<img src=x onerror=alert(1)>\n<b/onclick=alert(2)>x',
      })
      expect(container.querySelector('img')).toBeNull()
      const all = Array.from(container.querySelectorAll('*'))
      for (const n of all) {
        expect(n.getAttributeNames().some((a) => a.startsWith('on'))).toBe(false)
      }
      expect(bodyEl(container).className).toContain('whitespace-pre-line')
    })

    it('escapes < and & from server text', () => {
      const { container } = renderToast({ title: 'T', body: 'a < b & c\nlinea 2' })
      const el = bodyEl(container)
      expect(el.innerHTML).toContain('&lt;')
      expect(el.innerHTML).toContain('&amp;')
      expect(el.textContent).toBe('a < b & c\nlinea 2')
    })
  })
})
