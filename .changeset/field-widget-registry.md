---
'@asteby/metacore-runtime-react': minor
---

Registro de widgets de campo: `registerFieldWidget(name, component)` (devuelve disposer), `getFieldWidget`, `listFieldWidgets`, `clearFieldWidgets`, el hook `useFieldWidgetRegistryVersion` y los tipos `FieldWidgetProps` (`field`, `value`, `onChange`, `disabled`, `error`, `record`) y `FieldWidgetComponent`. `DynamicForm` y `DynamicRecordDialog` consultan el registro con el `widget` servido por el kernel (`FieldDef.Widget`) antes del render por `type`, de modo que un host enchufa mapas, horarios u otros editores propios. Un nombre sin registrar deja el comportamiento actual intacto.

Atención: un widget registrado tiene prioridad sobre los widgets built-in del SDK con el mismo nombre (`upload`, `icon`, `dynamic_select`); registrar uno con ese nombre reemplaza el render del SDK para esos campos.

`FieldWidgetProps.record` son los valores vivos del form en `DynamicForm` (también en modo crear) y el registro cargado/en edición en el diálogo.
