---
"@asteby/metacore-runtime-react": minor
---

Resolutor universal de íconos: `parseIconSpec` (Lucide en 4 formas, clases FontAwesome 5/6 vía tabla de alias propia, otras fuentes/Iconify, emoji, imágenes seguras), `registerIconResolver` para que el host enchufe FontAwesome/Iconify/sprites, componente `Icon` y columna `type: 'icon'` en tabla y detalle. `DynamicIcon` conserva su firma y ahora interpreta también esos formatos; los nombres Lucide resuelven igual que antes.
