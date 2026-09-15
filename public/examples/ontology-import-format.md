# 本体 JSON 导入格式

在本体树点击“下载示例”，编辑 JSON 文件后点击“导入 JSON”上传。
使用 UTF-8 编码，单文件最多 5 MB、1000 个本体，层级最多 32 层。

```json
{
  "version": 1,
  "ontologies": [
    {
      "name": "人物",
      "description": "人物分类",
      "alias": ["Person"],
      "color": "#3b82f6",
      "display_shape": "circle",
      "properties": [
        {
          "name": "出生日期",
          "alias": ["Date of birth"],
          "datatype": "time",
          "description": "人物的出生日期",
          "types": ["基础信息"]
        }
      ],
      "children": [{ "name": "科学家" }]
    }
  ]
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| version | 是 | 固定为数字 1 |
| ontologies | 是 | 根本体数组，不可为空 |
| name | 是 | 本体名称，非空字符串 |
| description | 否 | 描述，默认空字符串 |
| alias | 否 | 别名字符串数组，名称自动包含在别名中 |
| color | 否 | `#RRGGBB` 格式的颜色 |
| display_shape | 否 | rectangle、rounded、circle、diamond、hexagon；默认 rectangle |
| properties | 否 | 当前本体关联的属性定义数组 |
| children | 否 | 子本体数组，字段与父本体相同 |

`properties` 中支持以下字段：`name`（必填）、`alias`、`datatype`、`description`、`types`、`tail_ontology_id`。`datatype` 支持 `string`、`url`、`time`、`quantity`、`globe-coordinate`、`commonsMedia`、`wikibase-item`、`external-id`，默认值为 `string`。导入时属性按当前项目内名称匹配，已有属性更新并建立本体关联，新属性创建后建立关联。`tail_ontology_id` 仅用于 `wikibase-item` 属性，可填写目标本体 ID。

导入到当前知识库的本体树根级，children 决定父子关系，数组顺序决定新增节点顺序。
本体 ID 由系统自动生成，不接受 id、parent_id 或 project_id 字段。
采用增量更新，不清空或替换整棵本体树。同一父级下同名（忽略大小写）的本体保留原 ID，更新文件中明确提供的 description、alias、color、display_shape；未提供的字段保持原值。新本体追加。
文件中未出现的本体、已有子本体及属性关联全部保留。children 为空数组也不会删除已有子本体。
description 为空字符串可清空描述，color 为 null 可清空颜色；提供 alias 数组会替换该本体的别名（名称始终自动包含）。已有本体的位置和排序保持不变。
名称或别名与其他同级本体冲突时拒绝导入，错误信息会指出冲突本体。
整个文件在一个事务中导入，校验或写入失败会全部回滚。

此格式导入本体层级、属性定义及本体-属性关联，不包含实体数据或关系图节点样式。
