---
'@asteby/metacore-runtime-react': minor
---

DynamicRecordDialog: el renderer cubre los tipos `password` (nunca se prellena ni se muestra; vacío = no se envía), `phone`/`tel`, `checkbox`, `time`, `hidden` (no se renderiza, sí va en el payload con su default), `multiselect` (ref/searchEndpoint o `options` estáticas vía `staticOptions` en DynamicMultiSelectField) y `file` (UploadField). Los tipos existentes no cambian.

Al editar, un `password` vacío ya no entra al gate de `required` (vacío = no cambiar), tanto al guardar como en "Siguiente" del wizard; al crear sigue siendo obligatorio. Comportamiento fijado con test: un campo `hidden` con `visible_when` siempre se omite del payload (no se evalúa el predicado), y un `hidden` sin `visible_when` viaja con su default. Deuda conocida: hay dos resolvers de campos (`EditField` del diálogo y `resolveWidget` de dynamic-form).
