// InspectionChecklist — plantilla de puntos con semáforo, medición, fotos/video
// por punto y recomendación → renglón del presupuesto (benchmark §7, TAL-4/5;
// Shopmonkey S39, Tekmetric S36). Controlado: `points` + `onChange`. Sirve a la
// recepción del vehículo (encabezado con km/combustible/daños), a la inspección
// multipunto de la OT, a la hoja de alineación y a la garantía.
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2, Trash2, Video } from 'lucide-react'
import { Badge, Button, Input, Textarea } from '@asteby/metacore-ui'
import { useFormatter } from './format'
import {
    DEFAULT_TREAD_THRESHOLDS,
    FUEL_LEVELS,
    hasRecommendation,
    newInspectionKey,
    summarizeInspection,
    treadStatus,
    validateInspection,
    type FuelLevel,
    type InspectionHeader,
    type InspectionMedia,
    type InspectionPoint,
    type InspectionRules,
    type InspectionStatus,
    type InspectionValidation,
    type TreadThresholds,
} from './inspection'

export interface InspectionUploadResult {
    url: string
    /** Si el host no lo dice, se deduce del archivo. */
    type?: 'photo' | 'video'
}

export interface InspectionChecklistProps {
    points: InspectionPoint[]
    onChange: (points: InspectionPoint[]) => void
    /** Encabezado de recepción (km, combustible, daños). Sin él no se muestra. */
    header?: InspectionHeader
    onHeaderChange?: (header: InspectionHeader) => void
    /**
     * Sube un archivo al almacenamiento del host (el mismo `POST /upload` que
     * usan los campos `upload`) y devuelve su URL. Sin él no hay botón de foto.
     */
    onUpload?: (file: File, point: InspectionPoint | null) => Promise<InspectionUploadResult>
    /** Emite la validación tras cada cambio (para bloquear «Guardar»/«Enviar»). */
    onValidate?: (v: InspectionValidation) => void
    rules?: InspectionRules
    /** Umbrales de profundidad de dibujo (mm). */
    treadThresholds?: TreadThresholds
    /** Errores del servidor `"<índice>.<campo>"`. */
    serverErrors?: Record<string, string>
    /** Muestra la recomendación y su precio. Default true. */
    allowRecommendations?: boolean
    /** Permite agregar/quitar puntos a mano. Default false (los pone la plantilla). */
    allowCustomPoints?: boolean
    /** Solo lectura: sin edición, para revisar una inspección enviada o cerrada. */
    readOnly?: boolean
    currency?: string
    /** Botón «Agregar al presupuesto» sobre las recomendaciones (recibe los puntos). */
    onAddToBudget?: (points: InspectionPoint[]) => void
}

const STATUS_STYLE: Record<InspectionStatus, string> = {
    pending: 'border-border text-muted-foreground',
    ok: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    attention: 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300',
    urgent: 'border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300',
}

const STATUS_DOT: Record<InspectionStatus, string> = {
    pending: 'bg-muted-foreground/40',
    ok: 'bg-emerald-500',
    attention: 'bg-amber-500',
    urgent: 'bg-red-500',
}

const LIGHTS: InspectionStatus[] = ['ok', 'attention', 'urgent']

function statusLabel(t: (k: string, o: { defaultValue: string }) => string, s: InspectionStatus): string {
    switch (s) {
        case 'ok':
            return t('inspection.status.ok', { defaultValue: 'Bien' })
        case 'attention':
            return t('inspection.status.attention', { defaultValue: 'Atención' })
        case 'urgent':
            return t('inspection.status.urgent', { defaultValue: 'Urgente' })
        default:
            return t('inspection.status.pending', { defaultValue: 'Sin revisar' })
    }
}

function fuelLabel(t: (k: string, o: { defaultValue: string }) => string, f: FuelLevel): string {
    switch (f) {
        case 'empty':
            return t('inspection.fuel.empty', { defaultValue: 'Reserva' })
        case 'quarter':
            return t('inspection.fuel.quarter', { defaultValue: '1/4' })
        case 'half':
            return t('inspection.fuel.half', { defaultValue: '1/2' })
        case 'three_quarters':
            return t('inspection.fuel.three_quarters', { defaultValue: '3/4' })
        default:
            return t('inspection.fuel.full', { defaultValue: 'Lleno' })
    }
}

