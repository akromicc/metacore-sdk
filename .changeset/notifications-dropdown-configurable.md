---
"@asteby/metacore-notifications": minor
---

`NotificationsDropdown` configurable para hosts con contrato propio, todo opcional y retrocompatible: `listParams`, `parseList` (con `unreadCount` del servidor), `normalizeItem` (filas y payloads en vivo), ids `string | number`, `onMarkRead`/`onMarkAllRead`/`onDelete` con actualización optimista y rollback, `fetchUnreadCount` + `unreadPollMs` (solo pestaña visible), `badgeMax`, `triggerAriaLabel`, `onIngest`, `footer`, `closeOnClick`, `renderAvatar`/`item.user`, `reloadAfterPermission` y `richText={false}` (cuerpo como texto plano) también en `showNotificationToast`. Ahora se muestran los estados de carga y error (con reintentar). `NotificationsApiClient` admite `post`/`delete` opcionales. El sanitizador de texto enriquecido se endurece (ya no deja pasar `<b/onclick=…>` ni `<` sueltos) y gana pruebas de entradas hostiles.
