---
"@asteby/metacore-runtime-react": minor
"@asteby/metacore-i18n": minor
---

Procedencia de registros: `ProvenanceBadge`, `AuthorshipCell`, `ProvenanceActorChip` y `NotificationProvenanceAvatar` muestran persona sola, agente solo (nombre/avatar de `OrgRuntimeProvider agentActor`), sistema/integración con su origen y «persona con agente» con avatar superpuesto y tooltip accesible (quién autorizó, qué propuso el agente y cuándo). La columna created_by de las tablas dinámicas, el detalle del registro, `AuditInfo`, `RecordHistory` y `ActivityTimeline` los usan por defecto cuando la fila trae `created_by.provenance` (kernel `provenance`). Nuevos `agentActor` y `provenanceOrigin` en `OrgRuntimeProvider`; claves i18n `provenance.*` en es/en.
