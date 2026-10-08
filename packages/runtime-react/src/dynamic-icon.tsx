// DynamicIcon resolves a lucide glyph by name without pulling the full icon
// set into the shared chunk. It draws through the shared glyph registry of
// @asteby/metacore-ui: a glyph seen before renders in the first frame, and an
// unseen one holds its box until it loads, so the label next to it stays put.
import { useState, type ReactNode } from 'react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { Glyph } from '@asteby/metacore-ui/icons'
import { resolveIconSpec } from './icon-resolvers'

export interface DynamicIconProps {
    name: string
    className?: string
}

export interface IconProps {
    /** Any icon value: Lucide name, FontAwesome classes, emoji, image URL... */
    name: unknown
    className?: string
    /** Accessible name. Without it the icon is decorative (aria-hidden). */
    label?: string
    /** Drawn when the value cannot be interpreted. Default: nothing. */
    fallback?: ReactNode
    /** Maps an image `src` before it reaches <img> (e.g. host `getImageUrl`). */
    resolveImageSrc?: (src: string) => string
    /** Render image sources (default true). DynamicIcon turns it off. */
    images?: boolean
}

type IconName = keyof typeof dynamicIconImports

function pascalToKebab(pascal: string): string {
    return pascal
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase()
}

function kebabToPascal(kebab: string): string {
    return kebab
        .split('-')
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
        .join('')
}

function loaderFor(pascal: string) {
    const kebab = pascalToKebab(pascal)
    // Lucide keys split digits ("building-2"); "building2" is not one.
    return (
        dynamicIconImports[kebab as IconName] ??
        dynamicIconImports[kebab.replace(/([a-z])(\d)/g, '$1-$2') as IconName]
    )
}

function IconImage({ src, className, label }: { src: string; className?: string; label?: string }) {
    const [failed, setFailed] = useState<string | null>(null)
    if (failed === src) return null
    return (
        <img
            src={src}
            alt={label ?? ''}
            loading="lazy"
            decoding="async"
            className={className}
            onError={() => setFailed(src)}
        />
    )
}

// Icon — renders any icon value the SDK can interpret (see parseIconSpec and
// registerIconResolver): Lucide glyph, emoji, image or a host-rendered node.
// A value nobody understands renders `fallback` (default nothing), never the
// raw text. Decorative (aria-hidden) unless `label` is given.
export function Icon({ name, className, label, fallback = null, resolveImageSrc, images = true }: IconProps) {
    const spec = resolveIconSpec(name)
    const a11y = label ? ({ role: 'img', 'aria-label': label } as const) : ({ 'aria-hidden': true } as const)
    switch (spec.kind) {
        case 'lucide':
            return <Glyph name={spec.name} className={className} {...a11y} />
        case 'emoji':
            return (
                <span className={className} {...a11y}>
                    {spec.value}
                </span>
            )
        case 'image':
            if (!images) return <>{fallback}</>
            return (
                <IconImage
                    src={resolveImageSrc ? resolveImageSrc(spec.src) : spec.src}
                    className={className}
                    label={label}
                />
            )
        case 'node':
            return <>{spec.node}</>
        default:
            return <>{fallback}</>
    }
}

// DynamicIcon keeps its { name, className } contract: Lucide names resolve
// exactly as before; FontAwesome classes, emoji and host resolvers now work
// too. Image paths still draw nothing here (icon slots in menus/buttons never
// showed <img>); use <Icon> or a `type: 'icon'` column for images.
export function DynamicIcon({ name, className }: DynamicIconProps) {
    return <Icon name={name} className={className} images={false} />
}

// resolveLucideIconName — canonical PascalCase lucide name for a value that is
// either already PascalCase ("CreditCard") or the kebab slug lucide documents
// ("credit-card"). Returns null for anything that is not a real glyph: empty,
// path-like strings (slash, dot, scheme), or the generic "Icon" base export.
export function resolveLucideIconName(value: unknown): string | null {
    if (typeof value !== 'string' || value === '' || value === 'Icon') return null
    if (/[/\\.:\s]/.test(value)) return null
    let name = value
    if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
        name = kebabToPascal(value)
    }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return null
    return loaderFor(name) ? name : null
}

// isLucideIconName — true when a string is a lucide-react icon name
// ("Banknote", "CreditCard", or the kebab slug "credit-card"). Lets image-ish
// renderers tell an icon name apart from an image path/URL: addons declare
// icons by lucide slug (same convention as OptionDef.icon), so a column
// inferred as `image` may carry one. Path-like strings (slash, dot, scheme)
// are rejected before the registry lookup; "Icon" itself is the generic base
// component, not a real glyph.
export function isLucideIconName(value: unknown): value is string {
    return resolveLucideIconName(value) !== null
}

/** PascalCase names of every lucide glyph, for the icon picker grid. */
export function lucideIconNames(): string[] {
    return Object.keys(dynamicIconImports).map(kebabToPascal)
}
