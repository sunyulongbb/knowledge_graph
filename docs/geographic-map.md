# 离线地理位置地图

知识布局中的“地理位置地图”替代原语义地图。已保存的 `semantic` 布局偏好自动映射到 `geographic`。原独立语义地图文件未删除。

## 底图与覆盖范围

Leaflet 1.9.4 由本地 `/node_modules/leaflet/dist/` 提供。离线底图为 `/maps/world/tiles/{z}/{x}/{y}.svg`，0–5 级共 1,365 张 XYZ 瓦片；允许继续放大至 9 级，放大时复用已有瓦片，不请求在线地图。

底图源为 [Natural Earth](https://www.naturalearthdata.com/)，源数据由其官方维护的 `nvkelso/natural-earth-vector` 仓库取得。包含 242 个国家/地区和 1,251 个主要城市，并非全球全部城镇。国家和城市均采用数据集中的简体中文名称，同时保留英文名称用于本地搜索。坐标搜索框用于本地定位国家/城市，不执行在线地理编码。地图不包含道路、建筑和街道细节。Web Mercator 地图显示纬度范围约为 ±85.05°。

地图跟随系统 `data-theme` 和应用主题事件切换颜色。深色底图通过本地 SVG 瓦片的 `?theme=dark` 变体提供，无需下载另一套瓦片；标注、知识标记、弹窗和地图控件同步切换，保留当前位置及缩放级别。

地图缩放限制为 1–8 级。进入地图或修改筛选条件时，先在全球范围查询符合条件的实体，再自动缩放到这些坐标的覆盖区域并保留边距；自动聚焦最多放大到 6 级，单点也不会过度放大。手动拖动、缩放和普通刷新保持用户视野，点击“聚焦实体”可重新定位，“全球视野”可查看全图。聚焦使用当前查询返回的位置（最多 1,000 个），不会绕过分类或权限筛选。

数据使用 Natural Earth 的[公共领域许可](https://www.naturalearthdata.com/about/terms-of-use/)。源文件位于 `scripts/map-source/`。重建无需 GIS/Python 第三方依赖：

```powershell
python scripts/build-offline-map.py
```

部署时需包含 `public/maps/world/`，并安装项目依赖。完整底图、城市标注和 Leaflet 均已放在本地资源中；地图浏览不依赖外部地图服务。

## 知识坐标

地图只显示有有效地球坐标的知识，不会根据名称猜测位置。实体属性示例：

```json
{
  "name": "地理坐标",
  "datatype": "globe-coordinate",
  "value": { "latitude": 39.9042, "longitude": 116.4074 }
}
```

可通过现有实体 JSON 导入接口导入，或编辑实体的地理坐标属性。坐标值采用纬度/经度命名，存储为 GeoJSON 时使用 `[经度, 纬度]`。零值坐标有效，月球等非地球坐标不显示。

地图仅接受 `globe-coordinate` 属性及数值类型的 `latitude`、`longitude` 结构化值。错误存储为字符串的坐标需要先修正属性定义和数据，不在地图查询时自动识别转换。`scripts/fix-coordinate-storage.ts` 提供 `attr/coordinates` 属性的一次性修复：传入应用数据库名预览，追加 `--apply` 执行；事务内修正本体定义和属性记录，提交后同步 ES，并保留修复前的备份。

## ArangoDB 查询

坐标属性的 `link` 文档保存派生 `geo` Point 字段，首次使用地图时分批补齐旧文档，并创建 `link.geo` 地理索引。属性编辑、删除和重新导入通过现有关系文档写入逻辑维护该字段。

`GET /api/kb/geography/viewport?db=应用&west=西界&south=南界&east=东界&north=北界` 使用 `GEO_IN_RANGE` 地理索引缩小候选，再精确过滤视窗经纬度，包括跨日期变更线范围。知识权限、本体、分类子树、属性值和“实体条目”排除条件在数据库内应用。关键词结合 ArangoSearch，整个流程不访问 ES 或 SQLite 知识表。

接口最多返回 1,000 个不同的知识坐标位置，超过时标记 `truncated`；同一实体的多个坐标分别展示，客户端合并密集标记。点击标记可查看实体并进入详情页。无坐标或无权访问的知识不会出现在结果中。
