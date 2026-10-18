import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/** Registra el service worker (solo si `enabled`, normalmente producción; requiere HTTPS o localhost). */
export function useServiceWorker({ enabled, url = '/sw.js', scope = '/' }: { enabled: boolean; url?: string; scope?: string }) {
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return
    const register = () => navigator.serviceWorker.register(url, { scope }).catch(() => undefined)
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [enabled, url, scope])
}

/**
 * Botón "Instalar app": aparece solo cuando el navegador ofrece la instalación (Chrome, Edge, Android).
 * En iPhone/iPad no existe ese evento: muestra la instrucción de Compartir → Agregar a pantalla de inicio.
 */
export function InstallApp({ className = '', label = 'Instalar app', iosHint = 'Para instalar: toca Compartir y luego «Agregar a pantalla de inicio».' }: { className?: string; label?: string; iosHint?: string }) {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  if (event) {
    return (
      <button
        type="button"
        className={className}
        onClick={async () => {
          await event.prompt()
          await event.userChoice
          setEvent(null)
        }}
      >
        {label}
      </button>
    )
  }
  return ios ? <p className={className}>{iosHint}</p> : null
}
