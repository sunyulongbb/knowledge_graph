# Wikidata 数据类型与数值类型关联规范

## 1. 基本模型

Wikidata 属性值统一采用：

```text
Property
   ↓
datatype
   ↓
datavalue.type
   ↓
datavalue.value
```

标准 JSON 结构：

```json
{
  "datatype": "wikibase-item",
  "datavalue": {
    "type": "wikibase-entityid",
    "value": {
      "entity-type": "item",
      "id": "Q30",
      "numeric-id": 30
    }
  }
}
```

其中：

```text
datatype
= 属性的数据类型

datavalue.type
= 值在 Wikibase JSON 中的内部表示类型

datavalue.value
= 实际值
```

---

# 2. 数据类型与数值类型对应关系

按照 Wikidata/Wikibase JSON 数据模型，主要对应关系如下：

| Wikidata 数据类型 | datatype | datavalue.type | value 结构 |
|---|---|---|---|
| Item | `wikibase-item` | `wikibase-entityid` | Object |
| Property | `wikibase-property` | `wikibase-entityid` | Object |
| Lexeme | `wikibase-lexeme` | `wikibase-entityid` | Object |
| Form | `wikibase-form` | `wikibase-entityid` | Object |
| Sense | `wikibase-sense` | `wikibase-entityid` | Object |
| String | `string` | `string` | String |
| External identifier | `external-id` | `string` | String |
| URL | `url` | `string` | String |
| Commons media | `commonsMedia` | `string` | String |
| Mathematical expression | `math` | `string` | String |
| Musical notation | `musical-notation` | `string` | String |
| Quantity | `quantity` | `quantity` | Object |
| Point in time | `time` | `time` | Object |
| Globe coordinate | `globe-coordinate` | `globecoordinate` | Object |
| Monolingual text | `monolingualtext` | `monolingualtext` | Object |
| Geographic shape | `geo-shape` | `string` | String |
| Tabular data | `tabular-data` | `string` | String |

核心关系可以概括成：

```text
datatype
│
├─ wikibase-item ───────→ wikibase-entityid
├─ wikibase-property ───→ wikibase-entityid
├─ wikibase-lexeme ─────→ wikibase-entityid
├─ wikibase-form ───────→ wikibase-entityid
├─ wikibase-sense ──────→ wikibase-entityid
│
├─ string ──────────────→ string
├─ external-id ─────────→ string
├─ url ─────────────────→ string
├─ commonsMedia ────────→ string
├─ math ────────────────→ string
├─ musical-notation ────→ string
├─ geo-shape ───────────→ string
├─ tabular-data ────────→ string
│
├─ quantity ────────────→ quantity
├─ time ────────────────→ time
├─ globe-coordinate ────→ globecoordinate
└─ monolingualtext ─────→ monolingualtext
```

---

# 3. wikibase-entityid

用于：

```text
wikibase-item
wikibase-property
wikibase-lexeme
wikibase-form
wikibase-sense
```

典型 Item：

```json
{
  "datatype": "wikibase-item",
  "datavalue": {
    "type": "wikibase-entityid",
    "value": {
      "entity-type": "item",
      "id": "Q30",
      "numeric-id": 30
    }
  }
}
```

其中应优先使用：

```text
id = Q30
```

作为实体标识。

不要依赖：

```text
numeric-id = 30
```

因为并非所有实体类型都具有 numeric-id。

---

# 4. string

大量 Wikidata datatype 底层实际上共用：

```text
datavalue.type = string
```

例如：

```text
string
external-id
url
commonsMedia
math
musical-notation
geo-shape
tabular-data
        ↓
      string
```

普通字符串：

```json
{
  "datatype": "string",
  "datavalue": {
    "type": "string",
    "value": "ABC123"
  }
}
```

Commons Media：

```json
{
  "datatype": "commonsMedia",
  "datavalue": {
    "type": "string",
    "value": "Example.jpg"
  }
}
```

因此：

> `datavalue.type = string` 并不能说明这个属性在语义上就是普通字符串。

必须结合 `datatype` 判断实际含义。

---

# 5. quantity

标准关系：

```text
datatype       = quantity
datavalue.type = quantity
```

值为复合结构：

```json
{
  "datatype": "quantity",
  "datavalue": {
    "type": "quantity",
    "value": {
      "amount": "+1.88",
      "unit": "http://www.wikidata.org/entity/Q11573",
      "upperBound": "+1.89",
      "lowerBound": "+1.87"
    }
  }
}
```

核心字段：

```text
amount
unit
upperBound
lowerBound
```

注意：

```text
amount
```

