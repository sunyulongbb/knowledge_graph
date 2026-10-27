import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const coreKbSource = readFileSync(new URL("../src/server/routes/core-kb.ts", import.meta.url), "utf8");
const entitySearchRoute = coreKbSource
  .slice(
    coreKbSource.indexOf('  if (url.pathname === "/api/kb/entity_search" && method === "GET") {'),
    coreKbSource.indexOf('  if (url.pathname === "/api/kb/shorts_random"'),
  )
  .replaceAll("import.meta.dir", '"."');

function createEntitySearchRunner(
  db: any,
  search: (...args: any[]) => Promise<any>,
  isElasticsearchEnabled: () => boolean = () => true,
  searchParams = "",
) {
  const wrappedRoute = `
    return (async function route(
      url, method, db, hasProjectScope, scopedProjectId, scopedClause, scopedProject,
      definedClassEntityFilterSql, ontologyTypeFilterSql, isElasticsearchSearchEnabled,
      searchElasticsearchEntities, elasticsearchEntityNode, formatNode,
    ) {
      ${entitySearchRoute}
    })(
      url, method, db, false, null, () => "project_id = ?", null, "", "",
      isElasticsearchSearchEnabled, search, (document) => ({ id: document.sqlite_id, name: "ES result" }),
      (node) => node,
    );
  `;
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(wrappedRoute);
  return new Function("url", "method", "db", "search", "isElasticsearchSearchEnabled", js)(
    new URL(`http://localhost/api/kb/entity_search${searchParams}`),
    "GET",
    db,
    search,
    isElasticsearchEnabled,
  ) as Promise<Response>;
}

test("unscoped knowledge search reads results from the default application's Elasticsearch index", async () => {
  const queries: string[] = [];
  const db = {
    query(sql: string) {
      queries.push(sql);
      return {
        get: () => ({ id: 7, name: "default" }),
        all: () => [],
      };
    },
  };
  const searchCalls: unknown[] = [];
  const response = await createEntitySearchRunner(db, async (projectName, options) => {
    searchCalls.push({ projectName, options });
    return {
      total: 1,
      documents: [{ sqlite_id: "default-node" }],
    };
  });
  const result = await response.json();

  expect(searchCalls).toEqual([
    {
      projectName: "default",
      options: {
        ids: undefined,
        query: "",
        limit: 20,
        offset: 0,
        order: "modified_desc",
      },
    },
  ]);
  expect(queries.some((sql) => sql.includes("SELECT DISTINCT n.id"))).toBe(false);
  expect(queries.some((sql) => sql.includes("SELECT DISTINCT n.*"))).toBe(false);
  expect(result.nodes).toEqual([{ id: "default-node", name: "ES result", _timeline_attributes: [] }]);
  expect(result.total).toBe(1);
  expect(result.searchBackend).toBe("elasticsearch");
});

test("knowledge home filters by indexed classifications in Elasticsearch, not a SQLite node-ID list", async () => {
  const queries: string[] = [];
  const db = {
    query(sql: string) {
      queries.push(sql);
      return {
        get: () => ({ id: 7, name: "default" }),
        all: () => {
          if (sql.includes("FROM classes")) return [{ id: "class-a" }];
          if (sql.includes("SELECT DISTINCT type")) return [{ type: "Entity" }];
          return [];
        },
      };
    },
  };
  let searchOptions: any;
  const response = await createEntitySearchRunner(
    db,
    async (_projectName, options) => {
      searchOptions = options;
      return { total: 1, documents: [{ sqlite_id: "entity-from-es" }] };
    },
    () => true,
    "?class_id=class-a&defined_class_only=1&hide_entity=1",
  );
  const result = await response.json();

  expect(searchOptions.ids).toBeUndefined();
  expect(searchOptions.classIds).toEqual(["class-a"]);
  expect(searchOptions.excludeTypes).toEqual(["entity", "Entity"]);
  expect(queries.some((sql) => sql.includes("SELECT DISTINCT n.id"))).toBe(false);
  expect(result.nodes[0].id).toBe("entity-from-es");
});

test("Enterprise knowledge search fails explicitly instead of falling back to SQLite when ES is unavailable", async () => {
  const previousBackend = process.env.KNOWLEDGE_SEARCH_BACKEND;
  process.env.KNOWLEDGE_SEARCH_BACKEND = "elasticsearch";
  const db = {
    query() {
      return { get: () => ({ id: 7, name: "default" }), all: () => [] };
    },
  };
  try {
    const response = await createEntitySearchRunner(db, async () => {
      throw new Error("ES must not be queried when it is unconfigured");
    }, () => false);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Elasticsearch search is required, but ELASTICSEARCH_URL is not configured",
    });
  } finally {
    if (previousBackend === undefined) delete process.env.KNOWLEDGE_SEARCH_BACKEND;
    else process.env.KNOWLEDGE_SEARCH_BACKEND = previousBackend;
  }
});

test("knowledge page explicitly requires Elasticsearch even without Enterprise configuration", async () => {
  const queries: string[] = [];
  const db = {
    query(sql: string) {
      queries.push(sql);
      return { get: () => ({ id: 7, name: "default" }), all: () => [] };
    },
  };
  const response = await createEntitySearchRunner(db, async () => {
    throw new Error("Unconfigured Elasticsearch must not be queried");
  }, () => false, "?backend=elasticsearch&q=test");

  expect(response.status).toBe(503);
  expect(queries.some((sql) => sql.includes("SELECT DISTINCT n.*"))).toBe(false);
  expect(await response.json()).toEqual({
    error: "Elasticsearch search is required, but ELASTICSEARCH_URL is not configured",
  });
});
