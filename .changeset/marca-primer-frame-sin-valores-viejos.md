---
'@asteby/metacore-app-providers': minor
---

Marca en el primer frame sin valores viejos: `applyCachedBranding` prefiere `window.__BRAND__` (marca fresca del servidor) sobre lo guardado y reescribe la clave `platform-branding:<host>` con ella; lo guardado solo se usa si `__BRAND__` no existe. Cada respuesta del fetcher SUSTITUYE los campos guardados (sin fusionar con valores viejos) y el placeholder ya no se vuelve a persistir. Los colores se sanean a `#RRGGBB` al leer, pintar y guardar. Nuevos exports: `sanitizeBranding`, `persistBranding`, `readWindowBranding`.
