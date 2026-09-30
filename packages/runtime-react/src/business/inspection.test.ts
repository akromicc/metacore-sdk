import { describe, expect, it } from 'vitest'
import {
    makeInspectionPoint,
    parseInspectionPoints,
    recommendationsToLines,
    serializeInspectionPoints,
    summarizeInspection,
    treadStatus,
    validateInspection,
    worstStatus,
} from './inspection'

const pt = (p: Parameters<typeof makeInspectionPoint>[0]) => makeInspectionPoint({ section: 'Llantas', ...p })

describe('inspection · semáforo', () => {
    it('la profundidad de dibujo fija el color con los umbrales dados', () => {
        expect(treadStatus(null)).toBe('pending')
        expect(treadStatus(1.5)).toBe('urgent')
        expect(treadStatus(1.6)).toBe('attention')
        expect(treadStatus(2.9)).toBe('attention')
        expect(treadStatus(3)).toBe('ok')
        expect(treadStatus(4, { urgent: 2, attention: 5 })).toBe('attention')
    })
    it('el peor estado gana: rojo > amarillo > verde > pendiente', () => {
        expect(worstStatus([])).toBe('pending')
        expect(worstStatus([pt({ status: 'ok' }), pt({ status: 'attention' })])).toBe('attention')
        expect(worstStatus([pt({ status: 'urgent' }), pt({ status: 'attention' }), pt({ status: 'ok' })])).toBe('urgent')
    })
    it('resume conteos y total recomendado (solo puntos con recomendación)', () => {
        const s = summarizeInspection([
            pt({ name: 'a', status: 'ok' }),
            pt({ name: 'b', status: 'attention', recommendation: 'Cambiar balatas', quantity: 2, unit_price: 350.5 }),
            pt({ name: 'c', status: 'urgent', notes: 'sin recomendación', unit_price: 999 }),
            pt({ name: 'd' }),
        ])
        expect(s.counts).toEqual({ pending: 1, ok: 1, attention: 1, urgent: 1 })
        expect(s.worst).toBe('urgent')
        expect(s.recommendations).toBe(1)
        expect(s.recommendedTotal).toBe(701)
    })
})

describe('inspection · validación', () => {
    it('un punto en verde no lleva recomendación y no hay medidas negativas', () => {
        const v = validateInspection([
            pt({ name: 'ok', status: 'ok', recommendation: 'algo' }),
            pt({ name: 'mm', kind: 'tread', value: -1, status: 'urgent' }),
        ])
        expect(v.ok).toBe(false)
        expect(v.errors['0.recommendation']).toBeTruthy()
        expect(v.errors['1.value']).toBeTruthy()
    })
    it('exige revisar todo y el kilometraje solo cuando la regla lo pide', () => {
        const points = [pt({ name: 'a', status: 'ok' }), pt({ name: 'b' })]
        expect(validateInspection(points).ok).toBe(true)
        expect(validateInspection(points, undefined, { requireAllReviewed: true }).form).toMatch(/revisar/)
        expect(validateInspection([], { damage_notes: '' }, { requireOdometer: true }).ok).toBe(false)
        expect(validateInspection([], { damage_notes: '', odometer_km: 0 }, { requireOdometer: true }).ok).toBe(true)
    })
    it('una alerta sin nota, recomendación ni foto se marca si la regla lo pide', () => {
        const v = validateInspection([pt({ name: 'a', status: 'urgent' })], undefined, { requireEvidenceOnIssues: true })
        expect(v.errors['0.notes']).toBeTruthy()
        const withPhoto = pt({ name: 'a', status: 'urgent', media: [{ key: 'm', url: '/x.jpg', type: 'photo' }] })
        expect(validateInspection([withPhoto], undefined, { requireEvidenceOnIssues: true }).ok).toBe(true)
    })
})

describe('inspection · serialización', () => {
    it('serializa números reales, line_no 1-based y sin claves de UI', () => {
        const [row] = serializeInspectionPoints([
            pt({
                id: 'abc',
                name: '  Llanta FL ',
                kind: 'tread',
                value: 2.4,
                unit: 'mm',
                status: 'attention',
                recommendation: ' Cambiar ',
                quantity: 1,
                unit_price: 1800,
                media: [{ key: 'k', url: '/u/1.jpg', type: 'photo' }],
            }),
        ])
        expect(row).toMatchObject({
            id: 'abc',
            line_no: 1,
            name: 'Llanta FL',
            measure_value: 2.4,
            unit: 'mm',
            recommendation: 'Cambiar',
            unit_price: 1800,
            media: [{ url: '/u/1.jpg', type: 'photo' }],
        })
        expect(row).not.toHaveProperty('key')
        const [empty] = serializeInspectionPoints([pt({ name: 'x' })])
        expect(empty).not.toHaveProperty('measure_value')
        expect(empty).not.toHaveProperty('id')
    })
    it('parse es la inversa y tolera basura', () => {
        expect(parseInspectionPoints(null)).toEqual([])
        const [p] = parseInspectionPoints([
            { id: 'i', name: 'Frenos', section: 'Frenos', kind: 'measure', status: 'urgent', measure_value: '3.5', unit: 'mm', quantity: '2', unit_price: '10.5', approval: 'declined', media: [{ url: '/v.mp4', type: 'video' }] },
        ])
        expect(p).toMatchObject({ id: 'i', kind: 'measure', status: 'urgent', value: 3.5, quantity: 2, unit_price: 10.5, approval: 'declined' })
        expect(p.media[0]).toMatchObject({ url: '/v.mp4', type: 'video' })
        const [bad] = parseInspectionPoints([{ status: 'rojo', kind: 'raro' }])
        expect(bad.status).toBe('pending')
        expect(bad.kind).toBe('check')
    })
})

describe('inspection · recomendación → renglón', () => {
    it('convierte solo los puntos con recomendación y filtra por respuesta del cliente', () => {
        const points = [
            pt({ name: 'Balatas', recommendation: 'Cambiar', quantity: 2, unit_price: 400, status: 'urgent', approval: 'approved' }),
            pt({ name: 'Aceite', recommendation: 'Cambio', unit_price: 900, status: 'attention', approval: 'declined' }),
            pt({ name: 'Luces', status: 'ok' }),
        ]
        const all = recommendationsToLines(points)
        expect(all.map((l) => l.description)).toEqual(['Balatas — Cambiar', 'Aceite — Cambio'])
        expect(all[0]).toMatchObject({ kind: 'item', quantity: 2, unit_price: 400 })
        expect(recommendationsToLines(points, { approval: ['approved'] })).toHaveLength(1)
        expect(recommendationsToLines(points, { approval: ['declined'] })[0].description).toBe('Aceite — Cambio')
    })
})