在 Wikidata JSON 中应按照原始格式保留，不应自行把 datatype 修改成 `integer` 或 `decimal`。

---

# 6. time

标准关系：

```text
datatype       = time
datavalue.type = time
```

结构：

```json
{
  "datatype": "time",
  "datavalue": {
    "type": "time",
    "value": {
      "time": "+2001-12-31T00:00:00Z",
      "timezone": 0,
      "before": 0,
      "after": 0,
      "precision": 11,
      "calendarmodel": "http://www.wikidata.org/entity/Q1985727"
    }
  }
}
```

必须保留：

```text
time
timezone
before
after
precision
calendarmodel
```

特别是：

```text
precision
```

用于判断这个时间到底精确到：

```text
年
月
日
……
```

因此不能自行根据字符串直接定义成：

```text
year
date
datetime
```

应该保留 Wikidata 的 `time + precision` 模型。

---

# 7. globe-coordinate

标准关系：

```text
datatype       = globe-coordinate
datavalue.type = globecoordinate
```

结构：

```json
{
  "datatype": "globe-coordinate",
  "datavalue": {
    "type": "globecoordinate",
    "value": {
      "latitude": 52.516666666667,
      "longitude": 13.383333333333,
      "altitude": null,
      "precision": 0.016666666666667,
      "globe": "http://www.wikidata.org/entity/Q2"
    }
  }
}
```

主要字段：

```text
latitude
longitude
altitude
precision
globe
```

其中 `globe` 不能直接丢掉，因为 Wikidata 坐标不一定表示地球坐标。

---

# 8. monolingualtext

标准关系：

```text
datatype       = monolingualtext
datavalue.type = monolingualtext
```

例如：

```json
{
  "datatype": "monolingualtext",
  "datavalue": {
    "type": "monolingualtext",
    "value": {
      "text": "示例文本",
      "language": "zh"
    }
  }
}
```

必须同时保存：

```text
text
language
```

不能只保存文本内容。

---

# 9. 系统关联关系

如果系统需要建立 datatype 与 value type 配置表，建议直接按照 Wikidata 保存：

```text
DataType
   │
   │ valueType
   ▼
ValueType
```

例如：

```text
wikibase-item ─────────→ wikibase-entityid
wikibase-property ─────→ wikibase-entityid

string ────────────────→ string
external-id ───────────→ string
url ───────────────────→ string
commonsMedia ──────────→ string

quantity ──────────────→ quantity

time ──────────────────→ time

globe-coordinate ──────→ globecoordinate

monolingualtext ───────→ monolingualtext
```

数据库可以直接保存：

```json
{
  "datatype": "quantity",
  "valueType": "quantity"
}
```

或者：

```json
{
  "datatype": "wikibase-item",
  "valueType": "wikibase-entityid"
}
```

---

# 10. 数据解析原则

系统解析 Wikidata 时统一采用：

```text
读取 Property
      ↓
读取 mainsnak.datatype
      ↓
读取 mainsnak.datavalue.type
      ↓
根据 type 解析 datavalue.value
```

例如：

```js
const datatype = snak.datatype;
const valueType = snak.datavalue?.type;
const value = snak.datavalue?.value;
```

不要：

```text
看到 QID → 自己定义 entity
看到数字 → 自己定义 number
看到日期 → 自己定义 date
```

而应该始终以 Wikidata 原始定义为准。

---

# 11. 特殊值

Wikidata 的 Snak 还存在：

```text
snaktype = value
snaktype = somevalue
snaktype = novalue
```

因此不能假设：

```text
每个 mainsnak 都一定存在 datavalue
```

正确逻辑：

```text
mainsnak
 │
 ├─ value
 │    └─ datatype + datavalue
 │
 ├─ somevalue
 │    └─ 未知值
 │
 └─ novalue
      └─ 无值
```

这三种状态建议原样保留。

---

# 12. 最终规范

对于当前 Wikidata 数据处理系统，推荐严格保存：

```text
property
snaktype
datatype
datavalue.type
datavalue.value
rank
qualifiers
references
```

即：

```json
{
  "property": "P27",
  "snaktype": "value",
  "datatype": "wikibase-item",
  "datavalue": {
    "type": "wikibase-entityid",
    "value": {
      "entity-type": "item",
      "id": "Q30",
      "numeric-id": 30
    }
  },
  "rank": "normal",
  "qualifiers": {},
  "references": []
}
```

这样设计与 Wikidata 原始 JSON 数据模型基本保持一致，后续无论转换 Fuseki RDF、图数据库还是本体属性，都不会因为自行定义数据类型而丢失 Wikidata 原始语义。