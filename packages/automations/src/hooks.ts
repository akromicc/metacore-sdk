import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AutomationsApi } from './api'
import type { AutomationStatus } from './types'

export const automationsKeys = {
  all: ['automations'] as const,
  list: (status?: string) => ['automations', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['automations', 'detail', id] as const,
  runs: (id: string) => ['automations', 'runs', id] as const,
  catalog: ['automations', 'catalog'] as const,
}

export function useAutomations(api: AutomationsApi, status?: AutomationStatus) {
  return useQuery({ queryKey: automationsKeys.list(status), queryFn: () => api.list(status ? { status } : undefined), staleTime: 15_000 })
}

export function useAutomationRuns(api: AutomationsApi, id: string | undefined) {
  return useQuery({ queryKey: automationsKeys.runs(id ?? ''), queryFn: () => api.runs(id!), enabled: !!id, staleTime: 10_000 })
}

export function useAutomationCatalog(api: AutomationsApi) {
  return useQuery({ queryKey: automationsKeys.catalog, queryFn: () => api.catalog(), staleTime: 5 * 60_000 })
}

/** Lifecycle mutations; every success refreshes lists, detail and history. */
export function useAutomationActions(api: AutomationsApi) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: automationsKeys.all })
  return {
    confirm: useMutation({ mutationFn: (id: string) => api.confirm(id), onSuccess: done }),
    pause: useMutation({ mutationFn: (id: string) => api.pause(id), onSuccess: done }),
    resume: useMutation({ mutationFn: (id: string) => api.resume(id), onSuccess: done }),
    archive: useMutation({ mutationFn: (id: string) => api.archive(id), onSuccess: done }),
    run: useMutation({ mutationFn: (v: { id: string; dryRun: boolean }) => api.run(v.id, v.dryRun), onSuccess: done }),
    save: useMutation({
      mutationFn: (v: { id?: string; kind?: 'automation' | 'tool'; spec: Parameters<AutomationsApi['create']>[0]['spec']; version?: number }) =>
        v.id ? api.update(v.id, { spec: v.spec, version: v.version }) : api.create({ kind: v.kind, spec: v.spec }),
      onSuccess: done,
    }),
  }
}
