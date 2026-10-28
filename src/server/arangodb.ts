import { createHash, randomUUID } from "node:crypto";
import type { Database } from "bun:sqlite";

type ArangoConfig = {
  url: string;
  username: string;
  password: string;
};

type OutboxEvent = {
  id: number;
  project_id: number;
  database_name: string;
  node_id: string;
  action: "upsert" | "delete";
};

type UserOutboxEvent = {
  id: number;
  user_id: number;
  username: string;
  action: "sync" | "disable";
};

type AttributeRow = {
  id: string;
  node_id: string;
  key: string;
  value: string | null;
  datatype: string | null;
  property_name_snapshot: string | null;
  statement_json: string | null;
  created_at: string | null;
};

export type ArangoUserDatabaseGrant = {
  database: string;
  grant: "ro" | "none";
};

const IMPORT_BATCH_SIZE = 250;

export function configFromEnvironment(): ArangoConfig | null {
  const url = process.env.ARANGO_URL?.trim();
  const username = process.env.ARANGO_USERNAME?.trim();
  const password = process.env.ARANGO_PASSWORD;
  if (!url && !username && !password) return null;
  if (!url || !username || !password) {
    throw new Error("Enterprise ArangoDB configuration requires ARANGO_URL, ARANGO_USERNAME, and ARANGO_PASSWORD");
  }
  return { url: url.replace(/\/+$/, ""), username, password };
}

export class ArangoClient {
  private readonly authorization: string;

  constructor(
    private readonly config: ArangoConfig,
    private readonly request: typeof fetch = fetch,
  ) {
    this.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }

  async system(path: string, init: RequestInit = {}) {
    return this.send(`${this.config.url}/_db/_system${path}`, init);
  }

  async database(database: string, path: string, init: RequestInit = {}) {
    return this.send(`${this.config.url}/_db/${encodeURIComponent(database)}${path}`, init);
  }

  async user(path: string, init: RequestInit = {}) {
    return this.send(`${this.config.url}/_api/user${path}`, init);
  }

