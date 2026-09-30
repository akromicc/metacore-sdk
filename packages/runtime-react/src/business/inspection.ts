// Inspección con checklist (recepción de vehículo, inspección multipunto, OT,
// alineación, garantía): lógica pura del <InspectionChecklist> (benchmark §7,
// TAL-4/TAL-5). El semáforo, el resumen y la salida hacia el backend viven aquí
// para que el componente y los addons (que guardan por una acción) coincidan.
import { makeLine, type LineItem } from './line-items'
import { roundMoney, toAmount } from './format'

/** Semáforo de un punto: pendiente (sin revisar), verde, amarillo, rojo. */
export type InspectionStatus = 'pending' | 'ok' | 'attention' | 'urgent'

/**
 * Qué captura el punto: `check` solo el semáforo; `tread` profundidad de dibujo
 * en mm (el semáforo sale del valor); `measure` un valor numérico libre con su
 * unidad. El nivel de combustible y el kilometraje van en el encabezado.
 */
export type InspectionPointKind = 'check' | 'tread' | 'measure'

export type InspectionMediaType = 'photo' | 'video'

export interface InspectionMedia {
    /** Clave estable de UI. */
    key: string
    url: string
    type: InspectionMediaType
    caption?: string
}

export interface InspectionPoint {
    /** Clave estable de UI (no se envía). */
    key: string
    /** Id de la fila guardada, si ya existe. */
    id?: string
    /** Agrupa los puntos en el checklist («Llantas», «Frenos»...). */
    section: string
    name: string
    kind: InspectionPointKind
    status: InspectionStatus
    /** Valor medido (`tread`/`measure`). */
    value?: number | null
    unit?: string
    notes: string
    /** Trabajo recomendado; con texto, el punto es un renglón candidato. */
    recommendation: string
    quantity: number
    unit_price: number
    media: InspectionMedia[]
    /** Respuesta del cliente a la recomendación, cuando ya la dio. */
    approval?: 'none' | 'pending' | 'approved' | 'declined'
}

export type FuelLevel = 'empty' | 'quarter' | 'half' | 'three_quarters' | 'full'

export const FUEL_LEVELS: readonly FuelLevel[] = ['empty', 'quarter', 'half', 'three_quarters', 'full']

/** Encabezado de una recepción: lo que se ve al recibir el vehículo. */
export interface InspectionHeader {
    odometer_km?: number | null
    fuel_level?: FuelLevel | ''
    /** Daños previos visibles, para deslindar responsabilidad. */
    damage_notes: string
}

/** Umbrales de profundidad de dibujo en mm (el límite legal común es 1.6). */
export interface TreadThresholds {
    /** Por debajo de esto el semáforo es rojo. Default 1.6. */
    urgent: number
    /** Por debajo de esto (y sobre `urgent`) es amarillo. Default 3. */
    attention: number
}

export const DEFAULT_TREAD_THRESHOLDS: TreadThresholds = { urgent: 1.6, attention: 3 }

let seq = 0
export function newInspectionKey(prefix = 'ip'): string {
    seq += 1
    return `${prefix}-${Date.now().toString(36)}-${seq}`
}

export function makeInspectionPoint(partial: Partial<InspectionPoint> = {}): InspectionPoint {
    return {
        key: partial.key ?? newInspectionKey(),
        section: '',
        name: '',
        kind: 'check',
        status: 'pending',
        notes: '',
        recommendation: '',
        quantity: 1,
        unit_price: 0,
        media: [],
        ...partial,
    }
}

/** Semáforo que le toca a una profundidad de dibujo. Sin valor: `pending`. */
export function treadStatus(mm: number | null | undefined, th: TreadThresholds = DEFAULT_TREAD_THRESHOLDS): InspectionStatus {
    if (mm == null || !Number.isFinite(mm)) return 'pending'
    if (mm < th.urgent) return 'urgent'
    if (mm < th.attention) return 'attention'
    return 'ok'
}

const RANK: Record<InspectionStatus, number> = { pending: 0, ok: 1, attention: 2, urgent: 3 }

/** El peor estado de la lista (rojo > amarillo > verde > pendiente). */
export function worstStatus(points: Pick<InspectionPoint, 'status'>[]): InspectionStatus {
    return points.reduce<InspectionStatus>((w, p) => (RANK[p.status] > RANK[w] ? p.status : w), 'pending')
}

/** ¿El punto trae una recomendación que se puede cotizar? */
export function hasRecommendation(p: Pick<InspectionPoint, 'recommendation'>): boolean {
    return p.recommendation.trim() !== ''
}

export interface InspectionSummary {
    total: number
    counts: Record<InspectionStatus, number>
    worst: InspectionStatus
    /** Puntos sin revisar. */
    pending: number
    /** Puntos con recomendación. */
    recommendations: number
    /** Suma cantidad × precio de las recomendaciones. */
    recommendedTotal: number
}

export function summarizeInspection(points: InspectionPoint[]): InspectionSummary {
    const counts: Record<InspectionStatus, number> = { pending: 0, ok: 0, attention: 0, urgent: 0 }
    let recommendations = 0
    let recommendedTotal = 0
    for (const p of points) {
        counts[p.status] += 1
        if (hasRecommendation(p)) {
            recommendations += 1
            recommendedTotal += p.quantity * p.unit_price
        }
    }
    return {
        total: points.length,
        counts,
        worst: worstStatus(points),
        pending: counts.pending,
        recommendations,
        recommendedTotal: roundMoney(recommendedTotal),
    }
}

