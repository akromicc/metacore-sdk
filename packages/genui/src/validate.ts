import { GENUI_VERSION, type UISpec } from './types'

/** Limits mirror the Go validator (kernel package genui). */
export const GENUI_LIMITS = {
  blocks: 12,
  items: 50,
  columns: 8,
  fields: 12,
  actions: 4,
  text: 2000,
  label: 160,
  bytes: 64 * 1024,
} as const

const ACTION_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$/
const KEY = /^[A-Za-z_][A-Za-z0-9_.]{0,63}$/
const TONES = new Set(['', 'default', 'muted', 'info', 'success', 'warning', 'danger'])
const TRENDS = new Set(['', 'up', 'down', 'flat'])
const VARIANTS = new Set(['', 'primary', 'secondary', 'ghost', 'danger'])
const INPUT_KINDS = new Set(['text', 'textarea', 'number', 'switch', 'select', 'time', 'date'])

const ALLOWED: Record<string, string[]> = {
  text: ['type', 'text', 'tone'],
  kpi: ['type', 'items', 'title'],
  card: ['type', 'title', 'subtitle', 'body', 'badges', 'fields', 'link', 'tone'],
  table: ['type', 'title', 'columns', 'rows', 'caption'],
  links: ['type', 'title', 'items'],
  timeline: ['type', 'title', 'items'],
  chart: ['type', 'title', 'kind', 'x', 'series', 'rows', 'summary', 'caption'],
  confirm: ['type', 'title', 'description', 'fields', 'inputs', 'actions', 'badges', 'tone'],
}

export type ParseResult = { ok: true; spec: UISpec } | { ok: false; error: string }

class Invalid extends Error {}

const fail = (msg: string): never => {
  throw new Invalid(msg)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isScalar = (v: unknown) => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v)

function str(v: unknown, name: string, max: number, required = false) {
  if (v === undefined || v === null || v === '') {
    if (required) fail(`${name} required`)
    return
  }
  if (typeof v !== 'string') fail(`${name} must be text`)
  if ((v as string).length > max) fail(`${name} exceeds ${max} characters`)
}

/** True for '', app-relative paths ('/m/x', not '//host') and http(s) URLs. */
export function isSafeLink(link: unknown): boolean {
  if (link === undefined || link === null || link === '') return true
  if (typeof link !== 'string' || link.length > 2048) return false
  if (link.startsWith('/') && !link.startsWith('//') && !/[\\\n\r\t]/.test(link)) return true
  try {
    const u = new URL(link)
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.host
  } catch {
    return false
  }
}

function list(v: unknown, name: string, max: number, min = 0): unknown[] {
  if (v === undefined) {
    if (min > 0) fail(`${name} required`)
    return []
  }
  if (!Array.isArray(v)) fail(`${name} must be a list`)
  const arr = v as unknown[]
  if (arr.length < min || arr.length > max) fail(`${name}: ${min}..${max} entries`)
  return arr
}

function tone(v: unknown) {
  if (v !== undefined && !TONES.has(String(v))) fail(`unknown tone ${String(v)}`)
}

function rows(v: unknown) {
  for (const r of list(v, 'rows', GENUI_LIMITS.items)) {
    if (!isObj(r)) fail('row must be an object')
    const entries = Object.entries(r as Record<string, unknown>)
    if (entries.length > 16) fail('row has too many cells')
    for (const [k, c] of entries) {
      if (!KEY.test(k) || !isScalar(c)) fail(`cell ${k} must be a scalar`)
      if (typeof c === 'string' && c.length > GENUI_LIMITS.text) fail(`cell ${k} too long`)
    }
  }
}

function columns(v: unknown, max: number) {
  for (const c of list(v, 'columns', max, 1)) {
    if (!isObj(c) || typeof c.key !== 'string' || !KEY.test(c.key)) fail('invalid column')
    str((c as Record<string, unknown>).label, 'column label', GENUI_LIMITS.label, true)
  }
}

function items(v: unknown, kind: string) {
  const max = kind === 'kpi' ? GENUI_LIMITS.fields : GENUI_LIMITS.items
  for (const raw of list(v, 'items', max, 1)) {
    if (!isObj(raw)) fail('item must be an object')
    const it = raw as Record<string, unknown>
    for (const k of ['label', 'value', 'hint', 'title', 'source', 'date', 'time', 'status']) str(it[k], k, GENUI_LIMITS.label)
    str(it.description, 'description', GENUI_LIMITS.text)
    tone(it.tone)
    if (it.trend !== undefined && !TRENDS.has(String(it.trend))) fail('unknown trend')
    if (kind === 'kpi' && (!it.label || !it.value)) fail('kpi items need label and value')
    if (kind !== 'kpi' && !it.title) fail(`${kind} item needs a title`)
    if (!isSafeLink(it.url)) fail(`unsafe link ${String(it.url)}`)
  }
}

