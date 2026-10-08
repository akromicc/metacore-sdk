// Host-pluggable icon resolvers. A host that stores icons in a format the SDK
// does not parse (real FontAwesome, Iconify, its own sprite sheet...) registers
// a function once at boot and every <Icon>/<DynamicIcon>/`type: 'icon'` column
// understands it, without touching the SDK.
//
// Resolution order (documented contract):
//   1. host resolvers, MOST RECENTLY REGISTERED FIRST; the first one that
//      returns something other than null/undefined wins;
//   2. the built-in parser (`parseIconSpec`): Lucide, FontAwesome aliases,
//      emoji, images.
// A resolver receives the raw string and returns an `IconSpec` (delegate to
// the built-in renderers), a `ReactNode` (render exactly that), or `null` to
// pass. A resolver that throws is skipped.
import type { ReactNode } from 'react'
import { parseIconSpec, type IconSpec } from './icon-spec'

export type IconResolver = (spec: string) => IconSpec | ReactNode | null | undefined

/** Outcome of resolving: a built-in spec, or a node the host rendered itself. */
export type ResolvedIcon = IconSpec | { kind: 'node'; node: ReactNode }

const resolvers: IconResolver[] = []

const SPEC_KINDS = new Set(['lucide', 'emoji', 'image', 'unknown'])

function isIconSpec(v: unknown): v is IconSpec {
    return (
        typeof v === 'object' &&
        v !== null &&
        !('$$typeof' in v) &&
        SPEC_KINDS.has((v as { kind?: unknown }).kind as string)
    )
}

/** Registers a resolver; returns the disposer that removes it. */
export function registerIconResolver(fn: IconResolver): () => void {
    resolvers.push(fn)
    return () => {
        const i = resolvers.lastIndexOf(fn)
        if (i >= 0) resolvers.splice(i, 1)
    }
}

/** Host resolvers first (newest first), then the built-in parser. */
export function resolveIconSpec(spec: unknown): ResolvedIcon {
    if (typeof spec === 'string' && spec.trim() !== '') {
        for (let i = resolvers.length - 1; i >= 0; i--) {
            let out: ReturnType<IconResolver>
            try {
                out = resolvers[i]!(spec)
            } catch {
                continue
            }
            if (out === null || out === undefined) continue
            return isIconSpec(out) ? out : { kind: 'node', node: out }
        }
    }
    return parseIconSpec(spec)
}
