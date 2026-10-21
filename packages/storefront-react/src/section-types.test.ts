import { describe, expect, it, vi } from 'vitest'
import { createSectionRegistry, defineSection, sectionTypesToOps, syncSectionTypes, validateOpsSectionTypes, SectionTypesValidationError } from './index.js'

const C = () => null
const promo = defineSection({
  type: 'promo_banner',
  label: 'Promo',
  description: 'Banner',
  category: 'marketing',
  maxPerPage: 2,
  schema: {
    title: { label: 'Título', kind: 'text', required: true, max: 80 },
    link_url: { label: 'Enlace', kind: 'url', default: '/' },
    bg: { label: 'Color', kind: 'color' },
    picks: { label: 'Productos', kind: 'products' },
    tone: { label: 'Tono', kind: 'select', options: [{ value: 'a', label: 'A' }] },
    cards: { label: 'Tarjetas', kind: 'list', items: { name: { label: 'Nombre', kind: 'text' }, pic: { label: 'Foto', kind: 'image' } } },
  },
  component: C,
})
const hero = defineSection({ type: 'hero', schema: { title: { label: 'T', kind: 'text' }, extra: { label: 'E', kind: 'text' } }, component: C })

describe('sectionTypesToOps', () => {
  it('converts kinds, items->fields and metadata; excludes builtin with warning', () => {
    const { types, warnings } = createSectionRegistry([promo, hero]).toOpsSectionTypes()
    expect(types).toHaveLength(1)
    const t = types[0]!
    expect(t).toMatchObject({ type: 'promo_banner', label: 'Promo', description: 'Banner', category: 'marketing', max_per_page: 2 })
    const byKey = Object.fromEntries(t.schema.props.map((p) => [p.key, p]))
    expect(byKey.title).toMatchObject({ kind: 'text', required: true, max: 80 })
    expect(byKey.link_url).toMatchObject({ kind: 'text', default: '/' })
    expect(byKey.bg!.kind).toBe('text')
    expect(byKey.picks!.kind).toBe('product_list')
    expect(byKey.cards!.fields!.map((f) => [f.key, f.kind])).toEqual([['name', 'text'], ['pic', 'image']])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.type).toBe('hero')
  })

  it('warns only about extra props when builtinProps is given; includes builtin when excludeBuiltin=false', () => {
    const r = sectionTypesToOps([hero], { builtinProps: { hero: ['title'] } })
    expect(r.types).toEqual([])
    expect(r.warnings.map((w) => w.prop)).toEqual(['extra'])
    expect(sectionTypesToOps([hero], { excludeBuiltin: false }).types).toHaveLength(1)
  })

  it('throws with paths for invalid definitions', () => {
    const bad = defineSection({
      type: 'bad',
      schema: { camelCase: { label: '', kind: 'text' }, l: { label: 'L', kind: 'list' }, s: { label: 'S', kind: 'select' }, w: { label: 'W', kind: 'weird' as any } },
      component: C,
    })
    try {
      sectionTypesToOps([bad])
      throw new Error('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(SectionTypesValidationError)
      const paths = (e as SectionTypesValidationError).issues.map((i) => i.path)
      expect(paths).toContain('bad.schema.props[0].key')
      expect(paths).toContain('bad.schema.props[0].label')
      expect(paths).toContain('bad.schema.props[1].fields')
      expect(paths).toContain('bad.schema.props[2].options')
      expect(paths.some((p) => p.endsWith('.w.kind'))).toBe(true)
    }
  })

  it('validateOpsSectionTypes flags duplicates and empty labels', () => {
    const t = { type: 'x', label: '', schema: { props: [] } }
    const issues = validateOpsSectionTypes([t, t])
    expect(issues.map((i) => i.message)).toEqual(expect.arrayContaining(['label is required', 'duplicate type "x"']))
  })
})

describe('syncSectionTypes', () => {
  it('PUTs with sk_ token via fetch and returns counts', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { created: ['promo_banner'], updated: [] } }), { status: 200 }))
    const r = await syncSectionTypes({ baseUrl: 'https://ops.test/api/gw/', token: 'sk_x', fetch: fetchMock as any }, createSectionRegistry([promo, hero]))
    expect(r).toMatchObject({ created: 1, updated: 0 })
    expect(r.warnings).toHaveLength(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ops.test/api/gw/storefront/content/section-types')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_x')
    expect(JSON.parse(init.body as string).section_types[0].type).toBe('promo_banner')
  })

  it('rejects pk_ tokens, local errors before any request, and HTTP errors', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'nope' }), { status: 403 }))
    await expect(syncSectionTypes({ baseUrl: 'https://o', token: 'pk_x', fetch: fetchMock as any }, [promo])).rejects.toThrow(TypeError)
    const bad = defineSection({ type: 'b', schema: { L: { label: 'x', kind: 'text' } }, component: C })
    await expect(syncSectionTypes({ baseUrl: 'https://o', token: 'sk_x', fetch: fetchMock as any }, [bad])).rejects.toBeInstanceOf(SectionTypesValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(syncSectionTypes({ baseUrl: 'https://o', token: 'sk_x', fetch: fetchMock as any }, [promo])).rejects.toMatchObject({ status: 403 })
  })

  it('uses a client.request when given one', async () => {
    const request = vi.fn(async () => ({ created: 2, updated: 3 }))
    const r = await syncSectionTypes({ request } as any, [promo])
    expect(r).toMatchObject({ created: 2, updated: 3 })
    expect(request.mock.calls[0]![0]).toMatchObject({ method: 'PUT', path: '/storefront/content/section-types' })
  })
})
