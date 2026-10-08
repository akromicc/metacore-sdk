import {
  decideUpdate,
  isWithinTtl,
  resolveUpdatePolicy,
  type UpdatePolicy,
} from './update-policy'
import { installActivityTracking, isSafeSnapshot, readSafetySnapshot } from './dom-safety'

/**
 * Framework-free state machine that drives a service-worker update according to
 * an {@link UpdatePolicy}. The React hook / PWAProvider are thin wrappers, and
 * tests drive it with a fake registration.
 *
 * Effects: periodic `registration.update()` (visible tab only), re-check on
 * visibilitychange/focus, `updatefound` -> `statechange` detection of the
 * waiting worker, periodic re-evaluation while an update waits (so
 * `autoApplyAfterMs` and "becomes safe" are noticed), optional version-drift
 * check, and a single guarded reload after `SKIP_WAITING` -> `controllerchange`
 * (with a fallback timer).
 */

export interface VersionCheck {
  /** Version embedded in this build (e.g. commit hash via Vite `define`). */
  current: string
  /** Fetches the latest deployed version. Return undefined when unknown. The library assumes no endpoint. */
  fetchLatest: () => Promise<string | undefined>
  /** How often to compare. Default 5 min. */
  intervalMs?: number
}

export interface UpdateControllerOptions {
  policy?: Partial<UpdatePolicy>
  /** `registration.update()` cadence while visible. Default 5 min. 0 disables. */
  checkIntervalMs?: number
  /** Re-evaluation cadence while an update is waiting. Default 15 s. */
  evaluateIntervalMs?: number
  /** Replaces the default safe-moment test (modal/edit/idle). */
  isSafeToApply?: () => boolean
  versionCheck?: VersionCheck
  /** localStorage key prefix. Default `metacore_pwa_update`. */
  storagePrefix?: string
  /** Reload anyway if `controllerchange` never fires. Default 5 s. */
  reloadFallbackMs?: number
  /** Delay between `update()` and re-reading `registration.waiting`. Default 5 s. */
  postCheckDelayMs?: number
}

export type UpdateRegistration = Pick<
  ServiceWorkerRegistration,
  'waiting' | 'installing' | 'update' | 'addEventListener' | 'removeEventListener'
>

export interface UpdateControllerDeps {
  now: () => number
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined
  container: Pick<ServiceWorkerContainer, 'addEventListener' | 'removeEventListener'> | undefined
  doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | undefined
  win: Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined
  reload: () => void
}

export interface UpdateSnapshot {
  /** The prompt should be shown (decision === 'prompt'). */
  updatePending: boolean
  /** SKIP_WAITING sent, waiting for controllerchange/reload. */
  applying: boolean
  /** Client is known to be older than the server. */
  stale: boolean
}

export interface UpdateController {
  /** Binds the live registration and starts evaluating. */
  attach: (registration: UpdateRegistration) => void
  /** Starts listeners/timers (idempotent). Returns a disposer. */
  start: () => () => void
  stop: () => void
  evaluate: () => void
  applyNow: () => void
  dismiss: () => void
  getSnapshot: () => UpdateSnapshot
  subscribe: (fn: (s: UpdateSnapshot) => void) => () => void
}

const safeStorage = (): UpdateControllerDeps['storage'] => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function defaultDeps(): UpdateControllerDeps {
  const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  return {
    now: () => Date.now(),
    storage: safeStorage(),
    container: hasSW ? navigator.serviceWorker : undefined,
    doc: typeof document === 'undefined' ? undefined : document,
    win: typeof window === 'undefined' ? undefined : window,
    reload: () => window.location.reload(),
  }
}

