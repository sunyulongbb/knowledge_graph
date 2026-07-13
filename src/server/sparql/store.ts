import { db, getProjectByIdentifier } from "../db.ts";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto.ts";

const BUILTIN_ENDPOINTS = [
  {
    id: "builtin-wikidata",
    name: "Wikidata",
    endpoint: "https://query.wikidata.org/sparql",
    method: "GET",
    auth_type: "none",
    username: "",
    headers: {},
    timeout: 60000,
    retries: 2,
    user_agent: "KnowledgeGraphSPARQL/1.0",
    description: "Wikidata 公共查询端点",
    default_query: `SELECT ?item ?itemLabel ?itemDescription
WHERE {
  ?item wdt:P31 wd:Q5.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
  },
  {
    id: "builtin-dbpedia",
    name: "DBpedia",
    endpoint: "https://dbpedia.org/sparql",
    method: "GET",
    auth_type: "none",
    username: "",
    headers: {},
    timeout: 45000,
    retries: 2,
    user_agent: "KnowledgeGraphSPARQL/1.0",
    description: "DBpedia 公共查询端点",
    default_query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label
WHERE {
  ?item rdfs:label ?label .
  FILTER(lang(?label) = "zh" || lang(?label) = "en")
}
LIMIT 20`,
  },
] as const;

