// Copia el CSS plano de /ui a dist (tsup solo emite JS). El @import de swatch.css se resuelve aquí en un solo archivo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const read = (f) => readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8')
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true })
writeFileSync(new URL('../dist/ui.css', import.meta.url), read('ui.css').replace('@import "./swatch.css";', read('swatch.css')))