function block(raw: unknown, i: number) {
  if (!isObj(raw)) fail(`block ${i} must be an object`)
  const b = raw as Record<string, unknown>
  const type = String(b.type)
  const allowed = ALLOWED[type]
  if (!allowed) fail(`block ${i}: unknown type ${type}`)
  for (const k of Object.keys(b)) {
    const v = b[k]
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (!empty && !allowed!.includes(k)) fail(`block ${i} (${type}): field ${k} not allowed`)
  }
  tone(b.tone)
  str(b.title, 'title', GENUI_LIMITS.label)
  str(b.subtitle, 'subtitle', GENUI_LIMITS.label)
  str(b.caption, 'caption', GENUI_LIMITS.label)
  for (const k of ['text', 'body', 'summary', 'description']) str(b[k], k, GENUI_LIMITS.text)
  if (!isSafeLink(b.link)) fail(`unsafe link ${String(b.link)}`)
  for (const bd of list(b.badges, 'badges', 6)) {
    if (!isObj(bd)) fail('invalid badge')
    str((bd as Record<string, unknown>).label, 'badge', 60, true)
    tone((bd as Record<string, unknown>).tone)
  }
  for (const f of list(b.fields, 'fields', GENUI_LIMITS.fields)) {
    if (!isObj(f)) fail('invalid field')
    str((f as Record<string, unknown>).label, 'field label', GENUI_LIMITS.label, true)
    str((f as Record<string, unknown>).value, 'field value', GENUI_LIMITS.text)
  }
  switch (type) {
    case 'text':
      str(b.text, 'text', GENUI_LIMITS.text, true)
      break
    case 'card':
      str(b.title, 'title', GENUI_LIMITS.label, true)
      break
    case 'kpi':
    case 'links':
    case 'timeline':
      items(b.items, type)
      break
    case 'table':
      columns(b.columns, GENUI_LIMITS.columns)
      rows(b.rows)
      break
    case 'chart':
      if (b.kind !== 'bar' && b.kind !== 'line') fail('chart kind must be bar or line')
      if (typeof b.x !== 'string' || !KEY.test(b.x)) fail('chart x key invalid')
      columns(b.series, 4)
      rows(b.rows)
      str(b.summary, 'summary (accessible text)', GENUI_LIMITS.text, true)
      break
    case 'confirm': {
      str(b.title, 'title', GENUI_LIMITS.label, true)
      for (const raw of list(b.inputs, 'inputs', GENUI_LIMITS.fields)) {
        if (!isObj(raw)) fail('invalid input')
        const inp = raw as Record<string, unknown>
        if (typeof inp.name !== 'string' || !KEY.test(inp.name)) fail('invalid input name')
        str(inp.label, 'input label', GENUI_LIMITS.label, true)
        str(inp.help, 'input help', GENUI_LIMITS.label)
        if (!INPUT_KINDS.has(String(inp.kind))) fail(`invalid input kind ${String(inp.kind)}`)
        if (!isScalar(inp.value)) fail('input value must be scalar')
        const opts = list(inp.options, 'options', 30)
        if (inp.kind === 'select' && opts.length === 0) fail('select needs options')
        if (inp.kind !== 'select' && opts.length > 0) fail('options only for select')
      }
      for (const raw of list(b.actions, 'actions', GENUI_LIMITS.actions, 1)) {
        if (!isObj(raw)) fail('invalid action')
        const a = raw as Record<string, unknown>
        if (typeof a.id !== 'string' || !ACTION_ID.test(a.id)) fail(`invalid action id ${String(a.id)}`)
        str(a.label, 'action label', 60, true)
        if (a.variant !== undefined && !VARIANTS.has(String(a.variant))) fail('invalid action variant')
        if (a.params !== undefined) {
          if (!isObj(a.params)) fail('action params must be an object')
          const ps = Object.entries(a.params as Record<string, unknown>)
          if (ps.length > 8) fail('too many params')
          for (const [k, v] of ps) {
            if (!KEY.test(k) || !isScalar(v)) fail(`param ${k} must be a scalar`)
            if (typeof v === 'string' && v.length > GENUI_LIMITS.label) fail(`param ${k} too long`)
          }
        }
      }
      break
    }
  }
}

/**
 * Strictly validates an untrusted value (an agent embed) as a genui/v1 spec.
 * Never throws; an invalid spec is reported and must not be rendered.
 */
export function parseUISpec(value: unknown): ParseResult {
  try {
    let v = value
    if (typeof v === 'string') {
      if (v.length > GENUI_LIMITS.bytes) fail('spec too large')
      v = JSON.parse(v)
    } else if (JSON.stringify(v ?? null).length > GENUI_LIMITS.bytes) {
      fail('spec too large')
    }
    if (!isObj(v)) fail('spec must be an object')
    const s = v as Record<string, unknown>
    for (const k of Object.keys(s)) if (!['version', 'title', 'blocks'].includes(k)) fail(`unknown field ${k}`)
    if (s.version !== GENUI_VERSION) fail(`version must be ${GENUI_VERSION}`)
    str(s.title, 'title', GENUI_LIMITS.label)
    list(s.blocks, 'blocks', GENUI_LIMITS.blocks, 1).forEach(block)
    return { ok: true, spec: s as unknown as UISpec }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
