# @asteby/metacore-genui

Generative UI for agents, by metadata only. The agent (kernel package
`genui`) returns a `genui/v1` JSON spec; this package validates it again
(`parseUISpec`) and draws it with SDK components. Whitelisted blocks: `text`,
`kpi`, `card`, `table`, `links`, `timeline`, `chart` (dependency-free SVG with
a required text summary) and `confirm` (form + declared actions).

No HTML, markdown-to-HTML or scripts; links are http(s) or app-relative only;
actions are ids plus scalar params that the host maps to real calls.

```tsx
import { registerAgentResultRenderer } from '@asteby/metacore-runtime-react'
import { createGenerativeUIResult } from '@asteby/metacore-genui'

registerAgentResultRenderer('ui', createGenerativeUIResult({
  onNavigate: (path) => navigate({ to: path }),
  onAction: async ({ id, params }) => {
    if (id === 'automations.confirm') await api.post(`/automations/${params.id}/confirm`)
  },
}))
```
