---
'@asteby/storefront-react': patch
---

fix(fiscal): `IdentityDocumentReader` da 20 s (antes 3 s) a la lectura del PDF en el navegador. Ese plazo contaba también la descarga y el arranque del worker de pdf.js, así que en un teléfono con red lenta o un equipo ocupado una constancia buena terminaba en «No pudimos leer este archivo». La subida sin JavaScript conserva sus 3 s.
