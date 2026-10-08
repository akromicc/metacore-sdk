import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createUpdateController,
  type UpdateController,
  type UpdateSnapshot,
  type VersionCheck,
} from './update-controller'
import type { UpdatePolicy } from './update-policy'

export interface UseServiceWorkerUpdateOptions extends Partial<UpdatePolicy> {
  /** Turn the whole machine off (default true). Lets PWAProvider keep its legacy path. */
  enabled?: boolean
  /** `registration.update()` cadence while the tab is visible. Default 5 min. 0 disables. */
  checkIntervalMs?: number
  /** Replaces the default safe-moment test. */
  isSafeToApply?: () => boolean
  versionCheck?: VersionCheck
  storagePrefix?: string
}

export interface UseServiceWorkerUpdateResult extends UpdateSnapshot {
  /** User accepted: SKIP_WAITING + single reload after controllerchange. */
  applyNow: () => void
  /** User dismissed: hides the prompt for `dismissTtlMs`. */
  dismiss: () => void
}

const IDLE: UpdateSnapshot = { updatePending: false, applying: false, stale: false }

/**
 * React wrapper over {@link createUpdateController}. Binds to
 * `navigator.serviceWorker.ready`, so it works regardless of how the host
 * registers the worker (including a stubbed `virtual:pwa-register`).
 */
export function useServiceWorkerUpdate(options: UseServiceWorkerUpdateOptions = {}): UseServiceWorkerUpdateResult {
  const { enabled = true, checkIntervalMs, storagePrefix } = options
  const optsRef = useRef(options)
  optsRef.current = options
  const [snap, setSnap] = useState<UpdateSnapshot>(IDLE)
  const ctrlRef = useRef<UpdateController | null>(null)

  const policyKey = [
    options.dismissTtlMs,
    options.acceptedTtlMs,
    options.autoApplyAfterMs,
    options.staleAutoApplyAfterMs,
  ].join('|')
  const vc = options.versionCheck
  const hasVc = !!vc
  const vcCurrent = vc?.current
  const vcInterval = vc?.intervalMs

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const o = optsRef.current
    const ctrl = createUpdateController({
      policy: {
        dismissTtlMs: o.dismissTtlMs,
        acceptedTtlMs: o.acceptedTtlMs,
        autoApplyAfterMs: o.autoApplyAfterMs,
        staleAutoApplyAfterMs: o.staleAutoApplyAfterMs,
      },
      checkIntervalMs,
      storagePrefix,
      // Read through the ref so inline callbacks don't restart the machine.
      isSafeToApply: o.isSafeToApply ? () => optsRef.current.isSafeToApply?.() ?? true : undefined,
      versionCheck:
        hasVc && vcCurrent !== undefined
          ? {
              current: vcCurrent,
              intervalMs: vcInterval,
              fetchLatest: () => optsRef.current.versionCheck?.fetchLatest() ?? Promise.resolve(undefined),
            }
          : undefined,
    })
    ctrlRef.current = ctrl
    const unsub = ctrl.subscribe(setSnap)
    const stop = ctrl.start()
    let cancelled = false
    navigator.serviceWorker.ready
      .then((reg) => {
        if (!cancelled) ctrl.attach(reg)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      unsub()
      stop()
      ctrlRef.current = null
      setSnap(IDLE)
    }
  }, [enabled, checkIntervalMs, storagePrefix, policyKey, hasVc, vcCurrent, vcInterval])

  const applyNow = useCallback(() => ctrlRef.current?.applyNow(), [])
  const dismiss = useCallback(() => ctrlRef.current?.dismiss(), [])
  return { ...snap, applyNow, dismiss }
}
