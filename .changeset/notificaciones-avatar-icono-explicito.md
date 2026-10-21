---
'@asteby/metacore-notifications': minor
---

Avatar de notificaciones: el icono explícito (`icon` no vacío o `metadata.color`) gana a las iniciales y al avatar de `user`, de modo que las notificaciones del sistema ya no salen con «UN» cuando la API devuelve al destinatario en `user`. Nuevo campo opcional `actor?: {name?, avatar?}` (autor, con prioridad sobre `user`, que queda como compatibilidad). Nueva función pura `resolveAvatarChoice`. Prioridad: imagen, icono explícito, avatar del autor, iniciales, icono por tipo.
