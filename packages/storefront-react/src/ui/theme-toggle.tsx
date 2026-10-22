import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

/** Script de cabecera: aplica el tema guardado antes de pintar (sin parpadeo). Sin preferencia guardada manda el sistema. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`

function current(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Botón claro/oscuro. El estado real se lee del DOM tras hidratar (el servidor no sabe la preferencia).
 * Guarda la elección en localStorage ("theme") y fija `html[data-theme]`; los tokens de la tienda reaccionan a eso.
 */
export function ThemeToggle({ className = '', themeColors = { light: '#ffffff', dark: '#000000' } }: { className?: string; themeColors?: { light: string; dark: string } }) {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => setTheme(current()), [])

  const toggle = () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* modo privado: el cambio dura la sesión */
    }
    document.querySelector('meta[name="theme-color"][data-dynamic]')?.setAttribute('content', themeColors[next])
    setTheme(next)
  }

  const dark = theme === 'dark'
  return (
    <button type="button" onClick={toggle} className={className} aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} aria-pressed={theme === null ? undefined : dark}>
      {dark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
