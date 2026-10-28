import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
import {
  ArangoClient,
  ElasticsearchClient,
  arangoDatabaseName,
  arangoUserDatabaseGrants,
  elasticsearchEntityIndexName,
  initializeArangoKnowledgeSync,
  provisionArangoNativeUser,
  queryArangoIncomingRelations,
  searchElasticsearchEntities,
} from "../src/server/arangodb.ts";

function fixture() {
  const db = new Database(":memory:");
  db.run("CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, is_default INTEGER, owner_user_id INTEGER)");
  db.run("INSERT INTO projects (id,name,is_default,owner_user_id) VALUES (7,'default',1,NULL),(8,'enterprise_app',0,20)");
  db.run("CREATE TABLE application_members (project_id INTEGER,user_id INTEGER,review_requests INTEGER DEFAULT 0)");
  db.run("INSERT INTO application_members (project_id,user_id) VALUES (8,21)");
  db.run("CREATE TABLE users (id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT,status TEXT,is_admin INTEGER)");
  db.run("INSERT INTO users VALUES (21,'member','Member','user','active',0)");
  db.run("CREATE TABLE user_roles (user_id INTEGER,role_id INTEGER)");
  db.run(`CREATE TABLE nodes (
    id TEXT PRIMARY KEY, name TEXT, type TEXT, description TEXT, aliases TEXT, data TEXT, project_id INTEGER,
    created_at TEXT, updated_at TEXT
  )`);
  db.run(`CREATE TABLE attributes (
    id TEXT PRIMARY KEY, node_id TEXT, key TEXT, value TEXT, datatype TEXT,
    property_name_snapshot TEXT, statement_json TEXT, created_at TEXT
  )`);
  db.run("CREATE TABLE entity_classes (entity_id TEXT, class_id TEXT, PRIMARY KEY(entity_id,class_id))");
  db.run("INSERT INTO entity_classes VALUES ('source','class-a'),('target','class-b')");
  db.run(`INSERT INTO nodes (id,name,type,description,aliases,project_id) VALUES
    ('source','源实体','Thing','源描述','["别名一",{"language":"en","value":"Source alias"}]',7),
    ('target','{"en":{"language":"en","value":"New York City"},"ar":{"language":"ar","value":"مدينة نيويورك"}}','Thing',
      '{"en":{"language":"en","value":"largest city"},"it":{"language":"it","value":"città"}}',
      '{"fr":[{"language":"fr","value":"New York City"},{"language":"fr","value":"NYC"}]}',7),
    ('target-two','Second target','Thing','', '[]',7)`);
  db.run(
    `INSERT INTO attributes (id,node_id,key,value,datatype,property_name_snapshot)
     VALUES ('relation-1','source','P1','{"id":"entity/target"}','wikibase-entityid','related to')`,
  );
  db.run(
    `INSERT INTO attributes (id,node_id,key,value,datatype,property_name_snapshot,statement_json)
     VALUES ('literal-1','source','P2','literal value','string','description',
       '{"property":"P2","datatype":"string","snaktype":"value","rank":"preferred","qualifiers":{},"references":[],"datavalue":{"type":"string","value":"literal value"}}')`,
  );
  db.run(
    `INSERT INTO attributes (id,node_id,key,value,datatype,property_name_snapshot,statement_json)
     VALUES ('relation-many','source','P3','[{"id":"target"},{"id":"target-two"}]','wikibase-entityid','related to',
       '{"property":"P3","datatype":"wikibase-item","snaktype":"value","rank":"normal","qualifiers":{},"references":[],"datavalue":{"type":"wikibase-entityid","value":[{"id":"target"},{"id":"target-two"}]}}')`,
  );
  db.run(
    `INSERT INTO attributes (id,node_id,key,value,datatype,property_name_snapshot,statement_json)
     VALUES ('literal-many','source','P4','["first","second"]','string','descriptions',
       '{"property":"P4","datatype":"string","snaktype":"value","rank":"normal","qualifiers":{},"references":[],"datavalue":{"type":"string","value":["first","second"]}}')`,
  );
  return db;
}

