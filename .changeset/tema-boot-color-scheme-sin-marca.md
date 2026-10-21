---
'@asteby/metacore-theme': patch
---

El boot de tema previo al primer pintado fija también `color-scheme` junto a la clase `dark`/`light`, a partir de la preferencia efectiva (cookie o sistema) y sin depender del color de marca guardado. Si existe `window.__BRAND__`, no restaura las variables/estilos de marca del snapshot guardado (posiblemente viejos). El `ThemeProvider` mantiene `color-scheme` sincronizado.
