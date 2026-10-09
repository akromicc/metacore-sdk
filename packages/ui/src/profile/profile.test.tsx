import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Tabs } from '../primitives/tabs'
import {
  ContactLink,
  DefinitionList,
  EmptyState,
  PillTabsList,
  PillTabsTrigger,
  ProfileHeader,
  RecordList,
  RecordRow,
  SectionCard,
  StatStrip,
} from './index'

const Icon = ({ className }: { className?: string }) => <svg data-testid='icon' className={className} />

describe('SectionCard', () => {
  it('renders icon, title, badges and trailing action', () => {
    const html = renderToStaticMarkup(
      <SectionCard icon={Icon} title='Citas' badges={<span>3</span>} action={<button>Ver todas</button>}>
        cuerpo
      </SectionCard>
    )
    expect(html).toContain('data-slot="section-card"')
    expect(html).toContain('Citas')
    expect(html).toContain('Ver todas')
    expect(html).toContain('cuerpo')
  })
})

describe('StatStrip', () => {
  it('lays out one equal column per item and keeps dt before dd', () => {
    const html = renderToStaticMarkup(
      <StatStrip items={[{ label: 'Pacientes', value: 4 }, { label: 'Recetas', value: 9, highlight: true }]} />
    )
    expect(html).toContain('repeat(2, minmax(0, 1fr))')
    expect(html.indexOf('<dt')).toBeLessThan(html.indexOf('<dd'))
    expect(html).toContain('text-primary')
  })
})

describe('DefinitionList', () => {
  it('shows a muted fallback for empty values', () => {
    const html = renderToStaticMarkup(
      <DefinitionList items={[{ label: 'Teléfono', value: '555' }, { label: 'Correo' }, { label: 'Nota', value: '' }]} />
    )
    expect(html).toContain('555')
    expect(html.match(/No registrado/g)).toHaveLength(2)
  })
  it('accepts a custom empty label', () => {
    expect(renderToStaticMarkup(<DefinitionList emptyLabel='—' items={[{ label: 'A' }]} />)).toContain('—')
  })
})

describe('RecordRow', () => {
  it('is a plain row without onOpen', () => {
    const html = renderToStaticMarkup(
      <RecordList>
        <RecordRow icon={Icon} title='Receta #5' subtitle='01/10/2026' status={{ label: 'Activa', tone: 'success' }} />
      </RecordList>
    )
    expect(html).not.toContain('<button')
    expect(html).toContain('Activa')
    expect(html).toContain('var(--success')
  })
  it('becomes a full-width button with an accessible name when onOpen is set', () => {
    const html = renderToStaticMarkup(<RecordRow icon={Icon} title='Receta #5' onOpen={() => {}} />)
    expect(html).toContain('<button')
    expect(html).toContain('aria-label="Ver Receta #5"')
    expect(html).toContain('min-h-14')
  })
  it('keeps the brand tint for the primary tone', () => {
    const html = renderToStaticMarkup(<RecordRow icon={Icon} title='x' status={{ label: 'Ok', tone: 'primary' }} />)
    expect(html).toContain('bg-primary/10')
  })
})

describe('ContactLink / EmptyState', () => {
  it('ContactLink forwards href and keeps a 40px touch height', () => {
    const html = renderToStaticMarkup(<ContactLink icon={Icon} href='mailto:a@b.c'>a@b.c</ContactLink>)
    expect(html).toContain('href="mailto:a@b.c"')
    expect(html).toContain('min-h-10')
  })
  it('EmptyState renders title, description and action', () => {
    const html = renderToStaticMarkup(
      <EmptyState icon={Icon} title='Nada aquí' description='Crea el primero' action={<button>Crear</button>} />
    )
    expect(html).toContain('Nada aquí')
    expect(html).toContain('Crea el primero')
    expect(html).toContain('Crear')
  })
})

describe('PillTabs', () => {
  it('renders a sticky scrollable list with pill triggers', () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue='a'>
        <PillTabsList>
          <PillTabsTrigger value='a'>Resumen</PillTabsTrigger>
        </PillTabsList>
      </Tabs>
    )
    expect(html).toContain('sticky')
    expect(html).toContain('overflow-x-auto')
    expect(html).toContain('rounded-full')
  })
})

describe('ProfileHeader', () => {
  it('stacked: centers on phones and reserves a side column for actions on lg', () => {
    const html = renderToStaticMarkup(
      <ProfileHeader avatar={<i>A</i>} title='Ana' subtitle='Cédula 1' badges={<b>ID 1</b>} actions={<button>Editar</button>} />
    )
    expect(html).toContain('<h1')
    expect(html).toContain('items-center')
    expect(html).toContain('lg:w-44')
  })
  it('inline: keeps the avatar beside the title', () => {
    const html = renderToStaticMarkup(<ProfileHeader layout='inline' avatar={<i>A</i>} title='Ana' />)
    expect(html).not.toContain('lg:flex-row')
  })
})
