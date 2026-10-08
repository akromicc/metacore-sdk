import { describe, expect, it } from 'vitest'
import { decideUpdate, autoApplyThreshold, resolveUpdatePolicy, type UpdateState } from '../src/update-policy'
import { isSafeSnapshot } from '../src/dom-safety'

const H = 60 * 60 * 1000
const NOW = 1_000_000_000_000
const base: UpdateState = { hasWaiting: true, now: NOW, stale: false, safe: true, waitingSince: NOW }

describe('decideUpdate', () => {
  it('none without a waiting worker', () => {
    expect(decideUpdate({ ...base, hasWaiting: false })).toBe('none')
  })
  it('prompts by default and NEVER auto-applies, however old the update', () => {
    expect(decideUpdate({ ...base, waitingSince: NOW - 400 * 24 * H, stale: true })).toBe('prompt')
  })
  it('dismissal respects TTL', () => {
    expect(decideUpdate({ ...base, dismissedAt: NOW - 59 * 60_000 })).toBe('none')
    expect(decideUpdate({ ...base, dismissedAt: NOW - H })).toBe('prompt')
    expect(decideUpdate({ ...base, dismissedAt: NOW - 10 * 60_000 }, { dismissTtlMs: 5 * 60_000 })).toBe('prompt')
  })
  it('recent acceptance applies without re-asking, only when safe', () => {
    expect(decideUpdate({ ...base, acceptedAt: NOW - 60_000 })).toBe('apply')
    expect(decideUpdate({ ...base, acceptedAt: NOW - 60_000, safe: false })).toBe('none')
    expect(decideUpdate({ ...base, acceptedAt: NOW - 3 * 60_000 })).toBe('prompt')
  })
  it('acceptance beats a stale dismissal', () => {
    expect(decideUpdate({ ...base, acceptedAt: NOW - 1000, dismissedAt: NOW - 500 })).toBe('apply')
  })
  it('autoApplyAfterMs applies only past the threshold and only when safe', () => {
    const p = { autoApplyAfterMs: 24 * H }
    expect(decideUpdate({ ...base, waitingSince: NOW - 23 * H }, p)).toBe('prompt')
    expect(decideUpdate({ ...base, waitingSince: NOW - 24 * H }, p)).toBe('apply')
    expect(decideUpdate({ ...base, waitingSince: NOW - 48 * H, safe: false }, p)).toBe('prompt')
  })
  it('auto-apply overrides a dismissal (the ignored-for-days case) but unsafe + dismissed stays quiet', () => {
    const p = { autoApplyAfterMs: 24 * H }
    expect(decideUpdate({ ...base, waitingSince: NOW - 48 * H, dismissedAt: NOW - 1000 }, p)).toBe('apply')
    expect(decideUpdate({ ...base, waitingSince: NOW - 48 * H, dismissedAt: NOW - 1000, safe: false }, p)).toBe('none')
  })
  it('stale uses its own (shorter) threshold; not stale ignores it', () => {
    const p = { staleAutoApplyAfterMs: 10 * 60_000 }
    const s = { ...base, waitingSince: NOW - 11 * 60_000 }
    expect(decideUpdate({ ...s, stale: true }, p)).toBe('apply')
    expect(decideUpdate({ ...s, stale: false }, p)).toBe('prompt')
    const both = { autoApplyAfterMs: 24 * H, staleAutoApplyAfterMs: 10 * 60_000 }
    expect(decideUpdate({ ...s, stale: true }, both)).toBe('apply')
    expect(decideUpdate({ ...s, stale: false }, both)).toBe('prompt')
    expect(autoApplyThreshold(true, resolveUpdatePolicy({ autoApplyAfterMs: 5, staleAutoApplyAfterMs: 9 }))).toBe(5)
  })
  it('never applies when unsafe (modal / half-filled form), whatever the policy', () => {
    const p = { autoApplyAfterMs: 0, staleAutoApplyAfterMs: 0 }
    for (const extra of [{}, { stale: true }, { acceptedAt: NOW - 1 }]) {
      expect(decideUpdate({ ...base, ...extra, safe: false }, p)).not.toBe('apply')
    }
  })
  it('ignores invalid thresholds and future timestamps', () => {
    expect(decideUpdate({ ...base, waitingSince: 0 }, { autoApplyAfterMs: Number.NaN })).toBe('prompt')
    expect(decideUpdate({ ...base, waitingSince: 0 }, { autoApplyAfterMs: -1 })).toBe('prompt')
    expect(decideUpdate({ ...base, dismissedAt: NOW + H })).toBe('prompt')
    expect(decideUpdate({ ...base, acceptedAt: NOW + H })).toBe('prompt')
  })
  it('unknown waitingSince cannot auto-apply', () => {
    expect(decideUpdate({ ...base, waitingSince: undefined }, { autoApplyAfterMs: 0 })).toBe('prompt')
  })
})

describe('isSafeSnapshot', () => {
  const s = { modalOpen: false, editingInProgress: false, visible: false, idleMs: 0 }
  it('hidden tab with no modal/edit is safe', () => expect(isSafeSnapshot(s)).toBe(true))
  it('open modal or editing is never safe', () => {
    expect(isSafeSnapshot({ ...s, modalOpen: true })).toBe(false)
    expect(isSafeSnapshot({ ...s, editingInProgress: true })).toBe(false)
  })
  it('visible tab needs idle time', () => {
    expect(isSafeSnapshot({ ...s, visible: true, idleMs: 59_999 })).toBe(false)
    expect(isSafeSnapshot({ ...s, visible: true, idleMs: 60_000 })).toBe(true)
    expect(isSafeSnapshot({ ...s, visible: true, idleMs: 5 }, { minIdleMs: 1 })).toBe(true)
  })
})
