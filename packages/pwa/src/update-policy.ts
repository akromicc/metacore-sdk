/**
 * Pure (React-free, DOM-free) update policy.
 *
 * Given a snapshot of the service-worker update state, decides whether the
 * host should do nothing, ask the user, or silently apply the update. All
 * functions are deterministic so the whole decision table is unit-testable.
 *
 * Invariants:
 *  - Nothing is ever applied unless `safe` is true (never reload a half-filled form).
 *  - With the default policy nothing is ever auto-applied: the worst case is a
 *    prompt (current behaviour of every Metacore host).
 */

export type UpdateDecision = 'none' | 'prompt' | 'apply'

export interface UpdatePolicy {
  /** How long a dismissal ("Después") keeps the prompt hidden. Default: 1 h. */
  dismissTtlMs: number
  /**
   * How long after the user clicked "Actualizar" a still-waiting worker is
   * applied without asking again (reload that lost the race, other tab open…).
   * Default: 2 min.
   */
  acceptedTtlMs: number
  /**
   * Apply on its own once the update has been waiting this long AND the moment
   * is safe. Default: undefined = never auto-apply.
   */
  autoApplyAfterMs?: number
  /**
   * Same as `autoApplyAfterMs` but used when the client is known to run an
   * older build than the server (see `versionCheck`). When both are set the
   * smaller one wins while stale. Default: undefined.
   */
  staleAutoApplyAfterMs?: number
}

export const DEFAULT_UPDATE_POLICY: UpdatePolicy = {
  dismissTtlMs: 60 * 60 * 1000,
  acceptedTtlMs: 2 * 60 * 1000,
  autoApplyAfterMs: undefined,
  staleAutoApplyAfterMs: undefined,
}

export interface UpdateState {
  /** A worker is installed and waiting to activate. */
  hasWaiting: boolean
  /** Current epoch ms. */
  now: number
  /** Epoch ms when the waiting worker was first seen (persisted across reloads). */
  waitingSince?: number
  /** Epoch ms of the last dismissal. */
  dismissedAt?: number
  /** Epoch ms of the last explicit "update now" click. */
  acceptedAt?: number
  /** The client is known to be older than the server. */
  stale: boolean
  /** Applying (reloading) right now would not interrupt the user. */
  safe: boolean
}

export function resolveUpdatePolicy(policy?: Partial<UpdatePolicy>): UpdatePolicy {
  const out = { ...DEFAULT_UPDATE_POLICY }
  if (!policy) return out
  for (const k of Object.keys(policy) as (keyof UpdatePolicy)[]) {
    const v = policy[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

const validMs = (v: number | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0

/** True when `at` happened within the last `ttl` ms (future timestamps never count). */
export function isWithinTtl(at: number | undefined, now: number, ttl: number): boolean {
  if (at === undefined || !Number.isFinite(at)) return false
  const age = now - at
  return age >= 0 && age < ttl
}

/** The auto-apply threshold in force for this state, or undefined when disabled. */
export function autoApplyThreshold(stale: boolean, policy: UpdatePolicy): number | undefined {
  const normal = validMs(policy.autoApplyAfterMs) ? policy.autoApplyAfterMs : undefined
  const staleMs = stale && validMs(policy.staleAutoApplyAfterMs) ? policy.staleAutoApplyAfterMs : undefined
  if (normal === undefined) return staleMs
  if (staleMs === undefined) return normal
  return Math.min(normal, staleMs)
}

/**
 * Decision table (first match wins):
 *  1. no waiting worker                          -> none
 *  2. accepted recently                          -> apply if safe, else none (never re-ask)
 *  3. auto-apply threshold reached               -> apply if safe
 *  4. dismissed within TTL                       -> none
 *  5. otherwise                                  -> prompt
 * A threshold reached while unsafe falls through to 4/5 (prompt unless dismissed).
 */
export function decideUpdate(state: UpdateState, policyInput?: Partial<UpdatePolicy>): UpdateDecision {
  if (!state.hasWaiting) return 'none'
  const policy = resolveUpdatePolicy(policyInput)

  if (isWithinTtl(state.acceptedAt, state.now, policy.acceptedTtlMs)) {
    return state.safe ? 'apply' : 'none'
  }

  const threshold = autoApplyThreshold(state.stale, policy)
  if (
    threshold !== undefined &&
    state.waitingSince !== undefined &&
    state.now - state.waitingSince >= threshold &&
    state.safe
  ) {
    return 'apply'
  }

  if (isWithinTtl(state.dismissedAt, state.now, policy.dismissTtlMs)) return 'none'
  return 'prompt'
}
