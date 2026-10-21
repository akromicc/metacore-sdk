import { useEffect, useId, useRef, useState } from 'react'
import { useResolvedLocale } from '../locale.js'
import { NOTE_MAX_LENGTH, formatAvailabilityMessage, normalizeNote, promotionMessages, type PromotionMessages } from '@asteby/storefront'

export type OrderNoteStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type OrderNoteProps = {
  /** Saved note (`Cart.note`). */
  value: string | null | undefined
  /** Persists the note (`client.carts.setNote` through the shop action). Must resolve once stored. Throw to show the error. */
  onSave: (note: string | null) => Promise<void> | void
  /** Autosave debounce in ms. Default 800. `false`: save only on blur / button. */
  debounceMs?: number | false
  /**
   * No-JS form: `<form method="post" action>` with a hidden `intent` and a "Guardar nota" button, hidden once the
   * component hydrates (the autosave takes over). The shop's route action handles it.
   */
  form?: { action?: string; method?: 'post'; intent?: string; intentName?: string }
  locale?: string
  messages?: Partial<PromotionMessages>
  className?: string
  maxLength?: number
}

/**
 * "Añadir nota" for the order. A real `<textarea>` with a visible label; the server enforces 1000 characters and
 * plain text. With JavaScript it autosaves (debounced, on blur) and announces "Guardada"; without it, the form posts.
 */
export function OrderNote({ value, onSave, debounceMs = 800, form, locale: localeProp, messages, className, maxLength = NOTE_MAX_LENGTH }: OrderNoteProps) {
  const locale = useResolvedLocale(localeProp)
  const m = promotionMessages(locale, messages)
  const id = useId()
  const [text, setText] = useState(value ?? '')
  const [status, setStatus] = useState<OrderNoteStatus>('idle')
  const [hydrated, setHydrated] = useState(false)
  const saved = useRef(normalizeNote(value))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)
  const latest = useRef({ text, onSave })
  latest.current = { text, onSave }

  useEffect(() => setHydrated(true), [])
  // A new server value (another tab, cart refresh) replaces the field unless the buyer is typing.
  useEffect(() => {
    if (status === 'dirty' || status === 'saving') return
    const incoming = value ?? ''
    if (normalizeNote(incoming) !== normalizeNote(latest.current.text)) setText(incoming)
    saved.current = normalizeNote(value)
  }, [value])
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const next = normalizeNote(latest.current.text)
    if (next === saved.current) {
      setStatus((s) => (s === 'dirty' ? 'idle' : s))
      return
    }
    const mine = ++seq.current
    setStatus('saving')
    try {
      await latest.current.onSave(next)
      if (mine !== seq.current) return // a newer save superseded this one
      saved.current = next
      setStatus('saved')
    } catch {
      if (mine === seq.current) setStatus('error')
    }
  }

  function onChange(v: string) {
    setText(v.slice(0, maxLength))
    setStatus('dirty')
    if (debounceMs !== false) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), debounceMs)
    }
  }

  const statusText = status === 'saving' ? m['note.saving'] : status === 'saved' ? m['note.saved'] : status === 'error' ? m['note.error'] : ''
  const field = (
    <>
      <label htmlFor={id}>{m['note.label']}</label>
      <textarea
        id={id}
        name="note"
        value={text}
        maxLength={maxLength}
        placeholder={m['note.placeholder']}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void flush()}
        aria-describedby={`${id}-s`}
        rows={3}
      />
      <p id={`${id}-c`} data-sf-note-counter>
        {formatAvailabilityMessage(m['note.counter'], { n: text.length, max: maxLength })}
      </p>
      <p id={`${id}-s`} role={status === 'error' ? 'alert' : 'status'} aria-live="polite" data-sf-note-status={status}>
        {statusText}
      </p>
    </>
  )

  if (!form) return <div className={className} data-sf-order-note>{field}</div>
  return (
    <form method={form.method ?? 'post'} {...(form.action ? { action: form.action } : {})} className={className} data-sf-order-note onSubmit={(e) => hydrated && e.preventDefault()}>
      <input type="hidden" name={form.intentName ?? 'intent'} value={form.intent ?? 'note'} />
      {field}
      {!hydrated && <button type="submit">{m['note.save']}</button>}
    </form>
  )
}
