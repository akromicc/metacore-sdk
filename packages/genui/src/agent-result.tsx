import { useState, type ReactElement } from 'react'
import { GenerativeUI } from './generative-ui'
import type { UIActionHandler } from './types'

/** Minimal shape of an agent result whose embed carries a genui spec. */
export interface GenerativeUIAgentResult {
  kind: string
  embed?: { type?: string; ui?: unknown }
  [key: string]: unknown
}

export interface GenerativeUIResultOptions {
  /** Maps declared action ids (e.g. "automations.confirm") to host calls. */
  onAction?: UIActionHandler
  onNavigate?: (path: string) => void
}

/**
 * Builds a renderer for the agent result registry of
 * @asteby/metacore-runtime-react:
 *
 *   registerAgentResultRenderer('ui', createGenerativeUIResult({ onAction }))
 *
 * The chat already turns every embed into a result of its `type`, so `ui`
 * embeds produced by kernel tools render without touching the chat package.
 */
export function createGenerativeUIResult(opts: GenerativeUIResultOptions = {}): (props: { result: GenerativeUIAgentResult }) => ReactElement {
  function GenerativeUIResult({ result }: { result: GenerativeUIAgentResult }) {
    const [busy, setBusy] = useState(false)
    const onAction: UIActionHandler | undefined = opts.onAction
      ? async (ev) => {
          setBusy(true)
          try {
            await opts.onAction!(ev)
          } finally {
            setBusy(false)
          }
        }
      : undefined
    return (
      <div className='w-[min(100%,34rem)]'>
        <GenerativeUI spec={result.embed?.ui} onAction={onAction} onNavigate={opts.onNavigate} busy={busy} />
      </div>
    )
  }
  return GenerativeUIResult
}
