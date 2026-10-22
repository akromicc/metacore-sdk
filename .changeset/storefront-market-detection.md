---
'@asteby/storefront': minor
---

Detección de mercado por visita, pura y sin DOM: `visitorCountry` (cabeceras de país del CDN), `preferredLanguages` / `negotiateLocale` (Accept-Language), `suggestMarket` (sugiere, no redirige: respeta rastreadores y la elección guardada; el país manda sobre el idioma) y `hreflangLinks` para SEO por mercado. El mercado canónico sigue siendo el del dominio verificado en OPS.

El cliente acepta `domain` y `market`: envía `X-Storefront-Domain: <host>#<market>` para que UN dominio público sirva varios mercados (la tienda enruta por prefijo `/mx`, `/us`); OPS lo honra si la organización tiene ese mercado activo. Nuevo `storefrontDomainHeader`.
