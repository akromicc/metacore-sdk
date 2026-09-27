import { describe, expect, it } from 'vitest'
import { visibleRelationInclude } from './list-include'
import type { ColumnDefinition } from './types'

function col(partial: Partial<ColumnDefinition> & { key: string }): ColumnDefinition {
    return { label: partial.key, type: 'text', sortable: false, filterable: false, ...partial }
}

describe('visibleRelationInclude', () => {
    it('omits the parameter when the table has no relations', () => {
        expect(visibleRelationInclude([col({ key: 'name' })])).toBeUndefined()
        expect(visibleRelationInclude(undefined)).toBeUndefined()
    })

    it('lists only the visible relation columns', () => {
        const include = visibleRelationInclude([
            col({ key: 'name' }),
            col({ key: 'customer_id', type: 'relation' }),
            col({ key: 'warehouse_id', ref: 'inventory.Warehouse', hidden: true }),
            col({ key: 'created_by', type: 'creator' }),
            col({ key: 'items', item_fields: [{ key: 'product_id', label: 'Producto' }] }),
        ])
        expect(include).toBe('customer_id,created_by,items')
    })

    it('drops a column the view hid', () => {
        const include = visibleRelationInclude(
            [col({ key: 'customer_id', type: 'relation' }), col({ key: 'user_id', type: 'user' })],
            ['user_id'],
        )
        expect(include).toBe('customer_id')
    })
})
