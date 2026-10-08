import { describe, expect, it } from 'vitest'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { parseIconSpec } from '../icon-spec'
import { FONT_AWESOME_ALIASES } from '../icon-aliases'

const lucide = (name: string) => ({ kind: 'lucide', name })

describe('parseIconSpec', () => {
    it.each([
        ['CreditCard', 'CreditCard'],
        ['credit-card', 'CreditCard'],
        ['credit_card', 'CreditCard'],
        ['CreditCardIcon', 'CreditCard'],
        ['Building2', 'Building2'],
        ['building-2', 'Building2'],
        ['  brain  ', 'Brain'],
    ])('Lucide %s', (input, name) => {
        expect(parseIconSpec(input)).toEqual(lucide(name))
    })

    it.each([
        // The real ones stored by doctores.lat
        ['fas fa-brain', 'Brain'],
        ['fas fa-female', 'Venus'],
        ['fas fa-bone', 'Bone'],
        ['fas fa-eye', 'Eye'],
        ['fas fa-allergies', 'Flower2'],
        ['fas fa-baby', 'Baby'],
        ['fas fa-user-md', 'Stethoscope'],
        ['fas fa-tooth', 'Toothbrush'],
        // Other FA spellings
        ['fa-solid fa-brain', 'Brain'],
        ['far fa-heart', 'Heart'],
        ['fa fa-user-md', 'Stethoscope'],
        ['fa-brain', 'Brain'],
        ['fa-solid fa-heart-pulse', 'HeartPulse'],
        ['fas fa-heartbeat fa-2x fa-fw', 'HeartPulse'],
        ['fa-regular fa-calendar-check', 'CalendarCheck'],
        ['fal fa-map-marker-alt', 'MapPin'],
    ])('FontAwesome %s', (input, name) => {
        expect(parseIconSpec(input)).toEqual(lucide(name))
    })

    it.each([
        ['mdi mdi-home', 'Home'],
        ['mdi-home', 'Home'],
        ['bi bi-house', 'House'],
        ['ti ti-home', 'Home'],
        ['ri-home-line', 'Home'],
        ['mdi:home', 'Home'],
        ['lucide:brain', 'Brain'],
        ['material-icons home', 'Home'],
    ])('otras librerías %s', (input, name) => {
        expect(parseIconSpec(input)).toEqual(lucide(name))
    })

    it.each(['🩺', '👨‍⚕️', '🇲🇽', '👍🏽', '1️⃣', '❤️'])('emoji %s', (value) => {
        expect(parseIconSpec(value)).toEqual({ kind: 'emoji', value })
    })

    it('dos emojis o emoji con texto no son un emoji', () => {
        expect(parseIconSpec('🩺🩺').kind).toBe('unknown')
        expect(parseIconSpec('🩺 hola').kind).toBe('unknown')
    })

    it.each([
        'https://cdn.example.com/a.png',
        'http://example.com/icon',
        '/uploads/a.png',
        './a.png',
        '../a.svg',
        'uploads/a.webp',
        'data:image/png;base64,iVBORw0KGgo=',
        'data:image/svg+xml;base64,PHN2Zy8+',
        'data:image/jpeg;base64,/9j/4AAQ',
    ])('imagen válida %s', (src) => {
        expect(parseIconSpec(src)).toEqual({ kind: 'image', src })
    })

    it.each([
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'vbscript:x',
        'data:text/html;base64,PHNjcmlwdD4=',
        'data:image/svg+xml;base64,AAA" onerror="x',
        'data:application/javascript,alert(1)',
        'file:///etc/passwd',
        '//evil.example.com/x.png',
        '<svg onload=alert(1)></svg>',
        'blob:https://x/y',
        'https://x.com/a b.png',
    ])('inválido o peligroso %s -> unknown', (raw) => {
        expect(parseIconSpec(raw).kind).toBe('unknown')
    })

    it.each(['', '   ', 'no es un icono', 'fas fa-no-existe-xyz', 'fa-solid', 'Icon', 'texto.largo'])(
        'unknown %j',
        (raw) => {
            expect(parseIconSpec(raw).kind).toBe('unknown')
        },
    )

    it('valores no string', () => {
        expect(parseIconSpec(null)).toEqual({ kind: 'unknown', raw: '' })
        expect(parseIconSpec(undefined)).toEqual({ kind: 'unknown', raw: '' })
        expect(parseIconSpec(42)).toEqual({ kind: 'unknown', raw: '42' })
        expect(parseIconSpec({})).toMatchObject({ kind: 'unknown' })
    })

    it('es determinista', () => {
        expect(parseIconSpec('fas fa-brain')).toEqual(parseIconSpec('fas fa-brain'))
    })
})

describe('FONT_AWESOME_ALIASES', () => {
    it('tiene una tabla amplia', () => {
        expect(Object.keys(FONT_AWESOME_ALIASES).length).toBeGreaterThan(150)
    })

    it('todo alias apunta a un glifo Lucide real', () => {
        const keys = new Set(Object.keys(dynamicIconImports))
        const bad = Object.entries(FONT_AWESOME_ALIASES).filter(([, v]) => !keys.has(v))
        expect(bad).toEqual([])
    })

    it('cada alias resuelve a lucide vía parseIconSpec', () => {
        for (const name of Object.keys(FONT_AWESOME_ALIASES)) {
            expect(parseIconSpec(`fas fa-${name}`).kind, name).toBe('lucide')
        }
    })

    it('cubre los iconos médicos usados por doctores.lat', () => {
        const names = [
            'brain', 'bone', 'eye', 'heart', 'heartbeat', 'stethoscope', 'user-md', 'user-nurse', 'tooth',
            'baby', 'female', 'male', 'venus-mars', 'allergies', 'lungs', 'x-ray', 'pills', 'syringe',
            'hospital', 'ambulance', 'procedures', 'dna', 'microscope', 'notes-medical', 'file-medical',
            'vial', 'thermometer', 'wheelchair', 'diagnoses', 'head-side-virus', 'child', 'clinic-medical',
            'hospital-alt', 'user-doctor', 'map-marker-alt', 'shield-heart', 'hand-sparkles',
        ]
        for (const n of names) expect(parseIconSpec(`fas fa-${n}`).kind, n).toBe('lucide')
    })
})
