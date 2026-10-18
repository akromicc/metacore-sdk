/**
 * Resuelve el nombre de una variante ("Azul marino", "Rojo / Negro", "Fresa Kiwi", "#ff8800") a uno o más colores
 * para dibujar una muestra. Pura y sin DOM: sirve igual en servidor y cliente, y para cualquier tipo de variante
 * (sabores, colores de playera, acabados). Devuelve `null` si no reconoce nada: el llamador cae a texto.
 */

/** Colores genéricos (es/en). Se prueban de la frase más larga a la más corta: "azul marino" antes que "azul". */
const COLORS: [string, string][] = [
  ["azul marino", "#14213d"], ["navy", "#14213d"], ["azul rey", "#2447d6"], ["azul cielo", "#6ec1f0"], ["celeste", "#8fd0f5"],
  ["verde militar", "#4b5320"], ["verde oliva", "#6b7a2a"], ["verde limon", "#b8e03a"], ["verde menta", "#8fe0b5"],
  ["rojo", "#e0262d"], ["red", "#e0262d"], ["vino", "#6d1a36"], ["guinda", "#7a1f3d"], ["burgundy", "#6d1a36"],
  ["azul", "#2f5bea"], ["blue", "#2f5bea"], ["verde", "#2fa84f"], ["green", "#2fa84f"],
  ["amarillo", "#ffd21f"], ["yellow", "#ffd21f"], ["naranja", "#ff8a1f"], ["orange", "#ff8a1f"],
  ["morado", "#7b3fc4"], ["purpura", "#7b3fc4"], ["purple", "#7b3fc4"], ["violeta", "#8a4fd6"], ["lila", "#c4a5f0"],
  ["rosa mexicano", "#e4007c"], ["rosa", "#ff7eb6"], ["pink", "#ff7eb6"], ["fucsia", "#e4007c"], ["magenta", "#d4119e"],
  ["negro", "#111111"], ["black", "#111111"], ["blanco", "#ffffff"], ["white", "#ffffff"], ["gris oscuro", "#4a4f57"],
  ["gris claro", "#cfd3d8"], ["gris", "#9aa0a8"], ["gray", "#9aa0a8"], ["grey", "#9aa0a8"], ["plata", "#c0c4cc"], ["plateado", "#c0c4cc"], ["silver", "#c0c4cc"],
  ["dorado", "#d4a72c"], ["oro", "#d4a72c"], ["gold", "#d4a72c"], ["cafe", "#7a4a2b"], ["marron", "#7a4a2b"], ["brown", "#7a4a2b"],
  ["beige", "#e6d3b3"], ["crema", "#f4ead2"], ["hueso", "#f1ecde"], ["arena", "#d9c39a"], ["khaki", "#b8a77a"], ["camel", "#b9824a"],
  ["turquesa", "#1fc8c8"], ["aqua", "#34d3d3"], ["coral", "#ff6f61"], ["salmon", "#ff8f7a"], ["mostaza", "#d9a521"], ["terracota", "#c4623f"],
  ["transparente", "#e8edf2"],
];

/** Sabores (suplementos, alimentos, bebidas). */
const FLAVORS: [string, string][] = [
  ["fresa", "#ff4d6d"], ["kiwi", "#8bc34a"], ["mora azul", "#3d4fd6"], ["arandano", "#3d4fd6"], ["blueberry", "#3d4fd6"],
  ["mango", "#ffb020"], ["manzana verde", "#7cc242"], ["manzana", "#e03a3e"], ["pina", "#ffd23f"],
  ["chocolate", "#6b3f2a"], ["cacao", "#6b3f2a"], ["cookies", "#d8c3a5"], ["galleta", "#d8c3a5"], ["vainilla", "#f3e5c0"],
  ["limon", "#e8f04a"], ["limonada", "#e8f04a"], ["sandia", "#ff5a6e"], ["uva", "#7b3fc4"], ["cereza", "#c21e3a"],
  ["coco", "#f5efe6"], ["cacahuate", "#c8933f"], ["frutos rojos", "#d6244a"], ["frutas rojas", "#d6244a"],
  ["jamaica", "#9b1b46"], ["mandarina", "#ff8a1f"], ["platano", "#ffe066"], ["mocha", "#8a5a3c"],
  ["durazno", "#ffb07c"], ["melon", "#f6c26b"], ["maracuya", "#f7c331"], ["tropical", "#ffb020"],
  ["natural", "#ffffff"], ["sin sabor", "#ffffff"], ["neutro", "#ffffff"],
];