function response(status = 200, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("Enterprise startup creates per-project graph structures and migrates node/link documents", async () => {
  const db = fixture();
  const requests: { url: URL; method: string; body: string }[] = [];
  const elasticsearchRequests: { url: URL; method: string; body: string }[] = [];
  const client = new ArangoClient(
    { url: "http://arangodb:8529", username: "root", password: "secret" },
    async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || "GET";
      const body = typeof init.body === "string" ? init.body : "";
      requests.push({ url, method, body });

      if (url.pathname.endsWith("/_api/collection/entity") || url.pathname.endsWith("/_api/collection/link")) {
        return method === "GET" ? response(404, { error: true, errorMessage: "not found" }) : response();
      }
      if (url.pathname.endsWith("/_api/gharial/graph")) return response(404, { error: true });
      if (url.pathname.endsWith("/_api/view/entity_view/properties")) return response(404, { error: true });
      if (url.pathname.endsWith("/_api/import")) return response(201, { errors: 0 });
      return response();
    },
  );
  const elasticsearchClient = new ElasticsearchClient(
    { url: "http://elasticsearch:9200" },
    async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || "GET";
      const body = typeof init.body === "string" ? init.body : "";
      elasticsearchRequests.push({ url, method, body });
      if (method === "HEAD") return response(404, { error: "index_not_found_exception" });
      if (url.pathname === "/_bulk") return response(200, { errors: false, items: [] });
      return response(200, { deleted: 0, failures: [] });
    },
  );

  const stop = await initializeArangoKnowledgeSync(db, client, elasticsearchClient);
  try {
    const databaseCreation = requests.find((request) => request.url.pathname.endsWith("/_api/database"));
    expect(databaseCreation?.body).toContain('"default"');
    expect(requests.some((request) => request.body.includes('"enterprise_app"'))).toBe(true);
    expect(requests.some((request) => request.url.pathname.endsWith("/_api/gharial"))).toBe(true);
    expect(requests.some((request) => request.url.pathname.endsWith("/_api/view"))).toBe(true);

    const entityImport = requests.find((request) =>
      request.url.pathname.endsWith("/_api/import") && request.url.searchParams.get("collection") === "entity",
    );
    const entities = entityImport!.body.trim().split("\n").map((line) => JSON.parse(line));
    expect(entities).toHaveLength(3);
    const sourceEntity = entities.find((entity) => entity.sqlite_id === "source");
    expect(sourceEntity).not.toHaveProperty("attributes");
    expect(sourceEntity.class_ids).toEqual(["class-a"]);
    expect(sourceEntity.labels).toEqual({ zh: { language: "zh", value: "源实体" } });
    expect(sourceEntity.descriptions).toEqual({ zh: { language: "zh", value: "源描述" } });
    expect(sourceEntity.aliases).toEqual({
      zh: [{ language: "zh", value: "别名一" }],
      en: [{ language: "en", value: "Source alias" }],
    });
    expect(sourceEntity).not.toHaveProperty("name");
    expect(sourceEntity).not.toHaveProperty("description");
    const multilingualEntity = entities.find((entity) => entity.sqlite_id === "target");
    expect(multilingualEntity.labels).toEqual({
      en: { language: "en", value: "New York City" },
      ar: { language: "ar", value: "مدينة نيويورك" },
    });
    expect(multilingualEntity.descriptions).toEqual({
      en: { language: "en", value: "largest city" },
      it: { language: "it", value: "città" },
    });
    expect(multilingualEntity.aliases).toEqual({
      fr: [
        { language: "fr", value: "New York City" },
        { language: "fr", value: "NYC" },
      ],
    });

    const linkImport = requests.find((request) =>
      request.url.pathname.endsWith("/_api/import") && request.url.searchParams.get("collection") === "link",
    );
    const links = linkImport!.body.trim().split("\n").map((line) => JSON.parse(line));
    expect(links).toHaveLength(6);
    const relationClaim = links.find((link) => link.sqlite_id === "relation-1");
    expect(relationClaim).toMatchObject({
      _from: `entity/${createHash("sha256").update("source").digest("hex")}`,
      _to: `entity/${createHash("sha256").update("target").digest("hex")}`,
      property_name: "related to",
      mainsnak: {
        snaktype: "value",
        property: "P1",
        datatype: "wikibase-item",
        datavalue: { type: "wikibase-entityid", value: { id: "entity/target" } },
      },
      type: "statement",
      rank: "normal",
      qualifiers: {},
      references: [],
    });
    expect(relationClaim._key).toBe(
      createHash("sha256").update(`relation-1\u0000${createHash("sha256").update("target").digest("hex")}`).digest("hex"),
    );
    const literalClaim = links.find((link) => link.sqlite_id === "literal-1");
    expect(literalClaim).toMatchObject({
      _from: `entity/${createHash("sha256").update("source").digest("hex")}`,
      _to: `entity/${createHash("sha256").update("source").digest("hex")}`,
      mainsnak: {
        snaktype: "value",
        property: "P2",
        datatype: "string",
        datavalue: { type: "string", value: "literal value" },
      },
      rank: "preferred",
    });
    const multipleRelationClaims = links.filter((link) => link.sqlite_id === "relation-many");
    expect(multipleRelationClaims).toHaveLength(2);
    expect(multipleRelationClaims.map((link) => link._to).sort()).toEqual([
      `entity/${createHash("sha256").update("target").digest("hex")}`,
      `entity/${createHash("sha256").update("target-two").digest("hex")}`,
    ]);
    expect(multipleRelationClaims.map((link) => link.mainsnak.datavalue.value).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "target" },
      { id: "target-two" },
    ]);
    const multipleLiteralClaims = links.filter((link) => link.sqlite_id === "literal-many");
    expect(multipleLiteralClaims).toHaveLength(2);
    expect(multipleLiteralClaims.map((link) => link.mainsnak.datavalue.value).sort()).toEqual(["first", "second"]);
    expect(new Set(links.map((link) => link._key)).size).toBe(links.length);

    const elasticBulkRequests = elasticsearchRequests.filter((request) => request.url.pathname === "/_bulk");
    const indexedEntities = elasticBulkRequests.flatMap((request) =>
      request.body.trim().split("\n").filter((_, index) => index % 2 === 1).map((line) => JSON.parse(line)),
    );
    expect(indexedEntities).toHaveLength(3);
    expect(indexedEntities.find((entity) => entity.sqlite_id === "source")).not.toHaveProperty("attributes");
    expect(indexedEntities.find((entity) => entity.sqlite_id === "source").class_ids).toEqual(["class-a"]);
    const entityIndexCreation = elasticsearchRequests.find((request) =>
      request.method === "PUT" && request.url.pathname === "/entity-default",
    );
    expect(JSON.parse(entityIndexCreation!.body).mappings).toMatchObject({
      _meta: { entitySyncSchema: 3 },
      dynamic: "false",
      properties: {
        class_ids: { type: "keyword" },
        labels: { type: "object" },
        descriptions: { type: "object" },
        aliases: { type: "object" },
      },
    });
    expect(elasticsearchRequests.some((request) =>
      request.method === "PUT" && request.url.pathname === "/entity-enterprise-app",
    )).toBe(true);
    expect(elasticsearchRequests.some((request) =>
      request.url.pathname === "/entity-default/_delete_by_query",
    )).toBe(true);

    db.run("UPDATE nodes SET name='Updated' WHERE id='source'");
    expect((db.query("SELECT database_name FROM arangodb_sync_outbox").get() as any).database_name).toBe("default");
    db.run("UPDATE application_members SET review_requests=1 WHERE user_id=21");
    expect((db.query("SELECT COUNT(*) AS count FROM arangodb_user_sync_outbox").get() as any).count).toBe(1);
  } finally {
    stop?.();
    db.close();
  }
});