export function createUpdateController(
  options: UpdateControllerOptions = {},
  depsOverride: Partial<UpdateControllerDeps> = {},
): UpdateController {
  const deps: UpdateControllerDeps = { ...defaultDeps(), ...depsOverride }
  const policy = resolveUpdatePolicy(options.policy)
  const checkIntervalMs = options.checkIntervalMs ?? 5 * 60 * 1000
  const evaluateIntervalMs = options.evaluateIntervalMs ?? 15 * 1000
  const fallbackMs = options.reloadFallbackMs ?? 5000
  const postCheckMs = options.postCheckDelayMs ?? 5000
  const prefix = options.storagePrefix ?? 'metacore_pwa_update'
  const K = {
    since: `${prefix}_waiting_since`,
    dismissed: `${prefix}_dismissed_at`,
    accepted: `${prefix}_accepted_at`,
    attempt: `${prefix}_last_apply_attempt_at`,
  }

  const read = (key: string): number | undefined => {
    try {
      const v = deps.storage?.getItem(key)
      if (!v) return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    } catch {
      return undefined
    }
  }
  const write = (key: string, value: number | undefined) => {
    try {
      if (value === undefined) deps.storage?.removeItem(key)
      else deps.storage?.setItem(key, String(value))
    } catch {
      /* storage unavailable: policy degrades to in-session behaviour */
    }
  }

  let registration: UpdateRegistration | undefined
  let snapshot: UpdateSnapshot = { updatePending: false, applying: false, stale: false }
  const listeners = new Set<(s: UpdateSnapshot) => void>()
  let started = false
  let reloaded = false
  let evalTimer: ReturnType<typeof setInterval> | undefined
  let cleanups: Array<() => void> = []
  let installingCleanup: (() => void) | undefined
  let controllerChangeCleanup: (() => void) | undefined
  // Identity of the waiting worker last seen by THIS instance (a new deploy replaces it).
  let seenWaiting: { ref: unknown; scriptURL: string | undefined } | undefined
  const timeouts = new Set<ReturnType<typeof setTimeout>>()

  const patch = (p: Partial<UpdateSnapshot>) => {
    const next = { ...snapshot, ...p }
    if (
      next.updatePending === snapshot.updatePending &&
      next.applying === snapshot.applying &&
      next.stale === snapshot.stale
    ) {
      return
    }
    snapshot = next
    listeners.forEach((fn) => fn(snapshot))
  }

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timeouts.delete(t)
      fn()
    }, ms)
    timeouts.add(t)
  }

  const isSafe = (): boolean =>
    options.isSafeToApply ? options.isSafeToApply() : isSafeSnapshot(readSafetySnapshot(undefined, deps.now()))

  const reloadOnce = () => {
    if (reloaded) return
    reloaded = true
    deps.reload()
  }

  const stopEvalTimer = () => {
    if (evalTimer) clearInterval(evalTimer)
    evalTimer = undefined
  }

  const evaluate = () => {
    if (!registration) return
    const now = deps.now()
    const hasWaiting = !!registration.waiting
    if (!hasWaiting) {
      // Nothing pending: a previous acceptance has been fulfilled.
      seenWaiting = undefined
      write(K.since, undefined)
      write(K.accepted, undefined)
      write(K.attempt, undefined)
      stopEvalTimer()
      patch({ updatePending: false })
      return
    }
    if (snapshot.applying) return // reload in flight: never decide again
    const waiting = registration.waiting as (ServiceWorker | null)
    const identity = { ref: waiting, scriptURL: waiting?.scriptURL }
    if (seenWaiting && (seenWaiting.ref !== identity.ref || seenWaiting.scriptURL !== identity.scriptURL)) {
      // A different worker is waiting (e.g. v2 deployed over a waiting v1): it
      // inherits neither v1's age, its dismissal nor its apply attempt.
      write(K.since, undefined)
      write(K.dismissed, undefined)
      write(K.accepted, undefined)
      write(K.attempt, undefined)
    }
    seenWaiting = identity
    // Hard loop guard: at most ONE automatic apply attempt per acceptedTtlMs. If
    // we already tried and a worker is STILL waiting, applying again would loop
    // (sw.js ignoring SKIP_WAITING...). Forget the acceptance and go back to
    // asking; only an explicit click on "Update" may retry.
    const recentAttempt = isWithinTtl(read(K.attempt), now, policy.acceptedTtlMs)
    if (recentAttempt) write(K.accepted, undefined)
    let waitingSince = read(K.since)
    if (waitingSince === undefined || waitingSince > now) {
      waitingSince = now
      write(K.since, now)
    }
    const decision = decideUpdate(
      {
        hasWaiting,
        now,
        waitingSince,
        dismissedAt: read(K.dismissed),
        acceptedAt: read(K.accepted),
        stale: snapshot.stale,
        safe: !recentAttempt && isSafe(),
      },
      policy,
    )
    if (decision === 'apply') {
      applyNow()
      return
    }
    patch({ updatePending: decision === 'prompt' })
    if (started && !evalTimer && evaluateIntervalMs > 0) {
      evalTimer = setInterval(evaluate, evaluateIntervalMs)
    }
  }

  function applyNow() {
    if (snapshot.applying || !registration) return
    patch({ applying: true, updatePending: false })
    // Next deploy must notify again; remember the acceptance so a still-waiting
    // worker after the reload is applied without re-asking.
    const at = deps.now()
    write(K.dismissed, undefined)
    // Never renew a still-valid acceptance; always stamp the attempt (loop guard).
    if (!isWithinTtl(read(K.accepted), at, policy.acceptedTtlMs)) write(K.accepted, at)
    write(K.attempt, at)

    // ONE reload, and only once the new worker controls the page. Reloading
    // earlier leaves a blank page on mobile (old precache already cleaned).
    controllerChangeCleanup?.()
    deps.container?.addEventListener('controllerchange', reloadOnce, { once: true })
    controllerChangeCleanup = () => deps.container?.removeEventListener('controllerchange', reloadOnce)
    later(reloadOnce, fallbackMs)

    const waiting = registration?.waiting
    if (waiting) {
      try {
        waiting.postMessage({ type: 'SKIP_WAITING' })
      } catch {
        reloadOnce()
      }
    } else {
      // Already active (skipWaiting worker) or nothing to activate: reload picks the new build.
      reloadOnce()
    }
  }

  const check = () => {
    if (!registration) return
    void registration.update().catch(() => {})
    // update() installs in the background; look again shortly after.
    later(evaluate, postCheckMs)
  }

  const checkVisible = () => {
    if (deps.doc && deps.doc.visibilityState !== 'visible') return
    check()
  }

  const checkVersion = async () => {
    const vc = options.versionCheck
    if (!vc) return
    let latest: string | undefined
    try {
      latest = await vc.fetchLatest()
    } catch {
      return
    }
    if (!latest) return
    const stale = latest !== vc.current
    const wasStale = snapshot.stale
    patch({ stale })
    if (stale && (!wasStale || !registration?.waiting)) check()
    else if (stale !== wasStale) evaluate()
  }

  const onUpdateFound = () => {
    const installing = registration?.installing
    if (!installing) return
    installingCleanup?.()
    const onState = () => {
      if (installing.state === 'installed') evaluate()
    }
    installing.addEventListener('statechange', onState)
    installingCleanup = () => installing.removeEventListener('statechange', onState)
  }

  const controller: UpdateController = {
    attach(reg) {
      if (registration === reg) return
      registration?.removeEventListener('updatefound', onUpdateFound)
      installingCleanup?.()
      installingCleanup = undefined
      registration = reg
      reg.addEventListener('updatefound', onUpdateFound)
      evaluate()
      if (started) checkVisible()
    },
    start() {
      if (started) return () => {}
      started = true
      const onVisible = () => {
        if (deps.doc?.visibilityState === 'visible') {
          checkVisible()
          void checkVersion()
          evaluate()
        }
      }
      deps.doc?.addEventListener('visibilitychange', onVisible)
      deps.win?.addEventListener('focus', onVisible)
      cleanups.push(() => deps.doc?.removeEventListener('visibilitychange', onVisible))
      cleanups.push(() => deps.win?.removeEventListener('focus', onVisible))

      if (!options.isSafeToApply) cleanups.push(installActivityTracking())

      if (checkIntervalMs > 0) {
        const id = setInterval(checkVisible, checkIntervalMs)
        cleanups.push(() => clearInterval(id))
      }
      if (options.versionCheck) {
        void checkVersion()
        const id = setInterval(() => void checkVersion(), options.versionCheck.intervalMs ?? 5 * 60 * 1000)
        cleanups.push(() => clearInterval(id))
      }
      if (registration) {
        evaluate()
        checkVisible()
      }
      return () => controller.stop()
    },
    stop() {
      started = false
      stopEvalTimer()
      registration?.removeEventListener('updatefound', onUpdateFound)
      installingCleanup?.()
      installingCleanup = undefined
      controllerChangeCleanup?.()
      controllerChangeCleanup = undefined
      cleanups.forEach((fn) => fn())
      cleanups = []
      timeouts.forEach((t) => clearTimeout(t))
      timeouts.clear()
    },
    evaluate,
    applyNow,
    dismiss() {
      write(K.dismissed, deps.now())
      patch({ updatePending: false })
    },
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
  return controller
}