  private async send(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.request(url, {
        ...init,
        headers: {
          Authorization: this.authorization,
          ...(init.body instanceof Blob ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
        signal: init.signal || AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new Error(`ArangoDB request failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const text = await response.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const detail = body?.errorMessage || body?.message || response.statusText;
      throw Object.assign(new Error(`ArangoDB HTTP ${response.status}: ${detail || "request failed"}`), {
        status: response.status,
        body,
      });
    }
    return { response, body };
  }
}

type ElasticsearchConfig = { url: string };

export class ElasticsearchClient {
  constructor(
    private readonly config: ElasticsearchConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.request(`${this.config.url}${path}`, {
        ...init,
        headers: {
          ...(init.body instanceof Blob ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
        signal: init.signal || AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new Error(`Elasticsearch request failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const text = await response.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const detail = body?.error?.reason || body?.error?.type || response.statusText;
      throw Object.assign(new Error(`Elasticsearch HTTP ${response.status}: ${detail || "request failed"}`), {
        status: response.status,
        body,
      });
    }
    return { response, body };
  }
}

function elasticsearchConfigFromEnvironment(): ElasticsearchConfig | null {
  const url = process.env.ELASTICSEARCH_URL?.trim();
  if (!url) return null;
  return { url: url.replace(/\/+$/, "") };
}

export function isElasticsearchSearchEnabled() {
  return Boolean(elasticsearchConfigFromEnvironment());
}

export function arangoDatabaseName(projectName: string) {
  const name = String(projectName || "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`Project name "${name}" cannot be used as an ArangoDB database name; use 1–64 letters, digits, underscores, or hyphens, starting with a letter`);
  }
  return name;
}

export function elasticsearchEntityIndexName(projectName: string) {
  const name = String(projectName || "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`Project name "${name}" cannot be used to create an Elasticsearch entity index`);
  }
  return `entity-${name.toLowerCase().replace(/_/g, "-")}`;
}

export async function searchElasticsearchEntities(
  projectName: string,
  options: {
    ids?: string[];
    query: string;
    limit: number;
    offset: number;
    order: string;
    classIds?: string[];
    includeTypes?: string[];
    excludeTypes?: string[];
  },
  clientOverride?: ElasticsearchClient,
) {
  const config = elasticsearchConfigFromEnvironment();
  if (!clientOverride && !config) return null;
  if (options.ids?.length === 0 || options.classIds?.length === 0 || options.includeTypes?.length === 0) {
    return { total: 0, documents: [] as Record<string, any>[] };
  }
  const index = elasticsearchEntityIndexName(projectName);
  const filters: Record<string, unknown>[] = [];
  if (options.ids) filters.push({ terms: { sqlite_id: options.ids } });
  if (options.classIds) filters.push({ terms: { class_ids: options.classIds } });
  if (options.includeTypes) filters.push({ terms: { type: options.includeTypes } });
  const bool: Record<string, unknown> = { filter: filters };
  if (options.excludeTypes?.length) {
    bool.must_not = [{ terms: { type: options.excludeTypes } }];
  }
  if (options.query.trim()) {
    bool.must = [{
      multi_match: {
        query: options.query.trim(),
        fields: ["labels.*.value", "descriptions.*.value", "aliases.*.value", "type", "sqlite_id"],
        type: "best_fields",
        operator: "and",
      },
    }];
  }
  const sortField = options.order.startsWith("created") ? "created_at_sort" : "updated_at_sort";
  const sortOrder = options.order.endsWith("_asc") ? "asc" : "desc";
  const client = clientOverride || new ElasticsearchClient(config!);
  const { body } = await client.send(`/${encodeURIComponent(index)}/_search`, {
    method: "POST",
    body: JSON.stringify({
      from: options.offset,
      size: options.limit,
      track_total_hits: true,
      query: { bool },
      sort: [{ [sortField]: { order: sortOrder, unmapped_type: "keyword" } }, { sqlite_id: "asc" }],
    }),
  });
  return {
    total: Number(body?.hits?.total?.value ?? body?.hits?.total ?? 0),
    documents: (body?.hits?.hits || []).map((hit: any) => hit?._source).filter(Boolean),
  };
}

export async function queryArangoIncomingRelations(
  projectName: string,
  nodeId: string,
  clientOverride?: ArangoClient,
) {
  const config = configFromEnvironment();
  if (!clientOverride && !config) return null;
  const client = clientOverride || new ArangoClient(config!);
  const database = arangoDatabaseName(projectName);
  const vertex = `entity/${documentKey(nodeId)}`;
  const incoming = await client.database(database, "/_api/cursor", {
    method: "POST",
    body: JSON.stringify({
      query: `FOR edge IN link
        FILTER edge._to == @vertex AND edge._from != @vertex
        LET source = DOCUMENT(edge._from)
        FILTER source != null
        RETURN { source, propertyId: edge.property_id, propertyName: edge.property_name }`,
      bindVars: { vertex },
    }),
  });
  const relations = incoming.body?.result || [];
  if (!relations.length) return [];
  const sourceVertices = [...new Set(relations.map((relation: any) => relation.source?._id).filter(Boolean))];
  const secondLevel = await client.database(database, "/_api/cursor", {
    method: "POST",
    body: JSON.stringify({
      query: `FOR edge IN link
        FILTER edge._to IN @targets
          AND edge._from != edge._to
          AND edge._from != @vertex
        LET target = DOCUMENT(edge._to)
        LET source = DOCUMENT(edge._from)
        FILTER target != null AND source != null
        RETURN { targetId: target.sqlite_id, source, propertyId: edge.property_id, propertyName: edge.property_name }`,
      bindVars: { targets: sourceVertices, vertex },
    }),
  });
  return {
    relations,
    secondLevel: secondLevel.body?.result || [],
  };
}

export function documentKey(id: unknown) {
  return createHash("sha256").update(String(id)).digest("hex");
}

function parseJson(value: unknown): any {
  if (typeof value !== "string" || !value) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// User-entered localized text can itself look like a JSON scalar (123, true,
// null). Only decode structured JSON here; scalar text must remain literal.
function parseLocalizedInput(value: unknown): any {
  const parsed = parseJson(value);
  return typeof value === 'string' && (parsed === null || typeof parsed !== 'object')
    ? value
    : parsed;
}

type LocalizedValue = { language: string; value: string };
type LocalizedValueMap = Record<string, LocalizedValue>;
type LocalizedAliasMap = Record<string, LocalizedValue[]>;

function localizedEntry(value: unknown, language: string): LocalizedValue | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { language, value: text } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  const text = String(entry.value ?? "").trim();
  if (!text) return null;
  const entryLanguage = String(entry.language || language).trim() || language;
  return { language: entryLanguage, value: text };
}

function localizedValueMap(raw: unknown, defaultLanguage = "zh"): LocalizedValueMap {
  const parsed = parseLocalizedInput(raw);
  const result: LocalizedValueMap = {};
  const add = (value: unknown, language: string) => {
    const entry = localizedEntry(value, language);
    if (entry) result[entry.language] = entry;
  };
  if (typeof parsed === "string") {
    add(parsed, defaultLanguage);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        if ("value" in record) add(record, defaultLanguage);
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if ("value" in record) {
      add(record, defaultLanguage);
    } else {
      for (const [language, value] of Object.entries(record)) add(value, language);
    }
  }
  return result;
}

function localizedAliasMap(raw: unknown, defaultLanguage = "zh"): LocalizedAliasMap {
  const parsed = parseLocalizedInput(raw);
  const result: LocalizedAliasMap = {};
  const seen = new Set<string>();
  const add = (value: unknown, language: string) => {
    const entry = localizedEntry(value, language);
    if (!entry) return;
    const key = `${entry.language}\u0000${entry.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    (result[entry.language] ||= []).push(entry);
  };

  if (typeof parsed === "string") {
    add(parsed, defaultLanguage);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === "string") {
        add(item, defaultLanguage);
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        if ("value" in record) add(record, defaultLanguage);
        else {
          for (const [language, values] of Object.entries(record)) {
            if (Array.isArray(values)) values.forEach((value) => add(value, language));
            else add(values, language);
          }
        }
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if ("value" in record) {
      add(record, defaultLanguage);
    } else {
      for (const [language, values] of Object.entries(record)) {
        if (Array.isArray(values)) values.forEach((value) => add(value, language));
        else add(values, language);
      }
    }
  }
  return result;
}

function referencedEntityIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(referencedEntityIds);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const id = object.id ?? object.entity_id ?? object.entityId ?? object["entity-id"];
  const normalized = String(id ?? "").trim().replace(/^entity\//, "");
  const nested = object.value === undefined ? [] : referencedEntityIds(object.value);
  return normalized ? [normalized, ...nested] : nested;
}

export function entityDocument(node: Record<string, any>, syncVersion?: string, classIds: string[] = []) {
  const { name, description, aliases, ...fields } = node;
  return {
    ...fields,
    _key: documentKey(fields.id),
    sqlite_id: String(fields.id),
    class_ids: classIds,
    labels: localizedValueMap(name),
    descriptions: localizedValueMap(description),
    aliases: localizedAliasMap(aliases),
    created_at_sort: sortableDate(fields.created_at),
    updated_at_sort: sortableDate(fields.updated_at || fields.created_at),
    ...(syncVersion ? { sync_version: syncVersion } : {}),
  };
}

function sortableDate(value: unknown) {
  const raw = String(value ?? "").trim();
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : raw;
}

function elasticsearchNotFound(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 404);
}

export async function ensureElasticsearchEntityIndex(client: ElasticsearchClient, projectName: string, preserveExisting = false) {
  const index = elasticsearchEntityIndexName(projectName);
  let recreate = false;
  try {
    await client.send(`/${encodeURIComponent(index)}`, { method: "HEAD" });
  } catch (error) {
    if (!elasticsearchNotFound(error)) throw error;
    recreate = true;
  }
  if (!recreate && preserveExisting) return index;
  if (!recreate) {
    const { body } = await client.send(`/${encodeURIComponent(index)}/_mapping`);
    const mapping = body?.[index]?.mappings;
    recreate = mapping?.dynamic !== "false" || mapping?._meta?.entitySyncSchema !== 3;
  }
  if (recreate) {
    try {
      await client.send(`/${encodeURIComponent(index)}`, { method: "DELETE" });
    } catch (error) {
      if (!elasticsearchNotFound(error)) throw error;
    }
    await client.send(`/${encodeURIComponent(index)}`, {
      method: "PUT",
      body: JSON.stringify({
        mappings: {
          _meta: { entitySyncSchema: 3 },
          dynamic: "false",
          properties: {
            id: { type: "keyword" },
            sqlite_id: { type: "keyword" },
            type: { type: "keyword" },
            class_ids: { type: "keyword" },
            project_id: { type: "long" },
            created_at_sort: { type: "keyword" },
            updated_at_sort: { type: "keyword" },
            labels: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } },
              },
            },
            descriptions: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } },
              },
            },
            aliases: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } },
              },
            },
          },
        },
      }),
    });
  }
  return index;
}

async function bulkIndexEntities(
  client: ElasticsearchClient,
  index: string,
  documents: Record<string, any>[],
) {
  for (let offset = 0; offset < documents.length; offset += IMPORT_BATCH_SIZE) {
    const chunk = documents.slice(offset, offset + IMPORT_BATCH_SIZE);
    if (!chunk.length) continue;
    const body = chunk.flatMap((document) => [
      JSON.stringify({ index: { _index: index, _id: document._key } }),
      JSON.stringify(document),
    ]).join("\n") + "\n";
    const { body: result } = await client.send("/_bulk", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-ndjson" },
    });
    if (result?.errors) {
      const failures = (result.items || []).filter((item: any) => item.index?.error).slice(0, 3);
      throw new Error(`Elasticsearch bulk index into ${index} failed: ${JSON.stringify(failures)}`);
    }
  }
}

function entityClassIds(db: Database, nodeIds: string[]) {
  const result = new Map<string, string[]>();
  for (let offset = 0; offset < nodeIds.length; offset += 400) {
    const batch = nodeIds.slice(offset, offset + 400);
    if (!batch.length) continue;
    const rows = db.query(
      `SELECT entity_id, class_id FROM entity_classes
       WHERE entity_id IN (${batch.map(() => "?").join(",")})
          OR REPLACE(entity_id, 'entity/', '') IN (${batch.map(() => "?").join(",")})
       ORDER BY entity_id, class_id`,
    ).all(...batch, ...batch) as { entity_id: string; class_id: string }[];
    for (const row of rows) {
      const entityId = String(row.entity_id || "").replace(/^entity\//, "");
      const classIds = result.get(entityId) || [];
      classIds.push(String(row.class_id));
      result.set(entityId, classIds);
    }
  }
  return result;
}

async function synchronizeElasticsearchProjectSnapshot(
  client: ElasticsearchClient,
  db: Database,
  projectId: number,
  projectName: string,
) {
  const index = await ensureElasticsearchEntityIndex(client, projectName);
  const syncVersion = randomUUID();
  const nodes = db.query(
    "SELECT * FROM nodes WHERE project_id = ? OR (project_id IS NULL AND ? = (SELECT id FROM projects WHERE is_default=1 LIMIT 1)) ORDER BY id",
  ).all(projectId, projectId) as Record<string, any>[];
  const classIds = entityClassIds(db, nodes.map((node) => String(node.id)));
  await bulkIndexEntities(
    client,
    index,
    nodes.map((node) => ({
      ...entityDocument(node, undefined, classIds.get(String(node.id)) || []),
      sync_version: syncVersion,
    })),
  );
  const { body: result } = await client.send(`/${encodeURIComponent(index)}/_delete_by_query?conflicts=proceed&refresh=true`, {
    method: "POST",
    body: JSON.stringify({
      query: { bool: { must_not: [{ term: { sync_version: syncVersion } }] } },
    }),
  });
  if (result?.timed_out || result?.failures?.length) {
    throw new Error(`Elasticsearch snapshot cleanup failed for ${index}`);
  }
}

async function synchronizeElasticsearchNode(
  client: ElasticsearchClient,
  db: Database,
  projectName: string,
  nodeId: string,
  action: "upsert" | "delete",
) {
  const index = await ensureElasticsearchEntityIndex(client, projectName);
  const documentId = documentKey(nodeId);
  if (action === "delete") {
    try {
      await client.send(`/${encodeURIComponent(index)}/_doc/${documentId}`, { method: "DELETE" });
    } catch (error) {
      if (!elasticsearchNotFound(error)) throw error;
    }
    return;
  }

  const node = db.query("SELECT * FROM nodes WHERE id=?").get(nodeId) as Record<string, any> | null;
  if (!node) {
    await synchronizeElasticsearchNode(client, db, projectName, nodeId, "delete");
    return;
  }
  const classIds = entityClassIds(db, [nodeId]);
  await bulkIndexEntities(client, index, [entityDocument(node, undefined, classIds.get(nodeId) || [])]);
}

function claimStatement(attribute: AttributeRow) {
  const parsed = parseJson(attribute.statement_json);
  const statement = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, any>
    : {};
  const datatype = String(
    statement.mainsnak?.datatype || statement.datatype || attribute.datatype || "",
  ).toLowerCase();
  const normalizedDatatype = datatype === "wikibase-entityid" ? "wikibase-item" : datatype;
  const value = parseJson(attribute.value);
  const snaktype = statement.mainsnak?.snaktype || statement.snaktype || "value";
  const datavalue = statement.mainsnak?.datavalue || statement.datavalue || (
    snaktype === "value"
      ? { type: attribute.datatype || normalizedDatatype, value }
      : undefined
  );
  const mainsnak = statement.mainsnak || {
    snaktype,
    property: statement.property || attribute.key,
    datatype: normalizedDatatype,
    ...(datavalue ? { datavalue } : {}),
  };

  return {
    id: statement.id || attribute.id,
    mainsnak,
    type: statement.type || "statement",
    rank: statement.rank || "normal",
    qualifiers: statement.qualifiers || {},
    ...(statement["qualifiers-order"] ? { "qualifiers-order": statement["qualifiers-order"] } : {}),
    references: statement.references || [],
    datatype: normalizedDatatype,
    value,
  };
}

export function edgeDocuments(node: Record<string, any>, attributes: AttributeRow[], syncVersion?: string) {
  const edges: Record<string, unknown>[] = [];
  const sourceKey = documentKey(node.id);
  for (const attribute of attributes) {
    const claim = claimStatement(attribute);
    const isEntityRelation = claim.datatype === "wikibase-item";
    const datavalue = claim.mainsnak?.datavalue;
    const claimValues = datavalue?.value === undefined
      ? [claim.value]
      : Array.isArray(datavalue.value) ? datavalue.value : [datavalue.value];

    for (const [valueIndex, value] of claimValues.entries()) {
      const valueClaim = {
        ...claim,
        mainsnak: datavalue
          ? { ...claim.mainsnak, datavalue: { ...datavalue, value } }
          : claim.mainsnak,
        value,
      };
      const targets = isEntityRelation ? referencedEntityIds(value) : [];
      const destinations = targets.length ? targets : [null];
      for (const [targetIndex, target] of destinations.entries()) {
        const targetKey = target ? documentKey(target) : sourceKey;
        const edgeDiscriminator = claimValues.length === 1 && destinations.length === 1
          ? `${attribute.id}\u0000${targetKey}`
          : `${attribute.id}\u0000${valueIndex}\u0000${targetKey}\u0000${targetIndex}`;
        edges.push({
          _key: documentKey(edgeDiscriminator),
          _from: `entity/${sourceKey}`,
          _to: `entity/${targetKey}`,
          sqlite_id: String(attribute.id),
          source_id: String(node.id),
          target_id: target || String(node.id),
          property_id: String(claim.mainsnak?.property || attribute.key || ""),
          property_name: attribute.property_name_snapshot || "",
          ...valueClaim,
          attribute: { ...attribute },
          ...(syncVersion ? { sync_version: syncVersion } : {}),
        });
      }
    }
  }
  return edges;
}

async function createDatabase(client: ArangoClient, projectName: string) {
  const name = arangoDatabaseName(projectName);
  const { response } = await client.system("/_api/database", {
    method: "POST",
    body: JSON.stringify({ name }),
  }).catch(async (error: any) => {
    if (error?.status === 409) return { response: null };
    throw error;
  });
  if (!response) return name;
  return name;
}

async function ensureCollection(client: ArangoClient, dbName: string, name: string, type: 2 | 3) {
  const path = `/_api/collection/${encodeURIComponent(name)}`;
  try {
    await client.database(dbName, path, { method: "GET" });
    return;
  } catch (error: any) {
    if (error?.status !== 404) throw error;
  }
  await client.database(dbName, "/_api/collection", {
    method: "POST",
    body: JSON.stringify({ name, type }),
  }).catch((error: any) => {
    if (error?.status !== 409) throw error;
  });
}

async function ensureGraph(client: ArangoClient, dbName: string) {
  try {
    await client.database(dbName, "/_api/gharial/graph");
    return;
  } catch (error: any) {
    if (error?.status !== 404) throw error;
  }
  await client.database(dbName, "/_api/gharial", {
    method: "POST",
    body: JSON.stringify({
      name: "graph",
      edgeDefinitions: [{ collection: "link", from: ["entity"], to: ["entity"] }],
    }),
  }).catch((error: any) => {
    if (error?.status !== 409) throw error;
  });
}

async function ensureView(client: ArangoClient, dbName: string) {
  const properties = {
    links: { entity: { includeAllFields: true } },
  };
  try {
    await client.database(dbName, "/_api/view/entity_view/properties");
    await client.database(dbName, "/_api/view/entity_view/properties", {
      method: "PUT",
      body: JSON.stringify(properties),
    });
    return;
  } catch (error: any) {
    if (error?.status !== 404) throw error;
  }
  await client.database(dbName, "/_api/view", {
    method: "POST",
    body: JSON.stringify({ name: "entity_view", type: "arangosearch", ...properties }),
  }).catch((error: any) => {
    if (error?.status !== 409) throw error;
  });
}

async function ensureApplicationDatabase(client: ArangoClient, projectName: string) {
  const dbName = await createDatabase(client, projectName);
  await ensureCollection(client, dbName, "entity", 2);
  await ensureCollection(client, dbName, "link", 3);
  await ensureGraph(client, dbName);
  await ensureView(client, dbName);
  return dbName;
}

async function importDocuments(
  client: ArangoClient,
  dbName: string,
  collection: "entity" | "link",
  documents: Record<string, unknown>[],
) {
  for (let offset = 0; offset < documents.length; offset += IMPORT_BATCH_SIZE) {
    const chunk = documents.slice(offset, offset + IMPORT_BATCH_SIZE);
    if (!chunk.length) continue;
    const body = chunk.map((document) => JSON.stringify(document)).join("\n") + "\n";
    const path = `/_api/import?collection=${collection}&type=documents&onDuplicate=replace`;
    const { body: result } = await client.database(dbName, path, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-ndjson" },
    });
    if (Number(result?.errors || 0) > 0) {
      throw new Error(`ArangoDB import into ${collection} reported ${result.errors} failed document(s)`);
    }
  }
}

async function executeAql(client: ArangoClient, dbName: string, query: string, bindVars: Record<string, unknown>) {
  return client.database(dbName, "/_api/cursor", {
    method: "POST",
    body: JSON.stringify({ query, bindVars }),
  });
}

function attributesForNodes(db: Database, nodeIds: string[]) {
  const attributes = new Map<string, AttributeRow[]>();
  for (let offset = 0; offset < nodeIds.length; offset += 400) {
    const batch = nodeIds.slice(offset, offset + 400);
    if (!batch.length) continue;
    const rows = db.query(
      `SELECT id,node_id,key,value,datatype,property_name_snapshot,statement_json,created_at
       FROM attributes WHERE node_id IN (${batch.map(() => "?").join(",")}) ORDER BY id`,
    ).all(...batch) as AttributeRow[];
    for (const row of rows) {
      const list = attributes.get(String(row.node_id)) || [];
      list.push(row);
      attributes.set(String(row.node_id), list);
    }
  }
  return attributes;
}

async function synchronizeProjectSnapshot(client: ArangoClient, db: Database, projectId: number, projectName: string) {
  const dbName = await ensureApplicationDatabase(client, projectName);
  const syncVersion = randomUUID();
  const nodes = db.query(
    "SELECT * FROM nodes WHERE project_id = ? OR (project_id IS NULL AND ? = (SELECT id FROM projects WHERE is_default=1 LIMIT 1)) ORDER BY id",
  ).all(projectId, projectId) as Record<string, any>[];
  const attributes = attributesForNodes(db, nodes.map((node) => String(node.id)));
  const classIds = entityClassIds(db, nodes.map((node) => String(node.id)));

  for (let offset = 0; offset < nodes.length; offset += IMPORT_BATCH_SIZE) {
    const chunk = nodes.slice(offset, offset + IMPORT_BATCH_SIZE);
    await importDocuments(
      client,
      dbName,
      "entity",
      chunk.map((node) => entityDocument(node, syncVersion, classIds.get(String(node.id)) || [])),
    );
    await importDocuments(
      client,
      dbName,
      "link",
      chunk.flatMap((node) => edgeDocuments(node, attributes.get(String(node.id)) || [], syncVersion)),
    );
  }

  await executeAql(
    client,
    dbName,
    "FOR doc IN entity FILTER doc.sync_version != @version REMOVE doc IN entity",
    { version: syncVersion },
  );
  await executeAql(
    client,
    dbName,
    "FOR doc IN link FILTER doc.sync_version != @version REMOVE doc IN link",
    { version: syncVersion },
  );
}

async function synchronizeNode(
  client: ArangoClient,
  db: Database,
  projectId: number,
  projectName: string,
  nodeId: string,
  requestedAction: "upsert" | "delete",
) {
  const dbName = await ensureApplicationDatabase(client, projectName);
  const node = db.query(
    "SELECT * FROM nodes WHERE id = ? AND (project_id = ? OR (project_id IS NULL AND ? = (SELECT id FROM projects WHERE is_default=1 LIMIT 1)))",
  ).get(nodeId, projectId, projectId) as Record<string, any> | null;
  const vertexId = `entity/${documentKey(nodeId)}`;

  if (!node || requestedAction === "delete") {
    await executeAql(
      client,
      dbName,
      "FOR edge IN link FILTER edge._from == @vertex OR edge._to == @vertex REMOVE edge IN link",
      { vertex: vertexId },
    );
    try {
      await client.database(dbName, `/_api/document/${vertexId}`, { method: "DELETE" });
    } catch (error: any) {
      if (error?.status !== 404) throw error;
    }
    return;
  }

  const rows = db.query(
    "SELECT id,node_id,key,value,datatype,property_name_snapshot,statement_json,created_at FROM attributes WHERE node_id=? ORDER BY id",
  ).all(nodeId) as AttributeRow[];
  const classIds = entityClassIds(db, [nodeId]);
  await importDocuments(client, dbName, "entity", [entityDocument(node, undefined, classIds.get(nodeId) || [])]);
  await executeAql(client, dbName, "FOR edge IN link FILTER edge._from == @vertex REMOVE edge IN link", {
    vertex: vertexId,
  });
  await importDocuments(client, dbName, "link", edgeDocuments(node, rows));
}

function installOutbox(db: Database, defaultProjectId: number) {
  db.run(`CREATE TABLE IF NOT EXISTS arangodb_sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    database_name TEXT NOT NULL DEFAULT '',
    node_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('upsert','delete')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const outboxColumns = new Set((db.query("PRAGMA table_info(arangodb_sync_outbox)").all() as { name: string }[]).map((column) => column.name));
  if (!outboxColumns.has("database_name")) db.run("ALTER TABLE arangodb_sync_outbox ADD COLUMN database_name TEXT NOT NULL DEFAULT ''");
  db.run(`UPDATE arangodb_sync_outbox SET database_name=COALESCE(
    (SELECT name FROM projects WHERE id=arangodb_sync_outbox.project_id),''
  ) WHERE database_name=''`);
  db.run("CREATE INDEX IF NOT EXISTS arangodb_sync_outbox_created ON arangodb_sync_outbox(id)");
  db.run(`CREATE TABLE IF NOT EXISTS arangodb_user_sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('sync','disable')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run("CREATE INDEX IF NOT EXISTS arangodb_user_sync_outbox_created ON arangodb_user_sync_outbox(id)");
  for (const trigger of [
    "arangodb_nodes_insert",
    "arangodb_nodes_update",
    "arangodb_nodes_delete",
    "arangodb_attributes_insert",
    "arangodb_attributes_update",
    "arangodb_attributes_delete",
    "arangodb_entity_classes_insert",
    "arangodb_entity_classes_update",
    "arangodb_entity_classes_delete",
    "arangodb_users_insert",
    "arangodb_users_update",
    "arangodb_users_delete",
    "arangodb_user_roles_insert",
    "arangodb_user_roles_delete",
    "arangodb_application_members_insert",
    "arangodb_application_members_update",
    "arangodb_application_members_delete",
    "arangodb_projects_insert",
    "arangodb_projects_update",
  ]) db.run(`DROP TRIGGER IF EXISTS ${trigger}`);

  db.run(`CREATE TRIGGER arangodb_nodes_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,NEW.id,'upsert' FROM projects p
    WHERE p.id=COALESCE(NEW.project_id,${defaultProjectId});
  END`);
  db.run(`CREATE TRIGGER arangodb_nodes_update AFTER UPDATE ON nodes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,OLD.id,'delete' FROM projects p
    WHERE p.id=COALESCE(OLD.project_id,${defaultProjectId})
      AND COALESCE(OLD.project_id,${defaultProjectId}) <> COALESCE(NEW.project_id,${defaultProjectId});
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,NEW.id,'upsert' FROM projects p
    WHERE p.id=COALESCE(NEW.project_id,${defaultProjectId});
  END`);
  db.run(`CREATE TRIGGER arangodb_nodes_delete AFTER DELETE ON nodes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,OLD.id,'delete' FROM projects p
    WHERE p.id=COALESCE(OLD.project_id,${defaultProjectId});
  END`);
  db.run(`CREATE TRIGGER arangodb_attributes_insert AFTER INSERT ON attributes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,n.id,'upsert' FROM nodes n
    JOIN projects p ON p.id=COALESCE(n.project_id,${defaultProjectId})
    WHERE n.id=NEW.node_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_attributes_update AFTER UPDATE ON attributes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,n.id,'upsert' FROM nodes n
    JOIN projects p ON p.id=COALESCE(n.project_id,${defaultProjectId})
    WHERE n.id IN (OLD.node_id,NEW.node_id);
  END`);
  db.run(`CREATE TRIGGER arangodb_attributes_delete AFTER DELETE ON attributes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,n.id,'upsert' FROM nodes n
    JOIN projects p ON p.id=COALESCE(n.project_id,${defaultProjectId})
    WHERE n.id=OLD.node_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_entity_classes_insert AFTER INSERT ON entity_classes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,n.id,'upsert' FROM nodes n
    JOIN projects p ON p.id=COALESCE(n.project_id,${defaultProjectId})
    WHERE n.id=NEW.entity_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_entity_classes_update AFTER UPDATE ON entity_classes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,n.id,'upsert' FROM nodes n
    JOIN projects p ON p.id=COALESCE(n.project_id,${defaultProjectId})
    WHERE n.id IN (OLD.entity_id,NEW.entity_id);
  END`);
  db.run(`CREATE TRIGGER arangodb_entity_classes_delete AFTER DELETE ON entity_classes BEGIN
    INSERT INTO arangodb_sync_outbox(project_id,database_name,node_id,action)
    SELECT p.id,p.name,n.id,'upsert' FROM nodes n
    JOIN projects p ON p.id=COALESCE(n.project_id,${defaultProjectId})
    WHERE n.id=OLD.entity_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_users_insert AFTER INSERT ON users BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action) VALUES(NEW.id,NEW.username,'sync');
  END`);
  db.run(`CREATE TRIGGER arangodb_users_update AFTER UPDATE OF username,display_name,role,status,is_admin ON users BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action) VALUES(NEW.id,NEW.username,'sync');
  END`);
  db.run(`CREATE TRIGGER arangodb_users_delete AFTER DELETE ON users BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action) VALUES(OLD.id,OLD.username,'disable');
  END`);
  db.run(`CREATE TRIGGER arangodb_user_roles_insert AFTER INSERT ON user_roles BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users WHERE id=NEW.user_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_user_roles_delete AFTER DELETE ON user_roles BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users WHERE id=OLD.user_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_application_members_insert AFTER INSERT ON application_members BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users WHERE id=NEW.user_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_application_members_update AFTER UPDATE ON application_members BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users WHERE id=OLD.user_id AND OLD.user_id <> NEW.user_id;
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users WHERE id=NEW.user_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_application_members_delete AFTER DELETE ON application_members BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users WHERE id=OLD.user_id;
  END`);
  db.run(`CREATE TRIGGER arangodb_projects_insert AFTER INSERT ON projects BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users;
  END`);
  db.run(`CREATE TRIGGER arangodb_projects_update AFTER UPDATE OF owner_user_id,is_default ON projects BEGIN
    INSERT INTO arangodb_user_sync_outbox(user_id,username,action)
    SELECT id,username,'sync' FROM users;
  END`);
}

async function syncPendingOutbox(client: ArangoClient, db: Database, elasticsearchClient?: ElasticsearchClient) {
  const events = db.query(
    "SELECT id,project_id,database_name,node_id,action FROM arangodb_sync_outbox ORDER BY id LIMIT 500",
  ).all() as OutboxEvent[];
  if (!events.length) return;

  const groups = new Map<string, { projectId: number; databaseName: string; nodeId: string; action: "upsert" | "delete"; eventIds: number[] }>();
  for (const event of events) {
    const key = `${event.database_name}\u0000${event.node_id}`;
    const group = groups.get(key) || {
      projectId: Number(event.project_id),
      databaseName: String(event.database_name),
      nodeId: String(event.node_id),
      action: event.action,
      eventIds: [],
    };
    group.action = event.action;
    group.eventIds.push(Number(event.id));
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    await synchronizeNode(client, db, group.projectId, group.databaseName, group.nodeId, group.action);
    if (elasticsearchClient) {
      await synchronizeElasticsearchNode(elasticsearchClient, db, group.databaseName, group.nodeId, group.action);
    }
    const placeholders = group.eventIds.map(() => "?").join(",");
    db.run(`DELETE FROM arangodb_sync_outbox WHERE id IN (${placeholders})`, group.eventIds);
  }
}

async function syncPendingUserOutbox(client: ArangoClient, db: Database) {
  const events = db.query(
    "SELECT id,user_id,username,action FROM arangodb_user_sync_outbox ORDER BY id LIMIT 500",
  ).all() as UserOutboxEvent[];
  if (!events.length) return;

  const groups = new Map<number, { userId: number; username: string; action: "sync" | "disable"; eventIds: number[] }>();
  for (const event of events) {
    const userId = Number(event.user_id);
    const group = groups.get(userId) || {
      userId,
      username: String(event.username),
      action: event.action,
      eventIds: [],
    };
    group.username = String(event.username);
    group.action = event.action;
    group.eventIds.push(Number(event.id));
    groups.set(userId, group);
  }

  for (const group of groups.values()) {
    const user = db.query("SELECT id,username,display_name,role,status,is_admin FROM users WHERE id=?")
      .get(group.userId) as any;
    const active = Boolean(user) && user.status !== "disabled" && group.action !== "disable";
    await syncArangoNativeUserState(
      group.username,
      {
        id: group.userId,
        displayName: String(user?.display_name || group.username),
        role: user?.role === "admin" || user?.is_admin ? "admin" : "user",
        active,
      },
      user ? arangoUserDatabaseGrants(db, group.userId, user.role === "admin" || user.is_admin ? "admin" : "user", active) : [],
      client,
    );
    const placeholders = group.eventIds.map(() => "?").join(",");
    db.run(`DELETE FROM arangodb_user_sync_outbox WHERE id IN (${placeholders})`, group.eventIds);
  }
}

async function syncNewApplications(
  client: ArangoClient,
  db: Database,
  knownProjects: Set<number>,
  elasticsearchClient?: ElasticsearchClient,
) {
  const projects = db.query("SELECT id,name FROM projects ORDER BY id").all() as { id: number; name: string }[];
  for (const project of projects) {
    const projectId = Number(project.id);
    if (knownProjects.has(projectId)) continue;
    await synchronizeProjectSnapshot(client, db, projectId, project.name);
    if (elasticsearchClient) {
      await synchronizeElasticsearchProjectSnapshot(elasticsearchClient, db, projectId, project.name);
    }
    knownProjects.add(projectId);
  }
}

export async function syncArangoNativeUser(
  username: string,
  password: string,
  user: { id: number; displayName: string; role: string; active: boolean },
  grants: ArangoUserDatabaseGrant[] = [],
) {
  const config = configFromEnvironment();
  if (!config) return;
  const client = new ArangoClient(config);
  await provisionArangoNativeUser(client, username, password, user, grants);
}

export async function provisionArangoNativeUser(
  client: ArangoClient,
  username: string,
  password: string,
  user: { id: number; displayName: string; role: string; active: boolean },
  grants: ArangoUserDatabaseGrant[] = [],
) {
  const payload = {
    user: username,
    passwd: password,
    active: user.active,
    extra: { sqlite_user_id: user.id, display_name: user.displayName, role: user.role },
  };
  try {
    await client.user("", { method: "POST", body: JSON.stringify(payload) });
  } catch (error: any) {
    if (error?.status !== 409) throw error;
    const existing = await client.user(`/${encodeURIComponent(username)}`);
    if (Number(existing.body?.extra?.sqlite_user_id) !== user.id) {
      throw new Error("ArangoDB username is already assigned to a different account");
    }
    await client.user(`/${encodeURIComponent(username)}`, {
      method: "PATCH",
      body: JSON.stringify({ passwd: password, active: user.active, extra: payload.extra }),
    });
  }
  await syncArangoUserDatabaseGrants(client, username, grants);
}

async function syncArangoUserDatabaseGrants(
  client: ArangoClient,
  username: string,
  grants: ArangoUserDatabaseGrant[],
) {
  for (const grant of grants) {
    await client.user(
      `/${encodeURIComponent(username)}/database/${encodeURIComponent(grant.database)}`,
      { method: "PUT", body: JSON.stringify({ grant: grant.grant }) },
    );
  }
}

export async function syncArangoNativeUserState(
  username: string,
  user: { id: number; displayName: string; role: string; active: boolean },
  grants: ArangoUserDatabaseGrant[] = [],
  clientOverride?: ArangoClient,
) {
  const config = clientOverride ? null : configFromEnvironment();
  if (!config && !clientOverride) return;
  const client = clientOverride || new ArangoClient(config!);
  try {
    await client.user(`/${encodeURIComponent(username)}`, {
      method: "PATCH",
      body: JSON.stringify({
        active: user.active,
        extra: { sqlite_user_id: user.id, display_name: user.displayName, role: user.role },
      }),
    });
  } catch (error: any) {
    if (error?.status !== 404) throw error;
    return;
  }
  await syncArangoUserDatabaseGrants(client, username, grants);
}

export function arangoUserDatabaseGrants(
  db: Database,
  userId: number,
  role: string,
  active: boolean,
): ArangoUserDatabaseGrant[] {
  const projects = db.query("SELECT id,name,is_default,owner_user_id FROM projects ORDER BY id").all() as {
    id: number;
    name: string;
    is_default: number;
    owner_user_id: number | null;
  }[];
  const memberships = new Set(
    (db.query("SELECT project_id FROM application_members WHERE user_id=?").all(userId) as { project_id: number }[])
      .map((row) => Number(row.project_id)),
  );
  return projects.map((project) => {
    const hasAccess =
      active &&
      (role === "admin" ||
        Number(project.is_default) === 1 ||
        Number(project.owner_user_id) === userId ||
        memberships.has(Number(project.id)));
    return {
      database: arangoDatabaseName(project.name),
      grant: hasAccess ? "ro" : "none",
    };
  });
}

export async function initializeArangoKnowledgeSync(
  db: Database,
  clientOverride?: ArangoClient,
  elasticsearchClientOverride?: ElasticsearchClient,
) {
  const config = configFromEnvironment();
  if (!config && !clientOverride) return;
  const client = clientOverride || new ArangoClient(config!);
  const elasticsearchConfig = elasticsearchConfigFromEnvironment();
  const elasticsearchClient = elasticsearchClientOverride
    || (elasticsearchConfig ? new ElasticsearchClient(elasticsearchConfig) : undefined);
  const defaultProject = db.query("SELECT id FROM projects WHERE is_default=1 ORDER BY id LIMIT 1").get() as { id: number } | null;
  if (!defaultProject) throw new Error("Cannot initialize ArangoDB sync without a default application");
  installOutbox(db, Number(defaultProject.id));

  const projects = db.query("SELECT id,name FROM projects ORDER BY id").all() as { id: number; name: string }[];
  for (const project of projects) arangoDatabaseName(project.name);
  if (elasticsearchClient) {
    const indexProjects = new Map<string, string>();
    for (const project of projects) {
      const index = elasticsearchEntityIndexName(project.name);
      const existingProject = indexProjects.get(index);
      if (existingProject && existingProject !== project.name) {
        throw new Error(`Applications "${existingProject}" and "${project.name}" map to the same Elasticsearch index "${index}"`);
      }
      indexProjects.set(index, project.name);
    }
  }
  const knownProjects = new Set<number>();
  for (const project of projects) {
    const projectId = Number(project.id);
    await synchronizeProjectSnapshot(client, db, projectId, project.name);
    if (elasticsearchClient) {
      await synchronizeElasticsearchProjectSnapshot(elasticsearchClient, db, projectId, project.name);
    }
    knownProjects.add(projectId);
  }

  let running = false;
  let lastErrorAt = 0;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await syncNewApplications(client, db, knownProjects, elasticsearchClient);
      await syncPendingOutbox(client, db, elasticsearchClient);
      await syncPendingUserOutbox(client, db);
    } catch (error) {
      if (Date.now() - lastErrorAt >= 30_000) {
        console.error("Knowledge graph synchronization failed; pending outbox entries will be retried:", error);
        lastErrorAt = Date.now();
      }
    } finally {
      running = false;
    }
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
