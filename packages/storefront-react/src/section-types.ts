/**
 * Exporter of section types to the OPS `storefront_content` format, plus a
 * helper to sync them (`PUT /storefront/content/section-types`). Pure TS: no
 * React import, so it also runs in build scripts and CI.
 *
 * Kind mapping (SDK → OPS): `url`/`color` → `text` (the URL travels as text;
 * OPS `link` is a `{label,url}` object), `products` → `product_list`,
 * `items` → `fields` (recursive). The rest keep their name.
 */
import { StorefrontError } from '@asteby/storefront'
import type { SectionDefinition, SectionPropSchema, SectionSchema } from './sections.js'

/** Types OPS ships built in; they cannot be redefined through the API. */
export const OPS_BUILTIN_SECTION_TYPES = ['hero', 'product_grid', 'collection_list', 'rich_text', 'faq', 'image_with_text'] as const

export const OPS_PROP_KINDS = ['text', 'textarea', 'richtext', 'image', 'link', 'number', 'select', 'boolean', 'collection', 'collection_list', 'product', 'product_list', 'list'] as const
export type OpsPropKind = (typeof OPS_PROP_KINDS)[number]

export type OpsSectionProp = {
  key: string
  kind: OpsPropKind
  label: string
  required?: boolean
  default?: unknown
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  fields?: OpsSectionProp[]
}

export type OpsSectionType = {
  type: string
  label: string
  description?: string
  category?: string
  schema: { props: OpsSectionProp[] }
  max_per_page?: number
}

export type SectionTypeIssue = {
  /** Dotted path, e.g. `promo.schema.props[1].fields[0].key`. */
  path: string
  message: string
}

export type SectionTypeWarning = {
  type: string
  /** Prop key when the warning is about a single prop. */
  prop?: string
  message: string
}

export class SectionTypesValidationError extends Error {
  readonly issues: SectionTypeIssue[]
  constructor(issues: SectionTypeIssue[]) {
    super(`Invalid section types for OPS:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`)
    this.name = 'SectionTypesValidationError'
    this.issues = issues
  }
}

export type ToOpsOptions = {
  /** Skip OPS built-in types (default true). */
  excludeBuiltin?: boolean
  /**
   * Prop keys OPS already knows for each built-in type (e.g. `{ hero: ['title','subtitle'] }`).
   * With it, only the extra local props are warned about; without it, every
   * locally-defined built-in type gets one generic warning.
   */
  builtinProps?: Record<string, readonly string[]>
}

export type ToOpsResult = { types: OpsSectionType[]; warnings: SectionTypeWarning[] }

const SNAKE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/
const KIND_MAP: Record<string, OpsPropKind> = {
  text: 'text',
  textarea: 'textarea',
  richtext: 'richtext',
  url: 'text',
  color: 'text',
  image: 'image',
  number: 'number',
  boolean: 'boolean',
  select: 'select',
  collection: 'collection',
  product: 'product',
  products: 'product_list',
  list: 'list',
}
const LIST_KINDS = new Set<OpsPropKind>(['list'])

function convertProps(schema: SectionSchema | undefined, path: string, issues: SectionTypeIssue[]): OpsSectionProp[] {
  const out: OpsSectionProp[] = []
  for (const [key, spec] of Object.entries(schema ?? {})) {
    const p = `${path}.${key}`
    const kind = KIND_MAP[(spec as SectionPropSchema).kind]
    if (!kind) {
      issues.push({ path: `${p}.kind`, message: `unknown kind "${String((spec as SectionPropSchema).kind)}"` })
      continue
    }
    const prop: OpsSectionProp = { key, kind, label: spec.label }
    if (spec.required) prop.required = true
    if ('default' in spec && spec.default !== undefined) prop.default = spec.default
    if (spec.options) prop.options = spec.options.map((o) => ({ value: o.value, label: o.label }))
    if (spec.min !== undefined) prop.min = spec.min
    if (spec.max !== undefined) prop.max = spec.max
    if (LIST_KINDS.has(kind)) prop.fields = convertProps(spec.items, `${p}.fields`, issues)
    out.push(prop)
  }
  return out
}

/** Local mirror of the OPS validation, so mistakes surface before the request. */
export function validateOpsSectionTypes(types: readonly OpsSectionType[]): SectionTypeIssue[] {
  const issues: SectionTypeIssue[] = []
  const seen = new Set<string>()
  const walk = (props: readonly OpsSectionProp[] | undefined, path: string) => {
    if (!Array.isArray(props)) {
      issues.push({ path, message: 'must be a list' })
      return
    }
    const keys = new Set<string>()
    props.forEach((prop, i) => {
      const p = `${path}[${i}]`
      if (typeof prop.key !== 'string' || !SNAKE.test(prop.key)) issues.push({ path: `${p}.key`, message: `"${String(prop.key)}" must be snake_case (a-z, 0-9, _)` })
      else if (keys.has(prop.key)) issues.push({ path: `${p}.key`, message: `duplicate key "${prop.key}"` })
      else keys.add(prop.key)
      if (typeof prop.label !== 'string' || !prop.label.trim()) issues.push({ path: `${p}.label`, message: 'label is required' })
      if (!(OPS_PROP_KINDS as readonly string[]).includes(prop.kind)) {
        issues.push({ path: `${p}.kind`, message: `unknown kind "${String(prop.kind)}"` })
        return
      }
      if (prop.kind === 'list') {
        if (!prop.fields || prop.fields.length === 0) issues.push({ path: `${p}.fields`, message: 'list requires a non-empty "fields"' })
        else walk(prop.fields, `${p}.fields`)
      }
      if (prop.kind === 'select' && (!prop.options || prop.options.length === 0)) issues.push({ path: `${p}.options`, message: 'select requires non-empty "options"' })
      if (prop.min !== undefined && prop.max !== undefined && prop.min > prop.max) issues.push({ path: `${p}.max`, message: 'max must be >= min' })
    })
  }
  types.forEach((t, i) => {
    const p = t.type ? t.type : `[${i}]`
    if (!t.type || !t.type.trim()) issues.push({ path: `${p}.type`, message: 'type is required' })
    else if (seen.has(t.type)) issues.push({ path: `${p}.type`, message: `duplicate type "${t.type}"` })
    else seen.add(t.type)
    if (!t.label || !t.label.trim()) issues.push({ path: `${p}.label`, message: 'label is required' })
    if (t.max_per_page !== undefined && (!Number.isInteger(t.max_per_page) || t.max_per_page < 1)) issues.push({ path: `${p}.max_per_page`, message: 'must be a positive integer' })
    walk(t.schema?.props, `${p}.schema.props`)
  })
  return issues
}

