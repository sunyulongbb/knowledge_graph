import { db, getProjectByIdentifier } from "../db.ts";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
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
  normalizeEntityAttributeValues,
  serializeAttributeValues,
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
  const appFolder = hasProjectScope ? String(scopedProjectId) : "app";
  const APP_UPLOADS_DIR = resolve(
    import.meta.dir,
    "..",
    "..",
    "..",
    "uploads",
    appFolder,
  );
  const NODE_VIDEO_UPLOADS_DIR = resolve(APP_UPLOADS_DIR, "node-videos");
  mkdirSync(NODE_VIDEO_UPLOADS_DIR, { recursive: true });
  const NODE_IMAGE_UPLOADS_DIR = resolve(APP_UPLOADS_DIR, "node-images");
  mkdirSync(NODE_IMAGE_UPLOADS_DIR, { recursive: true });

  const resolveFileExtension = (urlPath: string, contentType: string) => {
    const match = String(urlPath || "")
      .trim()
      .match(/\.([a-z0-9]+)(?:$|\?)/i);
    if (match) return match[1].toLowerCase();
    if (contentType) {
      const lower = contentType.toLowerCase();
      if (lower.includes("jpeg")) return "jpg";
      if (lower.includes("png")) return "png";
      if (lower.includes("gif")) return "gif";
      if (lower.includes("webp")) return "webp";
      if (lower.includes("mp4")) return "mp4";
      if (lower.includes("webm")) return "webm";
      if (lower.includes("ogg")) return "ogg";
      if (lower.includes("quicktime")) return "mov";
    }
    return "";
  };

  const downloadRemoteFile = async (
    fileUrl: string,
    uploadDir: string,
    allowedExts: string[],
    maxSize: number,
  ) => {
    const parsed = new URL(fileUrl);
    const resp = await fetch(parsed.toString());
    if (!resp.ok) {
      throw new Error(`下载文件失败：HTTP ${resp.status}`);
    }
    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const ext = resolveFileExtension(parsed.pathname, contentType);
    if (!ext || !allowedExts.includes(ext)) {
      throw new Error(`不支持的文件类型：${ext || contentType}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength > maxSize) {
      throw new Error(
        `文件大小超过限制：${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB`,
      );
    }
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = resolve(uploadDir, filename);
    writeFileSync(filePath, Buffer.from(arrayBuffer));
    const base =
      uploadDir === NODE_VIDEO_UPLOADS_DIR ? "node-videos" : "node-images";
    return `/static/uploads/${appFolder}/${base}/${filename}`;
  };

  const parseDataUrlImage = (dataUrl: string) => {
    const match = String(dataUrl || "")
      .trim()
      .match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) return null;
    return {
      mime: match[1],
      base64: match[2],
    };
  };

  const saveDataUrlImageToLocal = async (dataUrl: string) => {
    const parsed = parseDataUrlImage(dataUrl);
    if (!parsed) return "";
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/bmp": "bmp",
      "image/x-icon": "ico",
      "image/vnd.microsoft.icon": "ico",
      "image/avif": "avif",
      "image/heif": "heif",
    };
    const ext = extMap[parsed.mime] || parsed.mime.split("/")[1] || "";
    if (!ext) {
      throw new Error(`不支持的图片类型：${parsed.mime}`);
    }
    const buffer = Buffer.from(parsed.base64, "base64");
    const maxSize = 20 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new Error("图片大小超过限制：20MB");
    }
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = resolve(NODE_IMAGE_UPLOADS_DIR, filename);
    writeFileSync(filePath, buffer);
    return `/static/uploads/${appFolder}/node-images/${filename}`;
  };

  const downloadRemoteMedia = async (
    mediaUrl: string,
    uploadDir: string,
    allowedExts: string[],
    maxSize: number,
  ) => {
    const url = (mediaUrl || "").toString().trim();
    if (!url || !url.toLowerCase().startsWith("http")) {
      return url;
    }
    try {
      return await downloadRemoteFile(url, uploadDir, allowedExts, maxSize);
    } catch (err) {
      console.warn("download media failed", err, url);
      return "";
    }
  };

  const normalizeListValue = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (item || "").toString().trim())
        .filter(Boolean);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (item || "").toString().trim())
            .filter(Boolean);
        }
      } catch {}
      return trimmed
        .split(/[\n,，;；、|]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
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
               WHERE (id = ? OR lower(name) = lower(?))
                 AND project_id = ?
               LIMIT 1`,
            )
            .get(normalized, normalized, scopedProjectId) as any)
        : (db
            .query(
              "SELECT id FROM classes WHERE (id = ? OR lower(name) = lower(?)) AND project_id IS NULL LIMIT 1",
            )
            .get(normalized, normalized) as any);
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
               WHERE (id = ? OR lower(name) = lower(?))
                 AND project_id = ?
               LIMIT 1`,
            )
            .get(normalized, normalized, scopedProjectId) as any)
        : (db
            .query(
              "SELECT id FROM ontologies WHERE (id = ? OR lower(name) = lower(?)) AND project_id IS NULL LIMIT 1",
            )
            .get(normalized, normalized) as any);
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

  const syncNodeTypeLabel = (
    nodeId: string,
    typeName: string,
    options: { forceOverwrite?: boolean } = {},
  ) => {
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
      const ontologyId = ensureOntologyRecord(normalizedType);
      const typeToSave = ontologyId || normalizedType;
      const currentType = (node.type || "").toString().trim();
      const hasType = currentType && currentType.toLowerCase() !== "entity";
      if (hasType && !options.forceOverwrite) return;
      if (currentType === typeToSave) return;
      db.run(
        "UPDATE nodes SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [typeToSave, nid],
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
      syncNodeTypeLabel(headNodeId, sourceType, { forceOverwrite: true });
    }
    if (targetType) {
      const tailClassId = ensureClassRecord(targetType);
      tailOntologyId = ensureOntologyRecord(targetType);
      if (tailClassId) {
        assignNodeClass(tailNodeId, tailClassId);
      }
      syncNodeTypeLabel(tailNodeId, targetType, { forceOverwrite: false });
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
    const propertyId = (url.searchParams.get("property_id") || "").trim();
    const propertyValue = (url.searchParams.get("property_value") || "").trim();
    const hideEntity = (url.searchParams.get("hide_entity") || "").trim();

    const likeParam = `%${q}%`;
    const params: any[] = [
      likeParam,
      likeParam,
      likeParam,
      likeParam,
      likeParam,
    ];
    const countParams: any[] = [
      likeParam,
      likeParam,
      likeParam,
      likeParam,
      likeParam,
    ];

    let joinClause = "";
    let whereClause =
      "WHERE (COALESCE(n.name, '') LIKE ? OR COALESCE(n.aliases, '') LIKE ? OR COALESCE(n.description, '') LIKE ? OR COALESCE(n.type, '') LIKE ? OR COALESCE(n.id, '') LIKE ?)";
    let propertyKeyConditions: string[] = [];
    const propertyKeys = new Set<string>();

    if (propertyId) {
      propertyKeys.add(propertyId);
      if (propertyId.startsWith("property/")) {
        propertyKeys.add(propertyId.substring(9));
      }
      if (/^P\d+$/.test(propertyId)) {
        const numeric = propertyId.substring(1);
        propertyKeys.add(numeric);
        propertyKeys.add(`property/${numeric}`);
      }
      if (/^\d+$/.test(propertyId)) {
        propertyKeys.add(`P${propertyId}`);
        propertyKeys.add(`property/${propertyId}`);
      }

      try {
        const propRow = db
          .query(
            "SELECT name, alias FROM properties WHERE id = ? OR lower(name) = lower(?) LIMIT 1",
          )
          .get(propertyId, propertyId) as any;
        if (propRow?.name) {
          propertyKeys.add(propRow.name);
        }
        if (propRow?.alias) {
          try {
            const parsed = JSON.parse(propRow.alias);
            if (Array.isArray(parsed)) {
              parsed.forEach((aliasItem: any) => {
                if (aliasItem) propertyKeys.add(String(aliasItem).trim());
              });
            }
          } catch {
            if (typeof propRow.alias === "string") {
              propertyKeys.add(propRow.alias);
            }
          }
        }
      } catch {}
    }

    if (propertyId || propertyValue) {
      joinClause +=
        " INNER JOIN attributes a ON (a.node_id = n.id OR REPLACE(a.node_id, 'entity/', '') = n.id)";
    }
    if (propertyKeys.size > 0) {
      const placeholders = Array.from(propertyKeys)
        .map(() => "?")
        .join(",");
      whereClause += ` AND a.key IN (${placeholders})`;
      Array.from(propertyKeys).forEach((key) => {
        params.push(key);
        countParams.push(key);
      });
    }
    if (propertyValue) {
      whereClause += " AND lower(a.value) LIKE ?";
      const valueParam = `%${propertyValue.toLowerCase()}%`;
      params.push(valueParam);
      countParams.push(valueParam);
    }

    if (classId) {
      joinClause += " INNER JOIN entity_classes ec ON ec.entity_id = n.id";
      whereClause += " AND ec.class_id = ?";
      params.push(classId);
      countParams.push(classId);
    }

    if (hideEntity === "1" || hideEntity.toLowerCase() === "true") {
      whereClause += " AND lower(trim(n.type)) <> 'entity'";
    }

    const typeFilterRaw = url.searchParams.get("type");
    if (typeFilterRaw !== null) {
      const typeFilter = typeFilterRaw.trim();
      if (typeFilter === "") {
        whereClause += " AND (n.type IS NULL OR TRIM(n.type) = '')";
      } else {
        joinClause +=
          " LEFT JOIN ontologies ot_filter ON lower(trim(n.type)) = lower(trim(ot_filter.id))";
        whereClause +=
          " AND (lower(trim(n.type)) = lower(?) OR lower(trim(ot_filter.id)) = lower(?))";
        params.push(typeFilter, typeFilter);
        countParams.push(typeFilter, typeFilter);
      }
    }

    if (hasProjectScope) {
      whereClause += ` AND ${scopedClause("n")}`;
      params.push(scopedProjectId);
      countParams.push(scopedProjectId);
    }

    const orderBy = (url.searchParams.get("order") || "").trim();
    let orderClause = " ORDER BY n.rowid DESC";
    if (orderBy === "modified_desc") {
      orderClause = " ORDER BY datetime(COALESCE(n.updated_at, n.created_at)) DESC, n.rowid DESC";
    } else if (orderBy === "modified_asc") {
      orderClause = " ORDER BY datetime(COALESCE(n.updated_at, n.created_at)) ASC, n.rowid ASC";
    } else if (orderBy === "created_desc") {
      orderClause = " ORDER BY datetime(n.created_at) DESC, n.rowid DESC";
    } else if (orderBy === "created_asc") {
      orderClause = " ORDER BY datetime(n.created_at) ASC, n.rowid ASC";
    }

    const nodes = db
      .query(
        `SELECT DISTINCT n.* FROM nodes n${joinClause} ${whereClause}${orderClause} LIMIT ? OFFSET ?`,
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

  if (url.pathname === "/api/kb/shorts_random" && method === "GET") {
    const limit = Math.max(
      1,
      parseInt(url.searchParams.get("limit") || "12", 10),
    );
    const parseListParam = (value: string | null) =>
      (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    let params: any[] = [];
    let whereClause = "WHERE video IS NOT NULL AND TRIM(video) <> ''";

    if (hasProjectScope) {
      whereClause += ` AND ${scopedClause()}`;
      params.push(scopedProjectId);
    }

    const baseWhereClause = whereClause;
    const total = db
      .query(`SELECT COUNT(*) as count FROM nodes ${baseWhereClause}`)
      .get(...params) as any;

    const excludeIdsParam = parseListParam(url.searchParams.get("exclude_ids"));
    const recentIdsParam = parseListParam(url.searchParams.get("recent_ids"));
    const recentClassesParam = parseListParam(
      url.searchParams.get("recent_classes"),
    );
    const currentId = (url.searchParams.get("current_id") || "").trim();
    if (excludeIdsParam.length) {
      const placeholders = excludeIdsParam.map(() => "?").join(",");
      whereClause += ` AND id NOT IN (${placeholders})`;
      params.push(...excludeIdsParam);
    }

    const candidateLimit = Math.max(limit * 10, 80);
    const recentRows = db
      .query(
        `SELECT * FROM nodes ${whereClause}
         ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, rowid DESC
         LIMIT ?`,
      )
      .all(...params, candidateLimit) as any[];
    const randomRows = db
      .query(`SELECT * FROM nodes ${whereClause} ORDER BY RANDOM() LIMIT ?`)
      .all(...params, candidateLimit) as any[];

    const mergedRowMap = new Map<string, any>();
    [...recentRows, ...randomRows].forEach((row: any) => {
      const rowId = (row?.id || "").toString().trim();
      if (rowId && !mergedRowMap.has(rowId)) {
        mergedRowMap.set(rowId, row);
      }
    });

    const currentNode = currentId
      ? formatNode(
          db
            .query(`SELECT * FROM nodes ${baseWhereClause} AND id = ? LIMIT 1`)
            .get(...params.slice(0, hasProjectScope ? 1 : 0), currentId) as any,
        )
      : null;
    const currentClass = (currentNode?.classLabel || "").toString().trim();
    const currentTags = new Set(
      Array.isArray(currentNode?.tags)
        ? currentNode.tags
            .map((tag: any) => String(tag || "").trim())
            .filter(Boolean)
        : [],
    );
    const recentClassCounts = new Map<string, number>();
    recentClassesParam.forEach((className) => {
      recentClassCounts.set(
        className,
        (recentClassCounts.get(className) || 0) + 1,
      );
    });
    const recentIdSet = new Set(recentIdsParam);

    const daysSince = (value: any) => {
      if (!value) return 365;
      const time = new Date(value).getTime();
      if (!Number.isFinite(time)) return 365;
      return Math.max(0, (Date.now() - time) / 86400000);
    };
    const tagOverlapCount = (tags: any[]) => {
      if (!currentTags.size || !Array.isArray(tags)) return 0;
      let count = 0;
      tags.forEach((tag: any) => {
        const text = String(tag || "").trim();
        if (text && currentTags.has(text)) count += 1;
      });
      return count;
    };

    const scoredNodes = Array.from(mergedRowMap.values())
      .map((row) => formatNode(row))
      .filter(Boolean)
      .map((node: any) => {
        const classLabel = String(node.classLabel || "").trim();
        const updatedDays = Math.min(
          daysSince(node.updated_at || node.created_at),
          365,
        );
        const freshnessScore = 2.6 / (1 + updatedDays / 7);
        const overlap = tagOverlapCount(node.tags || []);
        const sameClassBoost =
          currentClass && classLabel && classLabel === currentClass ? 1.8 : 0;
        const overlapBoost = Math.min(1.6, overlap * 0.45);
        const richnessScore =
          (node.image ? 0.45 : 0) +
          (node.description ? 0.35 : 0) +
          (classLabel ? 0.25 : 0) +
          (Array.isArray(node.tags) && node.tags.length ? 0.35 : 0);
        const diversityPenalty = Math.min(
          1.5,
          (recentClassCounts.get(classLabel) || 0) * 0.45,
        );
        const recentPenalty = recentIdSet.has(node.id) ? 3 : 0;
        const randomJitter = Math.random() * 0.35;
        const score =
          freshnessScore +
          sameClassBoost +
          overlapBoost +
          richnessScore -
          diversityPenalty -
          recentPenalty +
          randomJitter;
        return { node, score };
      })
      .sort((a, b) => b.score - a.score);

    const samplePool = scoredNodes.slice(0, Math.max(limit * 4, 24));
    const picked: any[] = [];
    while (samplePool.length && picked.length < limit) {
      const totalWeight = samplePool.reduce(
        (sum, item) => sum + Math.max(0.05, item.score + 0.5),
        0,
      );
      let threshold = Math.random() * totalWeight;
      let pickedIndex = 0;
      for (let i = 0; i < samplePool.length; i += 1) {
        threshold -= Math.max(0.05, samplePool[i].score + 0.5);
        if (threshold <= 0) {
          pickedIndex = i;
          break;
        }
      }
      const [nextItem] = samplePool.splice(pickedIndex, 1);
      if (nextItem?.node) picked.push(nextItem.node);
    }

    return Response.json({ nodes: picked, total: total?.count || 0 });
  }

  if (url.pathname === "/api/kb/gallery_random" && method === "GET") {
    const limit = Math.max(
      1,
      parseInt(url.searchParams.get("limit") || "12", 10),
    );
    const parseListParam = (value: string | null) =>
      (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    let params: any[] = [];
    const imageFilterClause = `
      (TRIM(n.image) <> ''
       OR EXISTS (
         SELECT 1 FROM attributes a
         WHERE a.node_id = n.id
           AND a.key IN ('image', '图像')
           AND TRIM(a.value) <> ''
       )
       OR TRIM(COALESCE(json_extract(n.data, '$.image'), '')) <> ''
       OR TRIM(COALESCE(json_extract(n.data, '$.icon'), '')) <> ''
       OR TRIM(COALESCE(json_extract(n.data, '$.avatar'), '')) <> ''
       OR TRIM(COALESCE(json_extract(n.data, '$.img'), '')) <> ''
       OR TRIM(COALESCE(json_extract(n.data, '$.logo'), '')) <> ''
      )
    `;
    let whereClause = `WHERE ${imageFilterClause}`;

    if (hasProjectScope) {
      whereClause += ` AND ${scopedClause("n")}`;
      params.push(scopedProjectId);
    }

    const baseWhereClause = whereClause;
    const total = db
      .query(
        `SELECT COUNT(DISTINCT n.id) as count FROM nodes n ${baseWhereClause}`,
      )
      .get(...params) as any;

    const excludeIdsParam = parseListParam(url.searchParams.get("exclude_ids"));
    const recentIdsParam = parseListParam(url.searchParams.get("recent_ids"));
    const recentClassesParam = parseListParam(
      url.searchParams.get("recent_classes"),
    );
    const currentId = (url.searchParams.get("current_id") || "").trim();
    if (excludeIdsParam.length) {
      const placeholders = excludeIdsParam.map(() => "?").join(",");
      whereClause += ` AND n.id NOT IN (${placeholders})`;
      params.push(...excludeIdsParam);
    }

    const candidateLimit = Math.max(limit * 10, 80);
    const recentRows = db
      .query(
        `SELECT DISTINCT n.* FROM nodes n ${whereClause}
         ORDER BY datetime(COALESCE(n.updated_at, n.created_at)) DESC, n.rowid DESC
         LIMIT ?`,
      )
      .all(...params, candidateLimit) as any[];
    const randomRows = db
      .query(
        `SELECT DISTINCT n.* FROM nodes n ${whereClause} ORDER BY RANDOM() LIMIT ?`,
      )
      .all(...params, candidateLimit) as any[];

    const mergedRowMap = new Map<string, any>();
    [...recentRows, ...randomRows].forEach((row: any) => {
      const rowId = (row?.id || "").toString().trim();
      if (rowId && !mergedRowMap.has(rowId)) {
        mergedRowMap.set(rowId, row);
      }
    });

    const currentNode = currentId
      ? formatNode(
          db
            .query(
              `SELECT * FROM nodes n WHERE n.id = ?` +
                (hasProjectScope ? ` AND ${scopedClause("n")}` : "") +
                ` LIMIT 1`,
            )
            .get(
              currentId,
              ...(hasProjectScope ? [scopedProjectId] : []),
            ) as any,
        )
      : null;
    const currentClass = (currentNode?.classLabel || "").toString().trim();
    const currentTags = new Set(
      Array.isArray(currentNode?.tags)
        ? currentNode.tags
            .map((tag: any) => String(tag || "").trim())
            .filter(Boolean)
        : [],
    );
    const recentClassCounts = new Map<string, number>();
    recentClassesParam.forEach((className) => {
      recentClassCounts.set(
        className,
        (recentClassCounts.get(className) || 0) + 1,
      );
    });
    const recentIdSet = new Set(recentIdsParam);

    const daysSince = (value: any) => {
      if (!value) return 365;
      const time = new Date(value).getTime();
      if (!Number.isFinite(time)) return 365;
      return Math.max(0, (Date.now() - time) / 86400000);
    };
    const tagOverlapCount = (tags: any[]) => {
      if (!currentTags.size || !Array.isArray(tags)) return 0;
      let count = 0;
      tags.forEach((tag: any) => {
        const text = String(tag || "").trim();
        if (text && currentTags.has(text)) count += 1;
      });
      return count;
    };

    const scoredNodes = Array.from(mergedRowMap.values())
      .map((row) => formatNode(row))
      .filter(
        (node) => node && typeof node.image === "string" && node.image.trim(),
      )
      .map((node: any) => {
        const classLabel = String(node.classLabel || "").trim();
        const updatedDays = Math.min(
          daysSince(node.updated_at || node.created_at),
          365,
        );
        const freshnessScore = 2.4 / (1 + updatedDays / 7);
        const overlap = tagOverlapCount(node.tags || []);
        const sameClassBoost =
          currentClass && classLabel && classLabel === currentClass ? 1.7 : 0;
        const overlapBoost = Math.min(1.5, overlap * 0.45);
        const richnessScore =
          (node.image ? 0.75 : 0) +
          (node.description ? 0.3 : 0) +
          (classLabel ? 0.25 : 0) +
          (Array.isArray(node.tags) && node.tags.length ? 0.3 : 0);
        const diversityPenalty = Math.min(
          1.5,
          (recentClassCounts.get(classLabel) || 0) * 0.45,
        );
        const recentPenalty = recentIdSet.has(node.id) ? 3 : 0;
        const randomJitter = Math.random() * 0.35;
        const score =
          freshnessScore +
          sameClassBoost +
          overlapBoost +
          richnessScore -
          diversityPenalty -
          recentPenalty +
          randomJitter;
        return { node, score };
      })
      .sort((a, b) => b.score - a.score);

    const samplePool = scoredNodes.slice(0, Math.max(limit * 4, 24));
    const picked: any[] = [];
    while (samplePool.length && picked.length < limit) {
      const totalWeight = samplePool.reduce(
        (sum, item) => sum + Math.max(0.05, item.score + 0.5),
        0,
      );
      let threshold = Math.random() * totalWeight;
      let pickedIndex = 0;
      for (let i = 0; i < samplePool.length; i += 1) {
        threshold -= Math.max(0.05, samplePool[i].score + 0.5);
        if (threshold <= 0) {
          pickedIndex = i;
          break;
        }
      }
      const [nextItem] = samplePool.splice(pickedIndex, 1);
      if (nextItem?.node) picked.push(nextItem.node);
    }

    return Response.json({ nodes: picked, total: total?.count || 0 });
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
      let image = (body?.image ?? "").toString().trim();
      let video = (body?.video ?? "").toString().trim();
      const link = (body?.link ?? "").toString().trim();
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
      if (image && image.startsWith("http")) {
        image = await downloadRemoteMedia(
          image,
          NODE_IMAGE_UPLOADS_DIR,
          ["jpg", "jpeg", "png", "gif", "webp", "svg"],
          20 * 1024 * 1024,
        );
      }
      if (video && video.startsWith("http")) {
        video = await downloadRemoteMedia(
          video,
          NODE_VIDEO_UPLOADS_DIR,
          ["mp4", "webm", "ogg", "mov"],
          500 * 1024 * 1024,
        );
      }
      let entityOntologyId: string | null = null;
      if (entityType) {
        entityOntologyId = ensureOntologyRecord(entityType);
        const entityTypeToSave = entityOntologyId || entityType;
        db.run(
          "UPDATE nodes SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [entityTypeToSave, targetResult.node.id],
        );
        const entityClassId = ensureClassRecord(entityType);
        if (entityClassId) assignNodeClass(targetResult.node.id, entityClassId);
      }
      if (image || video || link) {
        const updates = [] as string[];
        const params = [] as any[];
        if (image) {
          updates.push("image = ?");
          params.push(image);
        }
        if (video) {
          updates.push("video = ?");
          params.push(video);
        }
        if (link) {
          updates.push("link = ?");
          params.push(link);
        }
        if (updates.length) {
          params.push(targetResult.node.id);
          db.run(
            `UPDATE nodes SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            params,
          );
        }
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
                const categoriesRaw = Array.isArray(payload?.categories)
                  ? payload.categories
                  : [];
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

                // Update extra fields (type, description, aliases, tags, media)
                const targetId = targetResult.node.id;
                let imageUrl = payload.image
                  ? String(payload.image).trim()
                  : "";
                let videoUrl = payload.video
                  ? String(payload.video).trim()
                  : "";
                const linkValue = payload.link
                  ? String(payload.link).trim()
                  : "";
                if (imageUrl && imageUrl.startsWith("http")) {
                  imageUrl = await downloadRemoteMedia(
                    imageUrl,
                    NODE_IMAGE_UPLOADS_DIR,
                    ["jpg", "jpeg", "png", "gif", "webp", "svg"],
                    20 * 1024 * 1024,
                  );
                }
                if (videoUrl && videoUrl.startsWith("http")) {
                  videoUrl = await downloadRemoteMedia(
                    videoUrl,
                    NODE_VIDEO_UPLOADS_DIR,
                    ["mp4", "webm", "ogg", "mov"],
                    500 * 1024 * 1024,
                  );
                }
                if (
                  payload.entityType ||
                  payload.targetDescription ||
                  (Array.isArray(payload.aliases) && payload.aliases.length) ||
                  (Array.isArray(payload.tags) && payload.tags.length) ||
                  imageUrl ||
                  videoUrl ||
                  linkValue
                ) {
                  const updateFields: any = {};
                  let entityTypeToSave: string | null = null;
                  if (payload.entityType) {
                    const ontologyId = ensureOntologyRecord(payload.entityType);
                    entityTypeToSave = ontologyId || payload.entityType;
                    updateFields.type = entityTypeToSave;
                  }
                  if (payload.targetDescription)
                    updateFields.description = payload.targetDescription;
                  if (Array.isArray(payload.aliases))
                    updateFields.aliases = JSON.stringify(payload.aliases);
                  if (Array.isArray(payload.tags))
                    updateFields.tags = JSON.stringify(payload.tags);
                  if (imageUrl) updateFields.image = imageUrl;
                  if (videoUrl) updateFields.video = videoUrl;
                  if (linkValue) updateFields.link = linkValue;
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
                if (categoriesRaw.length) {
                  for (const categoryValue of categoriesRaw) {
                    const categoryName = (categoryValue || "")
                      .toString()
                      .trim();
                    if (!categoryName) continue;
                    const classId = ensureClassRecord(categoryName);
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

  if (url.pathname === "/api/kb/fetch" && method === "POST") {
    try {
      const body = (await req.json()) as any;
      const targetUrl = String(body?.url || "").trim();
      if (!targetUrl) {
        return Response.json({ error: "Missing url" }, { status: 400 });
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        return Response.json({ error: "Invalid URL" }, { status: 400 });
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return Response.json(
          { error: "Only http(s) URLs are allowed" },
          { status: 400 },
        );
      }
      const forbiddenHosts = [
        "localhost",
        "127.0.0.1",
        "::1",
        "[::1]",
        "0.0.0.0",
      ];
      if (forbiddenHosts.includes(parsedUrl.hostname)) {
        return Response.json(
          { error: "Localhost and loopback addresses are not allowed" },
          { status: 400 },
        );
      }
      const resp = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      const contentType =
        resp.headers.get("content-type") || "application/json";
      const bodyText = await resp.text();
      return new Response(bodyText, {
        status: resp.status,
        headers: {
          "Content-Type": contentType,
        },
      });
    } catch (err) {
      console.error(err);
      return Response.json(
        { error: "Failed to fetch remote URL" },
        { status: 500 },
      );
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

  if (url.pathname === "/api/kb/upload-video" && method === "POST") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response("No file uploaded", { status: 400 });
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const allowedExts = ["mp4", "webm", "mov", "avi", "mkv", "ogg", "mpeg"];
      if (!allowedExts.includes(ext)) {
        return new Response("Invalid video file type", { status: 400 });
      }
      const maxSize = 500 * 1024 * 1024;
      if (typeof file.size === "number" && file.size > maxSize) {
        return new Response("视频文件过大，请上传不超过 500MB 的视频。", {
          status: 413,
        });
      }
      const filename = `${crypto.randomUUID()}.${ext}`;
      const filePath = resolve(NODE_VIDEO_UPLOADS_DIR, filename);
      const arrayBuffer = await file.arrayBuffer();
      writeFileSync(filePath, Buffer.from(arrayBuffer));
      const fileUrl = `/static/uploads/${appFolder}/node-videos/${filename}`;
      return Response.json({ ok: true, url: fileUrl });
    } catch (e) {
      console.error(e);
      return new Response("Error uploading video", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/upload-image" && method === "POST") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response("No file uploaded", { status: 400 });
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const allowedExts = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "bmp",
        "ico",
        "avif",
        "heif",
      ];
      if (!allowedExts.includes(ext)) {
        return new Response("Invalid image file type", { status: 400 });
      }
      const maxSize = 20 * 1024 * 1024;
      if (typeof file.size === "number" && file.size > maxSize) {
        return new Response("图片文件过大，请上传不超过 20MB 的图片。", {
          status: 413,
        });
      }
      const filename = `${crypto.randomUUID()}.${ext}`;
      const filePath = resolve(NODE_IMAGE_UPLOADS_DIR, filename);
      const arrayBuffer = await file.arrayBuffer();
      writeFileSync(filePath, Buffer.from(arrayBuffer));
      const fileUrl = `/static/uploads/${appFolder}/node-images/${filename}`;
      return Response.json({ ok: true, url: fileUrl });
    } catch (e) {
      console.error(e);
      return new Response("Error uploading image", { status: 500 });
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
      let image = body.image != null ? String(body.image).trim() : "";
      let link = body.link != null ? String(body.link).trim() : "";
      let video = body.video != null ? String(body.video).trim() : "";

      if (image && image.startsWith("data:image/")) {
        image = await saveDataUrlImageToLocal(image);
      } else if (image && image.startsWith("http")) {
        image = await downloadRemoteMedia(
          image,
          NODE_IMAGE_UPLOADS_DIR,
          ["jpg", "jpeg", "png", "gif", "webp", "svg"],
          20 * 1024 * 1024,
        );
      }
      if (video && video.startsWith("http")) {
        video = await downloadRemoteMedia(
          video,
          NODE_VIDEO_UPLOADS_DIR,
          ["mp4", "webm", "ogg", "mov"],
          500 * 1024 * 1024,
        );
      }

      db.run(
        "INSERT INTO nodes (id, name, type, description, aliases, tags, image, link, video, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          name,
          type,
          desc,
          aliases,
          tags,
          image,
          link,
          video,
          scopedProjectId,
        ],
      );

      if (body.categories !== undefined) {
        const categoryIds = normalizeListValue(body.categories || []);
        for (const categoryValue of categoryIds) {
          const classId = ensureClassRecord(categoryValue);
          if (classId) {
            assignNodeClass(id, classId);
          }
        }
      }

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
      if (body.categories !== undefined) {
        const normalizedCategories = normalizeListValue(body.categories || []);
        db.run("DELETE FROM entity_classes WHERE entity_id = ?", [id]);
        for (const categoryValue of normalizedCategories) {
          const classId = ensureClassRecord(categoryValue);
          if (classId) {
            assignNodeClass(id, classId);
          }
        }
      }
      if (body.type !== undefined) {
        updates.push("type = ?");
        params.push(body.type !== null ? String(body.type) : null);
      }
      if (body.image !== undefined) {
        let imageValue = body.image ? String(body.image).trim() : "";
        if (imageValue && imageValue.startsWith("data:image/")) {
          imageValue = await saveDataUrlImageToLocal(imageValue);
        } else if (imageValue && imageValue.startsWith("http")) {
          imageValue = await downloadRemoteMedia(
            imageValue,
            NODE_IMAGE_UPLOADS_DIR,
            ["jpg", "jpeg", "png", "gif", "webp", "svg"],
            20 * 1024 * 1024,
          );
        }
        updates.push("image = ?");
        params.push(imageValue || "");
      }
      if (body.link !== undefined && body.link !== null) {
        updates.push("link = ?");
        params.push(body.link ? String(body.link).trim() : "");
      }
      if (body.video !== undefined) {
        let videoValue = body.video ? String(body.video).trim() : "";
        if (videoValue && videoValue.startsWith("http")) {
          videoValue = await downloadRemoteMedia(
            videoValue,
            NODE_VIDEO_UPLOADS_DIR,
            ["mp4", "webm", "ogg", "mov"],
            500 * 1024 * 1024,
          );
        }
        updates.push("video = ?");
        params.push(videoValue || "");
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
      const targetField = String(body.target_field || "aliases").trim();
      const removeAfter = body.remove === true;
      const deleteTargets = body.delete_targets === true;
      const allowedTargetFields = new Set(["aliases", "tags", "description", "name"]);
      if (!allowedTargetFields.has(targetField)) {
        return new Response("Invalid target_field", { status: 400 });
      }

      const normalizeStoredArray = (raw: any): string[] => {
        if (Array.isArray(raw)) {
          return raw.map((item) => String(item || "").trim()).filter(Boolean);
        }
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw || "[]");
            if (Array.isArray(parsed)) {
              return parsed
                .map((item) => String(item || "").trim())
                .filter(Boolean);
            }
          } catch {
            return raw
              .split(/[\n,，;、]+/)
              .map((item) => item.trim())
              .filter(Boolean);
          }
        }
        return [];
      };

      const appendTextValues = (current: string, values: string[]) => {
        const deduped = values.filter(
          (value) => value && !current.includes(value),
        );
        if (!deduped.length) return current;
        if (!current) return deduped.join("；");
        return `${current}\n${deduped.join("；")}`;
      };

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
          .query(
            "SELECT name, description, aliases, tags FROM nodes WHERE id = ?",
          )
          .get(attr.node_id) as any;
        if (!nodeRow) continue;

        let updated = false;
        const updates: string[] = [];
        const params: any[] = [];

        if (targetField === "aliases" || targetField === "tags") {
          const existing = normalizeStoredArray(nodeRow[targetField]);
          const merged = Array.from(new Set([...existing, ...newAliases]));
          updates.push(`${targetField} = ?`);
          params.push(JSON.stringify(merged));
          updated = merged.length > existing.length;
        } else if (targetField === "description") {
          const currentDescription = String(nodeRow.description || "").trim();
          const nextDescription = appendTextValues(
            currentDescription,
            newAliases,
          );
          if (nextDescription !== currentDescription) {
            updates.push("description = ?");
            params.push(nextDescription);
            updated = true;
          }
        } else if (targetField === "name") {
          const currentName = String(nodeRow.name || "").trim();
          const extraNames = newAliases.filter(
            (value) => value && value !== currentName,
          );
          if (extraNames.length) {
            const nextName = currentName
              ? `${currentName} / ${extraNames.join(" / ")}`
              : extraNames.join(" / ");
            updates.push("name = ?");
            params.push(nextName);
            updated = true;
          }
        }

        if (updated) {
          params.push(attr.node_id);
          db.run(
            `UPDATE nodes SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            params,
          );
          updatedCount++;
        }

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

      let propertyDeleted = false;
      if (removeAfter) {
        try {
          db.run("DELETE FROM ontology_properties WHERE property_id = ?", [propertyId]);
          db.run("DELETE FROM class_properties WHERE property_id = ?", [propertyId]);
          db.run(
            "DELETE FROM property_properties WHERE parent_property_id = ? OR child_property_id = ?",
            [propertyId, propertyId],
          );
          if (hasProjectScope) {
            db.run(
              "DELETE FROM properties WHERE id = ? AND project_id = ?",
              [propertyId, scopedProjectId],
            );
          } else {
            db.run("DELETE FROM properties WHERE id = ? AND project_id IS NULL", [propertyId]);
          }
          propertyDeleted = true;
        } catch (err) {
          console.warn("delete extracted property failed", err);
        }
      }

      return Response.json({
        success: true,
        matched: attrs.length,
        updated: updatedCount,
        removed: removedCount,
        deletedNodes,
        propertyDeleted,
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

  if (
    url.pathname === "/api/kb/clean/normalize-node-types" &&
    method === "POST"
  ) {
    try {
      const body = (await req.json()) as any;
      const ontologyIds = Array.isArray(body.ontology_ids)
        ? body.ontology_ids.map((id: any) => (id || "").toString().trim())
        : [];
      const selectedIds = Array.from(new Set(ontologyIds)).filter(Boolean);
      if (!selectedIds.length)
        return new Response("Missing ontology_ids", { status: 400 });

      const placeholders = selectedIds.map(() => "?").join(",");
      const rows = hasProjectScope
        ? (db
            .query(
              `SELECT id, name FROM ontologies WHERE project_id = ? AND id IN (${placeholders})`,
            )
            .all(scopedProjectId, ...selectedIds) as any[])
        : (db
            .query(
              `SELECT id, name FROM ontologies WHERE project_id IS NULL AND id IN (${placeholders})`,
            )
            .all(...selectedIds) as any[]);

      let matched = 0;
      let updated = 0;
      for (const ontology of rows) {
        const ontologyId = (ontology?.id || "").toString().trim();
        const ontologyName = (ontology?.name || "").toString().trim();
        if (!ontologyId) continue;

        const whereClause = hasProjectScope
          ? `${scopedClause()} AND (lower(trim(type)) = lower(?) OR lower(trim(type)) = lower(?))`
          : `(lower(trim(type)) = lower(?) OR lower(trim(type)) = lower(?))`;
        const countSql = `SELECT COUNT(*) AS count FROM nodes WHERE ${whereClause}`;
        const countRow = hasProjectScope
          ? (db.query(countSql).get(scopedProjectId, ontologyId, ontologyName) as any)
          : (db.query(countSql).get(ontologyId, ontologyName) as any);
        const count = countRow?.count || 0;
        if (count <= 0) continue;

        matched += count;
        const updateSql = `UPDATE nodes SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause}`;
        if (hasProjectScope) {
          db.run(updateSql, ontologyId, scopedProjectId, ontologyId, ontologyName);
        } else {
          db.run(updateSql, ontologyId, ontologyId, ontologyName);
        }
        updated += count;
      }

      return Response.json({
        success: true,
        matched,
        updated,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error normalizing node types", { status: 500 });
    }
  }

  if (
    url.pathname === "/api/kb/clean/change-property-type" &&
    method === "POST"
  ) {
    try {
      const body = (await req.json()) as any;
      const propertyId = (body?.property_id || "").toString().trim();
      const newDatatype = (body?.datatype || "").toString().trim();
      const deleteTargets = body?.delete_targets === true;
      if (!propertyId)
        return new Response("Missing property_id", { status: 400 });
      if (!newDatatype)
        return new Response("Missing datatype", { status: 400 });
      if (!["string", "wikibase-entityid"].includes(newDatatype)) {
        return new Response("Unsupported datatype", { status: 400 });
      }

      const property = hasProjectScope
        ? (db
            .query(
              `SELECT * FROM properties WHERE id = ? AND project_id = ? LIMIT 1`,
            )
            .get(propertyId, scopedProjectId) as any)
        : (db
            .query(
              "SELECT * FROM properties WHERE id = ? AND project_id IS NULL LIMIT 1",
            )
            .get(propertyId) as any);
      if (!property?.id)
        return new Response("Property not found", { status: 404 });

      const oldDatatype =
        (property.datatype || "string").toString().trim() || "string";
      if (oldDatatype === newDatatype) {
        return Response.json({
          success: true,
          matched: 0,
          updated: 0,
          deletedNodes: 0,
          message: "类型未变化",
        });
      }

      const newValuetype =
        newDatatype === "wikibase-entityid" ? "wikibase-entityid" : null;
      if (hasProjectScope) {
        db.run(
          "UPDATE properties SET datatype = ?, valuetype = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?",
          [newDatatype, newValuetype, propertyId, scopedProjectId],
        );
      } else {
        db.run(
          "UPDATE properties SET datatype = ?, valuetype = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id IS NULL",
          [newDatatype, newValuetype, propertyId],
        );
      }

      const attrs = hasProjectScope
        ? (db
            .query(
              `SELECT a.id, a.node_id, a.value, a.datatype FROM attributes a JOIN nodes n ON a.node_id = n.id WHERE a.key = ? AND n.project_id = ?`,
            )
            .all(propertyId, scopedProjectId) as any[])
        : (db
            .query(
              "SELECT id, node_id, value, datatype FROM attributes WHERE key = ?",
            )
            .all(propertyId) as any[]);

      let updatedCount = 0;
      const targetNodeIds = new Set<string>();

      for (const attr of attrs) {
        const values = parseStoredAttributeValues(attr.value, oldDatatype);
        if (!values.length) {
          db.run("DELETE FROM attributes WHERE id = ?", [attr.id]);
          continue;
        }

        if (oldDatatype === "string" && newDatatype === "wikibase-entityid") {
          const entityValues: any[] = [];
          for (const rawValue of values) {
            const text = rawValue?.toString?.().trim?.() || "";
            if (!text) continue;
            let targetId = extractEntityId(rawValue);
            let targetNode: any = null;
            if (targetId) {
              targetNode = hasProjectScope
                ? (db
                    .query(
                      "SELECT id, name FROM nodes WHERE id = ? AND project_id = ?",
                    )
                    .get(targetId, scopedProjectId) as any)
                : (db
                    .query("SELECT id, name FROM nodes WHERE id = ?")
                    .get(targetId) as any);
            }
            if (!targetNode) {
              const normalizedName = text;
              const nodeResult = ensureNodeByName(normalizedName, {
                ...(hasProjectScope ? { projectId: scopedProjectId } : {}),
              });
              targetNode = nodeResult.node;
            }
            if (!targetNode?.id) continue;
            const label =
              (targetNode.name || "").toString().trim() || targetNode.id;
            entityValues.push({
              "entity-type": "item",
              id: targetNode.id.toString(),
              label_zh: label,
              label,
              name: label,
            });
          }
          if (!entityValues.length) {
            db.run("DELETE FROM attributes WHERE id = ?", [attr.id]);
            continue;
          }
          const normalizedEntityValues =
            normalizeEntityAttributeValues(entityValues);
          if (!normalizedEntityValues.length) {
            db.run("DELETE FROM attributes WHERE id = ?", [attr.id]);
            continue;
          }
          const serialized = serializeAttributeValues(
            normalizedEntityValues,
            "wikibase-entityid",
          );
          db.run(
            "UPDATE attributes SET value = ?, datatype = ?, property_name_snapshot = ? WHERE id = ?",
            [serialized, "wikibase-entityid", property.name || null, attr.id],
          );
          updatedCount++;
          continue;
        }

        if (oldDatatype === "wikibase-entityid" && newDatatype === "string") {
          const stringValues: string[] = [];
          for (const rawValue of values) {
            const targetId = extractEntityId(rawValue);
            if (targetId) {
              targetNodeIds.add(targetId);
            }
            if (rawValue && typeof rawValue === "object") {
              const label =
                rawValue.label_zh ||
                rawValue.label ||
                rawValue.name ||
                rawValue.id ||
                rawValue["entity-id"] ||
                "";
              if (label && label.toString().trim()) {
                stringValues.push(label.toString().trim());
              }
            } else if (
              typeof rawValue === "string" ||
              typeof rawValue === "number"
            ) {
              const valueText = rawValue.toString().trim();
              if (valueText) stringValues.push(valueText);
            }
          }

          const normalized = Array.from(
            new Set(
              stringValues.map((v) => v.toString().trim()).filter(Boolean),
            ),
          );
          if (!normalized.length) {
            db.run("DELETE FROM attributes WHERE id = ?", [attr.id]);
            continue;
          }
          const serialized = serializeAttributeValues(normalized, "string");
          db.run(
            "UPDATE attributes SET value = ?, datatype = ?, property_name_snapshot = ? WHERE id = ?",
            [serialized, "string", property.name || null, attr.id],
          );
          updatedCount++;
          continue;
        }

        db.run(
          "UPDATE attributes SET datatype = ?, property_name_snapshot = ? WHERE id = ?",
          [newDatatype, property.name || null, attr.id],
        );
        updatedCount++;
      }

      let deletedNodes = 0;
      if (deleteTargets && targetNodeIds.size > 0) {
        const deleteNodeSql = hasProjectScope
          ? `DELETE FROM nodes WHERE id = ? AND ${scopedClause()}`
          : "DELETE FROM nodes WHERE id = ?";
        for (const targetId of targetNodeIds) {
          const exists = hasProjectScope
            ? (db
                .query(
                  `SELECT id FROM nodes WHERE id = ? AND ${scopedClause()}`,
                )
                .get(targetId, scopedProjectId) as any)
            : (db
                .query("SELECT id FROM nodes WHERE id = ?")
                .get(targetId) as any);
          if (!exists?.id) continue;
          db.run("DELETE FROM attributes WHERE node_id = ?", [targetId]);
          const incomingAttrs = db
            .query(
              "SELECT id, value, datatype FROM attributes WHERE datatype = 'wikibase-entityid' AND value LIKE ?",
            )
            .all(`%"${targetId}"%`) as any[];
          for (const incoming of incomingAttrs) {
            if (
              attributeValuesContainEntityId(
                incoming.value,
                incoming.datatype,
                targetId,
              )
            ) {
              db.run("DELETE FROM attributes WHERE id = ?", [incoming.id]);
            }
          }
          db.run("DELETE FROM entity_classes WHERE entity_id = ?", [targetId]);
          if (hasProjectScope) {
            db.run(deleteNodeSql, [targetId, scopedProjectId]);
          } else {
            db.run(deleteNodeSql, [targetId]);
          }
          deletedNodes++;
        }
      }

      return Response.json({
        success: true,
        matched: attrs.length,
        updated: updatedCount,
        deletedNodes,
      });
    } catch (e) {
      console.error(e);
      return new Response("Error changing property type", { status: 500 });
    }
  }

  if (url.pathname === "/api/kb/node-types" && method === "GET") {
    try {
      const rows = hasProjectScope
        ? (db
            .query(
              `SELECT DISTINCT type FROM nodes WHERE ${scopedClause()}`,
            )
            .all(scopedProjectId) as any[])
        : (db
            .query(
              "SELECT DISTINCT type FROM nodes",
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
      let value = body.value;
      const datatype = body.datatype || "string";
      const id = body.id || `attr/${crypto.randomUUID()}`;

      if (datatype === "commonsMedia") {
        if (typeof value === "string" && value.startsWith("data:image/")) {
          value = await saveDataUrlImageToLocal(value);
        } else if (Array.isArray(value)) {
          const converted = [];
          for (const item of value) {
            if (typeof item === "string" && item.startsWith("data:image/")) {
              converted.push(await saveDataUrlImageToLocal(item));
            } else {
              converted.push(item);
            }
          }
          value = converted;
        }
      }

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
      const label = body.label || type;

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
        label,
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

      const displayLabel = propRec && propRec.name ? propRec.name : propId;

      return Response.json(
        formatEdge({
          id: attr.id + ":" + targetId,
          source,
          target: targetId,
          type: propId,
          label: displayLabel,
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
