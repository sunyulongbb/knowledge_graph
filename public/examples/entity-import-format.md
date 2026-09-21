# 单实体 JSON 导入格式

文件顶层必须包含 `version: 1` 和一个 `entity` 对象。实体支持 `id`、`name`、`description`、`aliases`、`tags`、`categories`、`images`、`videos`、`pdf`、`link`、`visibility`、`type` 与 `attributes`。`images`、`videos` 是资源 URL 数组，`pdf` 是单个 PDF 资源 URL。

`type` 可写本体名称字符串，或 `{ "id": "...", "name": "...", "description": "..." }`。找不到同 ID 或同名本体时自动创建。

`attributes` 每项支持 `id`、`name`、`datatype`、`value`、`description`。属性不存在时自动创建，并自动关联到实体本体。一次文件仅允许导入一个实体。

当 `entity.id` 不存在时创建实体；同一应用中已存在时更新实体。本次 JSON 中出现的同键属性会替换旧值，未出现的其他属性保留。

`categories` 使用分类树格式，每项支持 `name`、`description`、`color`、`image`、`tags`、`children`。系统按同一父级下的名称创建或复用分类，并关联实体；分类的 `tags` 会自动合并到实体标签。更新实体时，仅当 JSON 明确包含 `categories` 才替换分类关联。

支持的数据类型包括：`string`、`external-id`、`url`、`commonsMedia`、`math`、`musical-notation`、`geo-shape`、`tabular-data`、`quantity`、`time`、`globe-coordinate`、`monolingualtext`、`wikibase-item`、`wikibase-property`、`wikibase-lexeme`、`wikibase-form` 与 `wikibase-sense`。下载示例中的人物属性采用 Wikidata Q22686 的真实声明；人物不具备的特殊属性类型没有为了覆盖类型而虚构。

`time` 属性可以直接使用 `1990`、`1990-05`、`1990-05-20` 或完整 ISO 时间字符串，系统会自动推断年、月、日或秒精度；也支持 `{ "time": "+1990-05-20T00:00:00Z", "precision": 11 }` 完整格式。

`wikibase-item` 属性值建议使用 `{ "id": "Q30", "label_zh": "美国" }`；多值使用对象数组。导入时会按 `id` 复用已有实体，不存在时使用中文标签自动创建“实体条目”实体，属性值随即与该实体建立引用关系。

远程图片、视频和 PDF 会在导入时同步到项目内的 `uploads/node-images`、`uploads/node-videos`、`uploads/node-pdfs`，数据库保存 `/static/uploads/...` 本地访问地址。
