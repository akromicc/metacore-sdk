---
'@asteby/storefront-react': patch
---

Las secciones aceptan la prop `image` como `{ url, alt }` (la forma que OPS publica) además de la URL suelta; antes la sección se descartaba con «must be a string».
