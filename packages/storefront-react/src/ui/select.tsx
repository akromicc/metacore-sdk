import { useEffect, useId, useRef, useState } from 'react'

export type SelectOption = { value: string; label: string }

const Chevron = ({ open = false, floating = false }: { open?: boolean; floating?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-select-chevron={floating ? 'floating' : ''} data-open={open || undefined}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export type SelectProps = {
  id: string
  name: string
  options: SelectOption[]
  defaultValue?: string
  /** Etiqueta accesible (la visible la pone el llamador con <label htmlFor={id}>). */
  label: string
  className?: string
}

/**
 * Selector con mejora progresiva. Sin JavaScript (o antes de hidratar) es un <select> nativo dentro de un formulario;
 * con JavaScript se reemplaza por un listbox propio (teclado completo, objetivo táctil de 44 px, tema claro/oscuro).
 * El <select> nativo sigue en el DOM como fuente de verdad: al elegir se cambia su valor y se emite "change", así un
 * formulario con onChange → submit (filtros por URL) no nota la diferencia.
 * Estilos: clases `select` (ver ui.css) y los tokens --background, --foreground, --border, --tint, --primary.
 */
export function Select({ id, name, options, defaultValue, label, className = '' }: SelectProps) {
  const native = useRef<HTMLSelectElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [enhanced, setEnhanced] = useState(false)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? '')
  const [active, setActive] = useState(0)
  const listId = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => setEnhanced(true), [])
  // El valor lo puede cambiar la URL (atrás/adelante): se sincroniza.
  useEffect(() => {
    if (defaultValue != null) setValue(defaultValue)
  }, [defaultValue])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const choose = (next: string) => {
    setOpen(false)
    setValue(next)
    const el = native.current
    if (el && el.value !== next) {
      el.value = next
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    root.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    const go = (i: number) => {
      e.preventDefault()
      setActive(i)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') go(Math.min(last, active + 1))
    else if (e.key === 'ArrowUp') go(Math.max(0, active - 1))
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(last)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const picked = options[active]
      if (picked) choose(picked.value)
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={root} data-select="" className={className || undefined}>
      <div data-select-native={enhanced ? 'hidden' : ''}>
        <select
          ref={native}
          id={enhanced ? undefined : id}
          name={name}
          defaultValue={defaultValue}
          tabIndex={enhanced ? -1 : undefined}
          aria-hidden={enhanced || undefined}
          aria-label={enhanced ? label : undefined}
          className="select"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!enhanced ? <Chevron floating /> : null}
      </div>

      {enhanced ? (
        <>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${label}: ${current?.label}`}
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={onKeyDown}
            className="select" data-select-trigger=""
          >
            <span data-select-value="">{current?.label}</span>
            <Chevron open={open} />
          </button>
          {open ? (
            <ul id={listId} role="listbox" aria-label={label} tabIndex={-1} data-select-list="">
              {options.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  data-active={i === active || undefined}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(o.value)}
                >
                  {o.label}
                  {o.value === value ? <Check /> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
