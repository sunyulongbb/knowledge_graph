import { db, getProjectByIdentifier } from "../db.ts";
import {
  formatNode,
  formatAttribute,
  formatEdge,
  normalizeEntryValueList,
  ensureNodeByName,
  canonicalizePropertyKey,
  ensurePropertyRecord,
  ensureAttributeRecord,
  getNextNumericNodeId,
  parseStoredAttributeValues,
  attributeValuesContainEntityId,
  extractEntityId,
} from "../utils.ts";

type EntityAttributeValue = {
  [key: string]: any;
};

export async function handleCoreKbRoutes(
  req: Request,
  url: URL,
  method: string,
) {
  const dbParam = (url.searchParams.get("db") || "").trim();
  const scopedProject =
    dbParam && dbParam !== "app" ? getProjectByIdentifier(dbParam) : null;
  const scopedProjectId = Number(scopedProject?.id || 0) || null;
  const hasProjectScope = scopedProjectId !== null;
  const scopedClause = (alias = "") => {
    const prefix = alias ? `${alias}.` : "";
    return `${prefix}project_id = ?`;
  };
  const applyScope = <T extends any[]>(params: T) =>
    hasProjectScope ? [...params, scopedProjectId] : params;
  const entryTaskScopeClause = (alias = "t") => {
    const prefix = alias ? `${alias}.` : "";
    return hasProjectScope
      ? `${prefix}project_id = ?`
      : `${prefix}project_id IS NULL`;
  };
  const entryTaskScopeParams = () => (hasProjectScope ? [scopedProjectId] : []);
  const mapEntryTaskRow = (row: any) => {
    let schema = [];
    let rows = [];
    let lastImportSummary = null;
    try {
      schema = JSON.parse(row?.schema_json || "[]");
    } catch {}
    try {
      rows = JSON.parse(row?.rows_json || "[]");
    } catch {}
    try {
      lastImportSummary = row?.last_import_summary
        ? JSON.parse(row.last_import_summary)
        : null;
    } catch {
      lastImportSummary = null;
    }
    return {
      id: row.id,
      name: row.name || "",
      mode: row.mode || "entity_sheet",
      project_id: row.project_id ?? null,
      schema: Array.isArray(schema) ? schema : [],
      rows: Array.isArray(rows) ? rows : [],
      row_count: Array.isArray(rows) ? rows.length : 0,
      last_imported_at: row.last_imported_at || null,
      last_import_summary: lastImportSummary,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  };

  const parsePropertyTypes = (raw: any): string[] => {
    if (!raw && raw !== "") return [];
    if (Array.isArray(raw)) {
      return raw
        .map((item: any) => (item ?? "").toString().trim())
        .filter(Boolean);
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

  const syncPropertyTypeForNode = (propertyId: string, nodeId: string) => {
    const pid = (propertyId || "").toString().trim();
    const nid = (nodeId || "")
      .toString()
      .trim()
      .replace(/^entity\//, "");
    if (!pid || !nid) return;
    try {
      const nodeRow = hasProjectScope
        ? (db
            .query(`SELECT type FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(nid, scopedProjectId) as any)
        : (db.query("SELECT type FROM nodes WHERE id = ?").get(nid) as any);
      const typeName = (nodeRow?.type || "").toString().trim();
      if (!typeName) return;

      const propRow = hasProjectScope
        ? (db
            .query(
              "SELECT types FROM properties WHERE id = ? AND project_id = ? LIMIT 1",
            )
            .get(pid, scopedProjectId) as any)
        : (db
            .query(
              "SELECT types FROM properties WHERE id = ? AND project_id IS NULL LIMIT 1",
            )
            .get(pid) as any);
      if (!propRow) return;

      const merged = Array.from(
        new Set([...parsePropertyTypes(propRow.types), typeName]),
      );
      if (hasProjectScope) {
        db.run(
          "UPDATE properties SET types = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?",
          [JSON.stringify(merged), pid, scopedProjectId],
        );
      } else {
        db.run(
          "UPDATE properties SET types = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id IS NULL",
          [JSON.stringify(merged), pid],
        );
      }
    } catch (err) {
      console.warn("syncPropertyTypeForNode failed", err);
    }
  };

  const syncAllPropertyTypesForNode = (nodeId: string) => {
    const nid = (nodeId || "")
      .toString()
      .trim()
      .replace(/^entity\//, "");
    if (!nid) return;
    try {
      const rows = db
        .query("SELECT DISTINCT key FROM attributes WHERE node_id = ?")
        .all(nid) as any[];
      for (const row of rows) {
        const key = (row?.key || "").toString().trim();
        if (!key) continue;
        syncPropertyTypeForNode(key, nid);
      }
    } catch (err) {
      console.warn("syncAllPropertyTypesForNode failed", err);
    }
  };

  const ensureClassRecord = (className: string): string | null => {
    const normalized = (className || "").toString().trim();
    if (!normalized) return null;
    try {
      const existing = hasProjectScope
        ? (db
            .query(
              `SELECT id
               FROM classes
               WHERE lower(name) = lower(?)
                 AND project_id = ?
               LIMIT 1`,
            )
            .get(normalized, scopedProjectId) as any)
        : (db
            .query(
              "SELECT id FROM classes WHERE lower(name) = lower(?) AND project_id IS NULL LIMIT 1",
            )
            .get(normalized) as any);
      if (existing?.id) return String(existing.id);

      const id = `class/${crypto.randomUUID()}`;
      const sortRow = hasProjectScope
        ? (db
            .query(
              "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM classes WHERE project_id = ?",
            )
            .get(scopedProjectId) as any)
        : (db
            .query(
              "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM classes WHERE project_id IS NULL",
            )
            .get() as any);
      db.run(
        "INSERT INTO classes (id, name, description, parent_id, project_id, sort_order) VALUES (?, ?, '', NULL, ?, ?)",
        [
          id,
          normalized,
          hasProjectScope ? scopedProjectId : null,
          Number(sortRow?.max_order || 0) + 1,
        ],
      );
      return id;
    } catch (err) {
      console.warn("ensureClassRecord failed", err);
      try {
        const fallback = hasProjectScope
          ? (db
              .query(
                "SELECT id FROM classes WHERE lower(name) = lower(?) AND project_id = ? LIMIT 1",
              )
              .get(normalized, scopedProjectId) as any)
          : (db
              .query(
                "SELECT id FROM classes WHERE lower(name) = lower(?) AND project_id IS NULL LIMIT 1",
              )
              .get(normalized) as any);
        return fallback?.id ? String(fallback.id) : null;
      } catch {
        return null;
      }
    }
  };

  const assignNodeClass = (nodeId: string, classId: string) => {
    const nid = (nodeId || "")
      .toString()
      .trim()
      .replace(/^entity\//, "");
    const cid = (classId || "").toString().trim();
    if (!nid || !cid) return;
    try {
      db.run(
        "INSERT OR IGNORE INTO entity_classes (entity_id, class_id) VALUES (?, ?)",
        [nid, cid],
      );
    } catch (err) {
      console.warn("assignNodeClass failed", err);
    }
  };

  const ensureOntologyRecord = (ontologyName: string): string | null => {
    const normalized = (ontologyName || "").toString().trim();
    if (!normalized) return null;
    try {
      const existing = hasProjectScope
        ? (db
            .query(
              `SELECT id
               FROM ontologies
               WHERE lower(name) = lower(?)
                 AND project_id = ?
               LIMIT 1`,
            )
            .get(normalized, scopedProjectId) as any)
        : (db
            .query(
              "SELECT id FROM ontologies WHERE lower(name) = lower(?) AND project_id IS NULL LIMIT 1",
            )
            .get(normalized) as any);
      if (existing?.id) return String(existing.id);

      const id = `ontology/${crypto.randomUUID()}`;
      const sortRow = hasProjectScope
        ? (db
            .query(
              "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ontologies WHERE project_id = ?",
            )
            .get(scopedProjectId) as any)
        : (db
            .query(
              "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ontologies WHERE project_id IS NULL",
            )
            .get() as any);
      db.run(
        "INSERT INTO ontologies (id, name, description, parent_id, project_id, sort_order) VALUES (?, ?, '', NULL, ?, ?)",
        [
          id,
          normalized,
          hasProjectScope ? scopedProjectId : null,
          Number(sortRow?.max_order || 0) + 1,
        ],
      );
      return id;
    } catch (err) {
      console.warn("ensureOntologyRecord failed", err);
      try {
        const fallback = hasProjectScope
          ? (db
              .query(
                "SELECT id FROM ontologies WHERE lower(name) = lower(?) AND project_id = ? LIMIT 1",
              )
              .get(normalized, scopedProjectId) as any)
          : (db
              .query(
                "SELECT id FROM ontologies WHERE lower(name) = lower(?) AND project_id IS NULL LIMIT 1",
              )
              .get(normalized) as any);
        return fallback?.id ? String(fallback.id) : null;
      } catch {
        return null;
      }
    }
  };

  const linkOntologyProperty = (ontologyId: string, propertyId: string) => {
    const oid = (ontologyId || "").toString().trim();
    const pid = (propertyId || "").toString().trim();
    if (!oid || !pid) return;
    try {
      db.run(
        "INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)",
        [oid, pid],
      );
    } catch (err) {
      console.warn("linkOntologyProperty failed", err);
    }
  };

  const syncNodeTypeLabel = (nodeId: string, typeName: string) => {
    const nid = (nodeId || "")
      .toString()
      .trim()
      .replace(/^entity\//, "");
    const normalizedType = (typeName || "").toString().trim();
    if (!nid || !normalizedType) return;
    try {
      const node = hasProjectScope
        ? (db
            .query(
              `SELECT id, type FROM nodes WHERE id = ? AND ${scopedClause()}`,
            )
            .get(nid, scopedProjectId) as any)
        : (db.query("SELECT id, type FROM nodes WHERE id = ?").get(nid) as any);
      if (!node?.id) return;
      const currentType = (node.type || "").toString().trim();
      if (currentType === normalizedType) return;
      db.run(
        "UPDATE nodes SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [normalizedType, nid],
      );
    } catch (err) {
      console.warn("syncNodeTypeLabel failed", err);
    }
  };

  const syncRelationPropertyModel = (
    propertyId: string,
    headTypeName: string,
    tailTypeName: string,
  ) => {
    const pid = (propertyId || "").toString().trim();
    const sourceType = (headTypeName || "").toString().trim();
    const targetType = (tailTypeName || "").toString().trim();
    if (!pid) return;
    try {
      const prop = hasProjectScope
        ? (db
            .query(
              "SELECT id, types, description FROM properties WHERE id = ? AND project_id = ? LIMIT 1",
            )
            .get(pid, scopedProjectId) as any)
        : (db
            .query(
              "SELECT id, types, description FROM properties WHERE id = ? AND project_id IS NULL LIMIT 1",
            )
            .get(pid) as any);
      if (!prop?.id) return;

      const mergedTypes = Array.from(
        new Set([
          ...parsePropertyTypes(prop.types),
          ...(sourceType ? [sourceType] : []),
          ...(targetType ? [targetType] : []),
        ]),
      );

      const descParts = new Set(
        String(prop.description || "")
          .split(/\n+/)
          .map((item) => item.trim())
          .filter(Boolean),
      );
      if (targetType) {
        descParts.add(`目标类型: ${targetType}`);
      }

      if (hasProjectScope) {
        db.run(
          "UPDATE properties SET datatype = ?, valuetype = ?, types = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?",
          [
            "wikibase-entityid",
            "wikibase-entityid",
            JSON.stringify(mergedTypes),
            Array.from(descParts).join("\n"),
            pid,
            scopedProjectId,
          ],
        );
      } else {
        db.run(
          "UPDATE properties SET datatype = ?, valuetype = ?, types = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id IS NULL",
          [
            "wikibase-entityid",
            "wikibase-entityid",
            JSON.stringify(mergedTypes),
            Array.from(descParts).join("\n"),
            pid,
          ],
        );
      }
    } catch (err) {
      console.warn("syncRelationPropertyModel failed", err);
    }
  };

  const ensureRelationSchema = (
    headNodeId: string,
    headTypeName: string,
    propertyId: string,
    tailNodeId: string,
    tailTypeName: string,
  ) => {
    const sourceType = (headTypeName || "").toString().trim();
    const targetType = (tailTypeName || "").toString().trim();
    let headOntologyId: string | null = null;
    let tailOntologyId: string | null = null;
    if (sourceType) {
      const headClassId = ensureClassRecord(sourceType);
      headOntologyId = ensureOntologyRecord(sourceType);
      if (headClassId) {
        assignNodeClass(headNodeId, headClassId);
        try {
          db.run(
            "INSERT OR IGNORE INTO class_properties (class_id, property_id) VALUES (?, ?)",
            [headClassId, propertyId],
          );
        } catch (err) {
          console.warn("link class property failed", err);
        }
      }
      syncNodeTypeLabel(headNodeId, sourceType);
    }
    if (targetType) {
      const tailClassId = ensureClassRecord(targetType);
      tailOntologyId = ensureOntologyRecord(targetType);
      if (tailClassId) {
        assignNodeClass(tailNodeId, tailClassId);
      }
      syncNodeTypeLabel(tailNodeId, targetType);
    }
    if (headOntologyId) {
      linkOntologyProperty(headOntologyId, propertyId);
    }
    if (tailOntologyId) {
      linkOntologyProperty(tailOntologyId, propertyId);
    }
    syncRelationPropertyModel(propertyId, sourceType, targetType);
  };

  if (url.pathname === "/api/kb/entry/tasks" && method === "GET") {
    try {
      const rows = db
        .query(
          `SELECT *
           FROM entry_tasks t
           WHERE ${entryTaskScopeClause("t")}
           ORDER BY datetime(COALESCE(t.updated_at, t.created_at)) DESC, t.rowid DESC`,
        )
        .all(...entryTaskScopeParams()) as any[];
      return Response.json({
        items: rows.map((row) => mapEntryTaskRow(row)),
      });
    } catch (err) {
      console.error(err);
      return new Response("Load entry tasks failed", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/entry/tasks" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const name = String(body?.name || "").trim();
      const modeRaw = String(body?.mode || "entity_sheet")
        .trim()
        .toLowerCase();
      const mode =
        modeRaw === "relation_sheet" ? "relation_sheet" : "entity_sheet";
      if (!name) return new Response("Missing name", { status: 400 });

      const existing = db
        .query(
          `SELECT *
           FROM entry_tasks t
           WHERE lower(t.name) = lower(?)
             AND ${entryTaskScopeClause("t")}
           LIMIT 1`,
        )
        .get(name, ...entryTaskScopeParams()) as any;
      if (existing?.id) {
        return Response.json(mapEntryTaskRow(existing));
      }

      const id = `entry-task/${crypto.randomUUID()}`;
      db.run(
        `INSERT INTO entry_tasks (
           id, name, mode, schema_json, rows_json, project_id, created_at, updated_at
         ) VALUES (?, ?, ?, '[]', '[]', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, name, mode, hasProjectScope ? scopedProjectId : null],
      );
      const created = db
        .query(
          `SELECT *
           FROM entry_tasks t
           WHERE t.id = ?
             AND ${entryTaskScopeClause("t")}
           LIMIT 1`,
        )
        .get(id, ...entryTaskScopeParams()) as any;
      return Response.json(mapEntryTaskRow(created));
    } catch (err) {
      console.error(err);
      return new Response("Create entry task failed", { status: 500 });
    }
  }

  if (url.pathname.startsWith("/api/kb/entry/tasks/")) {
    const prefix = "/api/kb/entry/tasks/";
    const taskId = decodeURIComponent(url.pathname.slice(prefix.length)).trim();
    if (!taskId) return new Response("Missing task id", { status: 400 });

    if (method === "GET") {
      try {
        const row = db
          .query(
            `SELECT *
             FROM entry_tasks t
             WHERE t.id = ?
               AND ${entryTaskScopeClause("t")}
             LIMIT 1`,
          )
          .get(taskId, ...entryTaskScopeParams()) as any;
        if (!row) return new Response("Entry task not found", { status: 404 });
        return Response.json(mapEntryTaskRow(row));
      } catch (err) {
        console.error(err);
        return new Response("Load entry task failed", { status: 500 });
      }
    }

    if (method === "POST") {
      try {
        const body = (await req.json()) as any;
        const existing = db
          .query(
            `SELECT *
             FROM entry_tasks t
             WHERE t.id = ?
               AND ${entryTaskScopeClause("t")}
             LIMIT 1`,
          )
          .get(taskId, ...entryTaskScopeParams()) as any;
        if (!existing)
          return new Response("Entry task not found", { status: 404 });

        const updates: string[] = [];
        const params: any[] = [];

        if (body?.name !== undefined) {
          const name = String(body.name || "").trim();
          if (!name) return new Response("Missing name", { status: 400 });
          updates.push("name = ?");
          params.push(name);
        }
        if (body?.mode !== undefined) {
          const modeRaw = String(body.mode || "")
            .trim()
            .toLowerCase();
          const mode =
            modeRaw === "relation_sheet" ? "relation_sheet" : "entity_sheet";
          updates.push("mode = ?");
          params.push(mode);
        }
        if (body?.schema !== undefined) {
          updates.push("schema_json = ?");
          params.push(
            JSON.stringify(Array.isArray(body.schema) ? body.schema : []),
          );
        }
        if (body?.rows !== undefined) {
          updates.push("rows_json = ?");
          params.push(
            JSON.stringify(Array.isArray(body.rows) ? body.rows : []),
          );
        }
        if (body?.last_import_summary !== undefined) {
          updates.push("last_import_summary = ?");
          params.push(
            body.last_import_summary
              ? JSON.stringify(body.last_import_summary)
              : null,
          );
        }
        if (body?.mark_imported === true) {
          updates.push("last_imported_at = CURRENT_TIMESTAMP");
        }
        if (!updates.length) {
          return Response.json(mapEntryTaskRow(existing));
        }

        params.push(taskId, ...entryTaskScopeParams());
        db.run(
          `UPDATE entry_tasks
           SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND ${entryTaskScopeClause("")}`,
          params,
        );
        const updated = db
          .query(
            `SELECT *
             FROM entry_tasks t
             WHERE t.id = ?
               AND ${entryTaskScopeClause("t")}
             LIMIT 1`,
          )
          .get(taskId, ...entryTaskScopeParams()) as any;
        return Response.json(mapEntryTaskRow(updated));
      } catch (err) {
        console.error(err);
        return new Response("Update entry task failed", { status: 500 });
      }
    }

    if (method === "DELETE") {
      try {
        db.run(
          `DELETE FROM entry_tasks
           WHERE id = ?
             AND ${entryTaskScopeClause("")}`,
          [taskId, ...entryTaskScopeParams()],
        );
        return Response.json({ ok: true });
      } catch (err) {
        console.error(err);
        return new Response("Delete entry task failed", { status: 500 });
      }
    }
  }

  if (url.pathname === "/api/kb/graph" && method === "GET") {
    // 加载当前项目的所有节点
    const nodesQuery = hasProjectScope
      ? `SELECT * FROM nodes WHERE ${scopedClause()}`
      : `SELECT * FROM nodes`;
    const nodesParams = hasProjectScope ? [scopedProjectId] : [];
    const nodes = db
      .query(nodesQuery)
      .all(...nodesParams)
      .map(formatNode);

    // 构建当前项目的节点ID集合
    const nodeIdSet = new Set(nodes.map((n: any) => String(n.id)));

    const edges = [];
    // 加载当前项目节点的关系属性
    const attrsQuery = hasProjectScope
      ? `SELECT a.* FROM attributes a 
         INNER JOIN nodes n ON a.node_id = n.id 
         WHERE a.datatype = 'wikibase-entityid' AND n.project_id = ?`
      : `SELECT * FROM attributes WHERE datatype = 'wikibase-entityid'`;
    const attrs = (
      hasProjectScope
        ? db.query(attrsQuery).all(scopedProjectId)
        : db.query(attrsQuery).all()
    ) as any[];
    for (const attr of attrs) {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        for (const val of list) {
          if (val && val.id) {
            let targetId = val.id;
            if (targetId.startsWith("entity/")) {
              targetId = targetId.replace("entity/", "");
            }
            // 只添加目标节点也在当前项目中的边
            if (!hasProjectScope || nodeIdSet.has(targetId)) {
              edges.push(
                formatEdge({
                  id: attr.id + ":" + targetId,
                  source: attr.node_id,
                  target: targetId,
                  type: attr.key,
                  data: JSON.stringify({
                    isAttribute: true,
                    qualifier: val.qualifier,
                  }),
                }),
              );
            }
          }
        }
      } catch {}
    }
    return Response.json({
      nodes,
      edges,
      counts: { nodes: nodes.length, edges: edges.length },
    });
  }

  if (url.pathname === "/api/kb/node/graph" && method === "GET") {
    let id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    if (id.startsWith("entity/")) {
      const stripped = id.replace("entity/", "");
      const nodeExists = hasProjectScope
        ? db
            .query(`SELECT 1 FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(stripped, scopedProjectId)
        : db.query("SELECT 1 FROM nodes WHERE id = ?").get(stripped);
      if (nodeExists) id = stripped;
    }

    const centerNode = hasProjectScope
      ? db
          .query(`SELECT * FROM nodes WHERE id = ? AND ${scopedClause()}`)
          .get(id, scopedProjectId)
      : db.query("SELECT * FROM nodes WHERE id = ?").get(id);
    if (!centerNode) return Response.json({ nodes: [], edges: [] });

    const edges: any[] = [];
    const outgoingAttrs = db
      .query(
        "SELECT * FROM attributes WHERE node_id = ? AND datatype = 'wikibase-entityid'",
      )
      .all(id) as any[];

    const processAttr = (attr: any) => {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        for (const val of list) {
          if (val && val.id) {
            let targetId = val.id;
            if (targetId.startsWith("entity/")) {
              targetId = targetId.replace("entity/", "");
            }

            edges.push(
              formatEdge({
                id: attr.id + ":" + targetId,
                source: attr.node_id,
                target: targetId,
                type: attr.key,
                data: JSON.stringify({
                  isAttribute: true,
                  qualifier: val.qualifier,
                }),
              }),
            );
          }
        }
      } catch {}
    };

    outgoingAttrs.forEach(processAttr);

    const incomingAttrs = db
      .query(
        "SELECT * FROM attributes WHERE datatype = 'wikibase-entityid' AND value LIKE ?",
      )
      .all(`%${id}%`) as any[];
    incomingAttrs.forEach((attr) => {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        const pointsToId = list.some((v: any) => {
          let tid = v?.id;
          if (tid && tid.startsWith("entity/"))
            tid = tid.replace("entity/", "");
          return tid === id;
        });
        if (pointsToId) processAttr(attr);
      } catch {}
    });

    const neighborIds = new Set<string>();
    neighborIds.add(id);
    edges.forEach((e: any) => {
      neighborIds.add(e.source);
      neighborIds.add(e.target);
    });

    const nodes = db
      .query(
        `SELECT * FROM nodes WHERE id IN (${Array.from(neighborIds)
          .map(() => "?")
          .join(",")})${hasProjectScope ? ` AND ${scopedClause()}` : ""}`,
      )
      .all(
        ...Array.from(neighborIds),
        ...(hasProjectScope ? [scopedProjectId] : []),
      )
      .map(formatNode);

    const existingNodeIds = new Set(nodes.map((n: any) => n.id));
    const filteredEdges = edges.filter(
      (e: any) =>
        existingNodeIds.has(e.source) && existingNodeIds.has(e.target),
    );

    return Response.json({ nodes, edges: filteredEdges });
  }

  if (url.pathname === "/api/kb/entity_search" && method === "GET") {
    const q = url.searchParams.get("q") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const classId = (url.searchParams.get("class_id") || "").trim();

    const likeParam = `%${q}%`;
    const params: any[] = [likeParam];
    const countParams: any[] = [likeParam];

    let joinClause = "";
    let whereClause = "WHERE n.name LIKE ?";

    if (classId) {
      joinClause += " INNER JOIN entity_classes ec ON ec.entity_id = n.id";
      whereClause += " AND ec.class_id = ?";
      params.push(classId);
      countParams.push(classId);
    }

    if (hasProjectScope) {
      whereClause += ` AND ${scopedClause("n")}`;
      params.push(scopedProjectId);
      countParams.push(scopedProjectId);
    }

    const nodes = db
      .query(
        `SELECT DISTINCT n.* FROM nodes n${joinClause} ${whereClause} LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset)
      .map(formatNode);

    const total = db
      .query(
        `SELECT COUNT(DISTINCT n.id) as count FROM nodes n${joinClause} ${whereClause}`,
      )
      .get(...countParams) as any;

    return Response.json({ nodes, total: total?.count || 0 });
  }

  if (url.pathname === "/api/kb/entry/single" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const targetName = (body?.targetName ?? "").toString().trim();
      if (!targetName) {
        return Response.json({ error: "缺少目标名称" }, { status: 400 });
      }

      const targetDescription = (body?.targetDescription ?? "")
        .toString()
        .trim();
      const attributesRaw = Array.isArray(body?.attributes)
        ? body.attributes
        : [];
      const attributes = attributesRaw
        .map((attr: any) => {
          const property = (attr?.property ?? "").toString().trim();
          const values = normalizeEntryValueList(attr?.values, attr?.rawValue);
          return { property, values };
        })
        .filter((attr: { property: string; values: string[] }) => {
          return Boolean(attr.property) && attr.values.length > 0;
        });

      const summary = {
        targetId: "",
        createdNodes: 0,
        reusedNodes: 0,
        createdEdges: 0,
        reusedEdges: 0,
        createdAttributes: 0,
        updatedAttributes: 0,
        valueNodes: [] as Array<{ id: string; name: string; property: string }>,
      };

      const entityType = (body?.entityType ?? "").toString().trim();
      const targetResult = ensureNodeByName(targetName, {
        description: targetDescription,
        ...(hasProjectScope ? { projectId: scopedProjectId } : {}),
      });
      summary.targetId = targetResult.node.id;
      if (targetResult.created) summary.createdNodes += 1;
      else summary.reusedNodes += 1;
      let entityOntologyId: string | null = null;
      if (entityType) {
        db.run(
          "UPDATE nodes SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [entityType, targetResult.node.id],
        );
        const entityClassId = ensureClassRecord(entityType);
        if (entityClassId) assignNodeClass(targetResult.node.id, entityClassId);
        entityOntologyId = ensureOntologyRecord(entityType);
      }

      const targetNameLower = targetName.toLowerCase();
      for (const attr of attributes) {
        const propertyLabel = attr.property;
        const propertyKey =
          canonicalizePropertyKey(propertyLabel) || propertyLabel;
        const propertyRecord = ensurePropertyRecord(
          propertyKey,
          propertyLabel,
          undefined,
          hasProjectScope ? { projectId: scopedProjectId } : {},
        );
        const propertyId = (propertyRecord.id || propertyKey || "")
          .toString()
          .trim();
        if (!propertyId) continue;
        if (entityOntologyId) {
          linkOntologyProperty(entityOntologyId, propertyId);
        }

        const entityAttributeValues: EntityAttributeValue[] = [];
        for (const rawValue of attr.values) {
          let normalizedValue = rawValue.toString().trim();
          let qualifier = "";
          const match = normalizedValue.match(/^(.*?)[\(（](.*?)[\)）]$/);
          if (match) {
            normalizedValue = match[1].trim();
            qualifier = match[2].trim();
          }

          if (!normalizedValue) continue;
          if (normalizedValue.toLowerCase() === targetNameLower) continue;
          const valueResult = ensureNodeByName(
            normalizedValue,
            hasProjectScope ? { projectId: scopedProjectId } : {},
          );
          if (valueResult.created) summary.createdNodes += 1;
          else summary.reusedNodes += 1;
          summary.valueNodes.push({
            id: valueResult.node.id,
            name: valueResult.node.name,
            property: propertyLabel,
          });
          const numericId = Number(valueResult.node.id);
          entityAttributeValues.push({
            "entity-type": "item",
            id: valueResult.node.id.toString(),
            ...(Number.isFinite(numericId) ? { "numeric-id": numericId } : {}),
            label_zh: valueResult.node.name,
            label: valueResult.node.name,
            name: valueResult.node.name,
            qualifier: qualifier || undefined,
          });
        }

        let attributeChanges = { created: false, updated: false };
        if (entityAttributeValues.length) {
          attributeChanges = ensureAttributeRecord(
            targetResult.node.id,
            propertyId,
            entityAttributeValues,
            { datatype: "wikibase-entityid" },
          );
        } else if (attr.values.length) {
          attributeChanges = ensureAttributeRecord(
            targetResult.node.id,
            propertyId,
            attr.values,
            {
              datatype: "string",
            },
          );
        }
        syncPropertyTypeForNode(propertyId, targetResult.node.id);
        if (attributeChanges.created) summary.createdAttributes += 1;
        if (attributeChanges.updated) summary.updatedAttributes += 1;
      }

      const formattedTarget = formatNode(
        db.query("SELECT * FROM nodes WHERE id = ?").get(summary.targetId),
      );
      return Response.json({ ok: true, target: formattedTarget, summary });
    } catch (err) {
      console.error(err);
      return new Response("Single entry import failed", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/entry/batch" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const mode = (body?.mode ?? "entity").toString().trim();
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const taskId = (body?.task_id ?? "").toString().trim();
      if (!rows.length) {
        return Response.json({ error: "没有可导入的数据" }, { status: 400 });
      }
      const total = rows.length;

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (data: any) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );
          };

          const totals = {
            imported: 0,
            createdNodes: 0,
            reusedNodes: 0,
            createdEdges: 0,
            errors: [] as string[],
          };

          for (let i = 0; i < rows.length; i++) {
            try {
              if (mode === "relation") {
                const row = rows[i];
                const headName = (row?.head ?? "").toString().trim();
                const relationType = (row?.relation ?? "").toString().trim();
                const tailName = (row?.tail ?? "").toString().trim();
                const headTypeName = (row?.head_type ?? "").toString().trim();
                const tailTypeName = (row?.tail_type ?? "").toString().trim();
                const qualifier = (row?.qualifier ?? "").toString().trim();
                if (!headName || !tailName) {
                  totals.errors.push(`第 ${i + 1} 行缺少头实体或尾实体`);
                  send({
                    type: "progress",
                    current: i + 1,
                    total,
                    errors: totals.errors.length,
                  });
                  continue;
                }
                const relation = relationType || "related";
                const headResult = ensureNodeByName(
                  headName,
                  hasProjectScope ? { projectId: scopedProjectId } : {},
                );
                if (headResult.created) totals.createdNodes += 1;
                else totals.reusedNodes += 1;
                const tailResult = ensureNodeByName(
                  tailName,
                  hasProjectScope ? { projectId: scopedProjectId } : {},
                );
                if (tailResult.created) totals.createdNodes += 1;
                else totals.reusedNodes += 1;
                const propRec = ensurePropertyRecord(
                  relation,
                  relation,
                  undefined,
                  hasProjectScope ? { projectId: scopedProjectId } : {},
                );
                const propId = propRec.id || relation;
                const entityValue: EntityAttributeValue = {
                  "entity-type": "item",
                  id: tailResult.node.id.toString(),
                  label: tailResult.node.name,
                  label_zh: tailResult.node.name,
                  ...(qualifier ? { qualifier } : {}),
                };
                const attrChanges = ensureAttributeRecord(
                  headResult.node.id,
                  propId,
                  [entityValue],
                  { datatype: "wikibase-entityid" },
                );
                ensureRelationSchema(
                  headResult.node.id,
                  headTypeName,
                  propId,
                  tailResult.node.id,
                  tailTypeName,
                );
                syncPropertyTypeForNode(propId, headResult.node.id);
                if (attrChanges.created) totals.createdEdges += 1;
                totals.imported += 1;
              } else {
                const payload = rows[i];
                const targetName = (payload?.targetName ?? "")
                  .toString()
                  .trim();
                if (!targetName) {
                  totals.errors.push(`第 ${i + 1} 行缺少名称`);
                  send({
                    type: "progress",
                    current: i + 1,
                    total,
                    errors: totals.errors.length,
                  });
                  continue;
                }
                const targetDescription = (payload?.targetDescription ?? "")
                  .toString()
                  .trim();
                const attributesRaw = Array.isArray(payload?.attributes)
                  ? payload.attributes
                  : [];
                const attributes = attributesRaw
                  .map((attr: any) => {
                    const property = (attr?.property ?? "").toString().trim();
                    const values = normalizeEntryValueList(
                      attr?.values,
                      attr?.rawValue,
                    );
                    return { property, values };
                  })
                  .filter(
                    (attr: { property: string; values: string[] }) =>
                      Boolean(attr.property) && attr.values.length > 0,
                  );

                const targetResult = ensureNodeByName(targetName, {
                  description: targetDescription,
                  ...(hasProjectScope ? { projectId: scopedProjectId } : {}),
                });
                if (targetResult.created) totals.createdNodes += 1;
                else totals.reusedNodes += 1;

                const targetNameLower = targetName.toLowerCase();
                for (const attr of attributes) {
                  const propertyLabel = attr.property;
                  const propertyKey =
                    canonicalizePropertyKey(propertyLabel) || propertyLabel;
                  const propertyRecord = ensurePropertyRecord(
                    propertyKey,
                    propertyLabel,
                    undefined,
                    hasProjectScope ? { projectId: scopedProjectId } : {},
                  );
                  const propertyId = (propertyRecord.id || propertyKey || "")
                    .toString()
                    .trim();
                  if (!propertyId) continue;
                  const entityType = (payload?.entityType ?? "")
                    .toString()
                    .trim();
                  if (entityType) {
                    const classId = ensureClassRecord(entityType);
                    if (classId) assignNodeClass(targetResult.node.id, classId);
                    const ontologyId = ensureOntologyRecord(entityType);
                    if (ontologyId)
                      linkOntologyProperty(ontologyId, propertyId);
                  }
                  const entityAttributeValues: EntityAttributeValue[] = [];
                  for (const rawValue of attr.values) {
                    let normalizedValue = rawValue.toString().trim();
                    let qualifier = "";
                    const match = normalizedValue.match(
                      /^(.*?)[\(（](.*?)[\)）]$/,
                    );
                    if (match) {
                      normalizedValue = match[1].trim();
                      qualifier = match[2].trim();
                    }
                    if (!normalizedValue) continue;
                    if (normalizedValue.toLowerCase() === targetNameLower)
                      continue;
                    const valueResult = ensureNodeByName(
                      normalizedValue,
                      hasProjectScope ? { projectId: scopedProjectId } : {},
                    );
                    if (valueResult.created) totals.createdNodes += 1;
                    else totals.reusedNodes += 1;
                    const numericId = Number(valueResult.node.id);
                    entityAttributeValues.push({
                      "entity-type": "item",
                      id: valueResult.node.id.toString(),
                      ...(Number.isFinite(numericId)
                        ? { "numeric-id": numericId }
                        : {}),
                      label_zh: valueResult.node.name,
                      label: valueResult.node.name,
                      name: valueResult.node.name,
                      qualifier: qualifier || undefined,
                    });
                  }
                  let attributeChanges = { created: false, updated: false };
                  if (entityAttributeValues.length) {
                    attributeChanges = ensureAttributeRecord(
                      targetResult.node.id,
                      propertyId,
                      entityAttributeValues,
                      { datatype: "wikibase-entityid" },
                    );
                  } else if (attr.values.length) {
                    attributeChanges = ensureAttributeRecord(
                      targetResult.node.id,
                      propertyId,
                      attr.values,
                      { datatype: "string" },
                    );
                  }
                  syncPropertyTypeForNode(propertyId, targetResult.node.id);
                  if (attributeChanges.created) totals.createdEdges += 1;
                }

                // Update extra fields (type, description, aliases, tags)
                const targetId = targetResult.node.id;
                if (
                  payload.entityType ||
                  payload.targetDescription ||
                  (Array.isArray(payload.aliases) && payload.aliases.length) ||
                  (Array.isArray(payload.tags) && payload.tags.length)
                ) {
                  const updateFields: any = {};
                  if (payload.entityType)
                    updateFields.type = payload.entityType;
                  if (payload.targetDescription)
                    updateFields.description = payload.targetDescription;
                  if (Array.isArray(payload.aliases))
                    updateFields.aliases = JSON.stringify(payload.aliases);
                  if (Array.isArray(payload.tags))
                    updateFields.tags = JSON.stringify(payload.tags);
                  const setClauses = Object.keys(updateFields)
                    .map((k) => `${k} = ?`)
                    .join(", ");
                  if (setClauses) {
                    db.run(
                      `UPDATE nodes SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                      [...Object.values(updateFields), targetId],
                    );
                  }
                  if (payload.entityType) {
                    const classId = ensureClassRecord(payload.entityType);
                    if (classId) assignNodeClass(targetId, classId);
                  }
                }

                totals.imported += 1;
              }
            } catch (rowErr: any) {
              totals.errors.push(
                `第 ${i + 1} 行: ${rowErr?.message || rowErr}`,
              );
            }
            send({
              type: "progress",
              current: i + 1,
              total,
              errors: totals.errors.length,
            });
          }

          send({ type: "done", summary: totals });
          if (taskId) {
            try {
              db.run(
                `UPDATE entry_tasks
                 SET last_imported_at = CURRENT_TIMESTAMP,
                     last_import_summary = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?
                   AND ${entryTaskScopeClause("")}`,
                [JSON.stringify(totals), taskId, ...entryTaskScopeParams()],
              );
            } catch (taskErr) {
              console.warn("update entry task import summary failed", taskErr);
            }
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      console.error(err);
      return new Response("Batch import failed", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/entry/relations" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      if (!rows.length) {
        return Response.json(
          { error: "没有可导入的关系数据" },
          { status: 400 },
        );
      }

      const results = {
        imported: 0,
        createdNodes: 0,
        reusedNodes: 0,
        createdEdges: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const headName = (row?.head ?? "").toString().trim();
        const relationType = (row?.relation ?? "").toString().trim();
        const tailName = (row?.tail ?? "").toString().trim();
        const headTypeName = (row?.head_type ?? "").toString().trim();
        const tailTypeName = (row?.tail_type ?? "").toString().trim();
        const qualifier = (row?.qualifier ?? "").toString().trim();

        if (!headName || !tailName) {
          results.errors.push(`第 ${i + 1} 行缺少头实体或尾实体`);
          continue;
        }

        const relation = relationType || "related";

        const headResult = ensureNodeByName(
          headName,
          hasProjectScope ? { projectId: scopedProjectId } : {},
        );
        if (headResult.created) results.createdNodes += 1;
        else results.reusedNodes += 1;

        const tailResult = ensureNodeByName(
          tailName,
          hasProjectScope ? { projectId: scopedProjectId } : {},
        );
        if (tailResult.created) results.createdNodes += 1;
        else results.reusedNodes += 1;

        const propRec = ensurePropertyRecord(
          relation,
          relation,
          undefined,
          hasProjectScope ? { projectId: scopedProjectId } : {},
        );
        const propId = propRec.id || relation;

        const entityValue: EntityAttributeValue = {
          "entity-type": "item",
          id: tailResult.node.id.toString(),
          label: tailResult.node.name,
          label_zh: tailResult.node.name,
          ...(qualifier ? { qualifier } : {}),
        };

        const attrChanges = ensureAttributeRecord(
          headResult.node.id,
          propId,
          [entityValue],
          { datatype: "wikibase-entityid" },
        );
        ensureRelationSchema(
          headResult.node.id,
          headTypeName,
          propId,
          tailResult.node.id,
          tailTypeName,
        );
        syncPropertyTypeForNode(propId, headResult.node.id);

        if (attrChanges.created) results.createdEdges += 1;
        results.imported += 1;
      }

      return Response.json({ ok: true, summary: results });
    } catch (err) {
      console.error(err);
      return new Response("Relation batch import failed", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/nodes" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      let id = body.id;
      if (!id) id = getNextNumericNodeId();
      id = id.toString();
      const name = body.name || "New Node";
      const type = body.type || "entity";
      const desc = body.description || "";
      const aliases = JSON.stringify(body.aliases || []);
      const tags = JSON.stringify(body.tags || []);
      const image = typeof body.image === "string" ? body.image.trim() : "";

      db.run(
        "INSERT INTO nodes (id, name, type, description, aliases, tags, image, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, type, desc, aliases, tags, image, scopedProjectId],
      );

      const newNode = hasProjectScope
        ? db
            .query(`SELECT * FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(id, scopedProjectId)
        : db.query("SELECT * FROM nodes WHERE id = ?").get(id);
      return Response.json({ ok: true, node: formatNode(newNode) });
    } catch (e) {
      console.error(e);
      return new Response("Error creating node", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/nodes/update" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      let id = body.id;
      if (!id) return new Response("Missing id", { status: 400 });
      if (typeof id === "string" && id.startsWith("entity/")) {
        id = id.slice("entity/".length);
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
      if (body.aliases !== undefined) {
        updates.push("aliases = ?");
        params.push(JSON.stringify(body.aliases));
      }
      if (body.tags !== undefined) {
        updates.push("tags = ?");
        params.push(JSON.stringify(body.tags));
      }
      if (body.type !== undefined) {
        updates.push("type = ?");
        params.push(body.type !== null ? String(body.type) : null);
      }
      if (body.image !== undefined) {
        updates.push("image = ?");
        params.push(body.image || "");
      }

      if (updates.length > 0) {
        params.push(id);
        const scopeSql = hasProjectScope ? ` AND ${scopedClause()}` : "";
        db.run(
          `UPDATE nodes SET ${updates.join(", ")} WHERE id = ?${scopeSql}`,
          hasProjectScope ? [...params, scopedProjectId] : params,
        );
      }

      const updatedNode = hasProjectScope
        ? db
            .query(`SELECT * FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(id, scopedProjectId)
        : db.query("SELECT * FROM nodes WHERE id = ?").get(id);
      if (!updatedNode) {
        return new Response("Node not found", { status: 404 });
      }
      if (body.type !== undefined) {
        syncAllPropertyTypesForNode(id);
      }
      return Response.json({ ok: true, node: formatNode(updatedNode) });
    } catch (e) {
      console.error(e);
      return new Response("Error updating node", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/nodes" && method === "DELETE") {
    let idParam = url.searchParams.get("id");
    if (!idParam) return new Response("Missing id", { status: 400 });
    idParam = idParam.trim();
    if (!idParam) return new Response("Missing id", { status: 400 });

    const normalizedId = idParam.startsWith("entity/")
      ? idParam.replace("entity/", "")
      : idParam;
    const prefixedId = normalizedId.startsWith("entity/")
      ? normalizedId
      : `entity/${normalizedId}`;
    const candidateIds = Array.from(
      new Set(
        [normalizedId, idParam, prefixedId].filter(
          (value) => typeof value === "string" && value.trim(),
        ),
      ),
    );

    if (!candidateIds.length) {
      return new Response("Missing id", { status: 400 });
    }

    const placeholders = candidateIds.map(() => "?").join(",");
    const scopedIds = hasProjectScope
      ? (
          db
            .query(
              `SELECT id FROM nodes WHERE id IN (${placeholders}) AND ${scopedClause()}`,
            )
            .all(...candidateIds, scopedProjectId) as any[]
        ).map((row) => row.id)
      : candidateIds;
    if (!scopedIds.length) return Response.json({ success: true });
    const scopedPlaceholders = scopedIds.map(() => "?").join(",");
    db.run(
      `DELETE FROM attributes WHERE node_id IN (${scopedPlaceholders})`,
      scopedIds,
    );
    db.run(
      `DELETE FROM entity_classes WHERE entity_id IN (${scopedPlaceholders})`,
      scopedIds,
    );
    db.run(`DELETE FROM nodes WHERE id IN (${scopedPlaceholders})`, scopedIds);

    return Response.json({ success: true });
  }

  if (url.pathname === "/api/kb/nodes/clear" && method === "DELETE") {
    const nodeCount = hasProjectScope
      ? (db
          .query(`SELECT COUNT(*) as count FROM nodes WHERE ${scopedClause()}`)
          .get(scopedProjectId) as any)
      : (db.query("SELECT COUNT(*) as count FROM nodes").get() as any);
    const total = nodeCount?.count || 0;

    if (hasProjectScope) {
      db.run(
        `DELETE FROM attributes WHERE node_id IN (SELECT id FROM nodes WHERE ${scopedClause()})`,
        [scopedProjectId],
      );
      db.run(
        `DELETE FROM entity_classes WHERE entity_id IN (SELECT id FROM nodes WHERE ${scopedClause()})`,
        [scopedProjectId],
      );
      db.run(`DELETE FROM nodes WHERE ${scopedClause()}`, [scopedProjectId]);
    } else {
      db.run("DELETE FROM attributes");
      db.run("DELETE FROM entity_classes");
      db.run("DELETE FROM nodes");
    }

    return Response.json({ success: true, deleted: total });
  }

  if (url.pathname === "/api/kb/relations/clear" && method === "DELETE") {
    let deleted = 0;
    if (hasProjectScope) {
      const result = db
        .query(
          `SELECT COUNT(*) as count FROM attributes WHERE datatype = 'wikibase-entityid' AND node_id IN (SELECT id FROM nodes WHERE ${scopedClause()})`,
        )
        .get(scopedProjectId) as any;
      deleted = result?.count || 0;
      db.run(
        `DELETE FROM attributes WHERE datatype = 'wikibase-entityid' AND node_id IN (SELECT id FROM nodes WHERE ${scopedClause()})`,
        [scopedProjectId],
      );
    } else {
      const result = db
        .query(
          "SELECT COUNT(*) as count FROM attributes WHERE datatype = 'wikibase-entityid'",
        )
        .get() as any;
      deleted = result?.count || 0;
      db.run("DELETE FROM attributes WHERE datatype = 'wikibase-entityid'");
    }

    return Response.json({ success: true, deleted });
  }

  // ── 数据清洗：属性值提取到别名 ──────────────────────────────────────────
  if (url.pathname === "/api/kb/clean/attr-to-alias" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const propertyId = body.property_id;
      if (!propertyId)
        return new Response("Missing property_id", { status: 400 });
      const removeAfter = body.remove === true;
      const deleteTargets = body.delete_targets === true;

      // 查找所有拥有该属性的节点
      const attrs = hasProjectScope
        ? (db
            .query(
              `SELECT a.id, a.node_id, a.value, a.datatype FROM attributes a
             JOIN nodes n ON a.node_id = n.id
             WHERE a.key = ? AND ${scopedClause().replace("project_id", "n.project_id")}`,
            )
            .all(propertyId, scopedProjectId) as any[])
        : (db
            .query(
              "SELECT id, node_id, value, datatype FROM attributes WHERE key = ?",
            )
            .all(propertyId) as any[]);

      let updatedCount = 0;
      let removedCount = 0;
      const targetNodeIds = new Set<string>();

      for (const attr of attrs) {
        // 解析属性值
        const values = parseStoredAttributeValues(
          attr.value,
          attr.datatype || "string",
        );
        if (!values.length) continue;

        // 提取字符串值作为别名
        const newAliases: string[] = [];
        for (const v of values) {
          if (typeof v === "string" && v.trim()) {
            newAliases.push(v.trim());
          } else if (v && typeof v === "object") {
            // 实体引用类型，提取 label
            const label = v.label_zh || v.label || v.name || "";
            if (label.trim()) newAliases.push(label.trim());
            // 收集目标节点 ID，跳过自引用属性（node 指向自身）
            if (deleteTargets) {
              const eid = v.id || v["entity-id"] || "";
              const targetId = typeof eid === "string" ? eid.trim() : "";
              const sourceId = String(attr.node_id || "").trim();
              if (targetId && targetId !== sourceId) {
                targetNodeIds.add(targetId);
              }
            }
          }
        }
        if (!newAliases.length) continue;

        // 获取当前节点的别名
        const nodeRow = db
          .query("SELECT aliases FROM nodes WHERE id = ?")
          .get(attr.node_id) as any;
        if (!nodeRow) continue;

        let currentAliases: string[] = [];
        try {
          currentAliases = JSON.parse(nodeRow.aliases || "[]");
        } catch {}
        if (!Array.isArray(currentAliases)) currentAliases = [];

        // 合并去重
        const merged = Array.from(new Set([...currentAliases, ...newAliases]));
        db.run("UPDATE nodes SET aliases = ? WHERE id = ?", [
          JSON.stringify(merged),
          attr.node_id,
        ]);
        updatedCount++;

        // 删除属性
        if (removeAfter) {
          db.run("DELETE FROM attributes WHERE id = ?", [attr.id]);
          removedCount++;
        }
      }

      // 删除目标节点及其关联数据
      let deletedNodes = 0;
      if (deleteTargets && targetNodeIds.size > 0) {
        for (const nodeId of targetNodeIds) {
          const exists = db
            .query("SELECT id FROM nodes WHERE id = ?")
            .get(nodeId) as any;
          if (!exists) continue;
          // 删除该节点自身的属性
          db.run("DELETE FROM attributes WHERE node_id = ?", [nodeId]);
          // 删除其他节点引用该节点的关系属性（清理入边）
          const incomingAttrs = db
            .query(
              "SELECT id, value, datatype FROM attributes WHERE datatype = 'wikibase-entityid' AND value LIKE ?",
            )
            .all(`%"${nodeId}"%`) as any[];
          for (const incoming of incomingAttrs) {
            if (
              attributeValuesContainEntityId(
                incoming.value,
                incoming.datatype,
                nodeId,
              )
            ) {
              db.run("DELETE FROM attributes WHERE id = ?", [incoming.id]);
            }
          }
          db.run("DELETE FROM entity_classes WHERE entity_id = ?", [nodeId]);
          db.run("DELETE FROM nodes WHERE id = ?", [nodeId]);
          deletedNodes++;
        }
      }

      return Response.json({
        success: true,
        matched: attrs.length,
        updated: updatedCount,
        removed: removedCount,
        deletedNodes,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error extracting attr to alias", { status: 500 });
    }
  }

  // ── 数据清洗：删除属性和目标节点 ─────────────────────────────────
  if (
    url.pathname === "/api/kb/clean/delete-attr-and-targets" &&
    method === "POST"
  ) {
    try {
      const body = (await req.json()) as any;
      const propertyId = body.property_id;
      if (!propertyId)
        return new Response("Missing property_id", { status: 400 });
      const deleteTargets = body.delete_targets !== false;

      const attrs = hasProjectScope
        ? (db
            .query(
              `SELECT a.id, a.node_id, a.value, a.datatype FROM attributes a
             JOIN nodes n ON a.node_id = n.id
             WHERE a.key = ? AND ${scopedClause().replace("project_id", "n.project_id")}`,
            )
            .all(propertyId, scopedProjectId) as any[])
        : (db
            .query(
              "SELECT id, node_id, value, datatype FROM attributes WHERE key = ?",
            )
            .all(propertyId) as any[]);

      let deletedAttrs = 0;
      let deletedNodes = 0;
      const targetNodeIds = new Set<string>();

      // 收集目标节点 ID（仅对实体引用类型属性）
      if (deleteTargets) {
        for (const attr of attrs) {
          if (attr.datatype !== "wikibase-entityid") continue;
          const values = parseStoredAttributeValues(attr.value, attr.datatype);
          for (const v of values) {
            const eid =
              typeof v === "string"
                ? v
                : v && typeof v === "object"
                  ? v.id || v["entity-id"] || ""
                  : "";
            if (eid && typeof eid === "string" && eid.trim()) {
              targetNodeIds.add(eid.trim());
            }
          }
        }
      }

      // 删除属性记录
      for (const attr of attrs) {
        db.run("DELETE FROM attributes WHERE id = ?", [attr.id]);
        deletedAttrs++;
      }

      // 删除目标节点及其关联数据
      for (const nodeId of targetNodeIds) {
        const exists = db
          .query("SELECT id FROM nodes WHERE id = ?")
          .get(nodeId) as any;
        if (!exists) continue;
        // 删除该节点自身的属性
        db.run("DELETE FROM attributes WHERE node_id = ?", [nodeId]);
        // 删除其他节点引用该节点的关系属性（清理入边）
        const incomingAttrs = db
          .query(
            "SELECT id, value, datatype FROM attributes WHERE datatype = 'wikibase-entityid' AND value LIKE ?",
          )
          .all(`%"${nodeId}"%`) as any[];
        for (const incoming of incomingAttrs) {
          if (
            attributeValuesContainEntityId(
              incoming.value,
              incoming.datatype,
              nodeId,
            )
          ) {
            db.run("DELETE FROM attributes WHERE id = ?", [incoming.id]);
          }
        }
        db.run("DELETE FROM entity_classes WHERE entity_id = ?", [nodeId]);
        db.run("DELETE FROM nodes WHERE id = ?", [nodeId]);
        deletedNodes++;
      }

      return Response.json({
        success: true,
        matched: attrs.length,
        deletedAttrs,
        deletedNodes,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error deleting attr and targets", { status: 500 });
    }
  }

  if (
    url.pathname === "/api/kb/clean/assign-target-node-type" &&
    method === "POST"
  ) {
    try {
      const body = (await req.json()) as any;
      const propertyId = body.property_id;
      const targetType = (body.target_type || "").toString().trim();
      if (!propertyId)
        return new Response("Missing property_id", { status: 400 });
      if (!targetType)
        return new Response("Missing target_type", { status: 400 });

      const attrs = hasProjectScope
        ? (db
            .query(
              `SELECT a.id, a.node_id, a.value, a.datatype FROM attributes a
             JOIN nodes n ON a.node_id = n.id
             WHERE a.key = ? AND ${scopedClause().replace("project_id", "n.project_id")}`,
            )
            .all(propertyId, scopedProjectId) as any[])
        : (db
            .query(
              "SELECT id, node_id, value, datatype FROM attributes WHERE key = ?",
            )
            .all(propertyId) as any[]);

      const targetNodeIds = new Set<string>();
      for (const attr of attrs) {
        const values = parseStoredAttributeValues(
          attr.value,
          attr.datatype || "string",
        );
        for (const value of values) {
          const targetId = extractEntityId(value);
          if (targetId) targetNodeIds.add(targetId);
        }
      }

      let updatedNodes = 0;
      const classId = ensureClassRecord(targetType);
      const ontologyId = ensureOntologyRecord(targetType);

      for (const targetId of targetNodeIds) {
        const node = hasProjectScope
          ? (db
              .query(
                `SELECT id, type FROM nodes WHERE id = ? AND ${scopedClause()}`,
              )
              .get(targetId, scopedProjectId) as any)
          : (db
              .query("SELECT id, type FROM nodes WHERE id = ?")
              .get(targetId) as any);
        if (!node?.id) continue;
        const currentType = (node.type || "").toString().trim();
        if (currentType !== targetType) {
          db.run(
            "UPDATE nodes SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [targetType, targetId],
          );
          updatedNodes++;
        }
        if (classId) assignNodeClass(targetId, classId);
      }

      if (ontologyId) linkOntologyProperty(ontologyId, propertyId);
      syncRelationPropertyModel(propertyId, "", targetType);

      return Response.json({
        success: true,
        matched: attrs.length,
        targetNodes: targetNodeIds.size,
        updatedNodes,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error assigning target node type", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/node-types" && method === "GET") {
    try {
      const rows = hasProjectScope
        ? (db
            .query(
              `SELECT DISTINCT type FROM nodes WHERE ${scopedClause()} AND type IS NOT NULL AND TRIM(type) <> ''`,
            )
            .all(scopedProjectId) as any[])
        : (db
            .query(
              "SELECT DISTINCT type FROM nodes WHERE type IS NOT NULL AND TRIM(type) <> ''",
            )
            .all() as any[]);
      const types = rows
        .map((row) => row?.type || row?.TYPE || "")
        .filter((type) => typeof type === "string" && type.toString().trim())
        .map((type) => type.toString().trim());
      return Response.json(Array.from(new Set(types)));
    } catch (e) {
      console.error(e);
      return new Response("Error loading node types", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/node" && method === "GET") {
    let id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    let node = hasProjectScope
      ? db
          .query(`SELECT * FROM nodes WHERE id = ? AND ${scopedClause()}`)
          .get(id, scopedProjectId)
      : db.query("SELECT * FROM nodes WHERE id = ?").get(id);
    if (!node && id.startsWith("entity/")) {
      const strippedId = id.replace("entity/", "");
      node = hasProjectScope
        ? db
            .query(`SELECT * FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(strippedId, scopedProjectId)
        : db.query("SELECT * FROM nodes WHERE id = ?").get(strippedId);
      if (node) id = strippedId;
    }

    if (!node) return new Response("Not found", { status: 404 });

    const neighborIds = new Set<string>();
    const outgoingAttrs = db
      .query(
        "SELECT value FROM attributes WHERE node_id = ? AND datatype = 'wikibase-entityid'",
      )
      .all(id) as any[];
    outgoingAttrs.forEach((attr) => {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        list.forEach((v: any) => {
          if (v?.id) {
            let tid = v.id;
            if (tid.startsWith("entity/")) tid = tid.replace("entity/", "");
            neighborIds.add(tid);
          }
        });
      } catch {}
    });

    const incomingAttrs = db
      .query(
        "SELECT node_id, value FROM attributes WHERE datatype = 'wikibase-entityid' AND value LIKE ?",
      )
      .all(`%${id}%`) as any[];
    incomingAttrs.forEach((attr) => {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        const pointsToId = list.some((v: any) => {
          let tid = v?.id;
          if (tid && tid.startsWith("entity/"))
            tid = tid.replace("entity/", "");
          return tid === id;
        });
        if (pointsToId) neighborIds.add(attr.node_id);
      } catch {}
    });

    const neighbors = [];
    if (neighborIds.size > 0) {
      const neighborNodes = db
        .query(
          `SELECT * FROM nodes WHERE id IN (${Array.from(neighborIds)
            .map(() => "?")
            .join(",")})${hasProjectScope ? ` AND ${scopedClause()}` : ""}`,
        )
        .all(
          ...Array.from(neighborIds),
          ...(hasProjectScope ? [scopedProjectId] : []),
        )
        .map(formatNode);
      neighbors.push(...neighborNodes);
    }

    return Response.json({ node: formatNode(node), neighbors });
  }

  if (url.pathname === "/api/kb/node/attributes" && method === "GET") {
    let id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const includeDeprecated =
      String(url.searchParams.get("show_deprecated") || "").toLowerCase() ===
        "1" ||
      String(url.searchParams.get("status") || "").toLowerCase() === "all";

    if (id.startsWith("entity/")) {
      const stripped = id.replace("entity/", "");
      const nodeExists = hasProjectScope
        ? db
            .query(`SELECT 1 FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(stripped, scopedProjectId)
        : db.query("SELECT 1 FROM nodes WHERE id = ?").get(stripped);
      if (nodeExists) id = stripped;
    }

    const attrs = db
      .query(
        `SELECT a.*
         FROM attributes a
         LEFT JOIN properties p ON p.id = a.key
         WHERE a.node_id = ? ${includeDeprecated ? "" : "AND (p.id IS NULL OR p.status = 'active')"}`,
      )
      .all(id)
      .map(formatAttribute);
    return Response.json({ items: attrs });
  }

  if (url.pathname === "/api/kb/attributes/save" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const nodeId = body.node_id || body.entity_id;
      const prop = body.property || body.prop;
      const value = body.value;
      const datatype = body.datatype || "string";
      const id = body.id || `attr/${crypto.randomUUID()}`;

      const existing = db
        .query("SELECT * FROM attributes WHERE id = ?")
        .get(id);
      const valueStr =
        typeof value === "object" ? JSON.stringify(value) : String(value);

      let snapshot = null;
      if (prop) {
        const propRow = db
          .query("SELECT name, status FROM properties WHERE id = ?")
          .get(prop) as any;
        if (propRow) {
          if (propRow.status === "deprecated") {
            return new Response(
              "Cannot add or edit values for deprecated properties",
              { status: 400 },
            );
          }
          snapshot = propRow.name;
        }
      }

      if (existing) {
        db.run(
          "UPDATE attributes SET key = ?, value = ?, datatype = ?, property_name_snapshot = ? WHERE id = ?",
          [prop, valueStr, datatype, snapshot, id],
        );
      } else {
        db.run(
          "INSERT INTO attributes (id, node_id, key, value, datatype, property_name_snapshot) VALUES (?, ?, ?, ?, ?, ?)",
          [id, nodeId, prop, valueStr, datatype, snapshot],
        );
      }
      syncPropertyTypeForNode(prop, nodeId);

      const saved = db.query("SELECT * FROM attributes WHERE id = ?").get(id);
      return Response.json(formatAttribute(saved));
    } catch (e) {
      console.error(e);
      return new Response("Error saving attribute", { status: 500 });
    }
  }

  if (url.pathname.startsWith("/api/kb/attributes/") && method === "DELETE") {
    const prefix = "/api/kb/attributes/";
    let id = url.pathname.substring(prefix.length);
    if (id && id !== "blacklist") {
      id = decodeURIComponent(id);
      db.run("DELETE FROM attributes WHERE id = ?", [id]);
      return Response.json({ success: true });
    }
  }

  if (url.pathname === "/api/kb/node/relations" && method === "GET") {
    let id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    if (id.startsWith("entity/")) {
      const stripped = id.replace("entity/", "");
      const nodeExists = hasProjectScope
        ? db
            .query(`SELECT 1 FROM nodes WHERE id = ? AND ${scopedClause()}`)
            .get(stripped, scopedProjectId)
        : db.query("SELECT 1 FROM nodes WHERE id = ?").get(stripped);
      if (nodeExists) id = stripped;
    }

    const edges: any[] = [];
    const outgoingAttrs = db
      .query(
        "SELECT * FROM attributes WHERE node_id = ? AND datatype = 'wikibase-entityid'",
      )
      .all(id) as any[];
    const processAttr = (attr: any) => {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        for (const val of list) {
          if (val && val.id) {
            let targetId = val.id;
            if (targetId.startsWith("entity/"))
              targetId = targetId.replace("entity/", "");
            edges.push(
              formatEdge({
                id: attr.id + ":" + targetId,
                source: attr.node_id,
                target: targetId,
                type: attr.key,
                data: JSON.stringify({ isAttribute: true }),
              }),
            );
          }
        }
      } catch {}
    };
    outgoingAttrs.forEach(processAttr);

    const incomingAttrs = db
      .query(
        "SELECT * FROM attributes WHERE datatype = 'wikibase-entityid' AND value LIKE ?",
      )
      .all(`%${id}%`) as any[];
    incomingAttrs.forEach((attr) => {
      try {
        const vals = JSON.parse(attr.value);
        const list = Array.isArray(vals) ? vals : [vals];
        const pointsToId = list.some((v: any) => {
          let tid = v?.id;
          if (tid && tid.startsWith("entity/"))
            tid = tid.replace("entity/", "");
          return tid === id;
        });
        if (pointsToId) processAttr(attr);
      } catch {}
    });

    return Response.json({ items: edges });
  }

  if (url.pathname === "/api/kb/edge" && method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const parts = id.split(":");
    if (parts.length < 2)
      return new Response("Invalid edge id", { status: 400 });

    const attrId = parts[0] as string;
    const targetId = parts.slice(1).join(":");
    const attr = db
      .query("SELECT * FROM attributes WHERE id = ?")
      .get(attrId) as any;
    if (!attr) return new Response("Not found", { status: 404 });

    try {
      const vals = JSON.parse(attr.value);
      const list = Array.isArray(vals) ? vals : [vals];
      const found = list.find((v: any) => {
        let tid = v?.id;
        if (tid && tid.startsWith("entity/")) tid = tid.replace("entity/", "");
        return tid === targetId;
      });

      if (found) {
        return Response.json(
          formatEdge({
            id,
            source: attr.node_id,
            target: targetId,
            type: attr.key,
            data: JSON.stringify({ isAttribute: true }),
          }),
        );
      }
    } catch {}

    return new Response("Not found", { status: 404 });
  }

  if (url.pathname === "/api/kb/relations/create" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const source = body.source;
      const target = body.target;
      const type = body.type || "related";

      let targetId = target;
      if (targetId.startsWith("entity/"))
        targetId = targetId.replace("entity/", "");
      const targetNode = db
        .query("SELECT name FROM nodes WHERE id = ?")
        .get(targetId) as any;
      const targetName = targetNode?.name || targetId;

      const entityValue: EntityAttributeValue = {
        "entity-type": "item",
        id: targetId,
        label: targetName,
        label_zh: targetName,
      };

      const propRec = ensurePropertyRecord(
        type,
        type,
        undefined,
        hasProjectScope ? { projectId: scopedProjectId } : {},
      );
      const propId = propRec.id || type;

      ensureAttributeRecord(source, propId, [entityValue], {
        datatype: "wikibase-entityid",
      });
      syncPropertyTypeForNode(propId, source);

      const attr = db
        .query("SELECT * FROM attributes WHERE node_id = ? AND key = ?")
        .get(source, propId) as any;

      return Response.json(
        formatEdge({
          id: attr.id + ":" + targetId,
          source,
          target: targetId,
          type: propId,
          data: JSON.stringify({ isAttribute: true }),
        }),
      );
    } catch (e) {
      console.error(e);
      return new Response("Error creating edge", { status: 500 });
    }
  }

  if (url.pathname.startsWith("/api/kb/relations/") && method === "DELETE") {
    const prefix = "/api/kb/relations/";
    let id = url.pathname.substring(prefix.length);

    if (id) {
      id = decodeURIComponent(id);
      const parts = id.split(":");
      if (parts.length >= 2) {
        const attrId = parts[0] as string;
        const targetId = parts.slice(1).join(":");

        const attr = db
          .query("SELECT * FROM attributes WHERE id = ?")
          .get(attrId) as any;
        if (attr) {
          try {
            const vals = JSON.parse(attr.value);
            let list = Array.isArray(vals) ? vals : [vals];
            const initialLen = list.length;
            list = list.filter((v: any) => {
              let tid = v?.id;
              if (tid && tid.startsWith("entity/"))
                tid = tid.replace("entity/", "");
              return tid !== targetId;
            });

            if (list.length !== initialLen) {
              if (list.length === 0) {
                db.run("DELETE FROM attributes WHERE id = ?", [attrId]);
              } else {
                db.run("UPDATE attributes SET value = ? WHERE id = ?", [
                  JSON.stringify(list),
                  attrId,
                ]);
              }
            }
          } catch {}
        }
      }
      return Response.json({ success: true });
    }
  }

  if (url.pathname === "/api/kb/stats" && method === "GET") {
    const nodeCount = hasProjectScope
      ? (db
          .query(`SELECT COUNT(*) as count FROM nodes WHERE ${scopedClause()}`)
          .get(scopedProjectId) as any)
      : (db.query("SELECT COUNT(*) as count FROM nodes").get() as any);
    const classCount = hasProjectScope
      ? (db
          .query("SELECT COUNT(*) as count FROM classes WHERE project_id = ?")
          .get(scopedProjectId) as any)
      : (db
          .query(
            "SELECT COUNT(*) as count FROM classes WHERE project_id IS NULL",
          )
          .get() as any);
    const propertyCount = hasProjectScope
      ? (db
          .query(
            "SELECT COUNT(*) as count FROM properties WHERE project_id = ?",
          )
          .get(scopedProjectId) as any)
      : (db
          .query(
            "SELECT COUNT(*) as count FROM properties WHERE project_id IS NULL",
          )
          .get() as any);
    const attributeCount = hasProjectScope
      ? (db
          .query(
            `SELECT COUNT(*) as count
             FROM attributes
             WHERE node_id IN (SELECT id FROM nodes WHERE ${scopedClause()})`,
          )
          .get(scopedProjectId) as any)
      : (db.query("SELECT COUNT(*) as count FROM attributes").get() as any);

    return Response.json({
      counts: {
        entity: nodeCount.count,
        link: attributeCount.count,
        instance: classCount.count,
        property: propertyCount.count,
      },
    });
  }

  return null;
}
