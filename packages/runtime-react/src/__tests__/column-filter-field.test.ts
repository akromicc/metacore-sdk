import { describe, it, expect, vi } from 'vitest'
import { applyColumnFilterFields } from '../column-filter-field'
import type { ColumnFilterConfig } from '../dynamic-columns-shim'

const cfg = (
    filterKey: string,
    options: ColumnFilterConfig['options'] = [],
    selectedValues: string[] = [],
    onFilterChange: ColumnFilterConfig['onFilterChange'] = vi.fn(),
): ColumnFilterConfig => ({ filterType: 'select', filterKey, options, selectedValues, onFilterChange })

describe('applyColumnFilterFields', () => {
    it('uses the FK as filterKey and adopts its options and selection', () => {
        const display = cfg('institution_type.name', [{ label: 'Clínica', value: 'Clínica' }])
        const field = {
            ...cfg('institution_type_id', [{ label: 'Clínica', value: '5' }], ['5']),
            searchEndpoint: '/options/institution_types?field=id',
        }
        const original = new Map([
            ['institution_type.name', display],
            ['institution_type_id', field],
        ])
        const out = applyColumnFilterFields(
            [{ key: 'institution_type.name', filterField: 'institution_type_id' }],
            original,
        )
        expect(out.get('institution_type.name')).toMatchObject({
            filterKey: 'institution_type_id',
            options: [{ label: 'Clínica', value: '5' }],
            selectedValues: ['5'],
            searchEndpoint: '/options/institution_types?field=id',
        })
        expect(original.get('institution_type.name')).toBe(display)
    })

    it('keeps the column option source when there is no separate field config', () => {
        const own = { ...cfg('user.avatar', [{ label: 'Uno', value: '42' }]), searchEndpoint: '/search/x' }
        const out = applyColumnFilterFields([{ key: 'user.avatar', filterField: 'user_id' }], new Map([['user.avatar', own]]))
        expect(out.get('user.avatar')).toMatchObject({
            filterKey: 'user_id',
            options: [{ label: 'Uno', value: '42' }],
            searchEndpoint: '/search/x',
        })
    })

    it('propagates selections under the filterField key (also snake_case)', () => {
        const onChange = vi.fn()
        const out = applyColumnFilterFields(
            [{ key: 'a.name', filter_field: 'a_id' }],
            new Map([['a.name', cfg('a.name', [], [], onChange)]]),
        )
        const c = out.get('a.name')!
        c.onFilterChange(c.filterKey, ['5', '8'])
        c.onFilterChange(c.filterKey, [])
        expect(onChange.mock.calls).toEqual([
            ['a_id', ['5', '8']],
            ['a_id', []],
        ])
    })

    it('is identical without filterField or when it equals the key', () => {
        const configs = new Map([['a', cfg('a')]])
        expect(applyColumnFilterFields([{ key: 'a' }], configs)).toBe(configs)
        expect(applyColumnFilterFields([{ key: 'a', filterField: 'a' }], configs)).toBe(configs)
        expect(applyColumnFilterFields(undefined, configs)).toBe(configs)
    })
})
