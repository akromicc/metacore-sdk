// @vitest-environment happy-dom
//
// IconPickerField `iconOnly`: hides the "Imagen" tab; stored value is always a
// lucide name; a pre-existing url/path is preserved until cleared/replaced.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'

vi.mock('../upload-field', () => ({
    UploadField: () => <div data-testid="upload-field" />,
}))

import { IconPickerField } from '../icon-picker-field'
import type { ActionFieldDef } from '../types'

afterEach(cleanup)

const field: ActionFieldDef = { key: 'icon', label: 'Ícono', type: 'text', widget: 'icon' }

describe('IconPickerField iconOnly', () => {
    it('por defecto sigue mostrando la pestaña Imagen', () => {
        render(<IconPickerField field={field} value="" onChange={() => {}} />)
        expect(screen.getByRole('tab', { name: 'Imagen' })).toBeTruthy()
    })

    it.each([
        ['prop', { iconOnly: true }, field],
        ['field.iconOnly', {}, { ...field, iconOnly: true }],
        ['field.icon_only', {}, { ...field, icon_only: true }],
    ])('oculta la pestaña Imagen (%s) y guarda el nombre Lucide', (_n, props, f) => {
        const onChange = vi.fn()
        render(<IconPickerField field={f as ActionFieldDef} value="" onChange={onChange} {...props} />)
        expect(screen.queryByRole('tab')).toBeNull()
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.change(screen.getByLabelText('Buscar ícono'), { target: { value: 'credit' } })
        fireEvent.click(screen.getByRole('option', { name: 'CreditCard' }))
        expect(onChange).toHaveBeenCalledWith('CreditCard')
        expect(screen.queryByTestId('upload-field')).toBeNull()
    })

    it('un valor URL existente no se corrompe: se muestra y solo cambia al quitar', () => {
        const onChange = vi.fn()
        render(<IconPickerField field={field} iconOnly value="/uploads/logo.png" onChange={onChange} />)
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByTestId('icon-legacy-value').textContent).toContain('/uploads/logo.png')
        expect(screen.queryByTestId('upload-field')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
        expect(onChange).toHaveBeenCalledWith('')
    })
})