type DefinitionsSource = { definitions(): SectionDefinition<any, any>[] } | readonly SectionDefinition<any, any>[]

/**
 * Converts the registry (or a list of definitions) to OPS section types.
 * Throws `SectionTypesValidationError` (with `issues`) when something would
 * be rejected by OPS.
 */
export function sectionTypesToOps(source: DefinitionsSource, options: ToOpsOptions = {}): ToOpsResult {
  const excludeBuiltin = options.excludeBuiltin ?? true
  const defs = Array.isArray(source) ? (source as readonly SectionDefinition<any, any>[]) : (source as { definitions(): SectionDefinition<any, any>[] }).definitions()
  const builtin = new Set<string>(OPS_BUILTIN_SECTION_TYPES)
  const issues: SectionTypeIssue[] = []
  const warnings: SectionTypeWarning[] = []
  const types: OpsSectionType[] = []

  for (const def of defs) {
    if (excludeBuiltin && builtin.has(def.type)) {
      const known = options.builtinProps?.[def.type]
      if (known) {
        for (const name of Object.keys(def.schema ?? {})) {
          if (!known.includes(name)) warnings.push({ type: def.type, prop: name, message: `prop "${name}" of built-in type "${def.type}" does not exist in the OPS schema; built-in types cannot be redefined, so it will not be editable in OPS` })
        }
      } else {
        warnings.push({ type: def.type, message: `"${def.type}" is a built-in OPS type: not synced, and its local props cannot be verified against the OPS schema` })
      }
      continue
    }
    const entryIssues: SectionTypeIssue[] = []
    const props = convertProps(def.schema, `${def.type}.schema.props`, entryIssues)
    issues.push(...entryIssues)
    const out: OpsSectionType = { type: def.type, label: def.label ?? def.type, schema: { props } }
    if (def.description) out.description = def.description
    if (def.category) out.category = def.category
    if (def.maxPerPage !== undefined) out.max_per_page = def.maxPerPage
    types.push(out)
  }
  issues.push(...validateOpsSectionTypes(types))
  if (issues.length) throw new SectionTypesValidationError(issues)
  return { types, warnings }
}

export type SectionTypesTarget =
  | { request<T>(spec: { method: 'PUT'; path: string; body?: unknown }): Promise<T> }
  | { baseUrl: string; token: string; fetch?: typeof fetch }

export type SyncResult = { created: number; updated: number; warnings: SectionTypeWarning[] }

const SYNC_PATH = '/storefront/content/section-types'

const count = (v: unknown): number => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0)

/**
 * Validates locally and then `PUT`s the section types to OPS. Needs an `sk_`
 * token with `content:write`. `target` is a `createStorefrontClient()` client or
 * `{ baseUrl, token, fetch? }`. Returns `{ created, updated, warnings }`.
 */
export async function syncSectionTypes(target: SectionTypesTarget, source: DefinitionsSource, options: ToOpsOptions = {}): Promise<SyncResult> {
  const { types, warnings } = sectionTypesToOps(source, options)
  let raw: unknown
  if ('request' in target && typeof target.request === 'function') {
    raw = await target.request<unknown>({ method: 'PUT', path: SYNC_PATH, body: { section_types: types } })
  } else {
    const t = target as { baseUrl: string; token: string; fetch?: typeof fetch }
    if (!t.token.startsWith('sk_')) throw new TypeError('syncSectionTypes: an sk_ token with content:write is required')
    const f = t.fetch ?? globalThis.fetch.bind(globalThis)
    const url = t.baseUrl.replace(/\/+$/, '') + SYNC_PATH
    const res = await f(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ section_types: types }),
    })
    const text = await res.text()
    let body: any
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      body = undefined
    }
    if (!res.ok) {
      throw new StorefrontError({ status: res.status, code: (body?.code ?? body?.error?.code ?? 'unknown') as StorefrontError['code'], message: body?.message ?? body?.error?.message ?? `Section types sync failed (${res.status})`, url })
    }
    raw = body
  }
  const data = (raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: unknown }).data : raw) as { created?: unknown; updated?: unknown } | undefined
  return { created: count(data?.created), updated: count(data?.updated), warnings }
}
