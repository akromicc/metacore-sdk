import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSafetySnapshot } from '../src/dom-safety'

class FakeInput {
  type = 'text'
  value = ''
  files: { length: number } | null = null
  isConnected = true
}

afterEach(() => vi.unstubAllGlobals())

function docWith(active: unknown) {
  return {
    activeElement: active,
    body: {},
    visibilityState: 'visible',
    querySelectorAll: () => [],
    // hasOpenModal probes the DOM; no dialogs in this fake
    querySelector: () => null,
  } as unknown as Document
}

describe('safe moment: file inputs', () => {
  it('a focused file input with selected files is editing in progress', () => {
    vi.stubGlobal('HTMLInputElement', FakeInput)
    const el = new FakeInput()
    el.type = 'file'
    el.files = { length: 1 }
    expect(readSafetySnapshot(docWith(el)).editingInProgress).toBe(true)
  })

  it('an empty file input is not editing', () => {
    vi.stubGlobal('HTMLInputElement', FakeInput)
    const el = new FakeInput()
    el.type = 'file'
    el.files = { length: 0 }
    expect(readSafetySnapshot(docWith(el)).editingInProgress).toBe(false)
  })
})
