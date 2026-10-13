import { useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button, Input, Label, Switch, Textarea, cn } from '@asteby/metacore-ui'
import type { AutomationsT } from './messages'
import {
  AUTOMATION_SPEC_VERSION,
  type ArgValue,
  type AutomationCatalog,
  type AutomationKind,
  type AutomationSpec,
  type JSONSchema,
  type Step,
  type StepType,
  type Trigger,
  type TriggerType,
} from './types'

/**
 * Which schema properties each step type edits. The widget of every field
 * (text, number with bounds, switch, select, multi-select) and whether it is
 * required come from the automation/v1 JSON Schema served by the backend, so
 * a new enum value or limit appears here without a frontend change.
 */
export const STEP_FIELDS: Record<StepType, string[]> = {
  tool: ['tool'],
  filter: ['from', 'unseen', 'limit'],
  condition: [],
  template: ['template'],
  summarize: ['from', 'mode', 'template', 'instructions'],
  deliver: ['channels', 'title', 'body', 'link', 'items_from'],
}

const TRIGGER_FIELDS: Record<TriggerType, string[]> = {
  cron: ['cron', 'timezone'],
  interval: ['every'],
  once: ['at', 'timezone'],
  event: ['event', 'cooldown'],
}

const LONG_TEXT = new Set(['template', 'body', 'instructions', 'description'])

function resolve(schema: JSONSchema, node?: JSONSchema): JSONSchema | undefined {
  if (!node) return undefined
  if (node.$ref?.startsWith('#/$defs/')) return resolve(schema, schema.$defs?.[node.$ref.slice(8)])
  return node
}

/** Required properties for a discriminated object (`allOf` if/then on type). */
function requiredFor(def: JSONSchema | undefined, type: string): Set<string> {
  const out = new Set(def?.required ?? [])
  for (const rule of def?.allOf ?? []) {
    if (rule.if?.properties?.type?.const === type) rule.then?.required?.forEach((r) => out.add(r))
  }
  return out
}

export interface SpecEditorProps {
  catalog: AutomationCatalog
  t: AutomationsT
  initial?: AutomationSpec
  initialKind?: AutomationKind
  /** Kind is fixed when editing. */
  lockKind?: boolean
  saving?: boolean
  error?: string | null
  onSubmit: (spec: AutomationSpec, kind: AutomationKind) => void
  onCancel: () => void
}

const blankSpec = (tz: string): AutomationSpec => ({
  schema_version: AUTOMATION_SPEC_VERSION,
  name: '',
  trigger: { type: 'cron', cron: '0 7 * * *', timezone: tz },
  steps: [{ id: 'enviar', type: 'deliver', channels: ['in_app'], title: '', body: '' }],
})

