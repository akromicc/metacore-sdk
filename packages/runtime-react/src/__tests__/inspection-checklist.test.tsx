// @vitest-environment happy-dom
//
// <InspectionChecklist>: el semáforo de una llanta sale de la profundidad, verde
// limpia la recomendación y la foto se sube por el host (onUpload).
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, o?: any) => o?.defaultValue ?? k,
        i18n: { language: 'es' },
    }),
}))

import { InspectionChecklist } from '../business/inspection-checklist'
import { makeInspectionPoint, type InspectionHeader, type InspectionPoint } from '../business/inspection'

afterEach(cleanup)

function Harness({ initial, onUpload }: { initial: InspectionPoint[]; onUpload?: any }) {
    const [points, setPoints] = useState(initial)
    const [header, setHeader] = useState<InspectionHeader>({ damage_notes: '', odometer_km: null, fuel_level: '' })
    return (
        <>
            <InspectionChecklist points={points} onChange={setPoints} header={header} onHeaderChange={setHeader} onUpload={onUpload} />
            <output data-testid="state">{JSON.stringify({ points, header })}</output>
        </>
    )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}')

describe('InspectionChecklist', () => {
    it('captura la profundidad y pinta el semáforo solo', () => {
        render(<Harness initial={[makeInspectionPoint({ section: 'Llantas', name: 'Llanta FL', kind: 'tread', unit: 'mm' })]} />)
        fireEvent.change(screen.getByLabelText('Llanta FL (mm)'), { target: { value: '1.2' } })
        expect(state().points[0]).toMatchObject({ value: 1.2, status: 'urgent' })
        fireEvent.change(screen.getByLabelText('Llanta FL (mm)'), { target: { value: '6' } })
        expect(state().points[0].status).toBe('ok')
    })

    it('verde limpia la recomendación; amarillo la permite', () => {
        render(
            <Harness
                initial={[makeInspectionPoint({ name: 'Balatas', status: 'attention', recommendation: 'Cambiar', unit_price: 500 })]}
            />,
        )
        expect(screen.getByPlaceholderText('Trabajo recomendado')).toBeTruthy()
        fireEvent.click(screen.getByRole('radio', { name: 'Bien' }))
        expect(state().points[0]).toMatchObject({ status: 'ok', recommendation: '', unit_price: 0 })
        expect(screen.queryByPlaceholderText('Trabajo recomendado')).toBeNull()
    })

    it('captura kilometraje y combustible del encabezado', () => {
        render(<Harness initial={[]} />)
        fireEvent.change(screen.getByLabelText('Kilometraje'), { target: { value: '84210' } })
        fireEvent.click(screen.getByRole('radio', { name: '1/2' }))
        expect(state().header).toMatchObject({ odometer_km: 84210, fuel_level: 'half' })
    })

    it('sube la foto por el host y la cuelga del punto', async () => {
        const onUpload = vi.fn(async () => ({ url: '/storage/public/inspections/a.jpg' }))
        const { container } = render(<Harness initial={[makeInspectionPoint({ name: 'Frenos' })]} onUpload={onUpload} />)
        const input = container.querySelector('input[type=file]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
        await waitFor(() => expect(state().points[0].media).toHaveLength(1))
        expect(state().points[0].media[0]).toMatchObject({ url: '/storage/public/inspections/a.jpg', type: 'photo' })
        expect(onUpload).toHaveBeenCalledTimes(1)
    })
})
