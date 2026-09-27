/**
 * Coalesces concurrent reads into one POST /api/q.
 *
 * Callers enqueue a batch token (`o:Customer?field=id&q=lop`). Tokens that
 * arrive inside an 8ms window share one request. Each part keeps its own
 * success, data and etag. A failed part does not reject the others.
 */
import type { ApiClient } from './api-context'

export interface QueryPart {
    success: boolean
    data?: unknown
    meta?: unknown
    message?: string
    etag?: string
    not_modified?: boolean
}

const WINDOW_MS = 8
const PART_TTL_MS = 30_000
const ENTITY_TTL_MS = 30_000

type Waiter = {
    token: string
    wire: string
    resolve: (part: QueryPart) => void
    reject: (error: Error) => void
    cachedRows?: Record<string, unknown>[]
    missingIds?: string[]
    field?: string
}

type CachedPart = { part: QueryPart; at: number }
type CachedEntity = { row: Record<string, unknown> | null; at: number }

const partCache = new Map<string, CachedPart>()
const entityCache = new Map<string, CachedEntity>()

export interface InListToken {
    field: string
    ids: string[]
    shape: string
}

/** A concrete `t:` `in:` list. `@` references stay whole: the ids are not known yet. */
export function splitInToken(token: string): InListToken | null {
    const q = token.indexOf('?')
    if (q < 0 || !token.startsWith('t:')) return null
    const model = token.slice(2, q)
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(model)) return null
    const params = new URLSearchParams(token.slice(q + 1))
    let field = ''
    let ids: string[] = []
    for (const [key, value] of params.entries()) {
        if (!value.startsWith('in:')) continue
        if (field || value.includes('@')) return null
        field = key
        ids = value
            .slice(3)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
    }
    if (!field || ids.length === 0) return null
    const keys = [...new Set(params.keys())].sort()
    const bits = keys.map((key) => `${key}=${key === field ? 'in:$1' : (params.get(key) ?? '')}`)
    return { field, ids, shape: `t:${model}?${bits.join('&')}` }
}

function entityKey(scope: string, shape: string, id: string): string {
    return `${scope}\n${shape}\n${id}`
}

function replaceInIds(token: string, field: string, ids: string[]): string {
    const q = token.indexOf('?')
    const params = new URLSearchParams(token.slice(q + 1))
    params.set(field, `in:${ids.join(',')}`)
    return `${token.slice(0, q)}?${params.toString()}`
}

export interface NarrowedIn {
    wire: string
    rows: Record<string, unknown>[]
    missingIds: string[]
    field: string
    shape: string
}

/** Drops ids already cached for this shape. An empty wire means nothing has to travel. */
export function narrowInToken(token: string, now = Date.now()): NarrowedIn | null {
    const parsed = splitInToken(token)
    if (!parsed) return null
    const scope = cacheScope()
    const rows: Record<string, unknown>[] = []
    const missingIds: string[] = []
    for (const id of parsed.ids) {
        const hit = entityCache.get(entityKey(scope, parsed.shape, id))
        if (!hit || now - hit.at >= ENTITY_TTL_MS) {
            missingIds.push(id)
            continue
        }
        if (hit.row) rows.push(hit.row)
    }
    if (missingIds.length === parsed.ids.length) return null
    return {
        wire: missingIds.length === 0 ? '' : replaceInIds(token, parsed.field, missingIds),
        rows,
        missingIds,
        field: parsed.field,
        shape: parsed.shape,
    }
}

/** Stores one row per requested id. An id with no row is remembered as empty. */
export function rememberInRows(
    token: string,
    ids: string[],
    rows: unknown,
    now = Date.now(),
): void {
    const parsed = splitInToken(token)
    if (!parsed) return
    const scope = cacheScope()
    const seen = new Set<string>()
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (!row || typeof row !== 'object') continue
            const id = String((row as Record<string, unknown>)[parsed.field] ?? '').trim()
            if (!id) continue
            seen.add(id)
            entityCache.set(entityKey(scope, parsed.shape, id), {
                row: row as Record<string, unknown>,
                at: now,
            })
        }
    }
    for (const id of ids) {
        if (seen.has(id)) continue
        entityCache.set(entityKey(scope, parsed.shape, id), { row: null, at: now })
    }
}

