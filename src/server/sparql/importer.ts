import { db } from "../db.ts";
import { ensureAttributeRecord, ensurePropertyRecord } from "../utils.ts";
import { mkdirSync } from "fs";
import { resolve } from "path";

const IMAGE_FILE_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;

function mediaSourceUrl(value: string, allowCommonsFilename = false) {
  const source = String(value || "").trim();
  if (!source) return "";
  // A Commons File: URL is a description page, not the media binary. Convert it
  // back to its filename so it goes through Special:FilePath below.
  const commonsFileMatch = source.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:([^?#]+)/i);
  const commonsFilename = commonsFileMatch
    ? decodeURIComponent(commonsFileMatch[1] || "")
    : source.replace(/^File:/i, "");
  if (/^https:\/\//i.test(commonsFilename)) return commonsFilename;
  if (!allowCommonsFilename && !IMAGE_FILE_PATTERN.test(commonsFilename)) return "";
  // Wikidata P18 values are Commons file names; Special:FilePath resolves them to the binary file.
  // Commons canonicalizes file titles as underscores (e.g. President_Barack_Obama.jpg).
  const normalizedFilename = commonsFilename.replace(/\s+/g, "_");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalizedFilename)}`;
}

async function cacheImportedImage(source: string, projectId: number | null, allowCommonsFilename = false) {
  const target = mediaSourceUrl(source, allowCommonsFilename);
  if (!target) return { localUrl: "", error: "无法解析媒体源" };
  let lastError = "下载请求失败";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(target, {
        redirect: "follow",
        signal: AbortSignal.timeout(60000),
        headers: {
          "User-Agent": "KnowledgeGraphSPARQL/1.0 (local media importer)",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (!response.ok) return { localUrl: "", error: `HTTP ${response.status}` };
      if (!contentType.startsWith("image/")) return { localUrl: "", error: `响应类型不是图片：${contentType || "未知"}` };
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) return { localUrl: "", error: "媒体文件为空或超过 20 MB" };
      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : contentType.includes("svg") ? "svg" : "jpg";
      const folder = projectId === null ? "app" : String(projectId);
      const directory = resolve(import.meta.dir, "..", "..", "..", "uploads", folder, "node-images");
      mkdirSync(directory, { recursive: true });
      const filename = `${crypto.randomUUID()}.${extension}`;
      await Bun.write(resolve(directory, filename), bytes);
      return { localUrl: `/static/uploads/${folder}/node-images/${filename}`, error: "" };
    } catch (error) {
      lastError = String((error as Error)?.message || error || "下载请求失败");
    }
  }
  return { localUrl: "", error: lastError };
}

function getLanguage(value: any) {
  return value?.["xml:lang"] || value?.language || "";
}

function rdfValueToText(value: any) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return String(value?.value ?? "").trim();
}

function qidFromValue(value: any) {
  const text = rdfValueToText(value);
  const match = text.match(/([QP]\d+)$/i);
  return match?.[1] ? match[1].toUpperCase() : text.split("/").filter(Boolean).pop() || text;
}

function inferRdfDatatype(value: any) {
  if (String(value?.type || "").toLowerCase() === "uri") return "wikibase-entityid";
  const datatype = String(value?.datatype || "").toLowerCase();
  if (/(boolean)$/.test(datatype)) return "boolean";
  if (/(integer|decimal|double|float)$/.test(datatype)) return "number";
  if (/(date|datetime|time)$/.test(datatype)) return "time";
  return "string";
}

function updatePropertyDatatype(propertyId: string, datatype: string, projectId: number | null) {
  if (!propertyId || datatype === "string") return;
  const scope = projectId !== null ? "project_id = ?" : "project_id IS NULL";
  const params = projectId !== null ? [datatype, datatype, propertyId, projectId] : [datatype, datatype, propertyId];
  db.run(
    `UPDATE properties
     SET datatype = ?, valuetype = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND ${scope}
       AND (datatype IS NULL OR trim(datatype) = '' OR lower(datatype) = 'string')`,
    params,
  );
}

function recommendFieldRole(field: string) {
  const lower = field.toLowerCase();
  if (/(^|_)(item|entity|person|subject|resource|uri|id|s)$/.test(lower)) return "entity_id";
  if (/(label|name|title)$/.test(lower)) return "label";
  if (/(description|abstract|summary|comment)$/.test(lower)) return "description";
  if (/(type|class|instanceof|category)$/.test(lower)) return "type";
  if (/(subject|from|source)$/.test(lower)) return "relation_from";
  if (/(object|to|target)$/.test(lower)) return "relation_to";
  if (/(property|predicate|relation)$/.test(lower)) return "relation_type";
  return "property";
}

function scopedNodeWhere(projectId: number | null) {
  return projectId !== null ? "project_id = ?" : "project_id IS NULL";
}

function scopedNodeParams(projectId: number | null) {
  return projectId !== null ? [projectId] : [];
}

function makeScopedNodeId(sourceId: string, projectId: number | null) {
  return projectId !== null ? `sparql:${projectId}:${sourceId}` : sourceId;
}

function ensureOntologyRecord(name: string, projectId: number | null) {
  const normalized = String(name || "").trim();
  if (!normalized) return null;
  const existing = projectId !== null
    ? (db.query("SELECT id FROM ontologies WHERE lower(name) = lower(?) AND project_id = ? LIMIT 1").get(normalized, projectId) as any)
    : (db.query("SELECT id FROM ontologies WHERE lower(name) = lower(?) AND project_id IS NULL LIMIT 1").get(normalized) as any);
  if (existing?.id) return String(existing.id);

  const id = `ontology/${crypto.randomUUID()}`;
  const order = projectId !== null
    ? (db.query("SELECT COALESCE(MAX(sort_order), 0) AS value FROM ontologies WHERE project_id = ?").get(projectId) as any)
    : (db.query("SELECT COALESCE(MAX(sort_order), 0) AS value FROM ontologies WHERE project_id IS NULL").get() as any);
  db.run(
    "INSERT INTO ontologies (id, name, description, parent_id, project_id, sort_order, status) VALUES (?, ?, '', NULL, ?, ?, 'active')",
    [id, normalized, projectId, Number(order?.value || 0) + 1],
  );
  return id;
}

function linkOntologyProperty(ontologyId: string | null, propertyId: string | null) {
  if (!ontologyId || !propertyId) return;
  db.run("INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)", [ontologyId, propertyId]);
}

function ensureClassRecord(name: string, projectId: number | null) {
  const normalized = String(name || "").trim();
  if (!normalized) return null;
  const existing = projectId !== null
    ? (db.query("SELECT id FROM classes WHERE lower(name) = lower(?) AND project_id = ? LIMIT 1").get(normalized, projectId) as any)
    : (db.query("SELECT id FROM classes WHERE lower(name) = lower(?) AND project_id IS NULL LIMIT 1").get(normalized) as any);
  if (existing?.id) return String(existing.id);

  const id = `class/${crypto.randomUUID()}`;
  const order = projectId !== null
    ? (db.query("SELECT COALESCE(MAX(sort_order), 0) AS value FROM classes WHERE project_id = ?").get(projectId) as any)
    : (db.query("SELECT COALESCE(MAX(sort_order), 0) AS value FROM classes WHERE project_id IS NULL").get() as any);
  db.run(
    "INSERT INTO classes (id, name, description, parent_id, project_id, sort_order) VALUES (?, ?, '', NULL, ?, ?)",
    [id, normalized, projectId, Number(order?.value || 0) + 1],
  );
  return id;
}

function assignNodeClass(nodeId: string, classId: string | null) {
  if (!nodeId || !classId) return;
  db.run("INSERT OR IGNORE INTO entity_classes (entity_id, class_id) VALUES (?, ?)", [nodeId, classId]);
}

function linkClassProperty(classId: string | null, propertyId: string | null) {
  if (!classId || !propertyId) return;
  db.run("INSERT OR IGNORE INTO class_properties (class_id, property_id) VALUES (?, ?)", [classId, propertyId]);
}

function findExistingNode(projectId: number | null, sourceId: string, label: string) {
  const scopedId = makeScopedNodeId(sourceId, projectId);
  const row = db
    .query(
      `SELECT id, name
       FROM nodes
       WHERE ${scopedNodeWhere(projectId)}
         AND (id = ? OR lower(name) = lower(?))
       LIMIT 1`,
    )
    .get(...scopedNodeParams(projectId), scopedId, label || sourceId) as any;
  return row || null;
}

export function buildFieldSuggestions(result: any) {
  const sampleRow = (Array.isArray(result?.rows) ? result.rows[0] : null) || {};
  return (result?.columns || []).map((column: string) => ({
    source: column,
    sample: sampleRow?.[column] || null,
    recommendedRole: recommendFieldRole(column),
  }));
}

export function buildImportPreview(result: any, mapping: any, endpointMeta: any, projectId: number | null = null) {
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const fieldMappings = Array.isArray(mapping?.fields) ? mapping.fields : [];
  const roleByField = new Map(fieldMappings.map((item: any) => [item.source, item]));
  const entityMap = new Map<string, any>();
  const relationMap = new Map<string, any>();
  const warnings: string[] = [];

  for (const row of rows) {
    let sourceId = "";
    let label = "";
    let description = "";
    let type = mapping?.defaultEntityType || "SPARQL实体";
    const properties: Record<string, any> = {};
    let relationFrom = "";
    let relationTo = "";
    let relationType = "";

    for (const [field, value] of Object.entries(row || {})) {
      const rule: any = roleByField.get(field) || { role: recommendFieldRole(field) };
      const role = rule.role || "property";
      const textValue = rdfValueToText(value);
      if (role === "entity_id") sourceId = qidFromValue(value);
      else if (role === "label") label = textValue || label;
      else if (role === "description") description = textValue || description;
      else if (role === "type") type = textValue || type;
      else if (role === "relation_from") relationFrom = qidFromValue(value);
      else if (role === "relation_to") relationTo = qidFromValue(value);
      else if (role === "relation_type") relationType = textValue || qidFromValue(value);
      else if (role !== "ignore") {
        properties[rule.targetField || field] = {
          value: textValue,
          datatype: inferRdfDatatype(value),
          label: rule.displaySource ? rdfValueToText((row as any)?.[rule.displaySource]) : textValue,
        };
      }
    }

    if (sourceId) {
      const entity = entityMap.get(sourceId) || {
        sourceId,
        nodeId: makeScopedNodeId(sourceId, projectId),
        label: "",
        type,
        description: "",
        properties: {},
        labels: {},
        descriptions: {},
        source: {
          type: "sparql",
          endpointId: endpointMeta?.id || null,
          endpoint: endpointMeta?.endpoint || "",
          projectId,
        },
      };
      if (label) {
        const sampleLabelField = Object.values(row || {}).find((item: any) => rdfValueToText(item) === label);
        const lang = getLanguage(sampleLabelField) || "zh";
        entity.labels[lang] = label;
        if (!entity.label) entity.label = label;
      }
      if (description) {
        entity.descriptions.zh = entity.descriptions.zh || description;
        if (!entity.description) entity.description = description;
      }
      entity.type = entity.type || type;
      Object.assign(entity.properties, properties);
      entityMap.set(sourceId, entity);
    }

    if (relationFrom && relationTo && relationType) {
      const key = `${relationFrom}::${relationType}::${relationTo}`;
      relationMap.set(key, {
        fromSourceId: relationFrom,
        toSourceId: relationTo,
        fromNodeId: makeScopedNodeId(relationFrom, projectId),
        toNodeId: makeScopedNodeId(relationTo, projectId),
        property: relationType,
        source: {
          type: "sparql",
          endpointId: endpointMeta?.id || null,
          projectId,
        },
      });
    }
  }

  const entityPreview = Array.from(entityMap.values()).map((entity) => {
    const existing = findExistingNode(projectId, entity.sourceId, entity.label || entity.sourceId);
    return {
      sourceId: entity.sourceId,
      nodeId: entity.nodeId,
      label: entity.label || entity.sourceId,
      type: entity.type,
      action: existing?.id ? "update" : "create",
      warning: entity.label ? "" : "缺少名称，导入时将使用 sourceId 作为名称",
      entity,
    };
  });

  const relationPreview = Array.from(relationMap.values()).map((relation) => ({
    from: relation.fromSourceId,
    to: relation.toSourceId,
    property: relation.property,
    action: "create",
    valid: true,
    warning: "",
    relation,
  }));

  return {
    summary: {
      rawRows: rows.length,
      entityCount: entityPreview.length,
      relationCount: relationPreview.length,
      createEntityCount: entityPreview.filter((item) => item.action === "create").length,
      updateEntityCount: entityPreview.filter((item) => item.action === "update").length,
      duplicateEntityCount: rows.length - entityPreview.length,
      skippedEntityCount: 0,
      createRelationCount: relationPreview.length,
      duplicateRelationCount: 0,
      invalidRelationCount: 0,
      missingRequiredCount: entityPreview.filter((item) => !item.sourceId).length,
      transformFailedCount: 0,
    },
    entities: entityPreview,
    relations: relationPreview,
    suggestions: buildFieldSuggestions(result),
    warnings,
  };
}

export async function importPreviewToGraph(preview: any, config: any = {}) {
  const projectId = typeof config?.projectId === "number" && Number.isFinite(config.projectId) ? config.projectId : null;
  const summary = {
    imported: 0,
    createdNodes: 0,
    updatedNodes: 0,
    createdEdges: 0,
    skipped: 0,
    failed: 0,
    mediaDownloaded: 0,
    mediaFailed: 0,
    mediaErrors: [] as string[],
  };
  const entityIdMap = new Map<string, string>();

  const ensureNodeExistsById = (sourceId: string, fallbackLabel?: string) => {
    const nodeId = makeScopedNodeId(sourceId, projectId);
    const existing = db
      .query(`SELECT id FROM nodes WHERE id = ? AND ${scopedNodeWhere(projectId)} LIMIT 1`)
      .get(nodeId, ...scopedNodeParams(projectId)) as any;
    if (existing?.id) return existing.id;
    db.run(
      `INSERT INTO nodes (id, name, type, description, aliases, tags, data, project_id, created_at, updated_at)
       VALUES (?, ?, 'SPARQL实体', '', '[]', '[]', '{}', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [nodeId, fallbackLabel || sourceId, projectId],
    );
    return nodeId;
  };

  for (const item of preview?.entities || []) {
    try {
      const entity = item.entity;
      const ontologyId = ensureOntologyRecord(entity.type || "SPARQL实体", projectId);
      const classId = ensureClassRecord(entity.type || "SPARQL实体", projectId);
      const nodeId = entity.nodeId || makeScopedNodeId(entity.sourceId, projectId);
      const existing = db
        .query(`SELECT id, name FROM nodes WHERE id = ? AND ${scopedNodeWhere(projectId)} LIMIT 1`)
        .get(nodeId, ...scopedNodeParams(projectId)) as any;

      if (existing?.id) {
        db.run(
          `UPDATE nodes
           SET name = ?, type = ?, description = COALESCE(NULLIF(description, ''), ?), data = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND ${scopedNodeWhere(projectId)}`,
          [
            entity.label || existing.name || entity.sourceId,
            entity.type || "SPARQL实体",
            entity.description || "",
            JSON.stringify({
              sourceId: entity.sourceId,
              labels: entity.labels,
              descriptions: entity.descriptions,
              properties: entity.properties,
              source: entity.source,
            }),
            existing.id,
            ...scopedNodeParams(projectId),
          ],
        );
        summary.updatedNodes += 1;
        entityIdMap.set(entity.sourceId, existing.id);
      } else {
        db.run(
          `INSERT INTO nodes (id, name, type, description, aliases, tags, data, project_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, '[]', '[]', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            nodeId,
            entity.label || entity.sourceId,
            entity.type || "SPARQL实体",
            entity.description || "",
            JSON.stringify({
              sourceId: entity.sourceId,
              labels: entity.labels,
              descriptions: entity.descriptions,
              properties: entity.properties,
              source: entity.source,
            }),
            projectId,
          ],
        );
        summary.createdNodes += 1;
        entityIdMap.set(entity.sourceId, nodeId);
      }
      assignNodeClass(nodeId, classId);
      const mediaSources: Array<{ propertyId: string; source: string }> = [];

      for (const [key, rawValue] of Object.entries(entity.properties || {})) {
        const value = rawValue && typeof rawValue === "object" && "value" in rawValue
          ? rawValue as { value: string; datatype?: string; label?: string }
          : { value: String(rawValue ?? ""), datatype: "string", label: String(rawValue ?? "") };
        const sourceDatatype = value.datatype || "string";
        const detectedMedia = sourceDatatype === "string" && IMAGE_FILE_PATTERN.test(String(value.value || ""));
        const property = ensurePropertyRecord(key, key, detectedMedia ? "commonsMedia" : (sourceDatatype === "string" ? undefined : sourceDatatype), { projectId });
        if (!property.id) continue;
        const propertyDefinition = db.query("SELECT datatype, valuetype FROM properties WHERE id = ? LIMIT 1").get(property.id) as any;
        const isCommonsMedia = detectedMedia || String(propertyDefinition?.datatype || propertyDefinition?.valuetype || "").toLowerCase() === "commonsmedia";
        const datatype = isCommonsMedia ? "commonsMedia" : sourceDatatype;
        updatePropertyDatatype(property.id, datatype, projectId);
        linkOntologyProperty(ontologyId, property.id);
        linkClassProperty(classId, property.id);
        if (datatype === "wikibase-entityid") {
          const targetSourceId = qidFromValue(value.value);
          const targetNodeId = ensureNodeExistsById(targetSourceId, value.label || targetSourceId);
          const attribute = ensureAttributeRecord(nodeId, property.id, [{
            id: targetNodeId,
            label: value.label || targetSourceId,
            label_zh: value.label || targetSourceId,
            "entity-type": "item",
          }], { datatype: "wikibase-entityid" });
          if (attribute.created || attribute.updated) summary.createdEdges += 1;
        } else {
          ensureAttributeRecord(nodeId, property.id, [value.value], { datatype });
          if (isCommonsMedia) mediaSources.push({ propertyId: property.id, source: value.value });
        }
      }
      // Media is intentionally kept online for now. Downloading from Wikimedia can
      // make a normal entity import take minutes, so do not block the import on it.
      const onlineMediaByProperty = new Map<string, string[]>();
      for (const media of mediaSources) {
        const onlineUrl = mediaSourceUrl(media.source, true);
        if (!onlineUrl) continue;
        const list = onlineMediaByProperty.get(media.propertyId) || [];
        list.push(onlineUrl);
        onlineMediaByProperty.set(media.propertyId, list);
      }
      for (const [propertyId, onlineUrls] of onlineMediaByProperty) {
        db.run(
          "UPDATE attributes SET value = ?, datatype = 'commonsMedia' WHERE node_id = ? AND key = ?",
          [JSON.stringify(onlineUrls), nodeId, propertyId],
        );
      }
      const onlineImages = Array.from(onlineMediaByProperty.values()).flat();
      if (onlineImages.length) {
        db.run("UPDATE nodes SET images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND " + scopedNodeWhere(projectId), [JSON.stringify(onlineImages), nodeId, ...scopedNodeParams(projectId)]);
      }
      summary.imported += 1;
    } catch {
      summary.failed += 1;
    }
  }

  for (const item of preview?.relations || []) {
    try {
      const relation = item.relation;
      const fromId = ensureNodeExistsById(relation.fromSourceId, relation.fromSourceId);
      const toId = ensureNodeExistsById(relation.toSourceId, relation.toSourceId);
      const property = ensurePropertyRecord(relation.property, relation.property, "entity", { projectId });
      if (!property.id) {
        summary.skipped += 1;
        continue;
      }
      ensureAttributeRecord(
        fromId,
        property.id,
        [
          {
            id: toId,
            label: toId,
            label_zh: toId,
            "entity-type": "item",
          },
        ],
        { datatype: "wikibase-entityid" },
      );
      summary.createdEdges += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
