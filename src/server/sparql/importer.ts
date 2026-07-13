import { db } from "../db.ts";
import { ensureAttributeRecord, ensurePropertyRecord } from "../utils.ts";

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
        properties[rule.targetField || field] = textValue;
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

export function importPreviewToGraph(preview: any, config: any = {}) {
  const projectId = typeof config?.projectId === "number" && Number.isFinite(config.projectId) ? config.projectId : null;
  const summary = {
    imported: 0,
    createdNodes: 0,
    updatedNodes: 0,
    createdEdges: 0,
    skipped: 0,
    failed: 0,
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

      for (const [key, value] of Object.entries(entity.properties || {})) {
        const property = ensurePropertyRecord(key, key, undefined, { projectId });
        if (!property.id) continue;
        ensureAttributeRecord(nodeId, property.id, [String(value ?? "")], {
          datatype: "string",
        });
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
