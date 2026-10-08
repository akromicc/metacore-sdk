import { hasOpenModal } from './use-modal-open'

/**
 * "Safe moment" to reload the app. We only reload when ALL hold:
 *  - no modal/dialog is open (a form is likely in there);
 *  - the user is not mid-input: no focused field with content, and no field the
 *    user typed into (trusted `input` event) within the last `EDIT_WINDOW_MS`
 *    that still has content (a file input with selected files counts).
 *    Prefilled/autofilled fields don't count;
 *  - the tab is hidden, OR the user has been idle for `minIdleMs` (default 60 s)
 *    so we don't yank the page from under someone who is reading/scrolling.
 * Hosts with other needs pass `isSafeToApply` to replace this.
 */
export interface SafetySnapshot {
  modalOpen: boolean
  editingInProgress: boolean
  visible: boolean
  /** ms since the last pointer/keyboard/touch/wheel activity. */
  idleMs: number
}

export interface SafetyOptions {
  /** Idle time required to reload a VISIBLE tab. Default 60 s. */
  minIdleMs?: number
}

export const DEFAULT_MIN_IDLE_MS = 60 * 1000
const EDIT_WINDOW_MS = 30 * 60 * 1000

export function isSafeSnapshot(s: SafetySnapshot, opts: SafetyOptions = {}): boolean {
  const minIdle = opts.minIdleMs ?? DEFAULT_MIN_IDLE_MS
  if (s.modalOpen || s.editingInProgress) return false
  return !s.visible || s.idleMs >= minIdle
}

const NON_TEXT_INPUTS = new Set([
  'hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'image',
])

function hasContent(el: Element): boolean {
  if (typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) {
    // A <input type=file> with selected files is work in progress too.
    if (el.type === 'file') return (el.files?.length ?? 0) > 0
    return !NON_TEXT_INPUTS.has(el.type) && el.value.trim().length > 0
  }
  if (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement) {
    return el.value.trim().length > 0
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    return (el.textContent ?? '').trim().length > 0
  }
  return false
}

const edited = new WeakMap<Element, number>()
let lastActivity = Date.now()
let trackers = 0
let untrack: (() => void) | undefined

/**
 * Starts (ref-counted) tracking of user edits and activity. Returns a disposer.
 * No-op outside the browser.
 */
export function installActivityTracking(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): () => void {
  if (!doc) return () => {}
  if (trackers === 0) {
    const onInput = (e: Event) => {
      if (e.isTrusted && e.target instanceof Element) edited.set(e.target, Date.now())
      lastActivity = Date.now()
    }
    const onActivity = () => {
      lastActivity = Date.now()
    }
    const onFormDone = (e: Event) => {
      if (typeof HTMLFormElement !== 'undefined' && e.target instanceof HTMLFormElement) {
        for (const el of Array.from(e.target.elements)) edited.delete(el)
      }
    }
    const activity = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    doc.addEventListener('input', onInput, true)
    doc.addEventListener('submit', onFormDone, true)
    doc.addEventListener('reset', onFormDone, true)
    for (const t of activity) doc.addEventListener(t, onActivity, { capture: true, passive: true })
    untrack = () => {
      doc.removeEventListener('input', onInput, true)
      doc.removeEventListener('submit', onFormDone, true)
      doc.removeEventListener('reset', onFormDone, true)
      for (const t of activity) doc.removeEventListener(t, onActivity, true)
    }
  }
  trackers += 1
  let done = false
  return () => {
    if (done) return
    done = true
    trackers -= 1
    if (trackers === 0) {
      untrack?.()
      untrack = undefined
    }
  }
}

export function readSafetySnapshot(doc: Document | undefined = typeof document === 'undefined' ? undefined : document, now = Date.now()): SafetySnapshot {
  if (!doc) return { modalOpen: false, editingInProgress: false, visible: false, idleMs: Infinity }
  const active = doc.activeElement
  let editing = !!active && active !== doc.body && hasContent(active)
  if (!editing) {
    // WeakMap is not iterable: probe the editable candidates currently in the DOM.
    const candidates = doc.querySelectorAll('input, textarea, [contenteditable]')
    for (const el of Array.from(candidates)) {
      const at = edited.get(el)
      if (at !== undefined && now - at < EDIT_WINDOW_MS && el.isConnected && hasContent(el)) {
        editing = true
        break
      }
    }
  }
  return {
    modalOpen: hasOpenModal(doc),
    editingInProgress: editing,
    visible: doc.visibilityState === 'visible',
    idleMs: now - lastActivity,
  }
}
