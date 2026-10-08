---
'@asteby/metacore-runtime-react': minor
---

`DynamicTable` ahora respeta `ColumnDefinition.filterField` (y `filter_field`) en el filtro de cabecera: una columna de display de relación (p. ej. `institution_type.name`) filtra por su campo persistido (`institution_type_id`) y adopta las opciones de ese campo cuando las tiene. Aditivo: sin `filterField`, o igual a la key, el comportamiento no cambia.

Cambio de contrato a notar: en hosts cuya metadata declare `filterField`, el parámetro `f_*` enviado al backend pasa de la key de la columna a la FK (`f_institution_type_id`), que es lo buscado. Los hosts que lo parcheaban localmente (p. ej. `applyMetadataFilterFields`) pueden borrar el parche.