function mediaTypeOf(file: File, hint?: 'photo' | 'video'): 'photo' | 'video' {
    return hint ?? (file.type.startsWith('video/') ? 'video' : 'photo')
}

export function InspectionChecklist({
    points,
    onChange,
    header,
    onHeaderChange,
    onUpload,
    onValidate,
    rules,
    treadThresholds = DEFAULT_TREAD_THRESHOLDS,
    serverErrors,
    allowRecommendations = true,
    allowCustomPoints = false,
    readOnly = false,
    currency,
    onAddToBudget,
}: InspectionChecklistProps) {
    const { t } = useTranslation()
    const fmt = useFormatter({ currency })
    const [uploading, setUploading] = useState<string | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const validation = useMemo(() => validateInspection(points, header, rules), [points, header, rules])
    const errors = { ...validation.errors, ...serverErrors }
    const summary = useMemo(() => summarizeInspection(points), [points])

    const sections = useMemo(() => {
        const order: string[] = []
        const map = new Map<string, number[]>()
        points.forEach((p, i) => {
            const s = p.section || ''
            if (!map.has(s)) {
                map.set(s, [])
                order.push(s)
            }
            map.get(s)!.push(i)
        })
        return order.map((s) => ({ section: s, indexes: map.get(s)! }))
    }, [points])

    const emit = (next: InspectionPoint[]) => {
        onChange(next)
        onValidate?.(validateInspection(next, header, rules))
    }
    const patch = (i: number, partial: Partial<InspectionPoint>) =>
        emit(points.map((p, j) => (j === i ? { ...p, ...partial } : p)))

    const setValue = (i: number, raw: string) => {
        const p = points[i]
        const value = raw.trim() === '' ? null : Number(raw.replace(',', '.'))
        const v = value != null && Number.isFinite(value) ? value : null
        // La profundidad de dibujo fija el semáforo; el técnico aún puede subirlo.
        if (p.kind === 'tread') patch(i, { value: v, status: treadStatus(v, treadThresholds) })
        else patch(i, { value: v })
    }

    const setStatus = (i: number, status: InspectionStatus) => {
        const p = points[i]
        // Verde no lleva recomendación: se limpia para no dejar un renglón huérfano.
        patch(i, status === 'ok' ? { status, recommendation: '', unit_price: 0, quantity: 1 } : { status: p.status === status ? 'pending' : status })
    }

    const upload = async (i: number, file: File) => {
        if (!onUpload) return
        const p = points[i]
        setUploading(p.key)
        setUploadError(null)
        try {
            const res = await onUpload(file, p)
            const media: InspectionMedia = { key: newInspectionKey('im'), url: res.url, type: mediaTypeOf(file, res.type) }
            patch(i, { media: [...p.media, media] })
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : t('inspection.uploadError', { defaultValue: 'No se pudo subir el archivo' }))
        } finally {
            setUploading(null)
        }
    }

    const setHeader = (partial: Partial<InspectionHeader>) => {
        if (!header) return
        const next = { ...header, ...partial }
        onHeaderChange?.(next)
        onValidate?.(validateInspection(points, next, rules))
    }

    const addPoint = (section: string) =>
        emit([...points, { key: newInspectionKey(), section, name: '', kind: 'check', status: 'pending', notes: '', recommendation: '', quantity: 1, unit_price: 0, media: [] }])

    return (
        <div data-slot="inspection-checklist" className="space-y-4">
            {header && (
                <div data-slot="inspection-header" className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">{t('inspection.odometer', { defaultValue: 'Kilometraje' })}</span>
                        <Input
                            inputMode="numeric"
                            value={header.odometer_km == null ? '' : String(header.odometer_km)}
                            disabled={readOnly}
                            onChange={(e) => {
                                const n = Number(e.target.value.replace(/[^\d.]/g, ''))
                                setHeader({ odometer_km: e.target.value.trim() === '' || !Number.isFinite(n) ? null : n })
                            }}
                        />
                    </label>
                    <div className="space-y-1 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">{t('inspection.fuel.label', { defaultValue: 'Nivel de combustible' })}</span>
                        <div role="radiogroup" className="flex flex-wrap gap-1.5">
                            {FUEL_LEVELS.map((f) => (
                                <Button
                                    key={f}
                                    type="button"
                                    size="sm"
                                    role="radio"
                                    aria-checked={header.fuel_level === f}
                                    variant={header.fuel_level === f ? 'default' : 'outline'}
                                    disabled={readOnly}
                                    onClick={() => setHeader({ fuel_level: header.fuel_level === f ? '' : f })}
                                >
                                    {fuelLabel(t, f)}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <label className="space-y-1 text-sm sm:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground">{t('inspection.damages', { defaultValue: 'Daños visibles al recibirlo' })}</span>
                        <Textarea
                            rows={2}
                            value={header.damage_notes}
                            disabled={readOnly}
                            placeholder={t('inspection.damagesPlaceholder', { defaultValue: 'Golpes, rayones, faltantes...' })}
                            onChange={(e) => setHeader({ damage_notes: e.target.value })}
                        />
                    </label>
                </div>
            )}

            {sections.map(({ section, indexes }) => (
                <section key={section || '_'} aria-label={section} className="space-y-2">
                    {section && <h4 className="text-sm font-semibold">{section}</h4>}
                    <div className="space-y-2">
                        {indexes.map((i) => {
                            const p = points[i]
                            const needsValue = p.kind === 'tread' || p.kind === 'measure'
                            const issue = p.status === 'attention' || p.status === 'urgent'
                            return (
                                <div key={p.key} data-slot="inspection-point" data-status={p.status} className="space-y-2 rounded-lg border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[p.status]}`} aria-hidden />
                                        {allowCustomPoints && !readOnly ? (
                                            <Input
                                                className="h-8 max-w-56"
                                                value={p.name}
                                                aria-invalid={!!errors[`${i}.name`]}
                                                onChange={(e) => patch(i, { name: e.target.value })}
                                            />
                                        ) : (
                                            <span className="min-w-0 flex-1 text-sm font-medium">{p.name}</span>
                                        )}
                                        {needsValue && (
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    inputMode="decimal"
                                                    className="h-8 w-20 text-right"
                                                    value={p.value == null ? '' : String(p.value)}
                                                    disabled={readOnly}
                                                    aria-label={`${p.name} (${p.unit ?? ''})`}
                                                    aria-invalid={!!errors[`${i}.value`]}
                                                    onChange={(e) => setValue(i, e.target.value)}
                                                />
                                                <span className="text-xs text-muted-foreground">{p.unit ?? (p.kind === 'tread' ? 'mm' : '')}</span>
                                            </div>
                                        )}
                                        <div role="radiogroup" aria-label={p.name} className="flex gap-1">
                                            {LIGHTS.map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={p.status === s}
                                                    disabled={readOnly}
                                                    onClick={() => setStatus(i, s)}
                                                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                                                        p.status === s ? STATUS_STYLE[s] : 'border-border text-muted-foreground hover:bg-muted'
                                                    } disabled:opacity-60`}
                                                >
                                                    {statusLabel(t, s)}
                                                </button>
                                            ))}
                                        </div>
                                        {allowCustomPoints && !readOnly && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                aria-label={t('inspection.removePoint', { defaultValue: 'Quitar punto' })}
                                                onClick={() => emit(points.filter((_, j) => j !== i))}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {(issue || p.notes || readOnly === false) && (
                                        <Textarea
                                            rows={1}
                                            value={p.notes}
                                            disabled={readOnly}
                                            aria-invalid={!!errors[`${i}.notes`]}
                                            placeholder={t('inspection.notes', { defaultValue: 'Observaciones' })}
                                            onChange={(e) => patch(i, { notes: e.target.value })}
                                        />
                                    )}
                                    {errors[`${i}.notes`] && <p className="text-xs text-destructive">{errors[`${i}.notes`]}</p>}
                                    {errors[`${i}.value`] && <p className="text-xs text-destructive">{errors[`${i}.value`]}</p>}

                                    {allowRecommendations && issue && (
                                        <div className="grid gap-2 rounded-md bg-muted/30 p-2 sm:grid-cols-[1fr_5rem_7rem]">
                                            <Input
                                                value={p.recommendation}
                                                disabled={readOnly}
                                                aria-invalid={!!errors[`${i}.recommendation`]}
                                                placeholder={t('inspection.recommendation', { defaultValue: 'Trabajo recomendado' })}
                                                onChange={(e) => patch(i, { recommendation: e.target.value })}
                                            />
                                            <Input
                                                inputMode="decimal"
                                                className="text-right"
                                                value={String(p.quantity)}
                                                disabled={readOnly || !hasRecommendation(p)}
                                                aria-label={t('inspection.quantity', { defaultValue: 'Cantidad' })}
                                                onChange={(e) => patch(i, { quantity: Number(e.target.value.replace(',', '.')) || 0 })}
                                            />
                                            <Input
                                                inputMode="decimal"
                                                className="text-right"
                                                value={String(p.unit_price)}
                                                disabled={readOnly || !hasRecommendation(p)}
                                                aria-label={t('inspection.unitPrice', { defaultValue: 'Precio' })}
                                                aria-invalid={!!errors[`${i}.unit_price`]}
                                                onChange={(e) => patch(i, { unit_price: Number(e.target.value.replace(',', '.')) || 0 })}
                                            />
                                            {errors[`${i}.recommendation`] && (
                                                <p className="text-xs text-destructive sm:col-span-3">{errors[`${i}.recommendation`]}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2">
                                        {p.media.map((m) => (
                                            <span key={m.key} className="group relative">
                                                {m.type === 'video' ? (
                                                    <video src={m.url} className="h-14 w-20 rounded border object-cover" controls preload="metadata" />
                                                ) : (
                                                    <img src={m.url} alt={m.caption ?? p.name} className="h-14 w-14 rounded border object-cover" />
                                                )}
                                                {!readOnly && (
                                                    <button
                                                        type="button"
                                                        aria-label={t('inspection.removeMedia', { defaultValue: 'Quitar archivo' })}
                                                        className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-background text-xs shadow group-hover:flex"
                                                        onClick={() => patch(i, { media: p.media.filter((x) => x.key !== m.key) })}
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                        {!readOnly && onUpload && <MediaPick busy={uploading === p.key} onFile={(f) => upload(i, f)} />}
                                        {p.approval && p.approval !== 'none' && (
                                            <Badge variant="outline" className="ml-auto">
                                                {p.approval === 'approved'
                                                    ? t('inspection.approval.approved', { defaultValue: 'Aprobado por el cliente' })
                                                    : p.approval === 'declined'
                                                      ? t('inspection.approval.declined', { defaultValue: 'Rechazado por el cliente' })
                                                      : t('inspection.approval.pending', { defaultValue: 'Esperando al cliente' })}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {allowCustomPoints && !readOnly && (
                        <Button type="button" variant="outline" size="sm" onClick={() => addPoint(section)}>
                            {t('inspection.addPoint', { defaultValue: 'Agregar punto' })}
                        </Button>
                    )}
                </section>
            ))}

            {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
            {validation.form && points.length > 0 && <p role="alert" className="text-sm text-destructive">{validation.form}</p>}

            <div data-slot="inspection-summary" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                {LIGHTS.map((s) => (
                    <Badge key={s} variant="outline" className={STATUS_STYLE[s]}>
                        {statusLabel(t, s)}: {summary.counts[s]}
                    </Badge>
                ))}
                {summary.pending > 0 && (
                    <Badge variant="outline" className={STATUS_STYLE.pending}>
                        {statusLabel(t, 'pending')}: {summary.pending}
                    </Badge>
                )}
                {allowRecommendations && summary.recommendations > 0 && (
                    <span className="ml-auto font-medium">
                        {t('inspection.recommendedTotal', { defaultValue: 'Recomendado' })}: {fmt.money(summary.recommendedTotal)}
                    </span>
                )}
                {onAddToBudget && !readOnly && summary.recommendations > 0 && (
                    <Button type="button" size="sm" onClick={() => onAddToBudget(points.filter(hasRecommendation))}>
                        {t('inspection.addToBudget', { defaultValue: 'Agregar al presupuesto' })}
                    </Button>
                )}
            </div>
        </div>
    )
}

/** Botón de foto/video: abre la cámara en móvil, el selector de archivos en escritorio. */
function MediaPick({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
    const { t } = useTranslation()
    const ref = useRef<HTMLInputElement | null>(null)
    return (
        <>
            <input
                ref={ref}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (ref.current) ref.current.value = ''
                    if (f) onFile(f)
                }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
                {t('inspection.addMedia', { defaultValue: 'Foto o video' })}
                <Video className="ml-1.5 h-3.5 w-3.5 opacity-60" aria-hidden />
            </Button>
        </>
    )
}
