import { db, getProjectByIdentifier } from "../db.ts";
import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

const UPLOADS_DIR = resolve(import.meta.dir, "..", "..", "..", "..", "uploads");
const CLASS_IMAGES_DIR = resolve(UPLOADS_DIR, "class-images");
mkdirSync(CLASS_IMAGES_DIR, { recursive: true });

function resolveScopedProject(req: Request, url: URL) {
  const directDb = (url.searchParams.get("db") || "").trim();
  if (directDb && directDb !== "app") {
    return getProjectByIdentifier(directDb);
  }

  try {
    const referer = (req.headers.get("referer") || "").trim();
    if (referer) {
      const refererUrl = new URL(referer);
      const refererDb = (refererUrl.searchParams.get("db") || "").trim();
      if (refererDb && refererDb !== "app") {
        return getProjectByIdentifier(refererDb);
      }
    }
  } catch {}

  return null;
}

export async function handleSchemaRoutes(
  req: Request,
  url: URL,
  method: string,
) {
  const parseTypes = (raw: any): string[] => {
    if (!raw && raw !== "") return [];
    if (Array.isArray(raw)) {
      return raw.map((item) => (item ?? "").toString().trim()).filter(Boolean);
    }
    const text = raw.toString().trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item ?? "").toString().trim())
          .filter(Boolean);
      }
    } catch {}
    return text
      .split(/[\n,，;；、|]+/g)
      .map((item: string) => item.trim())
      .filter(Boolean);
  };

  const scopedProject = resolveScopedProject(req, url);
  const scopedProjectId = Number(scopedProject?.id || 0) || null;
  const hasProjectScope = scopedProjectId !== null;
  const scopedProjectClause = (alias: string) =>
    hasProjectScope ? `${alias}.project_id = ?` : `${alias}.project_id IS NULL`;
  const scopedProjectParams = () => (hasProjectScope ? [scopedProjectId] : []);
  const mapOntologyRow = (row: any) => ({
    id: row.id,
    name: row.name,
    alias: parseAliasStorage(row.alias).length
      ? parseAliasStorage(row.alias)
      : [normalizeAlias(row.name)],
    label: row.name,
    description: row.description || "",
    parent_id: row.parent_id || null,
    parent: row.parent_id || null,
    project_id: row.project_id ?? null,
    sort_order: Number.isFinite(Number(row.sort_order))
      ? Number(row.sort_order)
      : null,
    status: row.status || "active",
    child_count: Number(row.child_count || 0),
    property_count: Number(row.property_count || 0),
  });
  const ontologyHasStatus = (() => {
    try {
      const cols = db.query("PRAGMA table_info(ontologies)").all() as any[];
      return cols.some((row) => (row?.name || row?.[1]) === "status");
    } catch {
      return false;
    }
  })();
  const getScopedOntologies = (q = "", status = "active") => {
    const scopeSql = scopedProjectClause("o");
    const childScopeSql = scopedProjectClause("child");
    const hasFilter = q.trim().length > 0;
    let filterSql = "";
    if (!ontologyHasStatus) {
      if (status === "deprecated") {
        filterSql = hasFilter
          ? "AND 0 = 1 AND (o.name LIKE ? OR COALESCE(o.alias, '') LIKE ?)"
          : "AND 0 = 1";
      } else {
        filterSql = hasFilter
          ? "AND (o.name LIKE ? OR COALESCE(o.alias, '') LIKE ?)"
          : "";
      }
    } else if (status === "all") {
      filterSql = hasFilter
        ? "AND (o.name LIKE ? OR COALESCE(o.alias, '') LIKE ?)"
        : "";
    } else if (status === "deprecated") {
      filterSql = hasFilter
        ? "AND o.status = 'deprecated' AND (o.name LIKE ? OR COALESCE(o.alias, '') LIKE ?)"
        : "AND o.status = 'deprecated'";
    } else {
      filterSql = hasFilter
        ? "AND (o.status IS NULL OR o.status = 'active') AND (o.name LIKE ? OR COALESCE(o.alias, '') LIKE ?)"
        : "AND (o.status IS NULL OR o.status = 'active')";
    }
    const queryParams: any[] = [
      ...scopedProjectParams(),
      ...scopedProjectParams(),
    ];
    if (hasFilter) {
      queryParams.push(`%${q}%`, `%${q}%`);
    }
    const rows = db
      .query(
        `SELECT
           o.*,
           (
             SELECT COUNT(*)
             FROM ontologies child
             WHERE child.parent_id = o.id
               AND ${childScopeSql}
           ) AS child_count,
           (
             SELECT COUNT(*)
             FROM ontology_properties op
             WHERE op.ontology_id = o.id
           ) AS property_count
         FROM ontologies o
         WHERE ${scopeSql}
         ${filterSql}
         ORDER BY COALESCE(o.sort_order, o.rowid), o.name`,
      )
      .all(...queryParams) as any[];
    return rows.map(mapOntologyRow);
  };
  const propertyScopeClause = (alias: string) => scopedProjectClause(alias);
  const propertyScopeParams = () => scopedProjectParams();
  const buildOntologyTree = (items: any[]) => {
    const nodeMap = new Map<string, any>();
    for (const item of items) {
      nodeMap.set(item.id, { ...item, children: [] });
    }
    const roots: any[] = [];
    for (const item of nodeMap.values()) {
      const parentId = item.parent_id || null;
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId).children.push(item);
      } else {
        roots.push(item);
      }
    }
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        const ao = Number.isFinite(Number(a.sort_order))
          ? Number(a.sort_order)
          : 0;
        const bo = Number.isFinite(Number(b.sort_order))
          ? Number(b.sort_order)
          : 0;
        if (ao !== bo) return ao - bo;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      for (const node of nodes) sortNodes(node.children || []);
    };
    sortNodes(roots);
    return roots;
  };
  const collectOntologySubtreeIds = (items: any[], rootId: string) => {
    const childrenByParent = new Map<string, any[]>();
    for (const item of items) {
      const parentId = item.parent_id || "";
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)?.push(item);
    }
    const result: string[] = [];
    const walk = (id: string) => {
      result.push(id);
      for (const child of childrenByParent.get(id) || []) {
        walk(child.id);
      }
    };
    walk(rootId);
    return result;
  };
  const parseCsvField = (raw: any) =>
    String(raw || "")
      .split("\u001f")
      .map((item: string) => item.trim())
      .filter(Boolean);

  const normalizeAlias = (raw: any) =>
    String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const normalizeAliasList = (raw: any): string[] => {
    const out: string[] = [];
    const pushAlias = (value: any) => {
      const token = normalizeAlias(value);
      if (token && !out.includes(token)) out.push(token);
    };
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) {
      raw.forEach(pushAlias);
      return out;
    }
    const text = String(raw || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushAlias);
        return out;
      }
    } catch {
      // not JSON, continue
    }
    pushAlias(text);
    return out;
  };

  const parseAliasStorage = (raw: any): string[] => {
    const normalized = normalizeAliasList(raw);
    if (normalized.length > 0) return normalized;
    return [];
  };

  const aliasArrayToStorage = (aliases: string[]) =>
    JSON.stringify(aliases.map((alias) => normalizeAlias(alias)));

  const arrayEquals = (a: string[], b: string[]) =>
    a.length === b.length && a.every((item, index) => item === b[index]);

  const findPropertyAliasConflict = (
    aliasTokens: string[],
    excludeId?: string,
  ) => {
    if (!aliasTokens.length) return null;
    const query = `SELECT id, alias FROM properties WHERE ${propertyScopeClause(
      "properties",
    )}${excludeId ? " AND id != ?" : ""}`;
    const params: any[] = [...propertyScopeParams()];
    if (excludeId) params.push(excludeId);
    const rows = db.query(query).all(...params) as any[];
    for (const row of rows) {
      const existingAliases = parseAliasStorage(row.alias);
      for (const token of aliasTokens) {
        if (existingAliases.includes(token)) return row.id;
      }
    }
    return null;
  };

  const findOntologyAliasConflict = (
    aliasTokens: string[],
    parentId: string | null,
    excludeId?: string,
  ) => {
    if (!aliasTokens.length) return null;
    const baseSql = parentId
      ? `SELECT id, alias FROM ontologies WHERE parent_id = ? AND id != ? AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)`
      : `SELECT id, alias FROM ontologies WHERE parent_id IS NULL AND id != ? AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)`;
    const params: any[] = parentId
      ? [parentId, excludeId, scopedProjectId, scopedProjectId]
      : [excludeId, scopedProjectId, scopedProjectId];
    const rows = db.query(baseSql).all(...params) as any[];
    for (const row of rows) {
      const existingAliases = parseAliasStorage(row.alias);
      for (const token of aliasTokens) {
        if (existingAliases.includes(token)) return row.id;
      }
    }
    return null;
  };

  if (url.pathname === "/api/kb/ontologies" && method === "GET") {
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "active").trim();
    return Response.json(getScopedOntologies(q, status));
  }

  if (url.pathname === "/api/kb/ontology/tree" && method === "GET") {
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "active").trim();
    const items = getScopedOntologies(q, status);
    return Response.json({
      items: buildOntologyTree(items),
      flat: items,
    });
  }

  if (url.pathname === "/api/kb/ontologies" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const id = body.id || `ontology/${crypto.randomUUID()}`;
      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim();
      const parentId = body.parent_id ? String(body.parent_id).trim() : null;
      const projectId = hasProjectScope
        ? scopedProjectId
        : body.project_id || null;
      const aliases = normalizeAliasList(body.alias || name);
      if (!name) return new Response("Missing name", { status: 400 });

      const duplicate = findOntologyAliasConflict(aliases, parentId);
      if (duplicate?.id) {
        const existingId = duplicate.id;
        const existingRow = db
          .query("SELECT alias FROM ontologies WHERE id = ?")
          .get(existingId) as any;
        const existingAliases = parseAliasStorage(existingRow?.alias);
        const normalizedNameAlias = normalizeAlias(name);
        const mergedAliases = Array.from(
          new Set([...existingAliases, ...aliases, normalizedNameAlias]),
        );
        const orderRow = parentId
          ? (db
              .query(
                "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ontologies WHERE parent_id = ? AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)",
              )
              .get(parentId, projectId, projectId) as any)
          : (db
              .query(
                "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ontologies WHERE parent_id IS NULL AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)",
              )
              .get(projectId, projectId) as any);
        const sortOrder = Number(orderRow?.max_order || 0) + 1;
        db.run(
          `UPDATE ontologies
           SET name = ?, alias = ?, description = ?, parent_id = ?, project_id = ?, sort_order = ?
           WHERE id = ?`,
          [
            name,
            aliasArrayToStorage(mergedAliases),
            description,
            parentId,
            projectId,
            sortOrder,
            existingId,
          ],
        );
        const updated = db
          .query("SELECT * FROM ontologies WHERE id = ?")
          .get(existingId) as any;
        return Response.json(mapOntologyRow(updated));
      }

      const orderRow = parentId
        ? (db
            .query(
              "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ontologies WHERE parent_id = ? AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)",
            )
            .get(parentId, projectId, projectId) as any)
        : (db
            .query(
              "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ontologies WHERE parent_id IS NULL AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)",
            )
            .get(projectId, projectId) as any);
      const sortOrder = Number(orderRow?.max_order || 0) + 1;

      db.run(
        "INSERT INTO ontologies (id, name, alias, description, parent_id, project_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          name,
          aliasArrayToStorage(aliases),
          description,
          parentId,
          projectId,
          sortOrder,
        ],
      );

      const created = db
        .query("SELECT * FROM ontologies WHERE id = ?")
        .get(id) as any;
      return Response.json(mapOntologyRow(created));
    } catch (e) {
      console.error(e);
      return new Response("Error creating ontology", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/ontologies/update" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const id = String(body.id || "").trim();
      if (!id) return new Response("Missing id", { status: 400 });

      const existing = hasProjectScope
        ? (db
            .query(
              `SELECT *
               FROM ontologies
               WHERE id = ?
                 AND project_id = ?`,
            )
            .get(id, scopedProjectId) as any)
        : (db
            .query(
              "SELECT * FROM ontologies WHERE id = ? AND project_id IS NULL",
            )
            .get(id) as any);
      if (!existing?.id)
        return new Response("Ontology not found", { status: 404 });

      const updates: string[] = [];
      const params: any[] = [];
      const name =
        body.name !== undefined ? String(body.name || "").trim() : undefined;
      const aliasTokens = normalizeAliasList(body.alias || name);
      if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
      }
      const existingAliases = parseAliasStorage(existing.alias);
      let aliasesToStore = existingAliases;
      if (aliasTokens.length > 0) {
        aliasesToStore = Array.from(
          new Set([...existingAliases, ...aliasTokens]),
        );
      }
      if (name !== undefined) {
        const newAliasToken = normalizeAlias(name);
        if (newAliasToken && !aliasesToStore.includes(newAliasToken)) {
          aliasesToStore.push(newAliasToken);
        }
      }
      const aliasNeedsWrite =
        aliasesToStore.length > 0 &&
        !arrayEquals(aliasesToStore, existingAliases);
      if (aliasNeedsWrite) {
        const parentId =
          body.parent_id !== undefined
            ? body.parent_id
              ? String(body.parent_id).trim()
              : null
            : existing.parent_id || null;
        const duplicate = findOntologyAliasConflict(
          aliasesToStore,
          parentId,
          id,
        );
        if (duplicate?.id) {
          return new Response("Ontology alias conflict", { status: 409 });
        }
        updates.push("alias = ?");
        params.push(aliasArrayToStorage(aliasesToStore));
      }
      if (body.description !== undefined) {
        updates.push("description = ?");
        params.push(String(body.description || "").trim());
      }
      if (body.parent_id !== undefined) {
        updates.push("parent_id = ?");
        params.push(body.parent_id ? String(body.parent_id).trim() : null);
      }
      if (body.sort_order !== undefined) {
        const sortOrder = Number(body.sort_order);
        updates.push("sort_order = ?");
        params.push(Number.isFinite(sortOrder) ? sortOrder : null);
      }
      if (hasProjectScope) {
        updates.push("project_id = COALESCE(project_id, ?)");
        params.push(scopedProjectId);
      }
      if (!updates.length) return Response.json({ ok: true });

      if (hasProjectScope) {
        params.push(id, scopedProjectId);
        db.run(
          `UPDATE ontologies
           SET ${updates.join(", ")}
           WHERE id = ?
             AND project_id = ?`,
          params,
        );
      } else {
        params.push(id);
        db.run(
          `UPDATE ontologies SET ${updates.join(", ")} WHERE id = ? AND project_id IS NULL`,
          params,
        );
      }

      const updated = db
        .query("SELECT * FROM ontologies WHERE id = ?")
        .get(id) as any;
      return Response.json(mapOntologyRow(updated));
    } catch (e) {
      console.error(e);
      return new Response("Error updating ontology", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/ontologies" && method === "DELETE") {
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return new Response("Missing id", { status: 400 });

    try {
      const allOntologies = getScopedOntologies("");
      const target = allOntologies.find((item) => item.id === id);
      if (!target) return new Response("Ontology not found", { status: 404 });

      const subtreeIds = collectOntologySubtreeIds(allOntologies, id);
      const softDeleteTxn = db.transaction((ids: string[]) => {
        for (const itemId of ids) {
          db.run("UPDATE ontologies SET status = 'deprecated' WHERE id = ?", [
            itemId,
          ]);
        }
      });
      softDeleteTxn(subtreeIds);
      return Response.json({ ok: true, deprecated: subtreeIds.length });
    } catch (e) {
      console.error(e);
      return new Response("Error deleting ontology", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/ontologies/clear" && method === "DELETE") {
    try {
      if (hasProjectScope) {
        db.transaction(() => {
          db.run(
            "DELETE FROM ontology_properties WHERE ontology_id IN (SELECT id FROM ontologies WHERE project_id = ?)",
            [scopedProjectId],
          );
          db.run(
            "DELETE FROM ontology_properties WHERE property_id IN (SELECT id FROM properties WHERE project_id = ?)",
            [scopedProjectId],
          );
          db.run("DELETE FROM properties WHERE project_id = ?", [
            scopedProjectId,
          ]);
          db.run("DELETE FROM ontologies WHERE project_id = ?", [
            scopedProjectId,
          ]);
        })();
      } else {
        db.transaction(() => {
          db.run(
            "DELETE FROM ontology_properties WHERE ontology_id IN (SELECT id FROM ontologies WHERE project_id IS NULL)",
            [],
          );
          db.run(
            "DELETE FROM ontology_properties WHERE property_id IN (SELECT id FROM properties WHERE project_id IS NULL)",
            [],
          );
          db.run("DELETE FROM properties WHERE project_id IS NULL", []);
          db.run("DELETE FROM ontologies WHERE project_id IS NULL", []);
        })();
      }
      return Response.json({ ok: true });
    } catch (e) {
      console.error(e);
      return new Response("Error clearing ontologies", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/ontology/property" && method === "GET") {
    const ontologyId = String(url.searchParams.get("ontology_id") || "").trim();
    if (!ontologyId)
      return new Response("Missing ontology_id", { status: 400 });
    try {
      const props = db
        .query(
          `SELECT p.*
           FROM properties p
           INNER JOIN ontology_properties op ON op.property_id = p.id
           WHERE op.ontology_id = ?
             AND ${propertyScopeClause("p")}
           ORDER BY p.name, p.id`,
        )
        .all(ontologyId, ...propertyScopeParams())
        .map((row: any) => ({
          id: row.id,
          name: row.name,
          label: row.name,
          datatype: row.datatype,
          valuetype: row.valuetype,
          types: parseTypes(row.types),
          description: row.description,
        }));
      return Response.json({ items: props });
    } catch (e) {
      console.error(e);
      return new Response("Error loading ontology properties", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/ontology/property" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const ontologyId = String(body.ontology_id || "").trim();
      const propertyId = String(body.property_id || "").trim();
      if (!ontologyId || !propertyId) {
        return new Response("Missing ontology_id or property_id", {
          status: 400,
        });
      }
      db.run(
        "INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)",
        [ontologyId, propertyId],
      );
      return Response.json({ ok: true });
    } catch (e) {
      console.error(e);
      return new Response("Error linking ontology property", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/ontology/property" && method === "DELETE") {
    const ontologyId = String(url.searchParams.get("ontology_id") || "").trim();
    const propertyId = String(url.searchParams.get("property_id") || "").trim();
    if (!ontologyId || !propertyId) {
      return new Response("Missing ontology_id or property_id", {
        status: 400,
      });
    }
    try {
      db.run(
        "DELETE FROM ontology_properties WHERE ontology_id = ? AND property_id = ?",
        [ontologyId, propertyId],
      );
      return Response.json({ ok: true });
    } catch (e) {
      console.error(e);
      return new Response("Error unlinking ontology property", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/classes" && method === "GET") {
    const q = url.searchParams.get("q") || "";
    const querySql = hasProjectScope
      ? `WITH RECURSIVE scoped_classes(id) AS (
           SELECT c.id
           FROM classes c
           WHERE c.project_id = ?
              OR (
                c.project_id IS NULL
                AND EXISTS (
                  SELECT 1
                  FROM entity_classes ec
                  INNER JOIN nodes n ON n.id = ec.entity_id
                  WHERE ec.class_id = c.id AND n.project_id = ?
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM entity_classes ec
                  INNER JOIN nodes n ON n.id = ec.entity_id
                  WHERE ec.class_id = c.id AND n.project_id <> ?
                )
              )
           UNION
           SELECT parent.id
           FROM classes parent
           INNER JOIN classes child ON child.parent_id = parent.id
           INNER JOIN scoped_classes scoped ON scoped.id = child.id
         )
         SELECT c.*, (
           SELECT COUNT(*)
           FROM entity_classes ec
           INNER JOIN nodes n ON n.id = ec.entity_id
           WHERE ec.class_id = c.id AND n.project_id = ?
         ) AS instance_count
         FROM classes c
         WHERE c.name LIKE ?
           AND c.id IN (SELECT id FROM scoped_classes)
         ORDER BY COALESCE(c.sort_order, c.rowid), c.name`
      : `SELECT c.*, (
           SELECT COUNT(*) FROM entity_classes ec WHERE ec.class_id = c.id
         ) AS instance_count
         FROM classes c
         WHERE c.name LIKE ?
         ORDER BY COALESCE(c.sort_order, c.rowid), c.name`;
    const classes = db
      .query(querySql)
      .all(
        ...(hasProjectScope
          ? [
              scopedProjectId,
              scopedProjectId,
              scopedProjectId,
              scopedProjectId,
              `%${q}%`,
            ]
          : [`%${q}%`]),
      )
      .map((row: any) => {
        let rowTags: string[] = [];
        try {
          rowTags = JSON.parse(row.tags || "[]");
        } catch {}
        return {
          id: row.id,
          name: row.name,
          label: row.name,
          description: row.description,
          parent: row.parent_id,
          project_id: row.project_id ?? null,
          color: row.color,
          image: row.image,
          sort_order: row.sort_order,
          instance_count: row.instance_count ?? 0,
          tags: rowTags,
        };
      });
    return Response.json(classes);
  }

  if (url.pathname === "/api/kb/classes" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const id = body.id || `class/${crypto.randomUUID()}`;
      const name = String(body.name || "New Class").trim();
      const desc = body.description || "";
      const parentId = body.parent_id || null;
      const projectId = hasProjectScope
        ? scopedProjectId
        : body.project_id || null;
      const color = body.color || null;
      const image = body.image || null;
      if (!name) return new Response("Missing name", { status: 400 });

      const existingClass = parentId
        ? (db
            .query(
              `SELECT *
               FROM classes
               WHERE name = ?
                 AND parent_id = ?
                 AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)
               LIMIT 1`,
            )
            .get(name, parentId, projectId, projectId) as any)
        : (db
            .query(
              `SELECT *
               FROM classes
               WHERE name = ?
                 AND parent_id IS NULL
                 AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)
               LIMIT 1`,
            )
            .get(name, projectId, projectId) as any);
      if (existingClass) {
        return Response.json({
          id: existingClass.id,
          name: existingClass.name,
          label: existingClass.name,
          description: existingClass.description,
          parent: existingClass.parent_id,
          project_id: existingClass.project_id ?? null,
          color: existingClass.color,
          image: existingClass.image,
          sort_order: existingClass.sort_order,
          deduped: true,
        });
      }

      const sortOrderRaw = body.sort_order;
      let sortOrder =
        typeof sortOrderRaw === "number" ? sortOrderRaw : Number(sortOrderRaw);

      if (!Number.isFinite(sortOrder)) {
        let querySql = "";
        let row: any = null;
        if (parentId) {
          querySql =
            "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM classes WHERE parent_id = ? AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)";
          row = db.query(querySql).get(parentId, projectId, projectId) as any;
        } else {
          querySql =
            "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM classes WHERE parent_id IS NULL AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)";
          row = db.query(querySql).get(projectId, projectId) as any;
        }
        sortOrder = (row?.max_order || 0) + 1;
      }

      db.run(
        "INSERT INTO classes (id, name, description, parent_id, project_id, color, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, desc, parentId, projectId, color, image, sortOrder],
      );

      const newClass = db
        .query("SELECT * FROM classes WHERE id = ?")
        .get(id) as any;
      return Response.json({
        id: newClass.id,
        name: newClass.name,
        label: newClass.name,
        description: newClass.description,
        parent: newClass.parent_id,
        project_id: newClass.project_id ?? null,
        color: newClass.color,
        image: newClass.image,
        sort_order: newClass.sort_order,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error creating class", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/classes/update" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const id = body.id;
      if (!id) return new Response("Missing id", { status: 400 });
      if (hasProjectScope) {
        const existing = db
          .query(
            "SELECT id, project_id FROM classes WHERE id = ? AND (project_id = ? OR project_id IS NULL)",
          )
          .get(id, scopedProjectId) as any;
        if (!existing) return new Response("Class not found", { status: 404 });
      }

      const updates = [];
      const params = [];

      if (body.name !== undefined) {
        updates.push("name = ?");
        params.push(body.name);
      }
      if (body.description !== undefined) {
        updates.push("description = ?");
        params.push(body.description);
      }
      if (body.parent_id !== undefined) {
        updates.push("parent_id = ?");
        params.push(body.parent_id);
      }
      if (body.color !== undefined) {
        updates.push("color = ?");
        params.push(body.color);
      }
      if (body.image !== undefined) {
        updates.push("image = ?");
        params.push(body.image);
      }
      if (body.sort_order !== undefined) {
        const orderVal =
          typeof body.sort_order === "number"
            ? body.sort_order
            : Number(body.sort_order);
        updates.push("sort_order = ?");
        params.push(Number.isFinite(orderVal) ? orderVal : null);
      }
      if (body.tags !== undefined) {
        updates.push("tags = ?");
        params.push(
          body.tags !== null
            ? JSON.stringify(Array.isArray(body.tags) ? body.tags : [])
            : null,
        );
      }
      if (hasProjectScope) {
        updates.push("project_id = COALESCE(project_id, ?)");
        params.push(scopedProjectId);
      }

      if (updates.length > 0) {
        if (hasProjectScope) {
          params.push(id, scopedProjectId);
          db.run(
            `UPDATE classes SET ${updates.join(", ")} WHERE id = ? AND (project_id = ? OR project_id IS NULL)`,
            params,
          );
        } else {
          params.push(id);
          db.run(
            `UPDATE classes SET ${updates.join(", ")} WHERE id = ?`,
            params,
          );
        }
      }

      const updatedClass = hasProjectScope
        ? (db
            .query("SELECT * FROM classes WHERE id = ? AND project_id = ?")
            .get(id, scopedProjectId) as any)
        : (db.query("SELECT * FROM classes WHERE id = ?").get(id) as any);
      if (!updatedClass)
        return new Response("Class not found", { status: 404 });
      let updatedClassTags = [];
      try {
        updatedClassTags = JSON.parse(updatedClass.tags || "[]");
      } catch {}
      return Response.json({
        id: updatedClass.id,
        name: updatedClass.name,
        label: updatedClass.name,
        description: updatedClass.description,
        parent: updatedClass.parent_id,
        project_id: updatedClass.project_id ?? null,
        color: updatedClass.color,
        image: updatedClass.image,
        sort_order: updatedClass.sort_order,
        tags: updatedClassTags,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error updating class", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/classes/reorder" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const updates = Array.isArray(body?.updates) ? body.updates : [];
      if (!updates.length) {
        return new Response("Missing updates", { status: 400 });
      }

      const stmt = hasProjectScope
        ? db.prepare(
            "UPDATE classes SET parent_id = ?, sort_order = ?, project_id = COALESCE(project_id, ?) WHERE id = ? AND (project_id = ? OR project_id IS NULL)",
          )
        : db.prepare(
            "UPDATE classes SET parent_id = ?, sort_order = ? WHERE id = ?",
          );
      const txn = db.transaction((rows: any[]) => {
        for (const row of rows) {
          if (!row?.id) continue;
          const pid = row.parent_id ?? null;
          const orderVal =
            typeof row.sort_order === "number"
              ? row.sort_order
              : Number(row.sort_order);
          const sort = Number.isFinite(orderVal) ? orderVal : null;
          if (hasProjectScope)
            stmt.run(pid, sort, scopedProjectId, row.id, scopedProjectId);
          else stmt.run(pid, sort, row.id);
        }
      });
      txn(updates);
      return Response.json({ ok: true, updated: updates.length });
    } catch (e) {
      console.error(e);
      return new Response("Error reordering classes", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/classes" && method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    try {
      if (hasProjectScope) {
        db.run(
          "DELETE FROM classes WHERE id = ? AND (project_id = ? OR project_id IS NULL)",
          [id, scopedProjectId],
        );
      } else {
        db.run("DELETE FROM classes WHERE id = ?", [id]);
      }
      return Response.json({ ok: true });
    } catch (e) {
      console.error(e);
      return new Response("Error deleting class", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/properties" && method === "GET") {
    const statusFilter = url.searchParams.get("status") || "active";
    const statusClause =
      statusFilter === "all"
        ? ""
        : statusFilter === "deprecated"
          ? " AND status = 'deprecated'"
          : " AND status = 'active'";
    const props = db
      .query(
        `SELECT * FROM properties WHERE ${propertyScopeClause("properties")}${statusClause}`,
      )
      .all(...propertyScopeParams())
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        alias: parseAliasStorage(row.alias).length
          ? parseAliasStorage(row.alias)
          : [normalizeAlias(row.name)],
        status: row.status || "active",
        label: row.name,
        datatype: row.datatype,
        valuetype: row.valuetype,
        types: parseTypes(row.types),
        description: row.description,
      }));
    return Response.json(props);
  }

  if (url.pathname === "/api/kb/property_create" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const name = body.name;
      const aliases = normalizeAliasList(body.alias || name);
      const datatype = body.datatype || "string";
      const valuetype = body.valuetype || null;
      const types = parseTypes(body.types);
      const description = String(body.description || "").trim();
      const ontologyIds = Array.isArray(body.ontology_ids)
        ? body.ontology_ids
            .map((item: any) => String(item || "").trim())
            .filter(Boolean)
        : [];
      const projectId = hasProjectScope ? scopedProjectId : null;

      if (!name) return new Response("Missing name", { status: 400 });

      const duplicate = findPropertyAliasConflict(aliases);
      if (duplicate?.id) {
        const existingId = duplicate.id;
        const existingProp = db
          .query(
            `SELECT id, alias FROM properties WHERE id = ? AND ${propertyScopeClause("properties")}`,
          )
          .get(existingId, ...propertyScopeParams()) as any;
        const existingAliases = parseAliasStorage(existingProp?.alias);
        const mergedAliases = Array.from(
          new Set([...existingAliases, ...aliases]),
        );
        db.run(
          `UPDATE properties
           SET name = ?, alias = ?, status = 'active', datatype = ?, valuetype = ?, types = ?, description = ?, project_id = ?
           WHERE id = ?`,
          [
            name,
            aliasArrayToStorage(mergedAliases),
            datatype,
            valuetype,
            JSON.stringify(types),
            description,
            projectId,
            existingId,
          ],
        );
        db.run("DELETE FROM ontology_properties WHERE property_id = ?", [
          existingId,
        ]);
        for (const ontologyId of ontologyIds) {
          db.run(
            "INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)",
            [ontologyId, existingId],
          );
        }

        const updatedProp = db
          .query(
            `SELECT * FROM properties WHERE id = ? AND ${propertyScopeClause("properties")}`,
          )
          .get(existingId, ...propertyScopeParams()) as any;
        return Response.json({
          id: updatedProp.id,
          name: updatedProp.name,
          alias: parseAliasStorage(updatedProp.alias).length
            ? parseAliasStorage(updatedProp.alias)
            : [normalizeAlias(updatedProp.name)],
          label: updatedProp.name,
          datatype: updatedProp.datatype,
          valuetype: updatedProp.valuetype,
          types: parseTypes(updatedProp.types),
          description: updatedProp.description,
        });
      }

      const maxIdResult = db
        .query(
          "SELECT MAX(CAST(id AS INTEGER)) as maxId FROM properties WHERE id GLOB '[0-9]*'",
        )
        .get() as any;
      const nextId = (maxIdResult?.maxId || 0) + 1;
      const id = nextId.toString();

      db.run(
        "INSERT INTO properties (id, name, alias, status, datatype, valuetype, types, description, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          name,
          aliasArrayToStorage(aliases),
          "active",
          datatype,
          valuetype,
          JSON.stringify(types),
          description,
          projectId,
        ],
      );
      for (const ontologyId of ontologyIds) {
        db.run(
          "INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)",
          [ontologyId, id],
        );
      }

      const newProp = db
        .query(
          `SELECT * FROM properties WHERE id = ? AND ${propertyScopeClause("properties")}`,
        )
        .get(id, ...propertyScopeParams()) as any;
      return Response.json({
        id: newProp.id,
        name: newProp.name,
        alias: parseAliasStorage(newProp.alias).length
          ? parseAliasStorage(newProp.alias)
          : [normalizeAlias(newProp.name)],
        label: newProp.name,
        datatype: newProp.datatype,
        valuetype: newProp.valuetype,
        types: parseTypes(newProp.types),
        description: newProp.description,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error creating property", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/property_update" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const id = body.id;
      const name = body.name;
      const aliasTokens = normalizeAliasList(body.alias);
      const datatype = body.datatype;
      const valuetype = body.valuetype;
      const types = body.types;
      const ontologyIds = Array.isArray(body.ontology_ids)
        ? body.ontology_ids
            .map((item: any) => String(item || "").trim())
            .filter(Boolean)
        : null;

      if (!id) return new Response("Missing id", { status: 400 });
      const existingProp = db
        .query(
          `SELECT * FROM properties WHERE id = ? AND ${propertyScopeClause("properties")}`,
        )
        .get(id, ...propertyScopeParams()) as any;
      if (!existingProp?.id) {
        return new Response("Property not found", { status: 404 });
      }

      const status = body.status
        ? String(body.status || "")
            .trim()
            .toLowerCase()
        : undefined;
      const updates = [];
      const params = [];

      const existingAliases = parseAliasStorage(existingProp.alias);
      const existingAliasRaw = String(existingProp.alias || "").trim();
      const existingAliasJson = existingAliasRaw
        ? JSON.stringify(existingAliases)
        : "";
      const aliasNeedsNormalization =
        existingAliasRaw && existingAliasRaw !== existingAliasJson;
      const nameChanged =
        name !== undefined && String(name || "").trim() !== existingProp.name;
      let aliasesToStore = existingAliases;
      if (aliasTokens.length > 0) {
        aliasesToStore = Array.from(
          new Set([...existingAliases, ...aliasTokens]),
        );
      }
      if (nameChanged) {
        const newAliasToken = normalizeAlias(name);
        if (newAliasToken && !aliasesToStore.includes(newAliasToken)) {
          aliasesToStore.push(newAliasToken);
        }
      }
      if (existingProp.status === "deprecated") {
        if (status !== "active") {
          return new Response(
            "Deprecated properties can only be restored by setting status=active",
            { status: 400 },
          );
        }
        if (
          aliasTokens.length > 0 ||
          name !== undefined ||
          datatype !== undefined ||
          valuetype !== undefined ||
          types !== undefined ||
          ontologyIds !== null
        ) {
          return new Response(
            "Deprecated properties cannot be edited except for restoration",
            { status: 400 },
          );
        }
        updates.push("status = ?");
        params.push("active");
      } else {
        const aliasNeedsWrite =
          aliasNeedsNormalization ||
          (aliasesToStore.length > 0 &&
            !arrayEquals(aliasesToStore, existingAliases));
        if (aliasNeedsWrite) {
          const duplicate = findPropertyAliasConflict(aliasesToStore, id);
          if (duplicate) {
            return new Response("Property alias conflict", { status: 409 });
          }
          updates.push("alias = ?");
          params.push(aliasArrayToStorage(aliasesToStore));
        }
        if (name !== undefined) {
          updates.push("name = ?");
          params.push(name);
        }
        if (datatype !== undefined) {
          updates.push("datatype = ?");
          params.push(datatype);
        }
        if (valuetype !== undefined) {
          updates.push("valuetype = ?");
          params.push(valuetype);
        }
        if (types !== undefined) {
          updates.push("types = ?");
          params.push(JSON.stringify(parseTypes(types)));
        }
        if (status !== undefined) {
          const normalizedStatus =
            status === "deprecated" ? "deprecated" : "active";
          updates.push("status = ?");
          params.push(normalizedStatus);
        }
      }

      if (updates.length > 0) {
        params.push(id, ...propertyScopeParams());
        db.run(
          `UPDATE properties SET ${updates.join(", ")} WHERE id = ? AND ${propertyScopeClause("properties")}`,
          params,
        );
      }

      if (ontologyIds) {
        db.run("DELETE FROM ontology_properties WHERE property_id = ?", [id]);
        for (const ontologyId of ontologyIds) {
          db.run(
            "INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)",
            [ontologyId, id],
          );
        }
      }

      return Response.json({ ok: true });
    } catch (e) {
      console.error(e);
      return new Response("Error updating property", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/property_delete" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const id = body.id;
      if (!id) return new Response("Missing id", { status: 400 });

      db.run(
        `UPDATE properties SET status = 'deprecated' WHERE id = ? AND ${propertyScopeClause("properties")}`,
        [id, ...propertyScopeParams()],
      );
      return Response.json({ ok: true });
    } catch (e) {
      console.error(e);
      return new Response("Error deleting property", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/property_search" && method === "GET") {
    const q = url.searchParams.get("q") || "";
    const classIdRaw = (url.searchParams.get("class_id") || "").trim();
    const typeNameRaw = (url.searchParams.get("type_name") || "").trim();
    const ontologyIdRaw = (url.searchParams.get("ontology_id") || "").trim();
    const associationMode = (url.searchParams.get("association_mode") || "all")
      .trim()
      .toLowerCase();
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const propertyHasStatus = (() => {
      try {
        const cols = db.query("PRAGMA table_info(properties)").all() as any[];
        return cols.some((row) => (row?.name || row?.[1]) === "status");
      } catch {
        return false;
      }
    })();

    const status = (url.searchParams.get("status") || "active").toLowerCase();
    const showDeprecated = status === "all" || status === "deprecated";
    const statusClause = propertyHasStatus
      ? status === "all"
        ? ""
        : status === "deprecated"
          ? " AND p.status = 'deprecated'"
          : " AND p.status = 'active'"
      : status === "deprecated"
        ? " AND 0 = 1"
        : "";
    const whereParts: string[] = [
      propertyScopeClause("p") + statusClause,
      "(p.name LIKE ? OR p.alias LIKE ? OR p.id LIKE ?)",
    ];
    const params: any[] = [
      ...propertyScopeParams(),
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
    ];
    const countParams: any[] = [
      ...propertyScopeParams(),
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
    ];

    if (classIdRaw) {
      whereParts.push(
        "p.id IN (SELECT property_id FROM class_properties WHERE class_id = ?)",
      );
      params.push(classIdRaw);
      countParams.push(classIdRaw);
    }

    if (typeNameRaw) {
      const normalizedType = typeNameRaw
        .toLowerCase()
        .replace(/["%_]/g, "")
        .trim();
      if (normalizedType) {
        whereParts.push(
          "(EXISTS (SELECT 1 FROM json_each(COALESCE(types, '[]')) jt WHERE LOWER(TRIM(CAST(jt.value AS TEXT))) = ?))",
        );
        params.push(normalizedType);
        countParams.push(normalizedType);
      }
    }

    if (ontologyIdRaw && associationMode === "linked") {
      whereParts.push(
        "EXISTS (SELECT 1 FROM ontology_properties opf WHERE opf.property_id = p.id AND opf.ontology_id = ?)",
      );
      params.push(ontologyIdRaw);
      countParams.push(ontologyIdRaw);
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    const selectParams: any[] = [];
    if (hasProjectScope) {
      selectParams.push(scopedProjectId, scopedProjectId);
    }
    if (ontologyIdRaw) {
      selectParams.push(ontologyIdRaw);
    }
    selectParams.push(...params, limit, offset);

    const props = db
      .query(
        `SELECT
           p.*,
           (
             SELECT GROUP_CONCAT(op.ontology_id, char(31))
             FROM ontology_properties op
             INNER JOIN ontologies o ON o.id = op.ontology_id
             WHERE op.property_id = p.id
               AND ${scopedProjectClause("o")}
           ) AS ontology_ids_csv,
           (
             SELECT GROUP_CONCAT(o.name, char(31))
             FROM ontology_properties op
             INNER JOIN ontologies o ON o.id = op.ontology_id
             WHERE op.property_id = p.id
               AND ${scopedProjectClause("o")}
           ) AS ontology_names_csv,
           ${
             ontologyIdRaw
               ? "EXISTS (SELECT 1 FROM ontology_properties opm WHERE opm.property_id = p.id AND opm.ontology_id = ?) AS linked_to_ontology,"
               : ""
           }
           p.id AS property_identity
         FROM properties p
         ${whereSql}
         LIMIT ? OFFSET ?`,
      )
      .all(...selectParams)
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        alias: parseAliasStorage(row.alias).length
          ? parseAliasStorage(row.alias)
          : [normalizeAlias(row.name)],
        status: row.status || "active",
        label: row.name,
        datatype: row.datatype,
        valuetype: row.valuetype,
        types: parseTypes(row.types),
        description: row.description,
        ontology_ids: parseCsvField(row.ontology_ids_csv),
        ontology_names: parseCsvField(row.ontology_names_csv),
        linked_to_ontology:
          ontologyIdRaw && row.linked_to_ontology !== undefined
            ? row.linked_to_ontology === 1
            : false,
      }));

    const total = db
      .query(`SELECT COUNT(*) as count FROM properties p ${whereSql}`)
      .get(...countParams) as any;

    return Response.json({ items: props, total: total.count });
  }

  if (url.pathname === "/api/kb/subclass") {
    return Response.json([]);
  }

  if (url.pathname === "/api/kb/class/schema") {
    if (method === "POST") {
      try {
        const body = (await req.json()) as any;
        const classId = body.class_id;
        const propertyId = body.property_id;

        if (!classId || !propertyId) {
          return new Response("Missing class_id or property_id", {
            status: 400,
          });
        }

        db.run(
          "INSERT OR IGNORE INTO class_properties (class_id, property_id) VALUES (?, ?)",
          [classId, propertyId],
        );
        return Response.json({ ok: true });
      } catch (e) {
        console.error(e);
        return new Response("Error adding class schema", { status: 500 });
      }
    }

    if (method === "GET") {
      const classId = url.searchParams.get("class_id");
      if (!classId) return new Response("Missing class_id", { status: 400 });

      const props = db
        .query(
          `
            WITH RECURSIVE ancestors(id) AS (
                SELECT id FROM classes WHERE id = ?
                UNION ALL
                SELECT c.parent_id FROM classes c, ancestors a WHERE c.id = a.id AND c.parent_id IS NOT NULL
            )
            SELECT p.*, MAX(CASE WHEN cp.class_id = ? THEN 1 ELSE 0 END) as is_local
            FROM properties p
            JOIN class_properties cp ON p.id = cp.property_id
            WHERE cp.class_id IN (SELECT id FROM ancestors)
              AND ${propertyScopeClause("p")}
            GROUP BY p.id
          `,
        )
        .all(classId, classId, ...propertyScopeParams())
        .map((row: any) => {
          const qualifiers = db
            .query(
              `
                SELECT p.* 
                FROM properties p
                JOIN property_properties pp ON p.id = pp.child_property_id
                WHERE pp.parent_property_id = ?
                  AND ${propertyScopeClause("p")}
              `,
            )
            .all(row.id, ...propertyScopeParams())
            .map((q: any) => ({
              id: q.id,
              name: q.name,
              label: q.name,
              datatype: q.datatype,
              valuetype: q.valuetype,
              types: parseTypes(q.types),
              description: q.description,
            }));

          return {
            id: row.id,
            name: row.name,
            label: row.name,
            datatype: row.datatype,
            valuetype: row.valuetype,
            types: parseTypes(row.types),
            description: row.description,
            is_local: row.is_local === 1,
            qualifiers,
          };
        });

      return Response.json({ items: props });
    }

    if (method === "DELETE") {
      const classId = url.searchParams.get("class_id");
      const propertyId = url.searchParams.get("property_id");

      if (!classId || !propertyId) {
        return new Response("Missing class_id or property_id", { status: 400 });
      }

      db.run(
        "DELETE FROM class_properties WHERE class_id = ? AND property_id = ?",
        [classId, propertyId],
      );
      return Response.json({ ok: true });
    }
  }

  if (url.pathname === "/api/kb/property/qualifier") {
    if (method === "POST") {
      try {
        const body = (await req.json()) as any;
        const parentId = body.parent_id;
        const childId = body.child_id;

        if (!parentId || !childId) {
          return new Response("Missing parent_id or child_id", { status: 400 });
        }

        db.run(
          "INSERT OR IGNORE INTO property_properties (parent_property_id, child_property_id) VALUES (?, ?)",
          [parentId, childId],
        );
        return Response.json({ ok: true });
      } catch (e) {
        console.error(e);
        return new Response("Error adding property qualifier", { status: 500 });
      }
    }

    if (method === "DELETE") {
      const parentId = url.searchParams.get("parent_id");
      const childId = url.searchParams.get("child_id");

      if (!parentId || !childId) {
        return new Response("Missing parent_id or child_id", { status: 400 });
      }

      db.run(
        "DELETE FROM property_properties WHERE parent_property_id = ? AND child_property_id = ?",
        [parentId, childId],
      );
      return Response.json({ ok: true });
    }
  }

  if (url.pathname === "/api/kb/entity/class") {
    if (method === "POST") {
      try {
        const body = (await req.json()) as any;
        const entityId = body.entity_id;
        const classId = body.class_id;

        if (!entityId || !classId) {
          return new Response("Missing entity_id or class_id", { status: 400 });
        }

        const dbEntityId = entityId.replace("entity/", "");
        db.run(
          "INSERT OR IGNORE INTO entity_classes (entity_id, class_id) VALUES (?, ?)",
          [dbEntityId, classId],
        );

        try {
          const attrs = db
            .query("SELECT key FROM attributes WHERE node_id = ?")
            .all(dbEntityId) as any[];
          for (const attr of attrs) {
            if (attr.key) {
              db.run(
                "INSERT OR IGNORE INTO class_properties (class_id, property_id) VALUES (?, ?)",
                [classId, attr.key],
              );
            }
          }
        } catch (err) {
          console.warn(
            "Failed to auto-associate attributes to class schema",
            err,
          );
        }

        return Response.json({ ok: true });
      } catch (e) {
        console.error(e);
        return new Response("Error setting entity class", { status: 500 });
      }
    }

    if (method === "DELETE") {
      const entityId = url.searchParams.get("entity_id");
      const classId = url.searchParams.get("class_id");
      if (!entityId) return new Response("Missing entity_id", { status: 400 });

      const dbEntityId = entityId.replace("entity/", "");
      if (classId) {
        db.run(
          "DELETE FROM entity_classes WHERE entity_id = ? AND class_id = ?",
          [dbEntityId, classId],
        );
      } else {
        db.run("DELETE FROM entity_classes WHERE entity_id = ?", [dbEntityId]);
      }
      return Response.json({ ok: true });
    }

    const entityId =
      url.searchParams.get("id") || url.searchParams.get("entity_id");
    if (!entityId) return new Response("Missing entity_id", { status: 400 });

    const dbEntityId = entityId.replace("entity/", "");
    const classes = db
      .query(
        `
          SELECT c.* FROM classes c
          JOIN entity_classes ec ON c.id = ec.class_id
          WHERE ec.entity_id = ?
        `,
      )
      .all(dbEntityId)
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        label: row.name,
        description: row.description,
        color: row.color,
      }));

    return Response.json({ items: classes });
  }

  if (url.pathname.startsWith("/api/kb/clean/tasks")) {
    if (method === "GET") return Response.json([]);
    return Response.json({});
  }

  if (
    url.pathname === "/api/kb/property/value_suggestions" &&
    method === "GET"
  ) {
    const prop = url.searchParams.get("property") || "";
    const entityIdParam = url.searchParams.get("entity_id") || "";
    let limit = parseInt(url.searchParams.get("limit") || "20");
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    if (!prop) {
      return Response.json({ items: [] });
    }

    const keysToCheck = new Set<string>();
    keysToCheck.add(prop);

    if (prop.startsWith("property/")) {
      keysToCheck.add(prop.substring(9));
    }

    Array.from(keysToCheck).forEach((k) => {
      if (/^\d+$/.test(k)) {
        keysToCheck.add("P" + k);
      } else if (/^P\d+$/.test(k)) {
        keysToCheck.add(k.substring(1));
      }
    });

    const propKeys = Array.from(keysToCheck);
    const propPlaceholders = propKeys.map((_, i) => `$p${i}`).join(",");

    let entityId = entityIdParam;
    if (entityId.startsWith("entity/")) {
      entityId = entityId.substring(7);
    }

    let classIds: string[] = [];
    if (entityId) {
      const classes = db
        .query("SELECT class_id FROM entity_classes WHERE entity_id = ?")
        .all(entityId) as any[];
      classIds = classes.map((c) => c.class_id);
    }

    let sql = "";
    const params: Record<string, any> = {};
    propKeys.forEach((k, i) => {
      params[`$p${i}`] = k;
    });
    params.$limit = limit;

    if (classIds.length > 0) {
      const classPlaceholders = classIds.map((_, i) => `$c${i}`).join(",");
      classIds.forEach((id, i) => {
        params[`$c${i}`] = id;
      });

      sql = `
        SELECT target_id as id, MAX(target_label) as label, COUNT(*) as count
        FROM (
            SELECT REPLACE(json_extract(a.value, '$.id'), 'entity/', '') as target_id, n.name as target_label
            FROM attributes a
            JOIN entity_classes ec ON REPLACE(a.node_id, 'entity/', '') = ec.entity_id
            LEFT JOIN nodes n ON REPLACE(json_extract(a.value, '$.id'), 'entity/', '') = n.id
            WHERE a.key IN (${propPlaceholders})
              AND a.datatype = 'wikibase-entityid'
              AND ec.class_id IN (${classPlaceholders})

            UNION ALL

            SELECT json_extract(a.value, '$') as target_id, json_extract(a.value, '$') as target_label
            FROM attributes a
            JOIN entity_classes ec ON REPLACE(a.node_id, 'entity/', '') = ec.entity_id
            WHERE a.key IN (${propPlaceholders})
              AND a.datatype = 'string'
              AND ec.class_id IN (${classPlaceholders})
        ) as combined
        WHERE target_id IS NOT NULL
        GROUP BY target_id
        ORDER BY count DESC
        LIMIT $limit
      `;
    } else {
      sql = `
        SELECT target_id as id, MAX(target_label) as label, COUNT(*) as count
        FROM (
            SELECT REPLACE(json_extract(value, '$.id'), 'entity/', '') as target_id, n.name as target_label
            FROM attributes a
            LEFT JOIN nodes n ON REPLACE(json_extract(a.value, '$.id'), 'entity/', '') = n.id
            WHERE key IN (${propPlaceholders})
              AND datatype = 'wikibase-entityid'

            UNION ALL

            SELECT json_extract(value, '$') as target_id, json_extract(value, '$') as target_label
            FROM attributes
            WHERE key IN (${propPlaceholders})
              AND datatype = 'string'
        ) as combined
        WHERE target_id IS NOT NULL
        GROUP BY target_id
        ORDER BY count DESC
        LIMIT $limit
      `;
    }

    const items = db.query(sql).all(params);
    return Response.json({ items });
  }

  // 分类图片上传 API
  if (url.pathname === "/api/kb/classes/upload-image" && method === "POST") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response("No file uploaded", { status: 400 });
      }

      // 生成唯一文件名
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const allowedExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"];
      if (!allowedExts.includes(ext)) {
        return new Response("Invalid file type", { status: 400 });
      }
      const filename = `${crypto.randomUUID()}.${ext}`;
      const filePath = resolve(CLASS_IMAGES_DIR, filename);

      // 保存文件
      const arrayBuffer = await file.arrayBuffer();
      writeFileSync(filePath, Buffer.from(arrayBuffer));

      // 返回访问 URL
      const imageUrl = `/static/uploads/class-images/${filename}`;
      return Response.json({ url: imageUrl });
    } catch (e) {
      console.error(e);
      return new Response("Error uploading image", { status: 500 });
    }
  }

  return null;
}
