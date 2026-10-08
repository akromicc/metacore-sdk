// @vitest-environment happy-dom
//
// Registro de widgets de campo: un host enchufa `widget: "<nombre>"` en
// DynamicForm y en el diálogo de registro (EditField / ReadonlyEditField).
// Sin registro, el render por `type` queda intacto.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'

// Referencia ESTABLE: un `t` nuevo por render provoca un bucle de render.
const i18nMock = { t: (k: string, o?: any) => o?.defaultValue ?? k, i18n: { language: 'es' } }
vi.mock('react-i18next', () => ({
    useTranslation: () => i18nMock,
}))

import { DynamicForm } from '../dynamic-form'
import { EditField, ReadonlyEditField } from '../dialogs/dynamic-record'
import {
    registerFieldWidget,
    getFieldWidget,
    clearFieldWidgets,
    listFieldWidgets,
    type FieldWidgetProps,
} from '../field-widget-registry'

afterEach(() => {
    cleanup()
    clearFieldWidgets()
})

function PinWidget({ field, value, onChange, disabled, error, record }: FieldWidgetProps) {
    return (
        <div data-testid="pin" data-disabled={String(!!disabled)} data-record={record?.name ?? ''}>
            <span data-testid="pin-value">{String(value ?? '')}</span>
            <span data-testid="pin-key">{field.key}</span>
            {error && <span data-testid="pin-error">{error}</span>}
            <button type="button" onClick={() => onChange('19.43,-99.13')}>
                fijar
            </button>
        </div>
    )
}

const pinField = { key: 'location', label: 'Ubicación', type: 'text', widget: 'map-pin' }

describe('field widget registry', () => {
    it('registra, resuelve y el disposer lo quita', () => {
        const dispose = registerFieldWidget('map-pin', PinWidget)
        expect(getFieldWidget('map-pin')).toBe(PinWidget)
        expect(listFieldWidgets()).toEqual(['map-pin'])
        dispose()
        expect(getFieldWidget('map-pin')).toBeUndefined()
    })

    it('un disposer viejo no quita un reemplazo posterior', () => {
        const Other = () => null
        const first = registerFieldWidget('map-pin', PinWidget)
        registerFieldWidget('map-pin', Other)
        first()
        expect(getFieldWidget('map-pin')).toBe(Other)
    })

    it('nombres desconocidos o vacíos no rompen', () => {
        expect(getFieldWidget('nope')).toBeUndefined()
        expect(getFieldWidget(undefined)).toBeUndefined()
        expect(getFieldWidget('')).toBeUndefined()
    })
})

describe('DynamicForm con widget registrado', () => {
    it('renderiza el widget y propaga onChange al payload', async () => {
        registerFieldWidget('map-pin', PinWidget)
        const onSubmit = vi.fn()
        render(
            <DynamicForm
                fields={[pinField as any]}
                initialValues={{ location: 'a' }}
                onSubmit={onSubmit}
            />,
        )
        expect(screen.getByTestId('pin-value').textContent).toBe('a')
        fireEvent.click(screen.getByText('fijar'))
        expect(screen.getByTestId('pin-value').textContent).toBe('19.43,-99.13')
        await act(async () => {
            screen.getByText('Guardar').click()
        })
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ location: '19.43,-99.13' })
    })

    it('sin registro conserva el render por type', () => {
        render(<DynamicForm fields={[pinField as any]} initialValues={{ location: 'a' }} onSubmit={vi.fn()} />)
        expect(screen.queryByTestId('pin')).toBeNull()
        expect(document.querySelector('input#location')).not.toBeNull()
    })

    it('registrar después del primer render re-renderiza el campo', () => {
        render(<DynamicForm fields={[pinField as any]} initialValues={{ location: 'a' }} onSubmit={vi.fn()} />)
        expect(screen.queryByTestId('pin')).toBeNull()
        act(() => {
            registerFieldWidget('map-pin', PinWidget)
        })
        expect(screen.getByTestId('pin')).toBeTruthy()
    })

    it('tras el disposer vuelve al render por type', () => {
        const dispose = registerFieldWidget('map-pin', PinWidget)
        render(<DynamicForm fields={[pinField as any]} initialValues={{ location: 'a' }} onSubmit={vi.fn()} />)
        expect(screen.getByTestId('pin')).toBeTruthy()
        act(() => dispose())
        expect(screen.queryByTestId('pin')).toBeNull()
        expect(document.querySelector('input#location')).not.toBeNull()
    })
})

describe('diálogo de registro (EditField)', () => {
    it('renderiza el widget con value/record/error y propaga onChange', () => {
        registerFieldWidget('map-pin', PinWidget)
        const onChange = vi.fn()
        render(
            <EditField
                field={pinField as any}
                value="x"
                onChange={onChange}
                record={{ name: 'Clínica' }}
                error="Requerido"
            />,
        )
        expect(screen.getByTestId('pin-value').textContent).toBe('x')
        expect(screen.getByTestId('pin').getAttribute('data-record')).toBe('Clínica')
        expect(screen.getByTestId('pin-error').textContent).toBe('Requerido')
        fireEvent.click(screen.getByText('fijar'))
        expect(onChange).toHaveBeenCalledWith('19.43,-99.13')
    })

    it('sin registro conserva el input por type', () => {
        render(<EditField field={pinField as any} value="x" onChange={vi.fn()} />)
        expect(screen.queryByTestId('pin')).toBeNull()
        expect(document.querySelector('input')).not.toBeNull()
    })

    it('campo readonly: el widget llega deshabilitado', () => {
        registerFieldWidget('map-pin', PinWidget)
        render(<ReadonlyEditField field={pinField as any} value="x" />)
        expect(screen.getByTestId('pin').getAttribute('data-disabled')).toBe('true')
    })
})
