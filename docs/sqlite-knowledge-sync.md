# 页面知识同步

系统管理员登录后，选择应用，打开「应用设置 → 知识同步 → 开始同步」。

服务端需要配置 `ARANGO_URL`、`ARANGO_USERNAME`、`ARANGO_PASSWORD` 和 `ELASTICSEARCH_URL`；企业版 Compose 已包含这些配置。

同步源是当前服务 `app.sqlite` 内当前应用的知识数据，不是上传的任意 SQLite 文件。导入包括实体、分类、可见性、所有者、维护成员以及 attributes 中的完整属性和关系。实体写入 ArangoDB 的 entity 集合，属性及关系写入 link 集合，然后调用现有同步器更新 ES 的 entity-<应用名> 索引。

相同 ID 的实体和出向关系以 SQLite 快照为准覆盖。不会删除仅存在于 ArangoDB 的其他实体。每批 100 个实体及其关系使用事务提交；失败时当前批次回滚，已提交批次保留，可再次执行。任务运行期间请避免编辑同一批知识。

任务在后台运行，关闭面板不会取消；重新打开面板可查看进度。状态保存在当前进程内，服务重启后不保留。此入口只在点击时执行，不启用旧版启动时全量重建。

- `GET /api/kb/knowledge-sync/sqlite/status?db=<应用名>`：配置情况和任务状态。
- `POST /api/kb/knowledge-sync/sqlite/start?db=<应用名>`：启动任务，返回 202；当前进程已有任务时返回 409。

两个接口均验证真实登录会话和系统管理员角色，包括 default 应用。
