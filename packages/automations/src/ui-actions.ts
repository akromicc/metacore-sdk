import type { UIActionEvent } from '@asteby/metacore-genui'
import type { AutomationsApi } from './api'

/** genui action ids the kernel automation tools emit. */
export const AUTOMATION_UI_ACTIONS = ['automations.confirm', 'automations.discard', 'automations.pause', 'automations.resume'] as const

/**
 * Maps the declared actions of automation cards (generative UI in the chat)
 * to the REST API. Returns true when the action was handled (false lets hosts
 * chain other handlers); rethrows API errors after onError so the card keeps
 * its buttons.
 */
export function automationUIActionHandler(api: AutomationsApi, hooks: { onDone?: (id: string, action: string) => void; onError?: (err: unknown) => void } = {}) {
  return async (ev: UIActionEvent): Promise<boolean> => {
    const id = typeof ev.params.id === 'string' ? ev.params.id : ''
    if (!id || !(AUTOMATION_UI_ACTIONS as readonly string[]).includes(ev.id)) return false
    try {
      if (ev.id === 'automations.confirm') await api.confirm(id)
      else if (ev.id === 'automations.discard') await api.archive(id)
      else if (ev.id === 'automations.pause') await api.pause(id)
      else await api.resume(id)
      hooks.onDone?.(id, ev.id)
    } catch (err) {
      hooks.onError?.(err)
      throw err // the card keeps its buttons
    }
    return true
  }
}
