// parseIconSpec — pure, deterministic classifier for "whatever the backend
// stored in an icon column". No React, no DOM. A string becomes one of:
//
//   { kind: 'lucide', name }  PascalCase Lucide glyph ("Brain", "CreditCard")
//   { kind: 'emoji',  value } a single emoji grapheme ("🩺", "👨‍⚕️", "🇲🇽")
//   { kind: 'image',  src }   http(s) URL, /rooted, ./relative or safe data:image
//   { kind: 'unknown', raw }  anything else (never rendered as raw text)
//
// Lucide covers: PascalCase, kebab, snake_case, optional `Icon` suffix, and
// FontAwesome 5/6 classes ("fas fa-brain", "fa-solid fa-brain", "far fa-heart",
// "fa fa-user-md", a bare "fa-brain") through FONT_AWESOME_ALIASES plus a
// generic try of the FA name against Lucide. Other libraries' classes
// ("mdi mdi-home", "bi bi-house", "ti ti-home", "ri-home-line") and Iconify ids
// ("mdi:home") only get the generic normalisation against Lucide; no tables.
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { FONT_AWESOME_ALIASES } from './icon-aliases'

export type IconSpec =
    | { kind: 'lucide'; name: string }
    | { kind: 'emoji'; value: string }
    | { kind: 'image'; src: string }
    | { kind: 'unknown'; raw: string }

const LUCIDE_KEYS = dynamicIconImports as Record<string, unknown>

function kebabToPascal(kebab: string): string {
    return kebab
        .split('-')
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
        .join('')
}

/** Lucide kebab key for any name spelling, or null when Lucide lacks it. */
function lucideKeyFor(raw: string): string | null {
    const tryKey = (s: string): string | null => {
        if (!s) return null
        const key = s
            .replace(/[\s_]+/g, '-')
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
            .toLowerCase()
        if (key in LUCIDE_KEYS) return key
        // Lucide splits digits ("building-2"); "building2" is not a key.
        const split = key.replace(/([a-z])(\d)/g, '$1-$2')
        return split in LUCIDE_KEYS ? split : null
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(raw)) return null
    if (raw === 'Icon' || raw === 'icon') return null
    return tryKey(raw) ?? (/Icon$/.test(raw) ? tryKey(raw.replace(/Icon$/, '')) : null)
}

const lucide = (key: string): IconSpec => ({ kind: 'lucide', name: kebabToPascal(key) })

// ---------- FontAwesome ----------
const FA_STYLE = /^(fa|fas|far|fab|fal|fad|fat|fass|fasr|fasl|fa-solid|fa-regular|fa-brands|fa-light|fa-thin|fa-duotone|fa-sharp|fa-classic)$/
const FA_MODIFIER =
    /^fa-(fw|lg|xs|sm|1x|2x|3x|4x|5x|6x|7x|8x|9x|10x|2xs|xl|2xl|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|bounce|fade|flip|shake|ul|li|border|inverse|stack|stack-1x|stack-2x|pull-left|pull-right|rotate-\d+|rotate-by|flip-horizontal|flip-vertical|flip-both)$/

function parseFontAwesome(tokens: string[]): IconSpec | null {
    const names = tokens
        .filter((t) => /^fa-[a-z0-9-]+$/.test(t) && !FA_STYLE.test(t) && !FA_MODIFIER.test(t))
        .map((t) => t.slice(3))
    const name = names[0]
    // "fas brain" without any `fa-` token is not FontAwesome syntax.
    if (!name) return null
    const alias = FONT_AWESOME_ALIASES[name]
    const key = (alias && lucideKeyFor(alias)) ?? lucideKeyFor(name)
    return key ? lucide(key) : { kind: 'unknown', raw: tokens.join(' ') }
}

// ---------- Other icon fonts / Iconify ----------
// "mdi mdi-home", "bi bi-house", "ti ti-home", "ri-home-line", "lucide-home".
const FONT_PREFIXES = ['mdi', 'bi', 'ti', 'ri', 'bx', 'la', 'fi', 'lucide', 'glyphicon', 'icon', 'pi', 'el', 'uil']

function parseOtherFont(tokens: string[]): IconSpec | null {
    for (const prefix of FONT_PREFIXES) {
        const tag = `${prefix}-`
        const token = tokens.find((t) => t.startsWith(tag) && t.length > tag.length)
        if (!token) continue
        // Only a font-class shape: "mdi mdi-home" (family token + class) or a
        // lone "mdi-home"; never "mdi-home extra words".
        if (!tokens.every((t) => t === prefix || t === token)) continue
        let rest = token.slice(tag.length).toLowerCase()
        const direct = lucideKeyFor(rest)
        if (direct) return lucide(direct)
        // Variant suffixes: "ri-home-line", "bi-house-fill", "ti-home-2".
        rest = rest.replace(/-(line|fill|outline|filled|solid|regular|thin)$/, '')
        const key = lucideKeyFor(rest)
        if (key) return lucide(key)
        return { kind: 'unknown', raw: tokens.join(' ') }
    }
    return null
}