const BUILTIN_TEMPLATES: Array<{
  id: string;
  name: string;
  category: string;
  source_type: string;
  endpoint_id: string | null;
  query: string;
  description: string;
  is_builtin: number;
  is_favorite: number;
}> = [
  {
    id: "template-person",
    name: "查询人物",
    category: "Wikidata 模板",
    source_type: "wikidata",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?item ?itemLabel ?itemDescription
WHERE {
  ?item wdt:P31 wd:Q5.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "适合测试人物实体导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-country",
    name: "查询国家",
    category: "Wikidata 模板",
    source_type: "wikidata",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?item ?itemLabel ?itemDescription
WHERE {
  ?item wdt:P31 wd:Q6256.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "适合测试国家实体导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-relation",
    name: "查询实体关系",
    category: "通用模板",
    source_type: "generic",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?subject ?subjectLabel ?property ?propertyLabel ?object ?objectLabel
WHERE {
  ?subject ?property ?object.
  FILTER(isIRI(?subject))
  FILTER(isIRI(?object))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "适合测试关系映射与导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-person-country",
    name: "人物及国籍",
    category: "导入测试",
    source_type: "wikidata",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?item ?itemLabel ?itemDescription ?country ?countryLabel
WHERE {
  ?item wdt:P31 wd:Q5.
  OPTIONAL { ?item wdt:P27 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "同时测试实体与国家关系导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-city-country",
    name: "城市及所属国家",
    category: "导入测试",
    source_type: "wikidata",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?item ?itemLabel ?itemDescription ?country ?countryLabel
WHERE {
  ?item wdt:P31/wdt:P279* wd:Q515.
  OPTIONAL { ?item wdt:P17 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "适合测试城市和国家关系导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-organization",
    name: "查询组织",
    category: "导入测试",
    source_type: "wikidata",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?item ?itemLabel ?itemDescription
WHERE {
  ?item wdt:P31/wdt:P279* wd:Q43229.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "适合测试组织类实体导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-person-birth",
    name: "人物及出生日期",
    category: "导入测试",
    source_type: "wikidata",
    endpoint_id: "builtin-wikidata",
    query: `SELECT ?item ?itemLabel ?itemDescription ?birthDate
WHERE {
  ?item wdt:P31 wd:Q5.
  OPTIONAL { ?item wdt:P569 ?birthDate. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
LIMIT 20`,
    description: "适合测试普通属性和日期字段导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-dbpedia-place",
    name: "DBpedia 地点测试",
    category: "DBpedia 模板",
    source_type: "dbpedia",
    endpoint_id: "builtin-dbpedia",
    query: `PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?abstract
WHERE {
  ?item a dbo:Place ;
        rdfs:label ?label .
  OPTIONAL {
    ?item dbo:abstract ?abstract .
    FILTER(lang(?abstract) = "en")
  }
  FILTER(lang(?label) = "en")
}
LIMIT 20`,
    description: "适合测试 DBpedia 文本字段导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-dbpedia-person",
    name: "DBpedia 人物测试",
    category: "DBpedia 模板",
    source_type: "dbpedia",
    endpoint_id: "builtin-dbpedia",
    query: `PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?abstract ?birthPlace
WHERE {
  ?item a dbo:Person ;
        rdfs:label ?label .
  OPTIONAL {
    ?item dbo:abstract ?abstract .
    FILTER(lang(?abstract) = "en")
  }
  OPTIONAL { ?item dbo:birthPlace ?birthPlace. }
  FILTER(lang(?label) = "en")
}
LIMIT 20`,
    description: "适合测试人物实体、简介和出生地关系导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-dbpedia-organization",
    name: "DBpedia 组织测试",
    category: "DBpedia 模板",
    source_type: "dbpedia",
    endpoint_id: "builtin-dbpedia",
    query: `PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?abstract ?industry
WHERE {
  ?item a dbo:Organisation ;
        rdfs:label ?label .
  OPTIONAL {
    ?item dbo:abstract ?abstract .
    FILTER(lang(?abstract) = "en")
  }
  OPTIONAL { ?item dbo:industry ?industry. }
  FILTER(lang(?label) = "en")
}
LIMIT 20`,
    description: "适合测试组织实体与行业属性导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-dbpedia-city-country",
    name: "DBpedia 城市与国家",
    category: "DBpedia 模板",
    source_type: "dbpedia",
    endpoint_id: "builtin-dbpedia",
    query: `PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?country
WHERE {
  ?item a dbo:City ;
        rdfs:label ?label .
  OPTIONAL { ?item dbo:country ?country. }
  FILTER(lang(?label) = "en")
}
LIMIT 20`,
    description: "适合测试城市实体及所属国家关系导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-dbpedia-category-relations",
    name: "DBpedia 分类关系测试",
    category: "DBpedia 模板",
    source_type: "dbpedia",
    endpoint_id: "builtin-dbpedia",
    query: `PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?category
WHERE {
  ?item rdfs:label ?label ;
        dct:subject ?category .
  FILTER(lang(?label) = "en")
}
LIMIT 20`,
    description: "适合测试实体到分类的关系导入",
    is_builtin: 1,
    is_favorite: 0,
  },
  {
    id: "template-dbpedia-museum",
    name: "DBpedia 博物馆测试",
    category: "DBpedia 模板",
    source_type: "dbpedia",
    endpoint_id: "builtin-dbpedia",
    query: `PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?abstract ?location
WHERE {
  ?item a dbo:Museum ;
        rdfs:label ?label .
  OPTIONAL {
    ?item dbo:abstract ?abstract .
    FILTER(lang(?abstract) = "en")
  }
  OPTIONAL { ?item dbo:location ?location. }
  FILTER(lang(?label) = "en")
}
LIMIT 20`,
    description: "适合测试文化机构实体和地点关系导入",
    is_builtin: 1,
    is_favorite: 0,
  },
];

function parseJson(value: any, fallback: any) {
  try {
    return value ? JSON.parse(String(value)) : fallback;
  } catch {
    return fallback;
  }
}

function projectScope(dbName: string | null | undefined) {
  const scoped = dbName && dbName !== "app" ? getProjectByIdentifier(dbName) : null;
  return Number(scoped?.id || 0) || null;
}

export function resolveProjectId(url: URL) {
  return projectScope((url.searchParams.get("db") || "").trim());
}

export function scopeWhere(projectId: number | null, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return projectId !== null ? `${prefix}project_id = ?` : `${prefix}project_id IS NULL`;
}

export function scopeParams(projectId: number | null) {
  return projectId !== null ? [projectId] : [];
}

export async function listEndpoints(projectId: number | null) {
  const rows = db
    .query(`SELECT * FROM sparql_endpoints WHERE ${scopeWhere(projectId)} ORDER BY datetime(updated_at) DESC, rowid DESC`)
    .all(...scopeParams(projectId)) as any[];
  const items = [];
  for (const row of rows) items.push(await mapEndpoint(row));
  return mergeBuiltinEndpoints(items);
}

export async function getEndpoint(projectId: number | null, id: string) {
  const row = db
    .query(`SELECT * FROM sparql_endpoints WHERE id = ? AND ${scopeWhere(projectId)} LIMIT 1`)
    .get(id, ...scopeParams(projectId)) as any;
  if (row) return mergeBuiltinEndpoint(await mapEndpoint(row));
  return getBuiltinEndpoint(id);
}

export async function saveEndpoint(projectId: number | null, payload: any) {
  const id = String(payload?.id || `sparql-endpoint/${crypto.randomUUID()}`);
  const encryptedPassword = await encryptSecret(String(payload?.password || ""));
  const encryptedToken = await encryptSecret(String(payload?.token || ""));
  const headers = JSON.stringify(payload?.headers && typeof payload.headers === "object" ? payload.headers : {});
  const existing = db
    .query(`SELECT id FROM sparql_endpoints WHERE id = ? AND ${scopeWhere(projectId)} LIMIT 1`)
    .get(id, ...scopeParams(projectId)) as any;

  const values = [
    id,
    String(payload?.name || "").trim(),
    String(payload?.endpoint || "").trim(),
    String(payload?.method || "POST").trim().toUpperCase(),
    String(payload?.auth_type || "none").trim(),
    String(payload?.username || "").trim(),
    encryptedPassword,
    encryptedToken,
    headers,
    Number(payload?.timeout || 30000),
    Number(payload?.retries || 1),
    String(payload?.user_agent || "").trim(),
    String(payload?.description || "").trim(),
    String(payload?.default_query || "").trim(),
    projectId,
  ];

  if (existing?.id) {
    db.run(
      `UPDATE sparql_endpoints
       SET name = ?, endpoint = ?, method = ?, auth_type = ?, username = ?, password = ?, token = ?, headers = ?, timeout = ?, retries = ?, user_agent = ?, description = ?, default_query = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND ${scopeWhere(projectId)}`,
      values.slice(1, 14).concat([id, ...scopeParams(projectId)]),
    );
  } else {
    db.run(
      `INSERT INTO sparql_endpoints (id, name, endpoint, method, auth_type, username, password, token, headers, timeout, retries, user_agent, description, default_query, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      values,
    );
  }

  return getEndpoint(projectId, id);
}

function getBuiltinEndpoint(id: string) {
  const item = BUILTIN_ENDPOINTS.find((entry) => entry.id === id);
  if (!item) return null;
  return {
    ...item,
    password_masked: "",
    token_masked: "",
    created_at: null,
    updated_at: null,
  };
}

function mergeBuiltinEndpoint(item: any) {
  const builtin = BUILTIN_ENDPOINTS.find((entry) => entry.id === item?.id);
  if (!builtin) return item;
  return {
    ...item,
    method: builtin.method,
    endpoint: builtin.endpoint,
    auth_type: item?.auth_type || builtin.auth_type,
    timeout: Math.max(Number(item?.timeout || 0), builtin.timeout),
    retries: Math.max(Number(item?.retries || 0), builtin.retries),
    user_agent: item?.user_agent || builtin.user_agent,
    description: item?.description || builtin.description,
    default_query: item?.default_query || builtin.default_query,
  };
}

function mergeBuiltinEndpoints(items: any[]) {
  const normalizedItems = items.map(mergeBuiltinEndpoint);
  const existing = new Set(normalizedItems.map((item) => item.id));
  const builtins = BUILTIN_ENDPOINTS.filter((item) => !existing.has(item.id)).map((item) => ({
    ...item,
    password_masked: "",
    token_masked: "",
    created_at: null,
    updated_at: null,
  }));
  return [...normalizedItems, ...builtins];
}

export function deleteEndpoint(projectId: number | null, id: string) {
  db.run(`DELETE FROM sparql_endpoints WHERE id = ? AND ${scopeWhere(projectId)}`, [id, ...scopeParams(projectId)]);
}

async function mapEndpoint(row: any) {
  const password = await decryptSecret(String(row?.password || ""));
  const token = await decryptSecret(String(row?.token || ""));
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    method: row.method,
    auth_type: row.auth_type || "none",
    username: row.username || "",
    password_masked: maskSecret(password),
    token_masked: maskSecret(token),
    headers: parseJson(row.headers, {}),
    timeout: Number(row.timeout || 30000),
    retries: Number(row.retries || 1),
    user_agent: row.user_agent || "",
    description: row.description || "",
    default_query: row.default_query || "",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function getEndpointSecrets(projectId: number | null, id: string) {
  const row = db
    .query(`SELECT * FROM sparql_endpoints WHERE id = ? AND ${scopeWhere(projectId)} LIMIT 1`)
    .get(id, ...scopeParams(projectId)) as any;
  if (row) {
    return mergeBuiltinEndpoint({
      ...row,
      headers: parseJson(row.headers, {}),
      password: await decryptSecret(String(row.password || "")),
      token: await decryptSecret(String(row.token || "")),
    });
  }
  const item = BUILTIN_ENDPOINTS.find((entry) => entry.id === id);
  if (!item) return null;
  return {
    ...item,
    password: "",
    token: "",
  };
}

export function listTemplates(projectId: number | null) {
  const items = db
    .query(`SELECT * FROM sparql_templates WHERE ${scopeWhere(projectId)} ORDER BY is_builtin DESC, is_favorite DESC, datetime(updated_at) DESC`)
    .all(...scopeParams(projectId)) as any[];
  return mergeBuiltinTemplates(items);
}

function mergeBuiltinTemplates(items: any[]) {
  const normalizedItems = items.map((item) => {
    const builtin = BUILTIN_TEMPLATES.find((entry) => entry.id === item?.id);
    if (!builtin) return item;
    return {
      ...item,
      name: builtin.name,
      category: builtin.category,
      source_type: builtin.source_type,
      endpoint_id: builtin.endpoint_id,
      query: builtin.query,
      description: builtin.description,
      is_builtin: 1,
    };
  });
  const existing = new Set(normalizedItems.map((item) => item.id));
  const builtins = BUILTIN_TEMPLATES.filter((item) => !existing.has(item.id));
  return [...normalizedItems, ...builtins];
}

export function saveTemplate(projectId: number | null, payload: any) {
  const id = String(payload?.id || `sparql-template/${crypto.randomUUID()}`);
  const existing = db
    .query(`SELECT id FROM sparql_templates WHERE id = ? AND ${scopeWhere(projectId)} LIMIT 1`)
    .get(id, ...scopeParams(projectId)) as any;
  const params = [
    id,
    String(payload?.name || "").trim(),
    String(payload?.category || "我的模板").trim(),
    String(payload?.source_type || "generic").trim(),
    payload?.endpoint_id ? String(payload.endpoint_id) : null,
    String(payload?.query || "").trim(),
    String(payload?.description || "").trim(),
    payload?.is_builtin ? 1 : 0,
    payload?.is_favorite ? 1 : 0,
    projectId,
  ];

  if (existing?.id) {
    db.run(
      `UPDATE sparql_templates
       SET name = ?, category = ?, source_type = ?, endpoint_id = ?, query = ?, description = ?, is_builtin = ?, is_favorite = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND ${scopeWhere(projectId)}`,
      params.slice(1, 9).concat([id, ...scopeParams(projectId)]),
    );
  } else {
    db.run(
      `INSERT INTO sparql_templates (id, name, category, source_type, endpoint_id, query, description, is_builtin, is_favorite, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      params,
    );
  }
}

export function deleteTemplate(projectId: number | null, id: string) {
  db.run(`DELETE FROM sparql_templates WHERE id = ? AND is_builtin = 0 AND ${scopeWhere(projectId)}`, [id, ...scopeParams(projectId)]);
}

export function toggleTemplateFavorite(projectId: number | null, id: string) {
  db.run(
    `UPDATE sparql_templates SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${scopeWhere(projectId)}`,
    [id, ...scopeParams(projectId)],
  );
}

export function addQueryHistory(projectId: number | null, payload: any) {
  const id = `sparql-history/${crypto.randomUUID()}`;
  db.run(
    `INSERT INTO sparql_query_history (id, endpoint_id, query, query_type, result_count, duration, success, error_message, project_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      payload?.endpoint_id || null,
      String(payload?.query || ""),
      String(payload?.query_type || ""),
      Number(payload?.result_count || 0),
      Number(payload?.duration || 0),
      payload?.success ? 1 : 0,
      payload?.error_message ? String(payload.error_message) : null,
      projectId,
    ],
  );
}

export function listQueryHistory(projectId: number | null) {
  return db
    .query(`SELECT * FROM sparql_query_history WHERE ${scopeWhere(projectId)} ORDER BY datetime(created_at) DESC LIMIT 50`)
    .all(...scopeParams(projectId)) as any[];
}

export function deleteQueryHistory(projectId: number | null, id: string) {
  db.run(`DELETE FROM sparql_query_history WHERE id = ? AND ${scopeWhere(projectId)}`, [id, ...scopeParams(projectId)]);
}

export function createTask(projectId: number | null, payload: any) {
  const id = String(payload?.id || `sparql-task/${crypto.randomUUID()}`);
  db.run(
    `INSERT INTO sparql_import_tasks (id, name, endpoint_id, endpoint, query, query_type, schema_id, mapping_config, import_config, status, result_count, entity_count, relation_count, success_count, failed_count, skipped_count, error_message, started_at, finished_at, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      String(payload?.name || "SPARQL 导入任务"),
      payload?.endpoint_id || null,
      payload?.endpoint || null,
      String(payload?.query || ""),
      String(payload?.query_type || ""),
      payload?.schema_id || null,
      JSON.stringify(payload?.mapping_config || {}),
      JSON.stringify(payload?.import_config || {}),
      String(payload?.status || "pending"),
      Number(payload?.result_count || 0),
      Number(payload?.entity_count || 0),
      Number(payload?.relation_count || 0),
      Number(payload?.success_count || 0),
      Number(payload?.failed_count || 0),
      Number(payload?.skipped_count || 0),
      payload?.error_message || null,
      payload?.started_at || null,
      payload?.finished_at || null,
      projectId,
    ],
  );
  return id;
}

export function updateTask(projectId: number | null, id: string, patch: Record<string, any>) {
  const fields: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = ?`);
    params.push(["mapping_config", "import_config"].includes(key) && typeof value !== "string" ? JSON.stringify(value) : value);
  }
  if (!fields.length) return;
  params.push(id, ...scopeParams(projectId));
  db.run(
    `UPDATE sparql_import_tasks SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${scopeWhere(projectId)}`,
    params,
  );
}

export function listTasks(projectId: number | null) {
  return db
    .query(`SELECT * FROM sparql_import_tasks WHERE ${scopeWhere(projectId)} ORDER BY datetime(updated_at) DESC`)
    .all(...scopeParams(projectId))
    .map(mapTask);
}

export function getTask(projectId: number | null, id: string) {
  const row = db
    .query(`SELECT * FROM sparql_import_tasks WHERE id = ? AND ${scopeWhere(projectId)} LIMIT 1`)
    .get(id, ...scopeParams(projectId)) as any;
  return row ? mapTask(row) : null;
}

function mapTask(row: any) {
  return {
    ...row,
    mapping_config: parseJson(row.mapping_config, {}),
    import_config: parseJson(row.import_config, {}),
  };
}

export function deleteTask(projectId: number | null, id: string) {
  db.run(`DELETE FROM sparql_import_logs WHERE task_id = ?`, [id]);
  db.run(`DELETE FROM sparql_import_tasks WHERE id = ? AND ${scopeWhere(projectId)}`, [id, ...scopeParams(projectId)]);
}

export function addTaskLog(taskId: string, level: string, stage: string, message: string, detail: any = null) {
  db.run(
    `INSERT INTO sparql_import_logs (id, task_id, level, stage, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [`sparql-log/${crypto.randomUUID()}`, taskId, level, stage, message, detail ? JSON.stringify(detail) : null],
  );
}

export function listTaskLogs(taskId: string) {
  return db
    .query(`SELECT * FROM sparql_import_logs WHERE task_id = ? ORDER BY datetime(created_at) ASC, rowid ASC`)
    .all(taskId) as any[];
}
