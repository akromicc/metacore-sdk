---
'@asteby/metacore-runtime-react': minor
---

DynamicRecordDialog: el renderer cubre los tipos `password` (nunca se prellena ni se muestra; vacío = no se envía), `phone`/`tel`, `checkbox`, `time`, `hidden` (no se renderiza, sí va en el payload con su default), `multiselect` (ref/searchEndpoint o `options` estáticas vía `staticOptions` en DynamicMultiSelectField) y `file` (UploadField). Los tipos existentes no cambian.
