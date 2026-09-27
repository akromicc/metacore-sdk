import type { ColumnDefinition } from './types'

/**
 * Columns whose labels come from a relation lookup. The list asks the server
 * to resolve only these, so hidden foreign keys do not each become a query.
 * Returns undefined when nothing relational is visible: the server then keeps
 * resolving everything, which is what hosts do before they send `include=`.
 */
export function visibleRelationInclude(
    columns: ColumnDefinition[] | undefined,
    hidden: string[] = [],
): string | undefined {
    if (!columns?.length) return undefined
    const hide = new Set(hidden)
    const keys: string[] = []
    for (const col of columns) {
        if (!col?.key || col.hidden || hide.has(col.key)) continue
        if (col.visibility === 'modal' || col.visibility === 'list') continue
        if (!columnNeedsRelation(col)) continue
        keys.push(col.key)
    }
    if (keys.length === 0) return undefined
    return keys.join(',')
}

function columnNeedsRelation(col: ColumnDefinition): boolean {
    if (col.type === 'relation' || col.type === 'relation-badge-list' || col.type === 'creator' || col.type === 'user') {
        return true
    }
    if (col.cellStyle === 'relation' || col.cellStyle === 'reference') return true
    if (col.ref) return true
    if (col.itemFields?.length || col.item_fields?.length) return true
    return false
}
