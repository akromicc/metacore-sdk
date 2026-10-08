// IconPickerField — the `icon` widget renderer for DynamicForm. Two modes:
//
//   - "Ícono" (default): search box + grid of lucide glyphs filtered by name.
//     Clicking one stores the PascalCase lucide name ("CreditCard") as the
//     field value — the same convention OptionDef.icon and image-ish cell
//     renderers already understand (see dynamic-icon.tsx).
//   - "Imagen": delegates to the existing UploadField untouched, so the value
//     is the uploaded file url/path exactly as the `upload` widget stores it.
//
// The stored value stays a plain string (retrocompatible): a lucide name when
// an icon was picked, a url/path when an image was uploaded. When editing, the
// initial mode is inferred from the current value — path-like ("/" or ".")
// means image, anything else means icon.
import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { lucideIconNames } from './dynamic-icon'
import {
    Button,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@asteby/metacore-ui/primitives'
import { DynamicIcon, resolveLucideIconName } from './dynamic-icon'
import { UploadField } from './upload-field'
import type { ActionFieldDef } from './types'

export interface IconPickerFieldProps {
    field: ActionFieldDef
    value: any
    onChange: (v: any) => void
    /**
     * Icon-only mode: hide the "Imagen" tab so the field can only store a
     * lucide icon name. Also read from `field.iconOnly` / `field.icon_only`
     * (metadata). An existing url/path value is preserved untouched until the
     * user picks an icon or clears it (shown as a non-editable current value).
     */
    iconOnly?: boolean
}

/** Icons rendered per "page" — grows as the user scrolls to the bottom. Keeps
 * the DOM light: the lucide catalog is ~1500 glyphs, so we never mount them all. */
const PAGE = 60

const ALL_ICON_NAMES = lucideIconNames()

/** True when a stored value looks like an image url/path rather than an icon name. */
export function looksLikeImageValue(value: unknown): boolean {
    return typeof value === 'string' && value !== '' && /[/.]/.test(value)
}

export function IconPickerField({ field, value, onChange, iconOnly }: IconPickerFieldProps) {
    const onlyIcon = iconOnly ?? field.iconOnly ?? field.icon_only ?? false
    const [mode, setMode] = useState<'icon' | 'image'>(() =>
        !onlyIcon && looksLikeImageValue(value) ? 'image' : 'icon',
    )
    // iconOnly + a stored url/path (written before the restriction): keep it,
    // render it as a read-only current value the user can clear or replace.
    const legacyImageValue = onlyIcon && looksLikeImageValue(value)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [limit, setLimit] = useState(PAGE)

    const selected = mode === 'icon' && !legacyImageValue ? resolveLucideIconName(value) : null

    // Full match list (names only) — filtered by query, not yet capped.
    const matches = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/[\s_-]/g, '')
        return q
            ? ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q))
            : ALL_ICON_NAMES
    }, [query])

    // Visible slice — grows on scroll (see onScroll below).
    const visible = matches.slice(0, limit)

    const pick = (name: string) => {
        onChange(name)
        setOpen(false)
    }

    return (
        <div className="flex flex-col gap-2">
            {!onlyIcon && (
            <div className="flex gap-1" role="tablist" aria-label="Tipo de ícono">
                <Button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'icon'}
                    variant={mode === 'icon' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMode('icon')}
                >
                    Ícono
                </Button>
                <Button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'image'}
                    variant={mode === 'image' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMode('image')}
                >
                    Imagen
                </Button>
            </div>
            )}
            {legacyImageValue && (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm" data-testid="icon-legacy-value">
                    <span className="min-w-0 truncate text-muted-foreground" title={String(value)}>
                        Valor actual: {String(value)}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                        Quitar
                    </Button>
                </div>
            )}
            {mode === 'image' && !onlyIcon ? (
                <UploadField field={field} value={value} onChange={onChange} />
            ) : (
                <Popover
                    open={open}
                    onOpenChange={(o: boolean) => {
                        setOpen(o)
                        if (o) {
                            // Fresh open: reset the search + paging.
                            setQuery('')
                            setLimit(PAGE)
                        }
                    }}
                >
                    <PopoverTrigger asChild>
                        <Button
                            id={field.key}
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between font-normal"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                {selected ? (
                                    <>
                                        <DynamicIcon name={selected} className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{selected}</span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">Selecciona un ícono…</span>
                                )}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        // Cap the panel to the space Radix measured between the
                        // trigger and the viewport edge so it can NEVER overflow
                        // off-screen (the old fixed max-h clipped inside tall
                        // modals). Prefer opening downward; flip only if needed.
                        className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[--radix-popover-trigger-width] flex-col overflow-hidden p-0"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                    >
                        <div className="shrink-0 p-2">
                            <Input
                                autoFocus
                                value={query}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setQuery(e.target.value)
                                    setLimit(PAGE)
                                }}
                                placeholder="Buscar ícono..."
                                aria-label="Buscar ícono"
                            />
                        </div>
                        <div
                            className="min-h-0 flex-1 overflow-y-auto"
                            role="listbox"
                            aria-label="Íconos"
                            onScroll={(e: React.UIEvent<HTMLDivElement>) => {
                                const el = e.currentTarget
                                // Near the bottom → reveal the next page.
                                if (
                                    el.scrollTop + el.clientHeight >= el.scrollHeight - 24 &&
                                    limit < matches.length
                                ) {
                                    setLimit((n) => n + PAGE)
                                }
                            }}
                        >
                            {visible.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    role="option"
                                    aria-selected={name === selected}
                                    aria-label={name}
                                    onClick={() => pick(name)}
                                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-accent ${
                                        name === selected ? 'bg-accent' : ''
                                    }`}
                                >
                                    <DynamicIcon name={name} className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{name}</span>
                                </button>
                            ))}
                            {visible.length === 0 && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    Sin resultados
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    )
}