test("native-user database grants are read-only and scoped to applications the user can access", () => {
  const db = fixture();
  try {
    expect(arangoUserDatabaseGrants(db, 20, "user", true)).toEqual([
      { database: "default", grant: "ro" },
      { database: "enterprise_app", grant: "ro" },
    ]);
    expect(arangoUserDatabaseGrants(db, 99, "user", true)).toEqual([
      { database: "default", grant: "ro" },
      { database: "enterprise_app", grant: "none" },
    ]);
    expect(arangoUserDatabaseGrants(db, 99, "user", false).every((grant) => grant.grant === "none")).toBe(true);
  } finally {
    db.close();
  }
});

test("ArangoDB database name is the exact project name and invalid names fail explicitly", () => {
  expect(arangoDatabaseName("My_Project-1")).toBe("My_Project-1");
  expect(() => arangoDatabaseName("project name")).toThrow("cannot be used as an ArangoDB database name");
  expect(() => arangoDatabaseName("123qwe")).toThrow("starting with a letter");
});

test("Elasticsearch index names normalize project names to valid lowercase indices", () => {
  expect(elasticsearchEntityIndexName("My_Project-1")).toBe("entity-my-project-1");
  expect(() => elasticsearchEntityIndexName("123qwe")).toThrow("cannot be used");
});

