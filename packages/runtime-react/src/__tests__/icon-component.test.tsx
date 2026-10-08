// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => () => {} }))
const I18N = { t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'es' } }
vi.mock('react-i18next', () => ({ useTranslation: () => I18N }))

import { Icon, DynamicIcon } from '../dynamic-icon'
import { registerIconResolver, resolveIconSpec } from '../icon-resolvers'
import { DynamicTable } from '../dynamic-table'
import { ApiProvider, type ApiClient } from '../api-context'
import { useMetadataCache } from '../metadata-cache'
import type { TableMetadata } from '../types'

afterEach(cleanup)

describe('registerIconResolver', () => {
    it('el resolutor del host gana a los built-ins y el disposer lo retira', () => {
        const dispose = registerIconResolver((s) => (s === 'fas fa-brain' ? { kind: 'emoji', value: '🧠' } : null))
        expect(resolveIconSpec('fas fa-brain')).toEqual({ kind: 'emoji', value: '🧠' })
        expect(resolveIconSpec('fas fa-bone')).toEqual({ kind: 'lucide', name: 'Bone' })
        dispose()
        expect(resolveIconSpec('fas fa-brain')).toEqual({ kind: 'lucide', name: 'Brain' })
    })

    it('el más reciente tiene prioridad; null cede al siguiente', () => {
        const a = registerIconResolver(() => ({ kind: 'emoji', value: 'A' }))
        const b = registerIconResolver((s) => (s === 'x' ? { kind: 'emoji', value: 'B' } : null))
        expect(resolveIconSpec('x')).toEqual({ kind: 'emoji', value: 'B' })
        expect(resolveIconSpec('y')).toEqual({ kind: 'emoji', value: 'A' })
        b()
        expect(resolveIconSpec('x')).toEqual({ kind: 'emoji', value: 'A' })
        a()
    })

    it('un resolutor que lanza se ignora; un ReactNode se renderiza tal cual', () => {
        const a = registerIconResolver(() => {
            throw new Error('boom')
        })
        const b = registerIconResolver((s) => (s === 'sprite:x' ? <svg data-testid="sprite" /> : null))
        expect(resolveIconSpec('Brain')).toEqual({ kind: 'lucide', name: 'Brain' })
        render(<Icon name="sprite:x" />)
        expect(screen.getByTestId('sprite')).toBeTruthy()
        a()
        b()
    })
})

describe('Icon', () => {
    it('lucide: svg, decorativo por defecto', async () => {
        const { container } = render(<Icon name="fas fa-brain" className="h-4" />)
        await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
        expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    })

    it('label vuelve el icono accesible', async () => {
        const { container } = render(<Icon name="Brain" label="Cerebro" />)
        await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
        expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Cerebro')
    })

    it('emoji: span aria-hidden', () => {
        const { container } = render(<Icon name="🩺" className="x" />)
        const span = container.querySelector('span')!
        expect(span.textContent).toBe('🩺')
        expect(span.getAttribute('aria-hidden')).toBe('true')
    })

    it('image: img lazy con alt vacío y se oculta si falla', () => {
        const { container } = render(<Icon name="https://x.test/a.png" className="h-5" />)
        const img = container.querySelector('img')!
        expect(img.getAttribute('src')).toBe('https://x.test/a.png')
        expect(img.getAttribute('alt')).toBe('')
        expect(img.getAttribute('loading')).toBe('lazy')
        expect(img.getAttribute('decoding')).toBe('async')
        fireEvent.error(img)
        expect(container.querySelector('img')).toBeNull()
    })

    it('image: resolveImageSrc transforma la ruta', () => {
        const { container } = render(<Icon name="/u/a.png" resolveImageSrc={(s) => `/api${s}`} />)
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/u/a.png')
    })

    it('unknown: nunca texto crudo; fallback opcional', () => {
        const a = render(<Icon name="algo raro" />)
        expect(a.container.textContent).toBe('')
        a.unmount()
        const b = render(<Icon name="javascript:alert(1)" fallback={<i data-testid="fb" />} />)
        expect(screen.getByTestId('fb')).toBeTruthy()
        expect(b.container.querySelector('img')).toBeNull()
    })

    it('DynamicIcon conserva su contrato con nombres Lucide', async () => {
        const { container } = render(<DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />)
        expect(container.firstElementChild?.getAttribute('class')).toContain('mr-2 h-4 w-4')
        await waitFor(() => expect(container.querySelector('svg:not([data-glyph-pending])')).toBeTruthy())
    })
})

describe('DynamicTable columna type "icon"', () => {
    const metaIcon: TableMetadata = {
        title: 'Specialties',
        endpoint: '/data/specialty',
        columns: [
            { key: 'name', label: 'Nombre', type: 'text', sortable: false, filterable: false, searchable: false },
            { key: 'icon', label: 'Icono', type: 'icon', sortable: false, filterable: false, searchable: false },
        ],
        actions: [],
        perPageOptions: [10],
        defaultPerPage: 10,
        searchPlaceholder: 'Buscar...',
        enableCRUDActions: false,
        hasActions: false,
    }
    const rows = [
        { id: 1, name: 'Neurología', icon: 'fas fa-brain' },
        { id: 2, name: 'Raro', icon: 'no se entiende' },
        { id: 3, name: 'Vacio', icon: '' },
    ]
    const api: ApiClient = {
        get: vi.fn(async (url: string) => {
            if (url.startsWith('/metadata/table/')) return { data: { success: true, data: metaIcon } }
            if (url.endsWith('/facets')) return { data: { success: true, data: [] } }
            return { data: { success: true, data: rows, meta: { total: rows.length } } }
        }),
        post: vi.fn(async () => ({ data: { success: true, data: null } })),
        put: vi.fn(async () => ({ data: { success: true, data: null } })),
        delete: vi.fn(async () => ({ data: { success: true, data: null } })),
    }

    it('"fas fa-brain" dibuja un glifo y nunca el texto crudo', async () => {
        useMetadataCache.getState().setMetadata('specialty', metaIcon)
        const { container } = render(
            <ApiProvider client={api}>
                <DynamicTable model="specialty" enableUrlSync={false} />
            </ApiProvider>,
        )
        await waitFor(() => expect(screen.getAllByText('Neurología').length).toBeGreaterThan(0))
        expect(container.textContent).not.toContain('fas fa-brain')
        expect(container.textContent).not.toContain('no se entiende')
        await waitFor(() => expect(container.querySelector('tbody svg.lucide:not([data-glyph-pending])')).toBeTruthy())
    })
})
