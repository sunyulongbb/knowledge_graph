# 影视领域知识图谱本体规范

## 1. 实体定义 (Nodes)
- **Movie (电影)**: 
  - 属性: `title` (标题), `rating` (评分), `year` (上映年份), `duration` (时长)
  - 集合名称: `entities` (类型字段 type="Movie")
- **Person (人物)**: 
  - 属性: `name` (姓名), `gender` (性别), `birth_date` (生日)
  - 集合名称: `entities` (类型字段 type="Person")

## 2. 关系定义 (Edges)
- **directed (执导)**: `Person` -> `Movie`
- **acted_in (出演)**: `Person` -> `Movie`
- 关系集合名称: `relations`

## 3. AQL 生成规则 (CRITICAL)
- **集合名称**: 统一使用 `entities` 存储节点，`relations` 存储边。
- **路径查询**: 必须使用 `SHORTEST_PATH` 寻找两个实体间的关联。
- **输出格式**: 
  - 必须返回路径中所有元素的 `_id`，存储在 `path_ids` 数组中。
  - 示例：`FOR v, e IN ANY SHORTEST_PATH 'entities/1' TO 'entities/2' GRAPH 'movie_graph' RETURN {nodes: v._id, edges: e._id}`

## 4. 输出约束
- 只返回 JSON 格式，严禁包含任何 Markdown 代码块标签或解释文字。
- JSON 格式示例：
{
  "aql": "...",
  "explanation": "简短的中文解释"
}
