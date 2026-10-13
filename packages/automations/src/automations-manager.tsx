import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, Bot, CalendarClock, FlaskConical, Pause, Pencil, Play, Plus, Trash2, Wrench, Zap } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@asteby/metacore-ui'
import { apiErrorMessage, type AutomationsApi } from './api'
import { useAutomationActions, useAutomationCatalog, useAutomationRuns, useAutomations } from './hooks'
import { makeT, type AutomationsT } from './messages'
import { SpecEditor } from './spec-editor'
import type { Automation, AutomationRun, AutomationStatus, RunOutput, TranslateFn } from './types'

export interface AutomationsManagerProps {
  api: AutomationsApi
  /** i18next-compatible translate; Spanish built in. */
  t?: TranslateFn
  notify?: { success: (msg: string) => void; error: (msg: string) => void }
  /** Opens an app-relative link. */
  onNavigate?: (path: string) => void
  /** Pre-selects an automation (e.g. from ?id= in the URL). */
  selectedId?: string
  onSelect?: (id: string | undefined) => void
  /** Header slot (e.g. the host's PageHeader actions). */
  header?: ReactNode
  /** Locale used for dates (default es-MX). */
  locale?: string
  className?: string
}

const TONE: Record<AutomationStatus, 'warning' | 'success' | 'muted' | 'danger' | 'info'> = {
  proposed: 'warning',
  active: 'success',
  paused: 'muted',
  error: 'danger',
  completed: 'info',
  archived: 'muted',
}

const FILTERS: Array<AutomationStatus | 'all'> = ['all', 'proposed', 'active', 'paused', 'error']

function fmt(iso: string | undefined, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}