test("application entity searches use Elasticsearch hits with project-filtered identifiers and paging", async () => {
  const requests: { url: URL; body: any }[] = [];
  const client = new ElasticsearchClient(
    { url: "http://elasticsearch:9200" },
    async (input, init = {}) => {
      requests.push({ url: new URL(String(input)), body: JSON.parse(String(init.body)) });
      return response(200, {
        hits: {
          total: { value: 1 },
          hits: [{ _source: { sqlite_id: "entity-1", labels: { zh: { value: "知识" } } } }],
        },
      });
    },
  );
  const results = await searchElasticsearchEntities("Project_A", {
    ids: ["entity-1", "entity-2"],
    query: "知识",
    limit: 10,
    offset: 20,
    order: "modified_desc",
  }, client);

  expect(requests[0].url.pathname).toBe("/entity-project-a/_search");
  expect(requests[0].body).toMatchObject({
    from: 20,
    size: 10,
    track_total_hits: true,
    sort: [{ updated_at_sort: { order: "desc", unmapped_type: "keyword" } }, { sqlite_id: "asc" }],
    query: {
      bool: {
        filter: [{ terms: { sqlite_id: ["entity-1", "entity-2"] } }],
        must: [{ multi_match: { query: "知识", fields: expect.arrayContaining(["labels.*.value"]) } }],
      },
    },
  });
  expect(results).toEqual({
    total: 1,
    documents: [{ sqlite_id: "entity-1", labels: { zh: { value: "知识" } } }],
  });
});

test("Elasticsearch can search an application index without SQLite candidate IDs and filter by class", async () => {
  const requests: { url: URL; body: any }[] = [];
  const client = new ElasticsearchClient(
    { url: "http://elasticsearch:9200" },
    async (input, init = {}) => {
      requests.push({ url: new URL(String(input)), body: JSON.parse(String(init.body)) });
      return response(200, {
        hits: {
          total: { value: 1 },
          hits: [{ _source: { sqlite_id: "entity-from-es", class_ids: ["class-a"] } }],
        },
      });
    },
  );
  const results = await searchElasticsearchEntities("Project_A", {
    query: "知识",
    limit: 10,
    offset: 0,
    order: "modified_desc",
    classIds: ["class-a"],
    excludeTypes: ["entity"],
  }, client);

  expect(requests[0].body.query.bool.filter).toEqual([{ terms: { class_ids: ["class-a"] } }]);
  expect(requests[0].body.query.bool.must_not).toEqual([{ terms: { type: ["entity"] } }]);
  expect(results.documents[0].sqlite_id).toBe("entity-from-es");
});

test("incoming associated entities and second-level relations are queried from ArangoDB", async () => {
  const requests: { url: URL; body: any }[] = [];
  const client = new ArangoClient(
    { url: "http://arangodb:8529", username: "root", password: "secret" },
    async (input, init = {}) => {
      const body = JSON.parse(String(init.body));
      requests.push({ url: new URL(String(input)), body });
      return requests.length === 1
        ? response(200, { result: [{ source: { _id: "entity/source-key", sqlite_id: "source" }, propertyId: "P1", propertyName: "关联" }] })
        : response(200, { result: [{ targetId: "source", source: { _id: "entity/second-key", sqlite_id: "second" }, propertyId: "P2", propertyName: "上游" }] });
    },
  );
  const result = await queryArangoIncomingRelations("enterprise_app", "target", client);

  expect(requests).toHaveLength(2);
  expect(requests.every((request) => request.url.pathname === "/_db/enterprise_app/_api/cursor")).toBe(true);
  expect(requests[0].body.query).toContain("FILTER edge._to == @vertex");
  expect(requests[1].body.query).toContain("FILTER edge._to IN @targets");
  expect(result?.relations[0].source.sqlite_id).toBe("source");
  expect(result?.secondLevel[0].source.sqlite_id).toBe("second");
});

test("native-user sync never overwrites an unrelated ArangoDB account with the same username", async () => {
  const methods: string[] = [];
  const client = new ArangoClient(
    { url: "http://arangodb:8529", username: "root", password: "secret" },
    async (_input, init = {}) => {
      methods.push(init.method || "GET");
      if (init.method === "POST") return response(409, { error: true });
      return response(200, { extra: { sqlite_user_id: 999 } });
    },
  );
  await expect(
    provisionArangoNativeUser(client, "alice", "password", {
      id: 21,
      displayName: "Alice",
      role: "user",
      active: true,
    }),
  ).rejects.toThrow("already assigned to a different account");
  expect(methods).toEqual(["POST", "GET"]);
});
