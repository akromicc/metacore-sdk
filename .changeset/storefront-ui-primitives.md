---
'@asteby/storefront-react': minor
---

Nuevo subpath `@asteby/storefront-react/ui` (y `ui.css`) con piezas de tienda reutilizables y sin dependencia de router: `Select` (listbox propio con mejora progresiva sobre `<select>` nativo), `Swatch` (muestra 2D plana para variantes: color, combinaciones o emoji; el catálogo manda sobre el nombre vía `parseSwatchAttribute`), `ThemeToggle` + `THEME_INIT_SCRIPT` (claro/oscuro sin parpadeo), `InstallApp` + `useServiceWorker` (PWA), y los estilos `.select`, `.check` y `.radio` basados en los tokens de la tienda.