export function SpecEditor({ catalog, t, initial, initialKind = 'automation', lockKind, saving, error, onSubmit, onCancel }: SpecEditorProps) {
  const uid = useId()
  const schema = catalog.schema
  const stepDef = resolve(schema, schema.$defs?.step)
  const triggerDef = resolve(schema, schema.$defs?.trigger)
  const [kind, setKind] = useState<AutomationKind>(initialKind)
  const [spec, setSpec] = useState<AutomationSpec>(() => initial ?? blankSpec(catalog.timezone))
  const [json, setJson] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const stepTypes = useMemo(
    () => ((stepDef?.properties?.type?.enum as StepType[] | undefined) ?? (Object.keys(STEP_FIELDS) as StepType[])).filter((s) => kind === 'automation' || s !== 'deliver'),
    [stepDef, kind],
  )
  const triggerTypes = (triggerDef?.properties?.type?.enum as TriggerType[] | undefined) ?? ['cron', 'interval', 'once', 'event']

  const setTrigger = (patch: Partial<Trigger>) => setSpec((s) => ({ ...s, trigger: { ...(s.trigger ?? { type: 'cron' }), ...patch } as Trigger }))
  const setStep = (i: number, patch: Partial<Step>) =>
    setSpec((s) => ({ ...s, steps: s.steps.map((st, j) => (j === i ? ({ ...st, ...patch } as Step) : st)) }))
  const moveStep = (i: number, d: -1 | 1) =>
    setSpec((s) => {
      const steps = [...s.steps]
      const j = i + d
      if (j < 0 || j >= steps.length) return s
      ;[steps[i], steps[j]] = [steps[j]!, steps[i]!]
      return { ...s, steps }
    })

  const submit = () => {
    let out = spec
    if (json !== null) {
      try {
        out = JSON.parse(json) as AutomationSpec
      } catch {
        setJsonError(t('editor.json_invalid'))
        return
      }
    }
    const clean: AutomationSpec = { ...out, schema_version: AUTOMATION_SPEC_VERSION }
    if (kind === 'tool') delete clean.trigger
    onSubmit(clean, kind)
  }

  /** Renders one schema-described property. */
  const field = (def: JSONSchema | undefined, name: string, label: string, value: unknown, set: (v: unknown) => void, required: boolean, key: string) => {
    const d = resolve(schema, def)
    const id = `${uid}-${key}`
    const enumVals = d?.enum as string[] | undefined
    const itemEnum = resolve(schema, d?.items)?.enum as string[] | undefined
    const labelEl = (
      <Label htmlFor={id} className='text-xs'>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </Label>
    )
    if (d?.type === 'boolean') {
      return (
        <div key={key} className='flex items-center gap-2'>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={(c) => set(c)} />
          {labelEl}
        </div>
      )
    }
    if (d?.type === 'array' && itemEnum) {
      const cur = new Set((value as string[] | undefined) ?? [])
      const allowed = name === 'channels' ? itemEnum.filter((c) => catalog.channels.includes(c as never)) : itemEnum
      return (
        <fieldset key={key} className='flex flex-col gap-1'>
          <legend className='text-xs font-medium'>{label}{required ? ' *' : ''}</legend>
          <div className='flex flex-wrap gap-3'>
            {allowed.map((opt) => (
              <label key={opt} className='flex items-center gap-1.5 text-sm'>
                <input
                  type='checkbox'
                  className='size-4 accent-[var(--primary)]'
                  checked={cur.has(opt)}
                  onChange={(e) => {
                    const next = new Set(cur)
                    if (e.target.checked) next.add(opt)
                    else next.delete(opt)
                    set([...next])
                  }}
                />
                {t(`automations.channel.${opt}` as never) || opt}
              </label>
            ))}
          </div>
        </fieldset>
      )
    }
    if (enumVals) {
      return (
        <div key={key} className='flex flex-col gap-1'>
          {labelEl}
          <select
            id={id}
            className='h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
            value={String(value ?? '')}
            onChange={(e) => set(e.target.value || undefined)}
          >
            {!required ? <option value=''>—</option> : null}
            {enumVals.map((v) => (
              <option key={v} value={v}>
                {name === 'mode' ? t(`editor.field.mode.${v}` as never) : v}
              </option>
            ))}
          </select>
        </div>
      )
    }
    if (d?.type === 'integer' || d?.type === 'number') {
      return (
        <div key={key} className='flex flex-col gap-1'>
          {labelEl}
          <Input id={id} type='number' min={d.minimum} max={d.maximum} value={value === undefined ? '' : String(value)} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
      )
    }
    const long = LONG_TEXT.has(name)
    return (
      <div key={key} className={cn('flex flex-col gap-1', long && 'sm:col-span-2')}>
        {labelEl}
        {long ? (
          <Textarea id={id} rows={3} maxLength={d?.maxLength} value={String(value ?? '')} onChange={(e) => set(e.target.value || undefined)} />
        ) : (
          <Input
            id={id}
            type={name === 'at' ? 'datetime-local' : 'text'}
            maxLength={d?.maxLength}
            value={String(value ?? '')}
            onChange={(e) => set(e.target.value || undefined)}
          />
        )}
      </div>
    )
  }

  const toolArgs = (st: Step, i: number) => {
    const tool = catalog.tools.find((x) => x.name === st.tool)
    if (!tool) return null
    return Object.entries(tool.parameters).map(([pname, p]) => {
      const set = (v: unknown) => {
        const args = { ...(st.args ?? {}) }
        if (v === undefined || v === '') delete args[pname]
        else args[pname] = v as ArgValue
        setStep(i, { args })
      }
      return field({ type: p.type ?? 'string', enum: p.enum, description: p.description }, pname, p.description ? `${pname} — ${p.description}` : pname, st.args?.[pname], set, !!p.required, `s${i}-a-${pname}`)
    })
  }

  return (
    <form
      className='flex flex-col gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      aria-describedby={`${uid}-hint`}
    >
      <p id={`${uid}-hint`} className='m-0 text-xs text-muted-foreground'>
        {t('editor.hint')}
      </p>
      {json === null ? (
        <>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {!lockKind ? (
              <div className='flex flex-col gap-1'>
                <Label htmlFor={`${uid}-kind`} className='text-xs'>{t('editor.kind')}</Label>
                <select
                  id={`${uid}-kind`}
                  className='h-9 rounded-md border bg-background px-2 text-sm'
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AutomationKind)}
                >
                  <option value='automation'>{t('editor.kind.automation')}</option>
                  <option value='tool'>{t('editor.kind.tool')}</option>
                </select>
              </div>
            ) : null}
            {field(schema.properties?.name, 'name', t('editor.name'), spec.name, (v) => setSpec((s) => ({ ...s, name: String(v ?? '') })), true, 'name')}
            {field(schema.properties?.description, 'description', t('editor.description'), spec.description, (v) => setSpec((s) => ({ ...s, description: v as string })), false, 'desc')}
          </div>

          {kind === 'automation' ? (
            <fieldset className='flex flex-col gap-3 rounded-lg border p-3'>
              <legend className='px-1 text-sm font-medium'>{t('editor.trigger')}</legend>
              <div className='flex flex-wrap gap-2' role='radiogroup' aria-label={t('editor.trigger')}>
                {triggerTypes.map((tt) => (
                  <Button
                    key={tt}
                    type='button'
                    size='sm'
                    role='radio'
                    aria-checked={spec.trigger?.type === tt}
                    variant={spec.trigger?.type === tt ? 'default' : 'outline'}
                    onClick={() => setSpec((s) => ({ ...s, trigger: { type: tt, timezone: tt === 'cron' || tt === 'once' ? catalog.timezone : undefined } }))}
                  >
                    {t(`editor.trigger.${tt}` as never)}
                  </Button>
                ))}
              </div>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {TRIGGER_FIELDS[spec.trigger?.type ?? 'cron'].map((name) =>
                  field(
                    triggerDef?.properties?.[name],
                    name,
                    t(`editor.field.${name}` as never),
                    (spec.trigger as unknown as Record<string, unknown> | undefined)?.[name],
                    (v) => setTrigger({ [name]: v } as Partial<Trigger>),
                    requiredFor(triggerDef, spec.trigger?.type ?? 'cron').has(name),
                    `tr-${name}`,
                  ),
                )}
              </div>
            </fieldset>
          ) : null}

          <fieldset className='flex flex-col gap-3'>
            <legend className='text-sm font-medium'>{t('editor.steps')}</legend>
            {spec.steps.map((st, i) => {
              const req = requiredFor(stepDef, st.type)
              return (
                <div key={i} className='flex flex-col gap-3 rounded-lg border p-3'>
                  <div className='flex flex-wrap items-end gap-2'>
                    <div className='flex min-w-[10rem] flex-1 flex-col gap-1'>
                      <Label htmlFor={`${uid}-s${i}-type`} className='text-xs'>{`${i + 1}.`}</Label>
                      <select
                        id={`${uid}-s${i}-type`}
                        className='h-9 rounded-md border bg-background px-2 text-sm'
                        value={st.type}
                        onChange={(e) => setStep(i, { type: e.target.value as StepType })}
                      >
                        {stepTypes.map((s) => (
                          <option key={s} value={s}>
                            {t(`editor.step.${s}` as never)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='flex w-36 flex-col gap-1'>
                      <Label htmlFor={`${uid}-s${i}-id`} className='text-xs'>{t('editor.field.id')}</Label>
                      <Input id={`${uid}-s${i}-id`} value={st.id} onChange={(e) => setStep(i, { id: e.target.value })} />
                    </div>
                    <div className='flex gap-1'>
                      <Button type='button' size='icon' variant='ghost' aria-label={t('editor.step.up')} onClick={() => moveStep(i, -1)} disabled={i === 0}>
                        <ArrowUp className='size-4' />
                      </Button>
                      <Button type='button' size='icon' variant='ghost' aria-label={t('editor.step.down')} onClick={() => moveStep(i, 1)} disabled={i === spec.steps.length - 1}>
                        <ArrowDown className='size-4' />
                      </Button>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        aria-label={t('editor.step.remove')}
                        onClick={() => setSpec((s) => ({ ...s, steps: s.steps.filter((_, j) => j !== i) }))}
                        disabled={spec.steps.length === 1}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  </div>
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    {st.type === 'tool' ? (
                      <div className='flex flex-col gap-1'>
                        <Label htmlFor={`${uid}-s${i}-tool`} className='text-xs'>{t('editor.field.tool')} *</Label>
                        <select
                          id={`${uid}-s${i}-tool`}
                          className='h-9 rounded-md border bg-background px-2 text-sm'
                          value={st.tool ?? ''}
                          onChange={(e) => setStep(i, { tool: e.target.value, args: {} })}
                        >
                          <option value=''>—</option>
                          {catalog.tools.map((tl) => (
                            <option key={tl.name} value={tl.name}>
                              {tl.title || tl.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {st.type === 'tool' ? toolArgs(st, i) : null}
                    {st.type === 'condition'
                      ? (['field', 'op', 'value'] as const).map((k) =>
                          field(
                            resolve(schema, schema.$defs?.condition)?.properties?.[k],
                            k,
                            t(`editor.field.if_${k}` as never),
                            st.if?.[k],
                            (v) => setStep(i, { if: { field: '', op: 'gt', ...st.if, [k]: k === 'value' && v !== undefined && !isNaN(Number(v)) ? Number(v) : v } as Step['if'] }),
                            k !== 'value',
                            `s${i}-if-${k}`,
                          ),
                        )
                      : null}
                    {STEP_FIELDS[st.type]
                      .filter((name) => name !== 'tool')
                      .map((name) =>
                        field(
                          stepDef?.properties?.[name],
                          name,
                          t(`editor.field.${name}` as never),
                          (st as unknown as Record<string, unknown>)[name],
                          (v) => setStep(i, { [name]: v } as Partial<Step>),
                          req.has(name),
                          `s${i}-${name}`,
                        ),
                      )}
                  </div>
                </div>
              )
            })}
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='self-start'
              onClick={() => setSpec((s) => ({ ...s, steps: [...s.steps, { id: `paso${s.steps.length + 1}`, type: 'template', template: '' }] }))}
              disabled={spec.steps.length >= 8}
            >
              <Plus className='size-4' /> {t('editor.step.add')}
            </Button>
          </fieldset>
        </>
      ) : (
        <div className='flex flex-col gap-1'>
          <Label htmlFor={`${uid}-json`} className='text-xs'>JSON automation/v1</Label>
          <Textarea id={`${uid}-json`} rows={18} className='font-mono text-xs' value={json} onChange={(e) => setJson(e.target.value)} aria-invalid={!!jsonError} />
          {jsonError ? <p role='alert' className='m-0 text-xs text-destructive'>{jsonError}</p> : null}
        </div>
      )}

      {error ? (
        <p role='alert' className='m-0 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive'>
          {error}
        </p>
      ) : null}

      <div className='flex flex-wrap items-center gap-2'>
        <Button type='submit' disabled={saving}>
          {saving ? t('editor.saving') : t('editor.save')}
        </Button>
        <Button type='button' variant='ghost' onClick={onCancel}>
          {t('editor.cancel')}
        </Button>
        <Button
          type='button'
          variant='link'
          className='ml-auto'
          onClick={() => {
            setJsonError(null)
            if (json === null) setJson(JSON.stringify(spec, null, 2))
            else {
              try {
                setSpec(JSON.parse(json) as AutomationSpec)
                setJson(null)
              } catch {
                setJsonError(t('editor.json_invalid'))
              }
            }
          }}
        >
          {json === null ? t('editor.advanced') : t('editor.form')}
        </Button>
      </div>
    </form>
  )
}