export function AutomationsManager({ api, t: tIn, notify, onNavigate, selectedId, onSelect, header, locale = 'es-MX', className }: AutomationsManagerProps) {
  const t = useMemo(() => makeT(tIn), [tIn])
  const [filter, setFilter] = useState<AutomationStatus | 'all'>('all')
  const [selected, setSelected] = useState<string | undefined>(selectedId)
  const [editing, setEditing] = useState<{ id?: string } | null>(null)
  useEffect(() => setSelected(selectedId), [selectedId])
  const list = useAutomations(api)
  const catalog = useAutomationCatalog(api)
  const actions = useAutomationActions(api)
  const select = (id: string | undefined) => {
    setSelected(id)
    setEditing(null)
    onSelect?.(id)
  }
  const items = (list.data ?? []).filter((a) => filter === 'all' || a.status === filter)
  const current = (list.data ?? []).find((a) => a.id === selected)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.data?.length ?? 0 }
    for (const a of list.data ?? []) c[a.status] = (c[a.status] ?? 0) + 1
    return c
  }, [list.data])

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      notify?.success(label)
    } catch (e) {
      notify?.error(apiErrorMessage(e, t('automations.error')))
    }
  }

  const showDetail = !!current || !!editing
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h1 className='m-0 text-xl font-semibold tracking-tight'>{t('automations.title')}</h1>
          <p className='m-0 mt-1 max-w-2xl text-sm text-muted-foreground'>{t('automations.subtitle')}</p>
        </div>
        <div className='flex items-center gap-2'>
          {header}
          <Button onClick={() => { setSelected(undefined); setEditing({}) }} disabled={!catalog.data}>
            <Plus className='size-4' /> {t('automations.new')}
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-1.5' role='tablist' aria-label={t('automations.title')}>
        {FILTERS.map((f) => (
          <Button key={f} size='sm' role='tab' aria-selected={filter === f} variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {t(`automations.filter.${f}` as never)}
            <span className='ml-1 tabular-nums opacity-70'>{counts[f] ?? 0}</span>
          </Button>
        ))}
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]'>
        <section aria-label={t('automations.title')} className={cn('flex flex-col gap-2', showDetail && 'hidden lg:flex')}>
          {list.isLoading ? (
            <p className='text-sm text-muted-foreground' role='status'>{t('automations.loading')}</p>
          ) : list.isError ? (
            <Card className='py-4'>
              <CardContent className='flex items-center gap-3 px-4 text-sm'>
                <AlertTriangle className='size-4 text-destructive' aria-hidden />
                {t('automations.load_error')}
                <Button size='sm' variant='outline' onClick={() => void list.refetch()}>{t('automations.retry')}</Button>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card className='py-6'>
              <CardContent className='px-4 text-center text-sm text-muted-foreground'>
                {filter === 'all' ? t('automations.empty') : t('automations.empty_filter')}
              </CardContent>
            </Card>
          ) : (
            <ul className='m-0 flex list-none flex-col gap-2 p-0'>
              {items.map((a) => (
                <li key={a.id}>
                  <AutomationRow a={a} t={t} locale={locale} active={a.id === selected} onClick={() => select(a.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-live='polite' className={cn(!showDetail && 'hidden lg:block')}>
          {editing && catalog.data ? (
            <Card className='py-4'>
              <CardHeader className='px-4'>
                <CardTitle className='text-base'>{editing.id ? t('editor.title_edit') : t('editor.title_new')}</CardTitle>
              </CardHeader>
              <CardContent className='px-4'>
                <SpecEditor
                  key={editing.id ?? 'new'}
                  catalog={catalog.data}
                  t={t}
                  initial={editing.id ? current?.spec : undefined}
                  initialKind={current && editing.id ? current.kind : 'automation'}
                  lockKind={!!editing.id}
                  saving={actions.save.isPending}
                  error={actions.save.error ? apiErrorMessage(actions.save.error, t('automations.error')) : null}
                  onCancel={() => setEditing(null)}
                  onSubmit={(spec, kind) =>
                    actions.save.mutate(
                      { id: editing.id, kind, spec, version: editing.id ? current?.version : undefined },
                      {
                        onSuccess: (a) => {
                          notify?.success(t('automations.done'))
                          setEditing(null)
                          select(a.id)
                        },
                      },
                    )
                  }
                />
              </CardContent>
            </Card>
          ) : current ? (
            <AutomationDetail
              a={current}
              api={api}
              t={t}
              locale={locale}
              onNavigate={onNavigate}
              onBack={() => select(undefined)}
              onEdit={() => setEditing({ id: current.id })}
              busy={Object.values(actions).some((m) => m.isPending)}
              onConfirm={() => run(t('automations.done'), () => actions.confirm.mutateAsync(current.id))}
              onPause={() => run(t('automations.done'), () => actions.pause.mutateAsync(current.id))}
              onResume={() => run(t('automations.done'), () => actions.resume.mutateAsync(current.id))}
              onDelete={() => {
                if (typeof window !== 'undefined' && !window.confirm(t('automations.delete_confirm'))) return
                void run(t('automations.done'), async () => {
                  await actions.archive.mutateAsync(current.id)
                  select(undefined)
                })
              }}
              onTest={(dryRun) => actions.run.mutateAsync({ id: current.id, dryRun })}
            />
          ) : (
            <Card className='hidden py-10 lg:block'>
              <CardContent className='px-4 text-center text-sm text-muted-foreground'>{t('automations.select')}</CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}

function KindIcon({ a }: { a: Automation }) {
  const Icon = a.kind === 'tool' ? Wrench : a.trigger_type === 'event' ? Zap : CalendarClock
  return <Icon className='size-4 shrink-0 text-primary' aria-hidden />
}

function AutomationRow({ a, t, locale, active, onClick }: { a: Automation; t: AutomationsT; locale: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        'flex w-full flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active && 'border-primary/50 bg-primary/5',
      )}
    >
      <span className='flex items-center gap-2'>
        <KindIcon a={a} />
        <span className='min-w-0 flex-1 truncate text-sm font-medium'>{a.name}</span>
        <Badge variant={TONE[a.status]}>{t(`automations.status.${a.status}` as never)}</Badge>
      </span>
      <span className='truncate text-xs text-muted-foreground'>{a.trigger_label}</span>
      <span className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
        <span className='inline-flex items-center gap-1'>
          {a.assisted_by ? <Bot className='size-3' aria-hidden /> : null}
          {a.authorship}
        </span>
        {a.next_run_at ? <span>{t('automations.next_run')}: {fmt(a.next_run_at, locale)}</span> : null}
      </span>
    </button>
  )
}

interface DetailProps {
  a: Automation
  api: AutomationsApi
  t: AutomationsT
  locale: string
  busy: boolean
  onNavigate?: (path: string) => void
  onBack: () => void
  onEdit: () => void
  onConfirm: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
  onTest: (dryRun: boolean) => Promise<{ run: AutomationRun; output?: RunOutput; error?: string }>
}

function AutomationDetail({ a, api, t, locale, busy, onNavigate, onBack, onEdit, onConfirm, onPause, onResume, onDelete, onTest }: DetailProps) {
  const runs = useAutomationRuns(api, a.id)
  const [preview, setPreview] = useState<{ output?: RunOutput; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  useEffect(() => setPreview(null), [a.id])
  const test = async (dry: boolean) => {
    setTesting(true)
    try {
      const r = await onTest(dry)
      setPreview({ output: r.output, error: r.error })
    } catch (e) {
      setPreview({ error: apiErrorMessage(e, t('automations.error')) })
    } finally {
      setTesting(false)
    }
  }
  const fields: Array<[string, ReactNode]> = [
    [t('automations.when'), a.trigger_label],
    [t('automations.authorship'), a.authorship],
  ]
  if (a.authorized_by_name || a.authorized_at) fields.push([t('automations.authorized'), `${a.authorized_by_name ?? ''} · ${fmt(a.authorized_at, locale)}`])
  if (a.tools?.length) fields.push([t('automations.tools'), a.tools.join(', ')])
  if (a.channels?.length) fields.push([t('automations.channels'), a.channels.map((c) => t(`automations.channel.${c}` as never)).join(', ')])
  fields.push([t('automations.uses_llm'), a.uses_llm ? t('automations.uses_llm.yes') : t('automations.uses_llm.no')])
  if (a.next_run_at) fields.push([t('automations.next_run'), fmt(a.next_run_at, locale)])
  if (a.last_run_at) fields.push([t('automations.last_run'), fmt(a.last_run_at, locale)])
  if (a.cost_usd_total > 0 || a.tokens_total > 0) fields.push([t('automations.cost'), `${a.tokens_total} tokens · US$${a.cost_usd_total.toFixed(4)}`])
  if (a.status_reason) fields.push([t('automations.reason'), a.status_reason])

  return (
    <div className='flex flex-col gap-3'>
      <Button variant='ghost' size='sm' className='self-start lg:hidden' onClick={onBack}>
        <ArrowLeft className='size-4' /> {t('automations.action.back')}
      </Button>
      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='flex flex-wrap items-center gap-2 text-base'>
            <KindIcon a={a} />
            {a.name}
            <Badge variant={TONE[a.status]}>{t(`automations.status.${a.status}` as never)}</Badge>
            {a.kind === 'tool' ? <Badge variant='muted'>{t('automations.kind.tool')}{a.tool_name ? ` · ${a.tool_name}` : ''}</Badge> : null}
          </CardTitle>
          {a.description ? <CardDescription>{a.description}</CardDescription> : null}
        </CardHeader>
        <CardContent className='flex flex-col gap-3 px-4'>
          {a.status === 'proposed' ? (
            <p className='m-0 rounded-md border border-[color-mix(in_oklab,var(--warning,oklch(0.68_0.16_70))_35%,transparent)] bg-[color-mix(in_oklab,var(--warning,oklch(0.68_0.16_70))_10%,transparent)] p-2 text-sm'>
              {t('automations.proposal_notice')}
            </p>
          ) : null}
          <dl className='m-0 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]'>
            {fields.map(([k, v]) => (
              <div key={k} className='contents'>
                <dt className='text-muted-foreground'>{k}</dt>
                <dd className='m-0 break-words'>{v}</dd>
              </div>
            ))}
          </dl>
          <div className='flex flex-wrap gap-2'>
            {a.status === 'proposed' ? (
              <>
                <Button size='sm' onClick={onConfirm} disabled={busy}>{t('automations.action.confirm')}</Button>
                <Button size='sm' variant='ghost' onClick={onDelete} disabled={busy}>{t('automations.action.discard')}</Button>
              </>
            ) : null}
            {a.status === 'active' ? (
              <Button size='sm' variant='outline' onClick={onPause} disabled={busy}>
                <Pause className='size-4' /> {t('automations.action.pause')}
              </Button>
            ) : null}
            {a.status === 'paused' || a.status === 'error' ? (
              <Button size='sm' variant='outline' onClick={onResume} disabled={busy}>
                <Play className='size-4' /> {t('automations.action.resume')}
              </Button>
            ) : null}
            {a.kind === 'automation' && a.status !== 'archived' ? (
              <Button size='sm' variant='outline' onClick={() => void test(true)} disabled={busy || testing}>
                <FlaskConical className='size-4' /> {t('automations.action.test')}
              </Button>
            ) : null}
            {a.status !== 'archived' ? (
              <Button size='sm' variant='outline' onClick={onEdit} disabled={busy}>
                <Pencil className='size-4' /> {t('automations.action.edit')}
              </Button>
            ) : null}
            {a.status !== 'proposed' && a.status !== 'archived' ? (
              <Button size='sm' variant='ghost' className='text-destructive' onClick={onDelete} disabled={busy}>
                <Trash2 className='size-4' /> {t('automations.action.delete')}
              </Button>
            ) : null}
          </div>
          {preview ? <Preview preview={preview} t={t} onNavigate={onNavigate} /> : null}
        </CardContent>
      </Card>
      <RunHistory runs={runs.data} loading={runs.isLoading} t={t} locale={locale} />
    </div>
  )
}

function Preview({ preview, t, onNavigate }: { preview: { output?: RunOutput; error?: string }; t: AutomationsT; onNavigate?: (p: string) => void }) {
  const o = preview.output
  return (
    <div className='flex flex-col gap-2 rounded-lg border border-dashed p-3' role='status'>
      <p className='m-0 text-xs font-medium text-muted-foreground'>{t('automations.preview')}</p>
      {preview.error ? <p className='m-0 text-sm text-destructive'>{preview.error}</p> : null}
      {o?.title ? <p className='m-0 text-sm font-semibold'>{o.title}</p> : null}
      {o?.text ? <p className='m-0 whitespace-pre-line text-sm'>{o.text}</p> : null}
      {o?.items?.length ? (
        <ul className='m-0 flex list-disc flex-col gap-1 pl-5 text-sm'>
          {o.items.map((it) => (
            <li key={it.key}>
              {it.url && /^https?:\/\//.test(it.url) ? (
                <a href={it.url} target='_blank' rel='noopener noreferrer nofollow' className='text-primary hover:underline'>
                  {it.title}
                </a>
              ) : it.url?.startsWith('/') && onNavigate ? (
                <button type='button' className='text-primary hover:underline' onClick={() => onNavigate(it.url!)}>
                  {it.title}
                </button>
              ) : (
                it.title
              )}
              {it.date ? <span className='text-muted-foreground'> · {it.date}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {(o?.notes ?? []).map((n, i) => (
        <p key={i} className='m-0 text-xs text-muted-foreground'>{n}</p>
      ))}
      {!preview.error && !o?.text && !o?.items?.length ? <p className='m-0 text-sm text-muted-foreground'>{t('automations.preview.empty')}</p> : null}
    </div>
  )
}

const RUN_DOT: Record<string, string> = {
  completed: 'bg-[var(--success,oklch(0.6_0.15_155))]',
  skipped: 'bg-muted-foreground',
  failed: 'bg-destructive',
  running: 'bg-[var(--info,oklch(0.62_0.13_235))]',
}

function RunHistory({ runs, loading, t, locale }: { runs?: AutomationRun[]; loading: boolean; t: AutomationsT; locale: string }) {
  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-sm'>{t('automations.history')}</CardTitle>
      </CardHeader>
      <CardContent className='px-4'>
        {loading ? (
          <p className='m-0 text-sm text-muted-foreground' role='status'>{t('automations.loading')}</p>
        ) : !runs?.length ? (
          <p className='m-0 text-sm text-muted-foreground'>{t('automations.history.empty')}</p>
        ) : (
          <ol className='m-0 flex list-none flex-col gap-3 border-l pl-4'>
            {runs.map((r) => (
              <li key={r.id} className='relative'>
                <span className={cn('absolute -left-[1.3rem] top-1.5 size-2.5 rounded-full ring-2 ring-background', RUN_DOT[r.status])} aria-hidden />
                <p className='m-0 flex flex-wrap items-center gap-1.5 text-sm font-medium'>
                  {t(`automations.run.${r.status}` as never)}
                  {r.dry_run ? <Badge variant='muted'>{t('automations.run.dry')}</Badge> : null}
                  {r.llm_used ? <Badge variant='info'>{t('automations.run.llm')}</Badge> : null}
                  {r.cache_hit ? <Badge variant='muted'>{t('automations.run.cache')}</Badge> : null}
                </p>
                <p className='m-0 text-xs text-muted-foreground'>
                  {fmt(r.started_at, locale)} · {r.duration_ms} ms
                  {r.deliveries ? ` · ${r.deliveries} ${t('automations.run.deliveries')}` : ''}
                  {r.cost_usd ? ` · US$${r.cost_usd.toFixed(4)}` : ''}
                </p>
                {r.error ? <p className='m-0 text-xs text-destructive'>{r.error}</p> : null}
                {r.output?.title && !r.dry_run ? <p className='m-0 truncate text-xs text-muted-foreground'>{r.output.title}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
