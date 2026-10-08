# @asteby/metacore-notifications

Bell dropdown, **unified toast**, dynamic Lucide icons / severity colors /
module chips, and live ingest over **SSE** (preferred) or WebSocket.

## Install

```bash
pnpm add @asteby/metacore-notifications \
  @asteby/metacore-ui @asteby/metacore-websocket \
  date-fns lucide-react sonner @tanstack/react-query react react-dom
```

## Boot (host app)

```tsx
import { installUnifiedToasts, registerModuleLabel } from '@asteby/metacore-notifications'

installUnifiedToasts() // every toast.success/info/… → same card as the bell
registerModuleLabel('team_chat', 'Equipo') // optional extra chips
```

## Dropdown + SSE

```tsx
import { NotificationsDropdown } from '@asteby/metacore-notifications'

<NotificationsDropdown
  apiClient={api}
  apiBasePath="/data/notifications/me"
  sseUrl="/api/notifications/stream"
  sseAccessToken={accessToken}
  preferSse
  showToastOnIngest
  onNotificationClick={(n) => n.link && navigate({ to: n.link })}
/>
```

### Live transports

| Prop | Role |
|------|------|
| `sseUrl` | `EventSource` to host SSE (`event: notification`) |
| `subscribeToNotifications` | Bring-your-own bus (team-chat bridge, etc.) |
| built-in WS | Used when neither SSE-prefer nor custom subscribe is set |

### Visual contract (payload / metadata)

- `icon` — Lucide kebab name (`shopping-cart`, `clipboard-list`, …)
- `type` — `info` \| `success` \| `warning` \| `error` → default colors
- `metadata.addon_key` / `apartado` — module chip (Inventario, Almacén, POS, …)
- `metadata.color` — optional CSS/hex override for the icon disc

## Host with its own contract

Everything below is optional; without these props the dropdown behaves exactly
as before (`GET apiBasePath` → `{ data: [] }`, one `PATCH ${apiBasePath}/${id}`
per item, unread count computed over the loaded page).

| Prop | Purpose |
|---|---|
| `listParams` | Object or `(perPage) => object` replacing the default `orderBy/orderDir/per_page` query. |
| `parseList(body)` | Reads the response: `{ items, unreadCount?, total? }`. A server `unreadCount` wins over the local count. |
| `normalizeItem(raw)` | Maps each row **and each live payload** to a `NotificationItem` (`read_at` → `is_read`, `action_url` → `link`…). `NotificationItem.id` may be `string \| number`. |
| `onMarkRead(ids)` / `onMarkAllRead()` | Replace the default PATCHes. Optimistic update, rolled back if the promise rejects. With only `onMarkRead`, "mark all" calls it with the unread ids. |
| `onDelete(id)` | Shows a trash button per row (second click confirms; rolled back on failure). Labels: `delete`, `confirmDelete`. |
| `fetchUnreadCount` + `unreadPollMs` | Server counter, polled only while the tab is visible (and on becoming visible). `0`/unset = no polling. |
| `badgeMax`, `triggerAriaLabel(unread)` | Badge cap (default `99` → `99+`) and trigger `aria-label`. |
| `onIngest(payload, item)` | Called once per NEW live notification (after dedup) — sound, query invalidation, hidden-tab push belong to the host. |
| `footer`, `closeOnClick`, `renderAvatar`, `item.user` | Extra footer (`ReactNode` or `(close) => ReactNode`), menu close behaviour, custom avatar or `user: { name, avatar }` with initials fallback. |
| `richText`, `reloadAfterPermission` | See below; `reloadAfterPermission={false}` skips the page reload after granting push permission. |
| `labels.loading / error / retry` | The loading and error states (with retry) are now rendered instead of the empty message. |

`onNotificationClick` receives the full normalized item (metadata included).
When it is present nothing is opened by default; without it only absolute
`http(s)` links are opened (`window.open`), relative links are a no-op — pass
`onNotificationClick` to navigate inside a SPA. The live toast delegates its
click to the same handler.

`closeOnClick`: Radix already closes the menu when an item is selected, so the
unset default keeps closing. `true` closes explicitly, `false` keeps it open.

The row delete button lives inside a menu item; Radix menus do not move focus
with Tab, so keyboard users reach it only by pointer. Prefer exposing deletion
in a dedicated page if keyboard access matters.

### Example: `{ notifications, unread_count }` + `read_at`

```tsx
<NotificationsDropdown
  apiClient={api}
  apiBasePath='/notifications'
  listParams={(n) => ({ limit: n })}
  parseList={(body) => {
    const b = body as { notifications: unknown[]; unread_count: number }
    return { items: b.notifications, unreadCount: b.unread_count }
  }}
  normalizeItem={(raw) => {
    const r = raw as Record<string, any>
    return {
      id: r.id, // numeric ids are fine
      title: r.title,
      message: r.body ?? '',
      type: r.type ?? 'info',
      is_read: r.read_at != null,
      created_at: r.created_at,
      link: r.action_url,
      image: r.image_url,
      metadata: r.meta_payload,
    }
  }}
  onMarkRead={(ids) => api.post('/notifications/mark-read', { notification_ids: ids }).then(() => {})}
  onMarkAllRead={() => api.post('/notifications/mark-read', { mark_all: true }).then(() => {})}
  onDelete={(id) => api.delete(`/notifications/${id}`).then(() => {})}
  fetchUnreadCount={() => api.get('/notifications/unread-count').then((r) => r.data.count)}
  unreadPollMs={60_000}
  onNotificationClick={(n) => navigate({ to: n.link })}
  onIngest={(payload, item) => playSound()}
  footer={(close) => <Link to='/notifications' onClick={close}>Ver todas</Link>}
  richText={false}
/>
```

### Rich text and XSS

By default (`richText` true) bodies go through `formatNotificationBodyHtml`,
a small **regex/tokenizer sanitizer** (allowlist: `strong b em i u mark code br
span`, no attributes; any other `<` is escaped) rendered with
`dangerouslySetInnerHTML`. It has hostile-input tests (`<img onerror>`,
`javascript:` hrefs, `on*` attributes, `<svg onload>`, malformed nesting,
`<b/onclick=…>`), but it is not a DOM-based sanitizer. The body of campaigns
and other **user-authored content is untrusted**: pass `richText={false}` to
the dropdown (and to `showNotificationToast`) so it is painted as plain text
escaped by React.

## API

- `GET {apiBasePath}` → `{ data: NotificationItem[] }`
- `PATCH {apiBasePath}/{id}` `{ is_read: true }`
- `GET /api/notifications/stream` — SSE (`?access_token=` for EventSource)

## License

Apache-2.0
