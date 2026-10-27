---
'@asteby/storefront-react': patch
---

fix(fiscal): cuando el servidor rechaza en `request-invoice`/`set-invoice` un campo que el formulario no tiene (p. ej. `invoice.country_code`), la acción ahora devuelve `error.serverField` (nombre sin prefijo) en lugar de nada; antes el comprador veía el aviso genérico sin ningún campo marcado. `fieldErrors` sigue incluyendo solo controles reales. Aditivo.
