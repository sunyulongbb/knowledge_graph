# 检索职责划分

在 ArangoDB（Enterprise）模式下，页面用途决定检索引擎，不通过客户端参数随意切换，也不在引擎异常时静默回退。

| 页面与用途 | 接口 | 引擎 |
| --- | --- | --- |
| 知识列表、实体选择、图谱实体查找 | `/api/kb/entity_search` | ArangoSearch |
| 应用首页、独立检索页 | `/api/kb/discover/search` | Elasticsearch |

知识检索使用各应用数据库中的 `knowledge_search` 视图，配置 `text_zh`、`text_en` 分词及 BM25 相关度排序。分类、本体、媒体和属性值条件在 ArangoDB 中过滤，属性名与属性值必须匹配同一条关系。权限与结果内容通过当前实体文档获取，分页总数在过滤后计算。

首次使用时，系统分批补齐旧实体的 `search_text` 字段并配置视图。新实体及正常编辑、导入通过统一实体投影维护该字段。视图按近实时方式提交索引，因此新内容可能短暂延迟出现；生产查询不使用会阻塞请求的 `waitForSync`。直接在数据库外部修改名称、别名、描述时，也应同步维护 `search_text`。

首页与独立检索页使用 ES 的全文检索及复合筛选，并继续用 ArangoDB 的当前权限信息限制可见结果。实体写入仍以 ArangoDB 为准，随后同步 ES；SQLite 仅承担现有定时知识备份。Lite 模式保留原有查询实现。

两条查询接口均返回 `searchBackend`，并通过 `X-Knowledge-Search` 响应头标识实际引擎。当前均保留分类子树筛选和 `hide_entity=1` 的“实体条目”排除规则。相关服务异常返回 503。

视图更新与 `waitForSync` 的生产使用限制参见 [ArangoSearch 官方说明](https://docs.arango.ai/arangodb/stable/indexes-and-search/arangosearch/)。

## 首页与独立检索页的高级搜索

首页搜索框将关键词带入独立检索页，使用 ES 返回结果与命中片段。默认智能匹配组合精确短语、`AUTO` 拼写容错和名称/别名前缀检索，并优先精确匹配。高级模式可选择完整短语、全部词语、任意词语，限定名称/别名范围、排除词语、更新时间范围、本体及子本体、属性/属性值和带图知识。日期范围按 UTC 日界限匹配存储的更新时间。

模糊检索遵循现有 ES 索引的分词结果，不等同于拼音检索或任意位置的字符串包含检索。实现参考 [ES multi-match 文档](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query)。

匹配高亮参考 [ES 高亮配置](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting-settings)，使用中性标记分隔命中词；前端转义原始文本后再生成 `mark` 元素，不直接插入来自索引的 HTML。搜索条件和页码会保留在当前应用的 URL 中。