export interface InspectionValidation {
    ok: boolean
    /** Errores por `"<índice>.<campo>"` (mismo contrato que LineItemsEditor). */
    errors: Record<string, string>
    /** Error de formulario (encabezado o conjunto). */
    form?: string
}

export interface InspectionRules {
    /** Exige revisar todos los puntos (ninguno `pending`). Default false (borrador). */
    requireAllReviewed?: boolean
    /** Exige kilometraje en el encabezado (recepción). Default false. */
    requireOdometer?: boolean
    /** Un punto amarillo/rojo debe llevar nota, recomendación o evidencia. Default false. */
    requireEvidenceOnIssues?: boolean
}

export function validateInspection(
    points: InspectionPoint[],
    header?: InspectionHeader,
    rules: InspectionRules = {},
): InspectionValidation {
    const errors: Record<string, string> = {}
    points.forEach((p, i) => {
        if (p.name.trim() === '') errors[`${i}.name`] = 'Falta el nombre del punto'
        if ((p.kind === 'tread' || p.kind === 'measure') && p.value != null && (!Number.isFinite(p.value) || p.value < 0)) {
            errors[`${i}.value`] = 'La medición no puede ser negativa'
        }
        if (p.quantity < 0 || p.unit_price < 0) errors[`${i}.unit_price`] = 'Cantidad y precio no pueden ser negativos'
        if (hasRecommendation(p) && p.status === 'ok') {
            errors[`${i}.recommendation`] = 'Un punto en verde no lleva recomendación'
        }
        if (
            rules.requireEvidenceOnIssues &&
            (p.status === 'attention' || p.status === 'urgent') &&
            p.notes.trim() === '' &&
            !hasRecommendation(p) &&
            p.media.length === 0
        ) {
            errors[`${i}.notes`] = 'Anota, recomienda o agrega una foto'
        }
    })
    let form: string | undefined
    if (rules.requireAllReviewed && points.some((p) => p.status === 'pending')) {
        form = 'Faltan puntos por revisar'
    }
    if (rules.requireOdometer && header && (header.odometer_km == null || !(header.odometer_km >= 0))) {
        form = form ?? 'Captura el kilometraje'
    }
    return { ok: Object.keys(errors).length === 0 && !form, errors, form }
}

/**
 * Única puerta de salida hacia el backend: números reales, sin claves de UI,
 * opcionales vacíos omitidos y `line_no` 1-based (mismo criterio que
 * `serializeLineItems`).
 */
export function serializeInspectionPoints(points: InspectionPoint[]): Record<string, unknown>[] {
    return points.map((p, i) => {
        const o: Record<string, unknown> = {
            line_no: i + 1,
            section: p.section.trim(),
            name: p.name.trim(),
            kind: p.kind,
            status: p.status,
            notes: p.notes.trim(),
            recommendation: p.recommendation.trim(),
            quantity: toAmount(p.quantity),
            unit_price: toAmount(p.unit_price),
            media: p.media.map((m) => ({ url: m.url, type: m.type, ...(m.caption ? { caption: m.caption } : {}) })),
        }
        if (p.id) o.id = p.id
        if (p.value != null && Number.isFinite(p.value)) o.measure_value = p.value
        if (p.unit) o.unit = p.unit
        return o
    })
}

/** Inversa de `serializeInspectionPoints`: filas del backend a puntos de UI. */
export function parseInspectionPoints(rows: unknown): InspectionPoint[] {
    if (!Array.isArray(rows)) return []
    const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
    return rows.map((r) => {
        const o = (r ?? {}) as Record<string, unknown>
        const status = str(o.status) as InspectionStatus
        const kind = str(o.kind) as InspectionPointKind
        const media = Array.isArray(o.media)
            ? (o.media as Record<string, unknown>[]).map((m) => ({
                  key: newInspectionKey('im'),
                  url: str(m.url),
                  type: (str(m.type) === 'video' ? 'video' : 'photo') as InspectionMediaType,
                  caption: str(m.caption) || undefined,
              }))
            : []
        const value = o.measure_value ?? o.value
        return makeInspectionPoint({
            id: str(o.id) || undefined,
            section: str(o.section),
            name: str(o.name),
            kind: kind === 'tread' || kind === 'measure' ? kind : 'check',
            status: status in RANK ? status : 'pending',
            value: value == null || value === '' ? null : toAmount(value),
            unit: str(o.unit) || undefined,
            notes: str(o.notes),
            recommendation: str(o.recommendation),
            quantity: o.quantity == null ? 1 : toAmount(o.quantity),
            unit_price: toAmount(o.unit_price),
            media,
            approval: ['none', 'pending', 'approved', 'declined'].includes(str(o.approval))
                ? (str(o.approval) as InspectionPoint['approval'])
                : undefined,
        })
    })
}

/**
 * Recomendación → renglón del presupuesto: cada punto con recomendación se
 * vuelve un renglón `item` (descripción «Punto — recomendación»). Se puede
 * filtrar por respuesta del cliente (p. ej. solo las aprobadas).
 */
export function recommendationsToLines(
    points: InspectionPoint[],
    opts: { approval?: InspectionPoint['approval'][] } = {},
): LineItem[] {
    return points
        .filter((p) => hasRecommendation(p) && (!opts.approval || (p.approval != null && opts.approval.includes(p.approval))))
        .map((p) =>
            makeLine({
                description: `${p.name} — ${p.recommendation.trim()}`,
                quantity: p.quantity > 0 ? p.quantity : 1,
                unit_price: p.unit_price,
            }),
        )
}
