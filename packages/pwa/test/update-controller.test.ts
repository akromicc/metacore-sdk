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

  // New page load sharing the same storage / registration (simulated reload).
  function reloaded(t: ReturnType<typeof setup>, opts: Parameters<typeof createUpdateController>[0] = {}) {
    return createUpdateController(
      { isSafeToApply: () => true, ...opts },
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
  }

  it('SKIP_WAITING ignored: after the reload the waiting worker persists -> prompt, NO second automatic reload', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting // sw.js that ignores SKIP_WAITING
    t.ctrl.attach(t.reg)
    t.ctrl.applyNow()
    vi.advanceTimersByTime(5001) // fallback reload
    expect(t.reload).toHaveBeenCalledTimes(1)
    expect(t.posted).toHaveLength(1)

    for (let i = 0; i < 3; i++) {
      const again = reloaded(t)
      const seen: boolean[] = []
      again.subscribe((s) => seen.push(s.updatePending))
      again.start()
      again.attach(t.reg)
      vi.advanceTimersByTime(60_000) // evaluate timer ticks while safe
      expect(again.getSnapshot().updatePending).toBe(true)
      expect(again.getSnapshot().applying).toBe(false)
      expect(t.posted).toHaveLength(1)
      expect(t.reload).toHaveBeenCalledTimes(1)
      expect(t.store.get('metacore_pwa_update_accepted_at')).toBeUndefined()
      again.stop()
    }
  })

  it('the guard also blocks autoApplyAfterMs within the TTL after an attempt', () => {
    const t = setup({ policy: { autoApplyAfterMs: 1000 } })
    t.regRaw.waiting = t.waiting
    t.ctrl.attach(t.reg)
    vi.advanceTimersByTime(2000)
    t.ctrl.applyNow()
    vi.advanceTimersByTime(5001)
    const again = reloaded(t, { policy: { autoApplyAfterMs: 1000 } })
    again.attach(t.reg)
    expect(t.posted).toHaveLength(1)
    expect(again.getSnapshot().updatePending).toBe(true)
  })

  it('an explicit user click after the failed attempt can retry', () => {
    const t = setup()
    t.regRaw.waiting = t.waiting
    t.ctrl.attach(t.reg)
    t.ctrl.applyNow()
    vi.advanceTimersByTime(5001)
    const again = reloaded(t)
    again.attach(t.reg)
    expect(again.getSnapshot().updatePending).toBe(true)
    again.applyNow() // explicit click
    expect(t.posted).toHaveLength(2)
    vi.advanceTimersByTime(5001)
    expect(t.reload).toHaveBeenCalledTimes(2)
  })

  it('applyNow does not renew a still-valid acceptance', () => {
    const t = setup()
    const accepted = String(Date.now() - 30_000)
    t.store.set('metacore_pwa_update_accepted_at', accepted)
    t.regRaw.waiting = t.waiting
    t.ctrl.attach(t.reg) // accepted vigente, no prior attempt -> applies once
    expect(t.posted).toHaveLength(1)
    expect(t.store.get('metacore_pwa_update_accepted_at')).toBe(accepted)
    expect(t.store.get('metacore_pwa_update_last_apply_attempt_at')).toBe(String(Date.now()))
  })

  it('a different waiting worker resets waitingSince and dismissal', () => {
    const t = setup({ policy: { autoApplyAfterMs: 60_000 } })
    const v1 = { scriptURL: '/sw.js?v=1', postMessage: (m: unknown) => t.posted.push(m) }
    t.regRaw.waiting = v1
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    t.ctrl.dismiss()
    vi.advanceTimersByTime(50_000)
    const sinceV1 = t.store.get('metacore_pwa_update_waiting_since')
    const v2 = { scriptURL: '/sw.js?v=2', postMessage: (m: unknown) => t.posted.push(m) }
    t.regRaw.waiting = v2
    t.ctrl.evaluate()
    expect(t.store.get('metacore_pwa_update_waiting_since')).not.toBe(sinceV1)
    expect(t.store.get('metacore_pwa_update_dismissed_at')).toBeUndefined()
    expect(t.ctrl.getSnapshot().updatePending).toBe(true)
    // v1's counter would already allow auto-apply at +10 s; v2 must wait its own 60 s
    vi.advanceTimersByTime(30_000)
    expect(t.posted).toHaveLength(0)
    vi.advanceTimersByTime(40_000)
    expect(t.posted).toHaveLength(1)
    t.ctrl.stop()
  })

  it('stop() removes statechange and controllerchange listeners', () => {
    const t = setup()
    t.ctrl.start()
    t.ctrl.attach(t.reg)
    const installing = Object.assign(new Target(), { state: 'installing' })
    t.regRaw.installing = installing
    t.regRaw.emit('updatefound')
    t.regRaw.waiting = t.waiting
    t.ctrl.stop()
    installing.state = 'installed'
    installing.emit('statechange')
    expect(t.ctrl.getSnapshot().updatePending).toBe(false)
    const t2 = setup()
    t2.regRaw.waiting = t2.waiting
    t2.ctrl.attach(t2.reg)
    t2.ctrl.applyNow()
    t2.ctrl.stop()
    t2.container.emit('controllerchange')
    expect(t2.reload).not.toHaveBeenCalled()
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
