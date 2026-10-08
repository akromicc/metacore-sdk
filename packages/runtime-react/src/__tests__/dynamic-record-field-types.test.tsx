// @vitest-environment happy-dom
//
// DynamicRecordDialog renderer: password / phone / tel / checkbox / time /
// hidden / multiselect / file used to fall through to a plain text input. Each
// type now renders its proper control and the value reaches onCreate/onUpdate.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'

import { DynamicRecordDialog, dropEmptyPasswords, filterVisibleFields, stripHiddenFieldValues } from '../dialogs/dynamic-record'
import { ApiProvider } from '../api-context'
import { toast } from 'sonner'

afterEach(() => {
    cleanup()
    vi.mocked(toast.error).mockClear()
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// Stable i18n instance (a new one per render would loop the dialog).
const i18n = (() => {
    const inst = i18next.createInstance()
    void inst.init({
        lng: 'es',
        fallbackLng: 'es',
        react: { useSuspense: false },
        resources: { es: { translation: {} } },
    })
    return inst
})()

const api = {
    get: vi.fn(async () => ({ data: { data: {} } })),
    post: vi.fn(async () => ({ data: { data: { url: '/files/logo.pdf' } } })),
    put: async () => ({ data: { success: true } }),
    delete: async () => ({ data: { success: true } }),
} as never

const fields = [
    { key: 'name', label: 'Nombre', type: 'text' },
    { key: 'secret', label: 'Clave', type: 'password' },
    { key: 'phone', label: 'Teléfono', type: 'phone' },
    { key: 'tel2', label: 'Tel2', type: 'tel' },
    { key: 'opens', label: 'Abre', type: 'time' },
    { key: 'active', label: 'Activo', type: 'checkbox' },
    {
        key: 'tags',
        label: 'Etiquetas',
        type: 'multiselect',
        options: [
            { value: 'a', label: 'Alfa' },
            { value: 'b', label: 'Beta' },
        ],
    },
    { key: 'tenant', label: 'Tenant', type: 'hidden', defaultValue: 't-1' },
    { key: 'doc', label: 'Documento', type: 'file' },
] as never[]

function renderDialog(props: Record<string, unknown>) {
    return render(
        <I18nextProvider i18n={i18n}>
            <ApiProvider client={api}>
                <DynamicRecordDialog
                    open
                    onOpenChange={() => {}}
                    model="clinics"
                    schema={{ title: 'Clínica', fields } as never}
                    {...(props as object)}
                />
            </ApiProvider>
        </I18nextProvider>,
    )
}

const inputOf = (label: string) => {
    const el = screen.getByText(label).closest('div')?.parentElement?.querySelector('input')
    if (!el) throw new Error(`no input for ${label}`)
    return el as HTMLInputElement
}

describe('DynamicRecordDialog field types', () => {
    it('renders each type with its control and sends the values on create', async () => {
        const onCreate = vi.fn(async () => undefined)
        renderDialog({ mode: 'create', onCreate })
        await waitFor(() => expect(screen.getByText('Nombre')).toBeTruthy())

        expect(inputOf('Clave').type).toBe('password')
        expect(inputOf('Teléfono').type).toBe('tel')
        expect(inputOf('Tel2').type).toBe('tel')
        expect(inputOf('Abre').type).toBe('time')
        expect(screen.getByRole('checkbox')).toBeTruthy()
        expect(screen.queryByText('Tenant')).toBeNull() // hidden: not rendered
        expect(document.querySelector('input[type="file"]')).toBeTruthy()

        fireEvent.change(inputOf('Clave'), { target: { value: 's3cret' } })
        fireEvent.change(inputOf('Teléfono'), { target: { value: '5551234' } })
        fireEvent.change(inputOf('Abre'), { target: { value: '09:30' } })
        fireEvent.click(screen.getByRole('checkbox'))
        fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

        await waitFor(() => expect(onCreate).toHaveBeenCalled())
        const payload = (onCreate.mock.calls[0] as unknown[])[0] as Record<string, unknown>
        expect(payload.secret).toBe('s3cret')
        expect(payload.phone).toBe('5551234')
        expect(payload.opens).toBe('09:30')
        expect(payload.active).toBe(true)
        expect(payload.tenant).toBe('t-1') // hidden default still in the payload
    })

    it('never prefills a password on edit and does not send it when left empty', async () => {
        const onUpdate = vi.fn(async () => undefined)
        renderDialog({
            mode: 'edit',
            recordId: '1',
            onUpdate,
            initialRecord: {
                id: 1,
                name: 'Clínica',
                secret: '$2a$hash',
                phone: '1',
                tel2: '2',
                opens: '08:00',
                active: true,
                tags: ['a'],
                tenant: 't-9',
                doc: '/f.pdf',
            },
        })
        await waitFor(() => expect(inputOf('Clave').type).toBe('password'))
        expect(inputOf('Clave').value).toBe('')
        expect(document.body.innerHTML).not.toContain('$2a$hash')

        fireEvent.click(screen.getByRole('button', { name: /Guardar|Actualizar/ }))
        await waitFor(() => expect(onUpdate).toHaveBeenCalled())
        const payload = (onUpdate.mock.calls[0] as unknown[])[1] as Record<string, unknown>
        expect('secret' in payload).toBe(false)
        expect(payload.tenant).toBe('t-9')
        expect(payload.tags).toEqual(['a'])
    })

    it('keeps already supported types unchanged (text/boolean)', () => {
        const visible = filterVisibleFields(
            [
                { key: 'a', label: 'A', type: 'text' },
                { key: 'b', label: 'B', type: 'boolean' },
                { key: 'c', label: 'C', type: 'hidden' },
            ] as never[],
            'edit',
        )
        expect(visible.map(f => f.key)).toEqual(['a', 'b'])
    })

    it('dropEmptyPasswords only drops empty password fields', () => {
        const out = dropEmptyPasswords(
            { p: '', q: 'x', name: '' },
            [
                { key: 'p', label: 'P', type: 'password' },
                { key: 'q', label: 'Q', type: 'password' },
                { key: 'name', label: 'N', type: 'text' },
            ] as never[],
        )
        expect(out).toEqual({ q: 'x', name: '' })
    })

    it('edit: an empty required password does not block saving and is not sent', async () => {
        const onUpdate = vi.fn(async () => undefined)
        renderDialog({
            mode: 'edit',
            recordId: '1',
            onUpdate,
            schema: {
                title: 'Clínica',
                fields: [
                    { key: 'name', label: 'Nombre', type: 'text' },
                    { key: 'secret', label: 'Clave', type: 'password', required: true },
                ],
            },
            initialRecord: { id: 1, name: 'Clínica' },
        })
        await waitFor(() => expect(inputOf('Clave').type).toBe('password'))
        fireEvent.click(screen.getByRole('button', { name: /Guardar|Actualizar/ }))
        await waitFor(() => expect(onUpdate).toHaveBeenCalled())
        const payload = (onUpdate.mock.calls[0] as unknown[])[1] as Record<string, unknown>
        expect('secret' in payload).toBe(false)
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('create: a required password is still mandatory', async () => {
        const onCreate = vi.fn(async () => undefined)
        renderDialog({
            mode: 'create',
            onCreate,
            schema: {
                title: 'Clínica',
                fields: [
                    { key: 'name', label: 'Nombre', type: 'text' },
                    { key: 'secret', label: 'Clave', type: 'password', required: true },
                ],
            },
        })
        await waitFor(() => expect(inputOf('Clave').type).toBe('password'))
        fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
        await waitFor(() => expect(toast.error).toHaveBeenCalled())
        expect(onCreate).not.toHaveBeenCalled()
    })

    it('hidden + visible_when: current behaviour is always stripped; plain hidden passes through', () => {
        const flds = [
            { key: 'kind', label: 'K', type: 'text' },
            { key: 'h_when', label: 'H', type: 'hidden', visible_when: { field: 'kind', equals: 'a' } },
            { key: 'h_plain', label: 'P', type: 'hidden' },
        ] as never[]
        for (const kind of ['a', 'b']) {
            const out = stripHiddenFieldValues({ kind, h_when: 'x', h_plain: 'y' }, flds, 'create')
            expect('h_when' in out).toBe(false) // even when the predicate is true
            expect(out.h_plain).toBe('y')
        }
    })
})
