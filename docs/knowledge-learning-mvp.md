# 知识学习 MVP

## 使用

重启 Bun 后端，刷新页面，在首页左侧进入「知识学习」。已有用户系统要求登录；个人路线按当前用户和应用隔离。学习任何当前有权读取的知识，不要求修改知识库的权限。

1. 创建学习路线，搜索一个实体，选择「自动发现」生成候选路线；或切换「手动编排」，逐条添加搜索结果。
2. 填写路线名称，上下调整或移除关卡，保存。
3. 点击旅程入口只打开全屏地图，选择任意节点，在弹框中阅读描述、属性和关联知识。
4. 浏览关联内容时，使用「返回当前学习关卡」回到原关卡；此操作不会完成或跳过关卡。
5. 点击节点弹框中的「开始学习」进入全屏选择题模式。答错可重试；本关全部答对才记录完成进度，可继续下一站或返回地图。再次进入可继续上次学习；完成后仍可复习。

路线入口采用地形与轨迹插画；地图和做题界面占满视口。地图不会自动展开正文，知识阅读只出现在节点弹框中。

练习无需大模型，由后端根据当前实体名称、描述、字面属性和直接关联生成最多三道选择题。干扰项来自其他实际知识或明确的「资料未提供」选项；同一属性的其他真实值、其他真实关联节点不会充当错误答案。信息少的节点使用基础名称识别题，不编造描述。

练习会话保存在后端内存，绑定用户、应用、路线和节点，有效期 30 分钟。重启服务或会话过期后需要重新开始本关练习；已完成进度始终保存在 SQLite。题目不复制到路线表，客户端拿不到正确选项标识，后端逐题验证全部答对后才写入完成状态。

入口是现有哈希路由 `#learning`。当前路线与关卡使用 `learning_route`、`learning_screen`、`learning_level` 查询参数保存，刷新可恢复已保存路线。未保存的编辑草稿仅在当前页面内存中。

## 数据与权限

- 复用 `EnterpriseKnowledgeStore`、现有 ArangoDB 连接及 `knowledgeReadAccess`、`canUseArangoKnowledge` 权限判断。
- 自动发现使用 `graph` 上 `entity`/`link` 的两跳 ANY 广度优先遍历，全局实体去重；私有且不可读的中间实体会被 PRUNE，不继续穿过它访问其他实体。
- 最多 20 个关联实体，加上主题自身最多 21 关。手动路线最多 100 关。
- 图距离仅用于生成候选顺序，不代表难度或前置依赖。不创建知识副本、不改变实体/关系结构。
- 复用 `/api/kb/entity_search` 搜索；学习属性、实体、关系直接由 ArangoDB 提供。自由浏览关联内容复用 `/api/kb/node`、`/api/kb/node/attributes`、`/api/kb/node/graph`。
- 关联实体失效或权限变化时，路线保留 ID 并显示不可用状态，可编辑移除；不会将失效知识默认为已完成。
- Lite 模式不会伪造图数据；需要知识内容或创建路线时返回明确的 ArangoDB 未启用提示。

## SQLite

启动时在现有 `adminDb` 中幂等创建 `learning_routes` 和所有者索引 `learning_routes_owner`。

| 字段 | 用途 |
| --- | --- |
| `id`, `project_id`, `user_id`, `name` | 个人路线及应用归属 |
| `node_ids_json` | 按顺序存储的知识实体 ID 数组 |
| `completed_ids_json` | 已完成 ID 集合 |
| `current_node_id` | 继续学习位置 |
| `revision` | 防止编辑覆盖其他会话的更新 |
| `created_at`, `updated_at` | 创建和更新时间 |

仅保存路线名称和实体 ID 等学习元数据，不保存实体名称、描述、属性或关联知识副本。编辑后移除不在路线中的完成状态，保留其他进度。进度写入采用同步 SQLite 事务合并，重复完成不会重复计数。

## 接口

全部接口使用 `?db=<应用短名>` 与现有登录 Cookie。路线只对所属用户可见。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/kb/learning/discover` | `{nodeId}`，返回主题和候选实体、层级及关系说明 |
| GET | `/api/kb/learning/routes` | 当前用户、当前应用的路线列表及进度 |
| POST | `/api/kb/learning/routes` | `{name,nodeIds}` 创建路线 |
| GET | `/api/kb/learning/routes/:id` | 路线、完成状态和实时读取的关卡名称；失效关卡明确标记 |
| PUT | `/api/kb/learning/routes/:id` | `{name,nodeIds,revision}` 编辑名称和顺序，保留已有进度 |
| DELETE | `/api/kb/learning/routes/:id` | 删除个人路线及进度，不删除知识 |
| GET | `/api/kb/learning/routes/:id/level?nodeId=...` | 实时读取关卡知识、主要属性和可读关联实体 |
| POST | `/api/kb/learning/routes/:id/progress` | `{nodeId}` 记录当前位置，不能直接标记完成 |
| POST | `/api/kb/learning/routes/:id/quiz` | `{nodeId}` 创建练习，返回会话与不含答案的题目 |
| POST | `/api/kb/learning/routes/:id/answer` | `{attemptId,questionId,optionId}` 校验答案；本关全部答对后更新完成进度 |

校验失败 400，未登录 401，他人/其他应用路线 404，编辑冲突 409，练习过期 410，依赖暂不可用 503。答错或部分答对不会增加完成关卡数。

## 文件

- `src/server/learning.ts`：SQLite 表、路线与进度 API、图遍历候选路线。
- `src/server/learning-quiz.ts`：依据知识事实生成选择题，不调用大模型。
- `src/server/index.ts`：注册独立学习接口，保持现有知识接口不变。
- `public/assets/scripts/knowledge-learning.js`：学习首页、编排、地图、阅读与关联浏览。
- `public/assets/styles/knowledge-learning.css`：独立界面、地图与轻量动画，支持减少动画偏好。
- `public/assets/styles/learning-journey.css`：旅程插画入口、全屏地图、节点弹框和做题界面。
- `public/index.html`、`public/assets/scripts/application-pages.js`：路由、导航和入口。
- `tests/learning.test.ts`、`tests/learning-ui.test.ts`：接口与前端交互流程验证。
- `scripts/verify-knowledge-learning.ts`：真实 ArangoDB 只读集成验证，路线写入临时内存 SQLite。

## 验证

```powershell
bun test tests/learning.test.ts tests/learning-ui.test.ts tests/learning-quiz.test.ts
bun run scripts/verify-knowledge-learning.ts
# 也可指定某个已有 Arango 应用数据库：
bun run scripts/verify-knowledge-learning.ts <数据库名>
```

契约测试使用内存 SQLite 和模拟图数据，覆盖两种创建方式、排序、移除、保存、阅读、关联返回、进度、刷新恢复、权限隔离与失效实体。真实集成脚本只读取 ArangoDB；路线元数据也仅写入内存，不修改现有应用和知识内容。
