---
'@asteby/metacore-runtime-react': minor
---

DynamicTable: el borrado masivo ahora muestra el motivo de cada rechazo del servidor. El toast de error conserva el conteo y añade como `description` hasta 3 motivos distintos agrupados con su cuenta ("• motivo (×2)", truncados a 200 caracteres, más "y N más"), como string con saltos de línea entregado en `description`; cómo se muestran esos saltos depende del toast del host. Los mensajes técnicos genéricos de axios ("Request failed with status code 500", "Network Error", "timeout of Nms exceeded") no cuentan como motivo. Si no hay motivo, el toast queda igual que antes. Nueva prop opcional `onBulkDeleteResult({ succeeded, failed })` llamada una vez al terminar (si lanza, se registra con `console.error` y la tabla se refresca igual), con `message` y `status` por fila fallida. Clave i18n nueva `dynamic.bulk_delete_error_more`.
