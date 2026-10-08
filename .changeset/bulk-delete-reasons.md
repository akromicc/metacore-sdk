---
'@asteby/metacore-runtime-react': minor
---

DynamicTable: el borrado masivo ahora muestra el motivo de cada rechazo del servidor. El toast de error conserva el conteo y añade como `description` hasta 3 motivos distintos agrupados con su cuenta ("• motivo (×2)", truncados a 200 caracteres, más "y N más"), siempre como texto. Si el servidor no da motivo, el toast queda igual que antes. Nueva prop opcional `onBulkDeleteResult({ succeeded, failed })` llamada una vez al terminar, con `message` y `status` por fila fallida. Clave i18n nueva `dynamic.bulk_delete_error_more`.
