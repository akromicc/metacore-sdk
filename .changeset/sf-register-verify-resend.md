---
'@asteby/storefront-react': minor
'@asteby/storefront': patch
---

feat(storefront-react): el paso «Confirma tu correo» del registro (en `<AccountAuth>` y en `<PostPurchaseAccountPrompt>`) ya permite reenviar el código con enfriamiento de 60 s (intent nuevo `resend`; la contraseña vive solo en memoria y viaja en un formulario aparte), corregir el correo, y explica el código incorrecto o vencido («pide uno nuevo») y la espera cuando el servidor limita (`error.retryAfter`). El reenvío del código de acceso también cuenta el enfriamiento. fix(storefront mock): con verificación de correo, `POST /customer/register` de un correo que ya tiene cuenta responde el mismo `202` que uno nuevo (como OPS; antes `409`, un oráculo de enumeración que ocultaba el comportamiento real); el `409` queda solo sin verificación.