// ---------- Emoji ----------
const EMOJI_FULL =
    /^(?:\p{Regional_Indicator}{2}|[0-9#*]️?⃣|\p{Extended_Pictographic}[\u{E0020}-\u{E007F}]+|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*️?)$/u
const EMOJI_START = /^(?:\p{Regional_Indicator}|[0-9#*]️?⃣|\p{Extended_Pictographic})/u

function graphemeCount(s: string): number | null {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: 'grapheme' }) => { segment(s: string): Iterable<unknown> } }).Segmenter
    if (!Seg) return null
    let n = 0
    for (const _ of new Seg(undefined, { granularity: 'grapheme' }).segment(s)) {
        void _
        n++
        if (n > 1) break
    }
    return n
}

export function isSingleEmoji(value: string): boolean {
    if (!value || value.length > 64) return false
    const count = graphemeCount(value)
    // With Intl.Segmenter: one grapheme that starts like an emoji. Without it
    // the strict sequence grammar above does the same job.
    return count !== null ? count === 1 && EMOJI_START.test(value) : EMOJI_FULL.test(value)
}

// ---------- Images ----------
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif|svg\+xml)(?:;[a-z0-9=.+-]+)*,[^\s"'<>\\]*$/i
const HTTP_URL = /^https?:\/\/[^\s"'<>\\]+$/i
// "/uploads/a.png", "./a.png", "../a.png" ("//host" is protocol-relative: no).
const ROOTED_PATH = /^(?:\/(?!\/)|\.\.?\/)[^\s"'<>\\]*$/
// "uploads/a.png": a bare relative path is an image only with an image extension.
const BARE_IMAGE_PATH = /^[A-Za-z0-9_][^\s"'<>\\:]*\.(?:png|jpe?g|webp|gif|svg|avif|ico)(?:[?#][^\s"'<>\\]*)?$/i

function isImageSource(v: string): boolean {
    return DATA_IMAGE.test(v) || HTTP_URL.test(v) || ROOTED_PATH.test(v) || BARE_IMAGE_PATH.test(v)
}

/** Classifies an icon value. Pure and deterministic. */
export function parseIconSpec(spec: unknown): IconSpec {
    if (typeof spec !== 'string') return { kind: 'unknown', raw: spec == null ? '' : String(spec) }
    const raw = spec
    const value = spec.trim()
    if (!value || value.length > 2048 || /[\u0000-\u001F]/.test(value)) return { kind: 'unknown', raw }

    if (isImageSource(value)) return { kind: 'image', src: value }
    // javascript:, vbscript:, data:text/html, file:, blob: ... never an icon.
    if (/^(?:javascript|vbscript|data|file|blob|about):/i.test(value)) return { kind: 'unknown', raw }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z0-9-]+:[a-z0-9-]+$/i.test(value)) {
        return { kind: 'unknown', raw }
    }
    if (isSingleEmoji(value)) return { kind: 'emoji', value }

    // Iconify id: "mdi:home", "lucide:brain", "ph:house-bold".
    const iconify = value.match(/^([a-z0-9-]+):([a-z0-9-]+)$/i)
    if (iconify) {
        const key = lucideKeyFor(iconify[2]!) ?? lucideKeyFor(iconify[2]!.replace(/-(line|fill|bold|outline|solid)$/, ''))
        return key ? lucide(key) : { kind: 'unknown', raw }
    }

    const tokens = value.split(/\s+/)
    if (tokens.length === 1) {
        const direct = lucideKeyFor(value)
        if (direct) return lucide(direct)
    }
    const fa = parseFontAwesome(tokens)
    if (fa) return fa.kind === 'unknown' ? { kind: 'unknown', raw } : fa
    const other = parseOtherFont(tokens)
    if (other) return other.kind === 'unknown' ? { kind: 'unknown', raw } : other
    // Material Icons ligatures: "material-icons home" / "material-symbols-outlined home".
    if (tokens.length === 2 && /^material-(icons|symbols)(-[a-z]+)?$/.test(tokens[0]!)) {
        const key = lucideKeyFor(tokens[1]!)
        if (key) return lucide(key)
    }
    return { kind: 'unknown', raw }
}
