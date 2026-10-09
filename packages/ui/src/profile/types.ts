import type { ComponentType } from 'react'

/** Any icon component that accepts a `className` (lucide, Font Awesome wrappers, custom SVGs). */
export type ProfileIcon = ComponentType<{ className?: string }>

/** Semantic tone of a status chip. `primary` uses the brand color; the rest map to Badge's tonal variants. */
export type StatusTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