/** Un solo diccionario: así la frase más larga gana entre colores y sabores ("mora azul" no es "azul"). */
const ALL = [...COLORS, ...FLAVORS]
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_COLORS = 4;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Busca, de la frase más larga a la más corta, las entradas del diccionario que aparecen como palabras completas. */
function scan(text: string, table: [string, string][]): string[] {
  const found: { index: number; color: string }[] = [];
  let rest = text;
  for (const [name, color] of [...table].sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`(^|[^a-z])${name}(?![a-z])`);
    const m = re.exec(rest);
    if (!m) continue;
    found.push({ index: m.index, color });
    // Se tacha lo encontrado para que "azul" no vuelva a salir dentro de "azul marino".
    const start = m.index + (m[1]?.length ?? 0)
    rest = rest.slice(0, start) + ' '.repeat(name.length) + rest.slice(start + name.length)
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.color);
}

/** Colores de un nombre de variante, en el orden en que se leen. `null` si no reconoce ninguno. */
export function resolveSwatch(value: string): string[] | null {
  const text = normalize(value);
  if (!text) return null;
  const parts = text.split(/\s*[/,+&|]\s*|\s+y\s+|\s+and\s+|\s+-\s+/);
  const colors: string[] = [];
  for (const part of parts) {
    const hex = part.match(/#[0-9a-f]{3,6}\b/i)?.[0];
    const found = hex && HEX.test(hex) ? [hex] : scan(part, ALL);
    for (const c of found) if (!colors.includes(c)) colors.push(c);
  }
  return colors.length > 0 ? colors.slice(0, MAX_COLORS) : null;
}

/** ¿Todos los valores de una opción tienen muestra? Solo entonces conviene dibujar el selector con colores. */
export function optionHasSwatches(values: string[]): boolean {
  return values.length > 0 && values.every((v) => resolveSwatch(v) !== null);
}

/** Fondo CSS plano: un color liso, dos mitades, o sectores iguales (hasta 4). */
export function swatchBackground(colors: string[]): string {
  const [first = 'transparent', second] = colors
  if (second === undefined) return first
  if (colors.length === 2) return `linear-gradient(90deg, ${first} 50%, ${second} 50%)`
  const step = 360 / colors.length;
  return `conic-gradient(${colors.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(", ")})`;
}

/** Luminancia relativa (0 negro – 1 blanco) de un color hex, para decidir si hace falta un aro. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const channel = (i: number): number => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** Lo que dibuja una muestra: uno o más colores planos, o un emoji. */
export type SwatchSpec = { colors: string[]; emoji?: undefined } | { emoji: string; colors?: undefined }

const EMOJI = /\p{Extended_Pictographic}/u

/**
 * Atributo del producto con el color o emoji de cada variante, como lo siembra el catálogo (OPS):
 * `"Mora Azul:#3d4fd6|Fresa Kiwi:#ff4d6d+#8bc34a|Natural:🥛"`. Cada valor es un hex, varios hex con "+" (combinación) o un emoji.
 * Mandar color o emoji es decisión del catálogo; el nombre ("Rojo", "Fresa") solo se usa si el atributo no lo trae.
 */
export function parseSwatchAttribute(raw: unknown): Map<string, SwatchSpec> {
  const map = new Map<string, SwatchSpec>()
  if (typeof raw !== 'string') return map
  for (const part of raw.split('|')) {
    const i = part.lastIndexOf(':')
    if (i <= 0) continue
    const name = normalize(part.slice(0, i))
    const value = part.slice(i + 1).trim()
    const colors = value.split('+').map((c) => c.trim())
    if (colors.length > 0 && colors.every((c) => HEX.test(c))) map.set(name, { colors: colors.slice(0, MAX_COLORS) })
    else if (EMOJI.test(value)) map.set(name, { emoji: value })
  }
  return map
}

/** Muestra de una variante: primero lo que diga el catálogo (atributo), luego el nombre. `null` si no hay forma de saberlo. */
export function resolveSwatchSpec(value: string, attribute?: Map<string, SwatchSpec>): SwatchSpec | null {
  const fromCatalog = attribute?.get(normalize(value))
  if (fromCatalog) return fromCatalog
  const colors = resolveSwatch(value)
  return colors ? { colors } : null
}
