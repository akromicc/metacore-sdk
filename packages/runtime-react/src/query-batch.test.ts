import { describe, expect, it } from 'vitest'
import {
    nameBatchTokens,
    narrowInToken,
    optionsBatchToken,
    optionsModelFromUrl,
    rememberInRows,
    resetQueryBatchCache,
    splitInToken,
    tokenForGet,
} from './query-batch'

describe('query batch tokens', () => {
    it('names distinct tokens and keeps duplicates as one part', () => {
        const named = nameBatchTokens([
            'o:Customer?field=id',
            'o:Product?field=id',
            'o:Customer?field=id',
        ])
        expect(named).toEqual([
            { name: 'q1', token: 'o:Customer?field=id', plan: 'q1=o:Customer?field=id' },
            { name: 'q2', token: 'o:Product?field=id', plan: 'q2=o:Product?field=id' },
        ])
    })

    it('builds an options token from the canonical url', () => {
        expect(optionsModelFromUrl('/options/Customer')).toBe('Customer')
        expect(optionsModelFromUrl('/data/Customer')).toBeNull()
        expect(optionsBatchToken('Customer', 'id', 'lop', 20, undefined)).toBe(
            'o:Customer?field=id&q=lop&limit=20',
        )
    })

    it('keeps each in: id and asks only for the ones that are missing', () => {
        resetQueryBatchCache()
        const token = 't:Stock?per_page=200&product_id=in:a,b,c&skip_refs=1'
        expect(splitInToken(token)?.shape).toBe('t:Stock?per_page=200&product_id=in:$1&skip_refs=1')
        expect(splitInToken('t:Stock?product_id=in:@p1.id')).toBeNull()

        rememberInRows(token, ['a', 'b'], [{ product_id: 'a', quantity: 1 }])
        const narrowed = narrowInToken(token)
        expect(narrowed?.missingIds).toEqual(['c'])
        expect(narrowed?.rows).toEqual([{ product_id: 'a', quantity: 1 }])
        expect(narrowed?.wire).toContain('in%3Ac')
        expect(narrowed?.wire).not.toContain('%2Cb')

        rememberInRows(token, ['c'], [{ product_id: 'c', quantity: 4 }])
        const done = narrowInToken('t:Stock?product_id=in:a,c&per_page=200&skip_refs=1')
        expect(done?.wire).toBe('')
        expect(done?.rows).toEqual([
            { product_id: 'a', quantity: 1 },
            { product_id: 'c', quantity: 4 },
        ])
        resetQueryBatchCache()
    })

    it('maps table reads onto batch tokens and leaves aggregates on GET', () => {
        expect(tokenForGet('/metadata/table/Sale')).toBe('m:Sale')
        expect(tokenForGet('/metadata/modal/Sale')).toBe('mm:Sale')
        expect(tokenForGet('/data/Stock', { per_page: 20, page: 1, 'f_product_id': 'in:a,b' })).toBe(
            't:Stock?f_product_id=in%3Aa%2Cb&page=1&per_page=20',
        )
        expect(tokenForGet('/data/Stock/aggregate', { page: 1 })).toBeNull()
        expect(tokenForGet('/data/Stock/me')).toBeNull()
        expect(tokenForGet('/options/Customer?field=name&q=lop')).toBe('o:Customer?field=name&q=lop')
    })
})
