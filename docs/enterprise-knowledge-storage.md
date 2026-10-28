# 企业版知识主存储

## SQLite 备份

Enterprise 以 ArangoDB 为知识主存储、ES 为检索索引，并将完整 entity/link 文档备份到 `app.sqlite` 的独立表 `enterprise_knowledge_backups`。每次知识写入后触发备份，后台默认每 60 秒重试和对账（`ENTERPRISE_SQLITE_BACKUP_INTERVAL_MS`）；ES 故障不影响备份。源读取成功后才替换快照，读取失败保留上一次成功版本。

此表保存每个应用最新成功快照，包括权限、关系及完整 statement，不包含附件文件本身。`GET /api/kb/knowledge-sync/status` 的 `sqliteBackup` 返回最近成功备份时间与实体/边数量。页面 SQLite 导入仍读取旧 nodes/attributes 表，尚未提供从新备份表恢复的页面操作。快照目前整图读取到内存；独立灾备和历史版本保留需要另行复制数据库及附件。

企业版首页和知识列表的关键词、筛选、分页及内容返回统一使用 Elasticsearch。知识新增、修改、删除先提交 ArangoDB，再由同步器同步到 ES。知识详情和图关系仍由 ArangoDB 提供。Lite 版保留原 SQLite 知识路径。用户、会话、应用、本体、分类和属性定义仍由现有 SQLite 元数据库管理；知识接口不再通过 SQLite 的 nodes / attributes / entity_classes 查询数据。

## 配置与部署

企业 Compose 已设置 `KNOWLEDGE_STORAGE_BACKEND=arangodb`，普通 Compose 设置 `sqlite`。本地 Bun 启动可在 `.env` 设置：

```dotenv
KNOWLEDGE_STORAGE_BACKEND=arangodb
ARANGO_URL=http://127.0.0.1:8529
ARANGO_USERNAME=root
ARANGO_PASSWORD=你的数据库密码
ELASTICSEARCH_URL=http://127.0.0.1:9200
KNOWLEDGE_LEGACY_SQLITE_SYNC=false
```

不设置模式时，有 ARANGO_URL 则选择 ArangoDB，否则为 SQLite。显式设置 sqlite 可保持 Lite 离线模式。

更新容器代码：

```bash
docker compose -f docker-compose.enterprise.yml up -d --build app
```

不需要替换或恢复旧 SQLite 知识表来使用这些 ArangoDB 知识接口。但元数据库的用户、会话和应用表仍需可用；此改造不修复整个 SQLite 文件。

企业模式不会执行旧的 SQLite 知识迁移、克隆修复或 SQLite → ArangoDB 全量重建，即使误设 legacy sync=true 也不会启动旧同步。现有 ArangoDB entity/link 集合必须已经存在；应用不会从 SQLite 重建知识。

## 写入与 ES 同步

ArangoDB 仅使用 entity 和 link 保存知识数据：entity 为实体，link 保存关系与具体属性值。普通值使用自环，实体引用使用关系边。link 内的 attribute 字段保留完整属性值、限定符、来源和数组结构；属性定义仍存于 SQLite 的 properties 等元数据表。不再创建或依赖 knowledge_attributes / knowledge_sync 集合。

同步器位于 `src/server/entity-elasticsearch-sync.ts`，直接读取每个应用的 entity 集合，同步到 entity-<应用名> 索引，并从 link 生成属性筛选字段；属性定义仍留在 SQLite。按实体和属性边修订计算指纹，跳过未变化文档。直接在 ArangoDB 修改实体或属性边，下次对账也会同步，无需任务表。

应用写入成功后立即触发同步：成功响应 sync=synced；ES 故障时 ArangoDB 已提交的知识仍保存成功，响应 sync=pending，由后台重试。启动时执行一次对账，此后默认每 30 秒对账，ENTITY_ES_SYNC_INTERVAL_MS 可调整周期。

对账包含新增、修改、删除。ES 扫描使用 PIT/search_after；删除候选会重新向 entity 核实，并通过 ES 乐观并发条件删除。源读取或索引写入失败时不会继续删除对账，下轮自动重试。ES 故障不影响 ArangoDB 知识保存。索引已有内容会保留并与 entity 对齐，不在启动时删除重建整个索引。

- `GET /api/kb/knowledge-sync/status?db=<应用名>`：管理员查询最近同步结果和错误；状态只在内存中记录。
- `POST /api/kb/knowledge-sync/reindex?db=<应用名>`，JSON `{}`：管理员立即执行一次 entity 对账；成功返回 synced 数量。

首页和知识列表共用 `/api/kb/entity_search`，由 ES 执行检索、属性/媒体/分类/类型过滤、排序、分页及总数统计，响应 searchBackend=elasticsearch。ES 故障返回 503，不回落到 ArangoDB 或 SQLite 进行内容查询。ArangoDB 仅为搜索提供当前实体标识和权限，防止同步延迟期间返回已删除或已转私有的知识；编辑权限也使用当前授权结果。深分页使用 ES PIT/search_after。

ArangoDB 库名大小写或下划线转换后若映射到同一 ES 索引，后台会拒绝同步并记录错误。

## 单独运行同步器

```bash
bun run scripts/sync-arango-to-es.ts --once
bun run scripts/sync-arango-to-es.ts --watch
# 仅处理某个应用
bun run scripts/sync-arango-to-es.ts --once --database=default
```

读取 `.env` 中的 ArangoDB/ES 配置，不依赖 SQLite 知识表，不创建 ArangoDB 辅助集合。应用内已经自动运行同一同步器，通常无需额外启动 watch 进程。

## 清理旧辅助集合

`scripts/retire-arango-auxiliary-collections.ts` 默认只预览。停止仍使用旧版本的应用后，使用 --apply：先把两个旧集合完整备份到 data/recovery，再将已有具体属性完整转存到 link 并核对，直接对账 entity 与 ES，最后删除旧集合。若发现缺少源实体、无法表示的属性或并发修改，会报错并保留未清理集合。脚本不删除 entity/link，不把属性定义迁入 ArangoDB。

## 当前兼容边界

已适配核心知识 CRUD、详情、分页与关键词/属性/媒体/分类/类型过滤、属性增删改、关系新增删除、关系顺序、单实体和应用图（应用图最多 500 个节点）、分类列表与知识分类分配、类型列表、统计、随机知识、Wiki 正文和维护权限申请/审批/撤销。分类名称、本体名称等来自现有元数据表。

批量录入、外部导入、清理工具、短视频/图库随机推荐、互动等专用接口尚未适配；企业路由明确返回 501，不回落到 SQLite 知识读写。这些功能需后续逐项迁移。原 SQLite 单独存放的知识维护者名单不会自动推断为 ArangoDB 权限；需在新权限接口重新授权或执行专门的一次性 ACL 迁移。

## 验证

```bash
bun test tests/enterprise-knowledge.test.ts tests/arangodb.test.ts tests/knowledge-access.test.ts tests/entity-taxonomy.test.ts tests/relation-order.test.ts
bun run scripts/verify-enterprise-knowledge.ts
```

第二条命令需要本地 ArangoDB/ES 与管理员凭据，仅创建并删除 codex_verify_<时间戳> 隔离数据库和对应索引，不修改业务知识。可用 TEST_ARANGO_URL / TEST_ELASTICSEARCH_URL 指定测试服务。