export function resetQueryBatchCache(): void {
    partCache.clear()
    entityCache.clear()
    waiters = []
    if (timer != null) clearTimeout(timer)
    timer = null
}
let waiters: Waiter[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let transport: ApiClient | null = null

function mergeCachedRows(cached: Record<string, unknown>[] | undefined, part: QueryPart): QueryPart {
    if (!cached?.length) return part
    const fresh = Array.isArray(part.data) ? part.data : []
    return { ...part, data: [...cached, ...fresh] }
}

function cacheScope(): string {
    if (typeof localStorage === 'undefined') return ''
    try {
        const raw = localStorage.getItem('auth_user')
        if (!raw) return ''
        return String((JSON.parse(raw) as { organization_id?: string }).organization_id ?? '')
    } catch {
        return ''
    }
}

export function optionsModelFromUrl(url: string): string | null {
    const match = url.match(/^\/options\/([A-Za-z][A-Za-z0-9_]*)$/)
    return match ? match[1] : null
}

export function optionsBatchToken(
    model: string,
    field: string,
    query: string,
    limit: number | undefined,
    filter: string | undefined,
): string {
    const params = new URLSearchParams()
    params.set('field', field)
    if (query) params.set('q', query)
    if (typeof limit === 'number' && limit > 0) params.set('limit', String(limit))
    if (filter) params.set('filter_value', filter)
    return `o:${model}?${params.toString()}`
}

/** Names each distinct token so the server can key the response. */
export function nameBatchTokens(tokens: string[]): { name: string; token: string; plan: string }[] {
    const unique: string[] = []
    const seen = new Set<string>()
    for (const token of tokens) {
        if (seen.has(token)) continue
        seen.add(token)
        unique.push(token)
    }
    return unique.map((token, index) => {
        const name = `q${index + 1}`
        return { name, token, plan: `${name}=${token}` }
    })
}

export function loadQueryPart(api: ApiClient, token: string): Promise<QueryPart> {
    const cached = partCache.get(`${cacheScope()}\n${token}`)
    if (cached && Date.now() - cached.at < PART_TTL_MS && cached.part.success) {
        return Promise.resolve(cached.part)
    }
    const narrowed = narrowInToken(token)
    if (narrowed && narrowed.wire === '') {
        return Promise.resolve({ success: true, data: narrowed.rows, meta: { total: narrowed.rows.length } })
    }
    return new Promise((resolve, reject) => {
        transport = api
        waiters.push({
            token,
            wire: narrowed?.wire ?? token,
            resolve,
            reject,
            cachedRows: narrowed?.rows,
            missingIds: narrowed?.missingIds,
            field: narrowed?.field,
        })
        if (timer == null) timer = setTimeout(() => void flushQueryBatch(), WINDOW_MS)
    })
}

async function flushQueryBatch() {
    timer = null
    const batch = waiters
    waiters = []
    const api = transport
    if (!api || batch.length === 0) return
    const named = nameBatchTokens(batch.map((waiter) => waiter.wire))
    const byToken = new Map(named.map((part) => [part.token, part.name]))
    const inm: Record<string, string> = {}
    const scope = cacheScope()
    for (const part of named) {
        const cached = partCache.get(`${scope}\n${part.token}`)
        if (cached?.part.etag) inm[part.name] = cached.part.etag
    }
    try {
        const res = await api.post('/q', { parts: named.map((part) => part.plan), inm })
        const body = res?.data
        if (!body || body.success !== true || !body.parts) {
            throw new Error('batch unavailable')
        }
        for (const waiter of batch) {
            const name = byToken.get(waiter.wire)
            const part = name ? (body.parts[name] as QueryPart | undefined) : undefined
            if (!part) {
                waiter.reject(new Error('batch part missing'))
                continue
            }
            if (part.not_modified) {
                const cached = partCache.get(`${scope}\n${waiter.token}`)
                if (cached) {
                    waiter.resolve(cached.part)
                    continue
                }
            }
            const merged = mergeCachedRows(waiter.cachedRows, part)
            if (waiter.missingIds && waiter.field) {
                rememberInRows(waiter.token, waiter.missingIds, part.data)
            }
            if (part.success) {
                partCache.set(`${scope}\n${waiter.token}`, { part: merged, at: Date.now() })
            }
            waiter.resolve(merged)
        }
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        for (const waiter of batch) waiter.reject(error)
    }
}

function canonicalParams(params?: Record<string, unknown>): string {
    if (!params) return ''
    const keys = Object.keys(params)
        .filter((key) => params[key] != null && params[key] !== '')
        .sort()
    const search = new URLSearchParams()
    for (const key of keys) search.set(key, String(params[key]))
    return search.toString()
}

/**
 * Token for a host GET that the batch can serve. Custom endpoints, aggregates
 * and `/me` stay on the legacy GET.
 */
export function tokenForGet(url: string, params?: Record<string, unknown>): string | null {
    const [path, query = ''] = url.split('?')
    const table = path.match(/^\/metadata\/table\/([A-Za-z][A-Za-z0-9_]*)$/)
    if (table) return `m:${table[1]}`
    const modal = path.match(/^\/metadata\/modal\/([A-Za-z][A-Za-z0-9_]*)$/)
    if (modal) return `mm:${modal[1]}`
    const list = path.match(/^\/data\/([A-Za-z][A-Za-z0-9_]*)$/)
    if (list) {
        const q = canonicalParams(params)
        return q ? `t:${list[1]}?${q}` : `t:${list[1]}`
    }
    const opt = path.match(/^\/options\/([A-Za-z][A-Za-z0-9_]*)$/)
    if (!opt) return null
    const search = new URLSearchParams(query)
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value != null && value !== '') search.set(key, String(value))
        }
    }
    const limit = Number(search.get('limit'))
    return optionsBatchToken(
        opt[1],
        search.get('field') || 'id',
        search.get('q') || search.get('search') || '',
        Number.isFinite(limit) && limit > 0 ? limit : undefined,
        search.get('filter_value') || undefined,
    )
}

function batchForbidden(message?: string): boolean {
    return /forbidden|permiso/i.test(message || '')
}

/**
 * GET through the batch when the URL is a list, table metadata, modal metadata
 * or options read. Anything the batch refuses falls back to the original GET.
 */
export async function batchGet(api: ApiClient, url: string, config?: { params?: Record<string, unknown> }) {
    const token = tokenForGet(url, config?.params)
    if (!token) return api.get(url, config)
    try {
        const part = await loadQueryPart(api, token)
        if (!part.success) {
            if (batchForbidden(part.message)) {
                const err = new Error(part.message || 'forbidden') as Error & {
                    status: number
                    response: { status: number }
                }
                err.status = 403
                err.response = { status: 403 }
                throw err
            }
            return api.get(url, config)
        }
        return { data: { success: true, data: part.data, meta: part.meta } }
    } catch (err) {
        const status = (err as { status?: number; response?: { status?: number } })?.status
            ?? (err as { response?: { status?: number } })?.response?.status
        if (status === 403) throw err
        return api.get(url, config)
    }
}
