# 实体 JSON 导入格式

单个实体沿用 `{ "version": 1, "entity": { ... } }` 格式。批量导入可直接使用实体对象数组，也可使用原单实体文档组成的数组：

```json
[
  { "id": "person-1", "name": "张三", "type": "人物", "attributes": [] },
  { "id": "person-2", "name": "李四", "type": "人物", "attributes": [] }
]
```

还支持 `{ "version": 1, "entities": [{ ... }, { ... }] }`。实体可包含 `id`、`name`、`description`、`aliases`、`tags`、`categories`、`images`、`videos`、`pdf`、`link`、`visibility`、`type` 与 `attributes`。`images`、`videos` 是资源 URL 数组，`pdf` 是单个 PDF 资源 URL。批量文件会先完整校验，再在同一事务中导入。

`type` 可写本体名称字符串，或 `{ "id": "...", "name": "...", "description": "..." }`。找不到同 ID 或同名本体时自动创建。

`attributes` 每项支持 `id`、`name`、`datatype`、`value`、`description`。属性不存在时自动创建，并自动关联到实体本体。

当 `entity.id` 不存在时创建实体；同一应用中已存在时更新实体。本次 JSON 中出现的同键属性会替换旧值，未出现的其他属性保留。

`categories` 使用分类树格式，每项支持 `name`、`description`、`color`、`image`、`tags`、`children`。系统按同一父级下的名称创建或复用分类，并关联实体；分类的 `tags` 会自动合并到实体标签。更新实体时，仅当 JSON 明确包含 `categories` 才替换分类关联。

支持的数据类型包括：`string`、`external-id`、`url`、`commonsMedia`、`math`、`musical-notation`、`geo-shape`、`tabular-data`、`quantity`、`time`、`globe-coordinate`、`monolingualtext`、`wikibase-item`、`wikibase-property`、`wikibase-lexeme`、`wikibase-form` 与 `wikibase-sense`。下载示例是通用占位模板，使用前请替换其中的 ID、名称、资源地址和属性值。

`time` 属性可以直接使用 `1990`、`1990-05`、`1990-05-20` 或完整 ISO 时间字符串，系统会自动推断年、月、日或秒精度；也支持 `{ "time": "+1990-05-20T00:00:00Z", "precision": 11 }` 完整格式。

`wikibase-item` 属性值可使用 `{ "id": "Q30", "label_zh": "美国" }`、`{ "label_zh": "美国" }` 或直接使用 `"美国"`；多值使用数组。系统优先在当前应用中按 ID 匹配，再按中文标签、名称和别名匹配，也能匹配同一批次中的目标。只有无法匹配时，才自动创建“实体条目”实体并建立引用关系。

远程图片、视频和 PDF 会在导入时同步到项目内的 `uploads/node-images`、`uploads/node-videos`、`uploads/node-pdfs`，数据库保存 `/static/uploads/...` 本地访问地址。
