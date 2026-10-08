---
'@asteby/metacore-pwa': minor
---

Política de actualización compartida y opt-in para el service worker. Nuevo `updateStrategy: 'auto' | 'prompt'` en `PWAProvider` (default `'auto'`: sin ningún cambio de comportamiento), con `autoApplyAfterMs`, `staleAutoApplyAfterMs`, `dismissTtlMs`, `isSafeToApply` y `versionCheck`. En `'prompt'` nunca se recarga sin aceptación del usuario salvo que se configure auto-aplicación (por defecto nunca) y solo en un momento seguro (sin modal, sin formulario a medias, pestaña oculta o inactiva); una sola recarga tras `SKIP_WAITING` -> `controllerchange`. Nuevos exports: `decideUpdate`, `isSafeSnapshot`, `createUpdateController`, `useServiceWorkerUpdate` y tipos. Reemplaza los `ReloadPrompt` locales de cada app.
