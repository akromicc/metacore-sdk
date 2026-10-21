/**
 * Loads a provider script once, with timeout, CSP nonce and an origin allowlist.
 * The URL comes from the server (`PaymentClient.sdk_url`) but is still checked:
 * https only and, when `allowedOrigins` is given, an exact origin match.
 */
export type LoadScriptOptions = {
  nonce?: string
  timeoutMs: number
  /** Exact origins allowed for the script (`https://sdk.mercadopago.com`). Omitted: any https origin. */
  allowedOrigins?: readonly string[]
  /** `true` when the SDK global is already there (skips the insert). */
  isLoaded?: () => boolean
  document?: Document
}

const pending = new Map<string, Promise<void>>()

export function loadPaymentSdk(url: string, options: LoadScriptOptions): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return Promise.reject(new Error('payment sdk: invalid url'))
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return Promise.reject(new Error('payment sdk: https required'))
  if (options.allowedOrigins && !options.allowedOrigins.includes(parsed.origin)) return Promise.reject(new Error('payment sdk: origin not allowed'))
  if (options.isLoaded?.()) return Promise.resolve()
  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined)
  if (!doc) return Promise.reject(new Error('payment sdk: no document (server)'))

  const key = parsed.toString()
  const existing = pending.get(key)
  if (existing) return existing

  const p = new Promise<void>((resolve, reject) => {
    const script = doc.createElement('script')
    script.src = key
    script.async = true
    if (options.nonce) script.nonce = options.nonce
    script.dataset.sfPaymentSdk = 'true'
    let done = false
    const finish = (err?: Error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (err) {
        script.remove()
        pending.delete(key) // allow a later retry
        reject(err)
      } else resolve()
    }
    const timer = setTimeout(() => finish(new Error('payment sdk: timeout')), options.timeoutMs)
    script.onload = () => finish()
    script.onerror = () => finish(new Error('payment sdk: failed to load'))
    doc.head.appendChild(script)
  })
  pending.set(key, p)
  return p
}

/** Test helper: forgets the loaded-script cache. */
export function resetPaymentSdkCache(): void {
  pending.clear()
}
