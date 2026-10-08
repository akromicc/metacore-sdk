import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUpdateController, type UpdateRegistration } from '../src/update-controller'

class Target {
  private l = new Map<string, Set<(e: unknown) => void>>()
  addEventListener(t: string, fn: (e: unknown) => void) {
    if (!this.l.has(t)) this.l.set(t, new Set())
    this.l.get(t)?.add(fn)
  }
  removeEventListener(t: string, fn: (e: unknown) => void) {
    this.l.get(t)?.delete(fn)
  }
  emit(t: string) {
    this.l.get(t)?.forEach((fn) => fn({}))
  }
}

function setup(opts: Parameters<typeof createUpdateController>[0] = {}, safe = true) {
  const store = new Map<string, string>()
  const container = new Target()
  const doc = Object.assign(new Target(), { visibilityState: 'visible' as DocumentVisibilityState })
  const win = new Target()
  const posted: unknown[] = []
  const waiting = { postMessage: (m: unknown) => posted.push(m) }
  const reg = Object.assign(new Target(), {
    waiting: null as unknown,
    installing: null as unknown,
    update: vi.fn(() => Promise.resolve()),
  })
  const reload = vi.fn()
  let isSafe = safe
  const ctrl = createUpdateController(
    { isSafeToApply: () => isSafe, ...opts },
    {
      now: () => Date.now(),
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
      },
      container: container as unknown as ServiceWorkerContainer,
      doc: doc as unknown as Document,
      win: win as unknown as Window,
      reload,
    },
  )
  return {
    ctrl, reg: reg as unknown as UpdateRegistration & { update: typeof reg.update; waiting: unknown },
    regRaw: reg, waiting, posted, reload, container, doc, store, setSafe: (v: boolean) => (isSafe = v),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('update controller', () => {
  it('no waiting worker: nothing pending', () => {
    const t = setup()
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    expect(t.ctrl.getSnapshot().updatePending).toBe(false)
  })

  it('waiting -> prompt; accept -> SKIP_WAITING -> controllerchange -> exactly ONE reload', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    expect(t.ctrl.getSnapshot().updatePending).toBe(true)
    t.ctrl.applyNow()
    t.ctrl.applyNow() // double click
    expect(t.posted).toEqual([{ type: 'SKIP_WAITING' }])
    expect(t.reload).not.toHaveBeenCalled()
    t.container.emit('controllerchange')
    vi.advanceTimersByTime(10_000) // fallback must not double-reload
    expect(t.reload).toHaveBeenCalledTimes(1)
    t.ctrl.stop()
  })

  it('reloads via fallback when controllerchange never fires', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting
    t.ctrl.attach(t.reg)
    t.ctrl.applyNow()
    vi.advanceTimersByTime(4999)
    expect(t.reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(t.reload).toHaveBeenCalledTimes(1)
  })

  it('dismiss hides the prompt until the TTL', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting
    t.ctrl.attach(t.reg)
    t.ctrl.dismiss()
    expect(t.ctrl.getSnapshot().updatePending).toBe(false)
    t.ctrl.evaluate()
    expect(t.ctrl.getSnapshot().updatePending).toBe(false)
    vi.advanceTimersByTime(60 * 60 * 1000 + 1)
    t.ctrl.evaluate()
    expect(t.ctrl.getSnapshot().updatePending).toBe(true)
  })

  it('accepted flag survives a reload: new controller applies silently, no prompt', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting
    t.ctrl.attach(t.reg)
    t.ctrl.applyNow()
    // simulate the reload losing the race: new page, same storage, worker still waiting
    const again = createUpdateController(
      { isSafeToApply: () => true },
      {
        now: () => Date.now(),
        storage: {
          getItem: (k) => t.store.get(k) ?? null,
          setItem: (k, v) => void t.store.set(k, v),
          removeItem: (k) => void t.store.delete(k),
        },
        container: t.container as unknown as ServiceWorkerContainer,
        doc: t.doc as unknown as Document,
        win: undefined,
        reload: t.reload,
      },
    )
    const seen: boolean[] = []
    again.subscribe((s) => seen.push(s.updatePending))
    again.attach(t.reg)
    expect(t.posted).toHaveLength(2)
    expect(seen).not.toContain(true)
  })

  it('default policy never auto-applies even after weeks', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000)
    expect(t.posted).toHaveLength(0)
    expect(t.reload).not.toHaveBeenCalled()
    t.ctrl.stop()
  })

  it('autoApplyAfterMs applies on its own, but waits for a safe moment', () => {
    const t = setup({ policy: { autoApplyAfterMs: 60_000 } }, false)
    t.regRaw.waiting = t.waiting
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    vi.advanceTimersByTime(5 * 60_000)
    expect(t.posted).toHaveLength(0)
    t.setSafe(true)
    vi.advanceTimersByTime(15_000)
    expect(t.posted).toEqual([{ type: 'SKIP_WAITING' }])
    t.container.emit('controllerchange')
    expect(t.reload).toHaveBeenCalledTimes(1)
    t.ctrl.stop()
  })

  it('updatefound -> installed detects the waiting worker immediately', () => {
    const t = setup()
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    const installing = Object.assign(new Target(), { state: 'installing' })
    t.regRaw.installing = installing
    t.regRaw.emit('updatefound')
    t.regRaw.waiting = t.waiting
    installing.state = 'installed'
    installing.emit('statechange')
    expect(t.ctrl.getSnapshot().updatePending).toBe(true)
    t.ctrl.stop()
  })

  it('polls update() only while visible and on returning to the tab', () => {
    const t = setup({ checkIntervalMs: 1000 })
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    const n0 = t.reg.update.mock.calls.length
    vi.advanceTimersByTime(3000)
    expect(t.reg.update.mock.calls.length).toBe(n0 + 3)
    t.doc.visibilityState = 'hidden'
    vi.advanceTimersByTime(3000)
    expect(t.reg.update.mock.calls.length).toBe(n0 + 3)
    t.doc.visibilityState = 'visible'
    t.doc.emit('visibilitychange')
    expect(t.reg.update.mock.calls.length).toBe(n0 + 4)
    t.ctrl.stop()
  })

  it('versionCheck: drift marks stale, forces update() now and uses the stale threshold', async () => {
    let latest: string | undefined = 'abc'
    const t = setup({
      policy: { staleAutoApplyAfterMs: 30_000 },
      versionCheck: { current: 'abc', fetchLatest: async () => latest, intervalMs: 60_000 },
    })
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    await vi.advanceTimersByTimeAsync(0)
    expect(t.ctrl.getSnapshot().stale).toBe(false)
    const n0 = t.reg.update.mock.calls.length
    latest = 'def'
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.ctrl.getSnapshot().stale).toBe(true)
    expect(t.reg.update.mock.calls.length).toBeGreaterThan(n0)
    t.regRaw.waiting = t.waiting
    t.ctrl.evaluate()
    await vi.advanceTimersByTimeAsync(31_000)
    expect(t.posted).toEqual([{ type: 'SKIP_WAITING' }])
    t.ctrl.stop()
  })

  it('versionCheck errors or unknown version never mark stale', async () => {
    const t = setup({ versionCheck: { current: 'a', fetchLatest: async () => { throw new Error('x') } } })
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    await vi.advanceTimersByTimeAsync(0)
    expect(t.ctrl.getSnapshot().stale).toBe(false)
    t.ctrl.stop()
  })
})
