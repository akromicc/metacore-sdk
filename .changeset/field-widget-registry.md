---
'@asteby/metacore-runtime-react': minor
---

Registro de widgets de campo: `registerFieldWidget(name, component)` (devuelve disposer), `getFieldWidget`, `listFieldWidgets`, `clearFieldWidgets` y el tipo `FieldWidgetProps` (`field`, `value`, `onChange`, `disabled`, `error`, `record`). `DynamicForm` y `DynamicRecordDialog` consultan el registro con el `widget` servido por el kernel (`FieldDef.Widget`) antes del render por `type`, de modo que un host enchufa mapas, horarios u otros editores propios. Un nombre sin registrar deja el comportamiento actual intacto.
