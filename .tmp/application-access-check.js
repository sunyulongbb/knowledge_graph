// @bun
// src/server/application-role-permissions.ts
function hasApplicationPermission(user, permission) {
  return !!user && user.status !== "disabled" && (user.role === "admin" || user.permissions?.includes("*") || user.permissions?.includes(permission));
}

// src/server/application-clone.ts
import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";
function tableExists(db, name) {
  return !!db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}
function columns(db, table) {
  return db.query(`PRAGMA table_info(${table})`).all().map((item) => String(item.name));
}
function insertRow(db, table, row, values = {}, omit = []) {
  const names = columns(db, table).filter((name) => !omit.includes(name) && ((name in values) || (name in row)));
  const placeholders = names.map(() => "?").join(",");
  db.run(`INSERT INTO ${table} (${names.join(",")}) VALUES (${placeholders})`, names.map((name) => (name in values) ? values[name] : row[name]));
}
function replaceReferences(value, ids, sourceProjectId, targetProjectId) {
  if (typeof value !== "string" || !value)
    return value;
  const mapValue = (item) => {
    if (typeof item === "string")
      return ids.get(item) || item.replaceAll(`/uploads/${sourceProjectId}/`, `/uploads/${targetProjectId}/`);
    if (Array.isArray(item))
      return item.map(mapValue);
    if (item && typeof item === "object")
      return Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, mapValue(nested)]));
    return item;
  };
  try {
    return JSON.stringify(mapValue(JSON.parse(value)));
  } catch {
    return mapValue(value);
  }
}
function cloneMappedTable(db, table, projectId, targetProjectId, prefix, ids) {
  if (!tableExists(db, table))
    return;
  const rows = db.query(`SELECT * FROM ${table} WHERE project_id=?`).all(projectId);
  for (const row of rows)
    ids.set(String(row.id), prefix ? `${prefix}/${crypto.randomUUID()}` : `clone-${crypto.randomUUID()}`);
  for (const row of rows) {
    const mapped = { id: ids.get(String(row.id)), project_id: targetProjectId };
    for (const [key, value] of Object.entries(row)) {
      if (key !== "id" && key !== "project_id")
        mapped[key] = replaceReferences(value, ids, projectId, targetProjectId);
    }
    insertRow(db, table, row, mapped);
  }
}
function cloneApplicationData(db, sourceProject, targetProject, options = {}) {
  const sourceId = Number(sourceProject.id);
  const targetId = Number(targetProject.id);
  const ids = new Map;
  cloneMappedTable(db, "ontologies", sourceId, targetId, "ontology", ids);
  cloneMappedTable(db, "properties", sourceId, targetId, "property", ids);
  cloneMappedTable(db, "classes", sourceId, targetId, "class", ids);
  cloneMappedTable(db, "nodes", sourceId, targetId, "", ids);
  for (const table of ["ontologies", "properties", "classes", "nodes"]) {
    if (!tableExists(db, table))
      continue;
    const rows = db.query(`SELECT * FROM ${table} WHERE project_id=?`).all(targetId);
    const tableColumns = columns(db, table);
    const mutable = tableColumns.filter((name) => !["id", "project_id", "created_at", "updated_at"].includes(name));
    for (const row of rows) {
      const values = mutable.map((name) => replaceReferences(row[name], ids, sourceId, targetId));
      if (mutable.length)
        db.run(`UPDATE ${table} SET ${mutable.map((name) => `${name}=?`).join(",")} WHERE id=?`, [...values, row.id]);
    }
  }
  const cloneRelations = (table, query, mapping) => {
    if (!tableExists(db, table))
      return;
    for (const row of db.query(query).all(sourceId)) {
      const values = {};
      for (const [column, sourceColumn] of Object.entries(mapping))
        values[column] = ids.get(String(row[sourceColumn])) || row[sourceColumn];
      insertRow(db, table, row, values);
    }
  };
  if (tableExists(db, "attributes")) {
    for (const row of db.query("SELECT a.* FROM attributes a JOIN nodes n ON n.id=a.node_id WHERE n.project_id=?").all(sourceId)) {
      insertRow(db, "attributes", row, {
        id: `attribute/${crypto.randomUUID()}`,
        node_id: ids.get(String(row.node_id)),
        key: ids.get(String(row.key)) || row.key,
        value: replaceReferences(row.value, ids, sourceId, targetId),
        statement_json: replaceReferences(row.statement_json, ids, sourceId, targetId)
      });
    }
  }
  cloneRelations("entity_classes", "SELECT ec.* FROM entity_classes ec JOIN nodes n ON n.id=ec.entity_id WHERE n.project_id=?", { entity_id: "entity_id", class_id: "class_id" });
  cloneRelations("class_properties", "SELECT cp.* FROM class_properties cp JOIN classes c ON c.id=cp.class_id WHERE c.project_id=?", { class_id: "class_id", property_id: "property_id" });
  cloneRelations("property_properties", "SELECT pp.* FROM property_properties pp JOIN properties p ON p.id=pp.parent_property_id WHERE p.project_id=?", { parent_property_id: "parent_property_id", child_property_id: "child_property_id" });
  cloneRelations("ontology_properties", "SELECT op.* FROM ontology_properties op JOIN ontologies o ON o.id=op.ontology_id WHERE o.project_id=?", { ontology_id: "ontology_id", property_id: "property_id" });
  if (tableExists(db, "entry_tasks"))
    cloneMappedTable(db, "entry_tasks", sourceId, targetId, "entry-task", ids);
  if (tableExists(db, "knowledge_reports"))
    cloneMappedTable(db, "knowledge_reports", sourceId, targetId, "report", ids);
  const uploadsRoot = options.uploadsRoot || resolve(import.meta.dir, "..", "..", "uploads");
  const sourceDir = resolve(uploadsRoot, String(sourceId));
  const targetDir = resolve(uploadsRoot, String(targetId));
  if (existsSync(sourceDir)) {
    mkdirSync(uploadsRoot, { recursive: true });
    cpSync(sourceDir, targetDir, { recursive: true, errorOnExist: true });
  }
  return { idMap: ids, filesCloned: existsSync(sourceDir) };
}
function removeClonedApplicationFiles(projectId, options = {}) {
  const uploadsRoot = options.uploadsRoot || resolve(import.meta.dir, "..", "..", "uploads");
  const targetDir = resolve(uploadsRoot, String(projectId));
  if (existsSync(targetDir))
    rmSync(targetDir, { recursive: true, force: true });
}

// src/shared/wikidata.ts
var datatypeValueTypes = {
  "wikibase-item": "wikibase-entityid",
  "wikibase-property": "wikibase-entityid",
  "wikibase-lexeme": "wikibase-entityid",
  "wikibase-form": "wikibase-entityid",
  "wikibase-sense": "wikibase-entityid",
  string: "string",
  "external-id": "string",
  url: "string",
  commonsMedia: "string",
  math: "string",
  "musical-notation": "string",
  "geo-shape": "string",
  "tabular-data": "string",
  quantity: "quantity",
  time: "time",
  "globe-coordinate": "globecoordinate",
  monolingualtext: "monolingualtext"
};
function normalizeDatatype(datatype, legacyValueType = "") {
  let dt = String(datatype || "").trim();
  const legacy = String(legacyValueType || "").trim();
  if ((!dt || dt === "string") && legacy === "wikibase-entityid")
    dt = "wikibase-item";
  if ((!dt || dt === "string") && legacy === "globecoordinate")
    dt = "globe-coordinate";
  if ((!dt || dt === "string" || dt === "wikibase-entityid") && legacy && legacy !== "string" && datatypeValueTypes[legacy])
    dt = legacy;
  if (dt === "wikibase-entityid")
    return "wikibase-item";
  if (dt === "globecoordinate")
    return "globe-coordinate";
  if (dt.toLowerCase() === "commonsmedia")
    return "commonsMedia";
  return dt || "string";
}
function valueTypeFor(datatype) {
  return datatypeValueTypes[normalizeDatatype(datatype)] || "string";
}

// src/server/ontology-import.ts
class OntologyImportError extends Error {
}
var shapes = new Set(["rectangle", "rounded", "circle", "diamond", "hexagon"]);
function parseOntologyImport(input) {
  const fail = (message) => {
    throw new OntologyImportError(message);
  };
  const object = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
    return value;
  };
  const root = object(input, "\u6587\u4EF6");
  if (root.version !== 1)
    fail("version \u5FC5\u987B\u4E3A 1\uFF0C\u8BF7\u53C2\u8003\u793A\u4F8B\u6587\u4EF6");
  for (const key of Object.keys(root))
    if (!["version", "ontologies"].includes(key))
      fail(`\u6587\u4EF6\u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
  if (!Array.isArray(root.ontologies) || !root.ontologies.length)
    fail("ontologies \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
  let count = 0;
  const parse = (value, path, depth) => {
    if (++count > 1000)
      fail("\u4E00\u6B21\u6700\u591A\u5BFC\u5165 1000 \u4E2A\u672C\u4F53");
    if (depth > 32)
      fail("\u672C\u4F53\u5C42\u7EA7\u4E0D\u80FD\u8D85\u8FC7 32 \u5C42");
    const row = object(value, path);
    for (const key of Object.keys(row))
      if (!["name", "description", "alias", "color", "display_shape", "properties", "children"].includes(key))
        fail(`${path} \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
    if (typeof row.name !== "string" || !row.name.trim())
      fail(`${path}.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    if (row.description !== undefined && typeof row.description !== "string")
      fail(`${path}.description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
    if (row.alias !== undefined && (!Array.isArray(row.alias) || row.alias.some((item) => typeof item !== "string" || !item.trim())))
      fail(`${path}.alias \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u7EC4\u6210\u7684\u6570\u7EC4`);
    if (row.color != null && (typeof row.color !== "string" || !/^#[\da-f]{6}$/i.test(row.color)))
      fail(`${path}.color \u5FC5\u987B\u662F #RRGGBB \u683C\u5F0F`);
    if (row.display_shape !== undefined && !shapes.has(String(row.display_shape)))
      fail(`${path}.display_shape \u4E0D\u652F\u6301\u8BE5\u5F62\u72B6`);
    if (row.children !== undefined && !Array.isArray(row.children))
      fail(`${path}.children \u5FC5\u987B\u662F\u6570\u7EC4`);
    if (row.properties !== undefined && !Array.isArray(row.properties))
      fail(`${path}.properties \u5FC5\u987B\u662F\u6570\u7EC4`);
    const properties = (row.properties || []).map((value2, index) => {
      const property = object(value2, `${path}.properties[${index}]`);
      for (const key of Object.keys(property))
        if (!["name", "alias", "datatype", "description", "types", "tail_ontology_id"].includes(key))
          fail(`${path}.properties[${index}] \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
      if (typeof property.name !== "string" || !property.name.trim())
        fail(`${path}.properties[${index}].name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      if (property.alias !== undefined && (!Array.isArray(property.alias) || property.alias.some((item) => typeof item !== "string" || !item.trim())))
        fail(`${path}.properties[${index}].alias \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      const datatype = normalizeDatatype(property.datatype || "string");
      if (!datatypeValueTypes[datatype])
        fail(`${path}.properties[${index}].datatype \u4E0D\u652F\u6301\u8BE5\u6570\u636E\u7C7B\u578B`);
      if (property.description !== undefined && typeof property.description !== "string")
        fail(`${path}.properties[${index}].description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
      if (property.types !== undefined && (!Array.isArray(property.types) || property.types.some((item) => typeof item !== "string" || !item.trim())))
        fail(`${path}.properties[${index}].types \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      if (property.tail_ontology_id !== undefined && typeof property.tail_ontology_id !== "string")
        fail(`${path}.properties[${index}].tail_ontology_id \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
      const name = property.name.trim();
      return {
        provided: Object.keys(property),
        name,
        alias: [...new Set([name, ...(property.alias || []).map((item) => item.trim())])],
        datatype,
        description: String(property.description || "").trim(),
        types: [...new Set((property.types || []).map((item) => item.trim()).filter(Boolean))],
        tail_ontology_id: String(property.tail_ontology_id || "").trim()
      };
    });
    return {
      provided: Object.keys(row),
      name: row.name.trim(),
      description: String(row.description || "").trim(),
      alias: [...new Set([row.name.trim(), ...(row.alias || []).map((item) => item.trim())])],
      color: row.color || null,
      display_shape: String(row.display_shape || "rectangle"),
      properties,
      children: (row.children || []).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1))
    };
  };
  return root.ontologies.map((row, index) => parse(row, `ontologies[${index}]`, 1));
}
function importOntologies(db, input, projectId) {
  const roots = parseOntologyImport(input);
  return db.transaction(() => {
    let created = 0, updated = 0;
    const siblings = db.query("SELECT id, name, alias FROM ontologies WHERE parent_id IS ? AND project_id IS ?");
    const insert = db.prepare("INSERT INTO ontologies (id, name, alias, description, parent_id, project_id, color, display_shape, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const hasPropertyTables = Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'properties'").get()) && Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ontology_properties'").get());
    const propertyRows = hasPropertyTables ? db.query("SELECT id, name, alias FROM properties WHERE project_id IS ?").all(projectId) : [];
    const upsertProperty = (property, ontologyId) => {
      if (!hasPropertyTables)
        return;
      const existing = propertyRows.find((row) => row.name.trim().toLowerCase() === property.name.toLowerCase());
      const id = existing?.id || `property/${crypto.randomUUID()}`;
      const valuetype = valueTypeFor(property.datatype);
      const values = [id, property.name, JSON.stringify(property.alias), "active", property.datatype, valuetype, JSON.stringify(property.types), property.description, projectId, property.tail_ontology_id || null];
      if (existing) {
        db.run("UPDATE properties SET name = ?, alias = ?, status = ?, datatype = ?, valuetype = ?, types = ?, description = ?, project_id = ?, tail_ontology_id = ? WHERE id = ?", [...values.slice(1), id]);
      } else {
        db.run("INSERT INTO properties (id, name, alias, status, datatype, valuetype, types, description, project_id, tail_ontology_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values);
        propertyRows.push({ id, name: property.name, alias: JSON.stringify(property.alias) });
      }
      db.run("INSERT OR IGNORE INTO ontology_properties (ontology_id, property_id) VALUES (?, ?)", [ontologyId, id]);
    };
    const importNode = (node, parentId) => {
      const rows = siblings.all(parentId, projectId);
      const existing = rows.find((row) => row.name.trim().toLowerCase() === node.name.toLowerCase());
      let id = existing?.id;
      if (!id || node.provided.includes("alias")) {
        const aliases = new Set(node.alias.map((value) => value.toLowerCase()));
        for (const row of rows) {
          if (row.id === id)
            continue;
          let stored = row.alias;
          try {
            stored = JSON.parse(row.alias || "[]");
          } catch {
            stored = (row.alias || "").split(/[,\uFF0C;\uFF1B\u3001\n]+/);
          }
          const values = Array.isArray(stored) ? stored : [stored];
          if ([row.name, ...values].some((value) => aliases.has(String(value || "").trim().toLowerCase()))) {
            throw new OntologyImportError(`\u672C\u4F53\u201C${node.name}\u201D\u7684\u540D\u79F0\u6216\u522B\u540D\u4E0E\u540C\u7EA7\u672C\u4F53\u201C${row.name}\u201D\u51B2\u7A81`);
          }
        }
      }
      if (id) {
        const fields = ["description", "alias", "color", "display_shape"];
        const supplied = fields.filter((field) => node.provided.includes(field));
        if (supplied.length) {
          const values = supplied.map((field) => field === "alias" ? JSON.stringify(node.alias) : node[field]);
          db.run(`UPDATE ontologies SET ${supplied.map((field) => `${field} = ?`).join(", ")} WHERE id = ? AND project_id IS ?`, [...values, id, projectId]);
        }
        updated++;
      } else {
        id = `ontology/${crypto.randomUUID()}`;
        const order = db.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ontologies WHERE parent_id IS ? AND project_id IS ?").get(parentId, projectId);
        insert.run(id, node.name, JSON.stringify(node.alias), node.description, parentId, projectId, node.color, node.display_shape, order.next);
        created++;
      }
      for (const property of node.properties)
        upsertProperty(property, id);
      for (const child of node.children)
        importNode(child, id);
    };
    for (const root of roots)
      importNode(root, null);
    return { created, updated, total: created + updated };
  })();
}
// data/default-core-ontology.json
var default_core_ontology_default = {
  version: 1,
  ontologies: [
    {
      name: "\u4EBA\u7269",
      description: "\u73B0\u5B9E\u6216\u865A\u6784\u4E16\u754C\u4E2D\u5177\u6709\u72EC\u7ACB\u8EAB\u4EFD\u7684\u4EBA\u7269",
      alias: [
        "Person"
      ],
      color: "#3B82F6",
      display_shape: "circle",
      properties: [
        {
          name: "\u51FA\u751F\u65E5\u671F",
          datatype: "time",
          description: "\u4EBA\u7269\u7684\u51FA\u751F\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u51FA\u751F\u5730\u70B9",
          datatype: "wikibase-item",
          description: "\u4EBA\u7269\u51FA\u751F\u7684\u5730\u70B9",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u56FD\u7C4D",
          datatype: "wikibase-item",
          description: "\u4EBA\u7269\u6240\u5C5E\u7684\u56FD\u5BB6\u6216\u5730\u533A",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u6240\u5C5E\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u4EBA\u7269\u6240\u5C5E\u6216\u4EFB\u804C\u7684\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        },
        {
          name: "\u901D\u4E16\u65E5\u671F",
          datatype: "time",
          description: "\u4EBA\u7269\u7684\u901D\u4E16\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u5730\u70B9",
      description: "\u81EA\u7136\u5730\u7406\u4F4D\u7F6E\u3001\u884C\u653F\u533A\u57DF\u53CA\u5177\u6709\u7A7A\u95F4\u4F4D\u7F6E\u7684\u573A\u6240",
      alias: [
        "Location"
      ],
      color: "#10B981",
      display_shape: "rounded",
      properties: [
        {
          name: "\u4E0A\u7EA7\u5730\u70B9",
          datatype: "wikibase-item",
          description: "\u6240\u5C5E\u7684\u4E0A\u7EA7\u5730\u7406\u533A\u57DF",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u5730\u7406\u5750\u6807",
          datatype: "globe-coordinate",
          description: "\u5730\u70B9\u7684\u7ECF\u7EAC\u5EA6\u5750\u6807",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u6240\u5C5E\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u8D1F\u8D23\u7BA1\u7406\u6216\u4F7F\u7528\u8BE5\u5730\u70B9\u7684\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        }
      ],
      children: []
    },
    {
      name: "\u7EC4\u7EC7",
      description: "\u5177\u6709\u5171\u540C\u76EE\u6807\u3001\u804C\u8D23\u6216\u7EC4\u7EC7\u7ED3\u6784\u7684\u7FA4\u4F53\u4E0E\u673A\u6784",
      alias: [
        "Organization"
      ],
      color: "#8B5CF6",
      display_shape: "rounded",
      properties: [
        {
          name: "\u6210\u7ACB\u65E5\u671F",
          datatype: "time",
          description: "\u7EC4\u7EC7\u6210\u7ACB\u7684\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u603B\u90E8\u5730\u70B9",
          datatype: "wikibase-item",
          description: "\u7EC4\u7EC7\u603B\u90E8\u6240\u5728\u5730\u70B9",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u4E0A\u7EA7\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u7EC4\u7EC7\u96B6\u5C5E\u7684\u4E0A\u7EA7\u673A\u6784",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        },
        {
          name: "\u8D1F\u8D23\u4EBA",
          datatype: "wikibase-item",
          description: "\u7EC4\u7EC7\u7684\u8D1F\u8D23\u4EBA",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/person"
        }
      ],
      children: []
    },
    {
      name: "\u7269\u4F53",
      description: "\u5177\u6709\u7269\u7406\u5F62\u6001\u7684\u81EA\u7136\u7269\u6216\u4EBA\u9020\u7269\uFF0C\u5305\u62EC\u8BBE\u5907\u4E0E\u8BBE\u65BD",
      alias: [
        "Object"
      ],
      color: "#F59E0B",
      display_shape: "rounded",
      properties: [
        {
          name: "\u5236\u9020\u5546",
          datatype: "wikibase-item",
          description: "\u7269\u4F53\u7684\u751F\u4EA7\u6216\u5236\u9020\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        },
        {
          name: "\u5236\u9020\u65E5\u671F",
          datatype: "time",
          description: "\u7269\u4F53\u7684\u5236\u9020\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u6240\u5728\u5730",
          datatype: "wikibase-item",
          description: "\u7269\u4F53\u6240\u5728\u5730\u70B9",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u6750\u6599",
          datatype: "string",
          description: "\u7269\u4F53\u7684\u4E3B\u8981\u6750\u6599",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u751F\u7269",
      description: "\u9664\u4EBA\u7269\u7C7B\u522B\u4E4B\u5916\u7684\u52A8\u7269\u3001\u690D\u7269\u3001\u5FAE\u751F\u7269\u53CA\u5176\u4ED6\u751F\u7269",
      alias: [
        "Creature"
      ],
      color: "#22C55E",
      display_shape: "circle",
      properties: [
        {
          name: "\u5B66\u540D",
          datatype: "string",
          description: "\u751F\u7269\u7684\u79D1\u5B66\u540D\u79F0",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u6816\u606F\u5730",
          datatype: "wikibase-item",
          description: "\u751F\u7269\u751F\u6D3B\u6216\u5206\u5E03\u7684\u5730\u70B9",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u4FDD\u62A4\u72B6\u6001",
          datatype: "string",
          description: "\u751F\u7269\u7684\u4FDD\u62A4\u72B6\u51B5",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u4E8B\u4EF6",
      description: "\u5728\u7279\u5B9A\u65F6\u95F4\u6216\u60C5\u5883\u4E0B\u53D1\u751F\u7684\u4E8B\u60C5\u6216\u6D3B\u52A8\u5B9E\u4F8B",
      alias: [
        "Event"
      ],
      color: "#EF4444",
      display_shape: "rounded",
      properties: [
        {
          name: "\u5F00\u59CB\u65F6\u95F4",
          datatype: "time",
          description: "\u4E8B\u4EF6\u5F00\u59CB\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u7ED3\u675F\u65F6\u95F4",
          datatype: "time",
          description: "\u4E8B\u4EF6\u7ED3\u675F\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u53D1\u751F\u5730\u70B9",
          datatype: "wikibase-item",
          description: "\u4E8B\u4EF6\u53D1\u751F\u7684\u5730\u70B9",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u53C2\u4E0E\u4EBA\u7269",
          datatype: "wikibase-item",
          description: "\u53C2\u4E0E\u4E8B\u4EF6\u7684\u4EBA\u7269",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/person"
        },
        {
          name: "\u53C2\u4E0E\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u53C2\u4E0E\u4E8B\u4EF6\u7684\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        }
      ],
      children: []
    },
    {
      name: "\u884C\u52A8",
      description: "\u4E3B\u4F53\u5B9E\u65BD\u7684\u884C\u4E3A\u3001\u6D3B\u52A8\u6216\u8FC7\u7A0B\u7C7B\u578B",
      alias: [
        "Action"
      ],
      color: "#F97316",
      display_shape: "rounded",
      properties: [
        {
          name: "\u6267\u884C\u8005",
          datatype: "wikibase-item",
          description: "\u5B9E\u65BD\u8BE5\u884C\u52A8\u7684\u4E3B\u4F53\u4EBA\u7269",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/person"
        },
        {
          name: "\u6267\u884C\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u5B9E\u65BD\u8BE5\u884C\u52A8\u7684\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        },
        {
          name: "\u53D1\u751F\u5730\u70B9",
          datatype: "wikibase-item",
          description: "\u884C\u52A8\u5B9E\u65BD\u7684\u5730\u70B9",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/location"
        },
        {
          name: "\u5F00\u59CB\u65F6\u95F4",
          datatype: "time",
          description: "\u884C\u52A8\u5F00\u59CB\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u6982\u5FF5",
      description: "\u7406\u8BBA\u3001\u601D\u60F3\u3001\u6280\u672F\u3001\u5B66\u79D1\u7B49\u62BD\u8C61\u77E5\u8BC6\u6982\u5FF5",
      alias: [
        "Concept"
      ],
      color: "#06B6D4",
      display_shape: "rounded",
      properties: [
        {
          name: "\u6240\u5C5E\u5B66\u79D1",
          datatype: "wikibase-item",
          description: "\u6982\u5FF5\u6240\u5C5E\u7684\u77E5\u8BC6\u6216\u5B66\u79D1\u9886\u57DF",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/concept"
        },
        {
          name: "\u76F8\u5173\u6982\u5FF5",
          datatype: "wikibase-item",
          description: "\u4E0E\u6B64\u6982\u5FF5\u76F8\u5173\u7684\u5176\u4ED6\u6982\u5FF5",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/concept"
        },
        {
          name: "\u63D0\u51FA\u8005",
          datatype: "wikibase-item",
          description: "\u63D0\u51FA\u8BE5\u6982\u5FF5\u7684\u4EBA\u7269",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/person"
        }
      ],
      children: []
    },
    {
      name: "\u89C4\u5219",
      description: "\u6CD5\u5F8B\u3001\u5236\u5EA6\u3001\u6807\u51C6\u3001\u89C4\u8303\u7B49\u7EA6\u675F\u6027\u77E5\u8BC6",
      alias: [
        "Rule"
      ],
      color: "#64748B",
      display_shape: "rounded",
      properties: [
        {
          name: "\u53D1\u5E03\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u53D1\u5E03\u6216\u5236\u5B9A\u89C4\u5219\u7684\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        },
        {
          name: "\u53D1\u5E03\u65E5\u671F",
          datatype: "time",
          description: "\u89C4\u5219\u53D1\u5E03\u7684\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u751F\u6548\u65E5\u671F",
          datatype: "time",
          description: "\u89C4\u5219\u751F\u6548\u7684\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u9002\u7528\u8303\u56F4",
          datatype: "string",
          description: "\u89C4\u5219\u9002\u7528\u7684\u5BF9\u8C61\u6216\u8303\u56F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u65F6\u95F4",
      description: "\u5177\u6709\u72EC\u7ACB\u77E5\u8BC6\u610F\u4E49\u7684\u65F6\u671F\u3001\u65F6\u4EE3\u548C\u65F6\u95F4\u533A\u95F4",
      alias: [
        "Time"
      ],
      color: "#A855F7",
      display_shape: "rounded",
      properties: [
        {
          name: "\u8D77\u59CB\u65F6\u95F4",
          datatype: "time",
          description: "\u65F6\u671F\u7684\u8D77\u59CB\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u7EC8\u6B62\u65F6\u95F4",
          datatype: "time",
          description: "\u65F6\u671F\u7684\u7EC8\u6B62\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u76F8\u5173\u4E8B\u4EF6",
          datatype: "wikibase-item",
          description: "\u4E0E\u8BE5\u65F6\u671F\u76F8\u5173\u7684\u4E8B\u4EF6",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/event"
        }
      ],
      children: []
    },
    {
      name: "\u5173\u7CFB",
      description: "\u53EF\u4F5C\u4E3A\u77E5\u8BC6\u5BF9\u8C61\u63CF\u8FF0\u7684\u5173\u7CFB\u7C7B\u578B\u6216\u5173\u7CFB\u5B9E\u4F8B",
      alias: [
        "Relation"
      ],
      color: "#EC4899",
      display_shape: "rounded",
      properties: [
        {
          name: "\u5173\u7CFB\u4E3B\u4F53",
          datatype: "wikibase-item",
          description: "\u5173\u7CFB\u6240\u6D89\u53CA\u7684\u4E3B\u4F53\u77E5\u8BC6\u5BF9\u8C61",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ]
        },
        {
          name: "\u5173\u7CFB\u5BA2\u4F53",
          datatype: "wikibase-item",
          description: "\u5173\u7CFB\u6240\u6D89\u53CA\u7684\u76EE\u6807\u77E5\u8BC6\u5BF9\u8C61",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ]
        },
        {
          name: "\u5F00\u59CB\u65F6\u95F4",
          datatype: "time",
          description: "\u5173\u7CFB\u5F00\u59CB\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u7ED3\u675F\u65F6\u95F4",
          datatype: "time",
          description: "\u5173\u7CFB\u7ED3\u675F\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u72B6\u6001",
      description: "\u4E8B\u7269\u5728\u67D0\u4E00\u9636\u6BB5\u6240\u5904\u7684\u72B6\u51B5\u6216\u72B6\u6001\u7C7B\u578B",
      alias: [
        "State"
      ],
      color: "#14B8A6",
      display_shape: "rounded",
      properties: [
        {
          name: "\u9002\u7528\u5BF9\u8C61",
          datatype: "wikibase-item",
          description: "\u5904\u4E8E\u8BE5\u72B6\u6001\u7684\u77E5\u8BC6\u5BF9\u8C61",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ]
        },
        {
          name: "\u5F00\u59CB\u65F6\u95F4",
          datatype: "time",
          description: "\u72B6\u6001\u5F00\u59CB\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u7ED3\u675F\u65F6\u95F4",
          datatype: "time",
          description: "\u72B6\u6001\u7ED3\u675F\u7684\u65F6\u95F4",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    },
    {
      name: "\u8868\u8FBE",
      description: "\u6587\u7AE0\u3001\u4F5C\u54C1\u3001\u8A00\u8BBA\u53CA\u5176\u4ED6\u4FE1\u606F\u8868\u8FBE\u5185\u5BB9",
      alias: [
        "Expression"
      ],
      color: "#6366F1",
      display_shape: "rounded",
      properties: [
        {
          name: "\u4F5C\u8005",
          datatype: "wikibase-item",
          description: "\u8868\u8FBE\u5185\u5BB9\u7684\u521B\u4F5C\u8005",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/person"
        },
        {
          name: "\u53D1\u5E03\u7EC4\u7EC7",
          datatype: "wikibase-item",
          description: "\u53D1\u5E03\u8868\u8FBE\u5185\u5BB9\u7684\u7EC4\u7EC7",
          types: [
            "\u5173\u8054\u4FE1\u606F"
          ],
          tail_ontology_id: "ontology/organization"
        },
        {
          name: "\u521B\u4F5C\u65E5\u671F",
          datatype: "time",
          description: "\u5185\u5BB9\u521B\u4F5C\u7684\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u53D1\u5E03\u65E5\u671F",
          datatype: "time",
          description: "\u5185\u5BB9\u53D1\u5E03\u7684\u65E5\u671F",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        },
        {
          name: "\u8BED\u8A00",
          datatype: "string",
          description: "\u5185\u5BB9\u4F7F\u7528\u7684\u8BED\u8A00",
          types: [
            "\u57FA\u7840\u4FE1\u606F"
          ]
        }
      ],
      children: []
    }
  ]
};

// src/server/application-access.ts
function isValidApplicationName(name, reserved = [], requireArangoCompatibility = false) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(name) && !/^\d+$/.test(name) && !reserved.includes(name.toLowerCase()) && (!requireArangoCompatibility || /^[a-zA-Z]/.test(name));
}
function ensureApplicationSchema(db) {
  const columns2 = db.query("PRAGMA table_info(projects)").all();
  if (!columns2.some((column) => column.name === "banner_image"))
    db.run("ALTER TABLE projects ADD COLUMN banner_image TEXT NOT NULL DEFAULT ''");
  if (!columns2.some((column) => column.name === "owner_user_id"))
    db.run("ALTER TABLE projects ADD COLUMN owner_user_id INTEGER");
  if (!columns2.some((column) => column.name === "is_default"))
    db.run("ALTER TABLE projects ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0");
  db.run(`CREATE TABLE IF NOT EXISTS application_members (
    project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, edit_settings INTEGER NOT NULL DEFAULT 0,
    review_requests INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id,user_id), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS application_requests (
    project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
    PRIMARY KEY(project_id,user_id), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, project_id INTEGER,
    message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  db.run("CREATE INDEX IF NOT EXISTS notifications_user_read ON user_notifications(user_id,read_at,id)");
}
function ensureDefaultApplication(db) {
  const existing = db.query("SELECT * FROM projects WHERE name='default' LIMIT 1").get();
  if (existing) {
    if (Number(existing.is_default) !== 1) {
      db.run("UPDATE projects SET is_default=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", [existing.id]);
      return db.query("SELECT * FROM projects WHERE id=?").get(existing.id);
    }
    return null;
  }
  db.run(`INSERT INTO projects
    (name,title,description,file,image,theme_color,tags,link,is_default)
    VALUES ('default','\u9ED8\u8BA4\u5E94\u7528','\u7CFB\u7EDF\u9996\u6B21\u521D\u59CB\u5316\u521B\u5EFA\u7684\u9ED8\u8BA4\u5E94\u7528','app.sqlite','','#ff7a2b','[]','',1)`);
  return db.query("SELECT * FROM projects WHERE name='default'").get();
}
function applicationPermissions(db, user, project) {
  const owner = !!user && user.id > 0 && Number(project?.owner_user_id) === user.id;
  const member = user && project ? db.query("SELECT * FROM application_members WHERE project_id=? AND user_id=?").get(project.id, user.id) : null;
  const defaultAccess = Number(project?.is_default) === 1;
  return {
    owner,
    member: owner || defaultAccess || !!member,
    editSettings: owner || defaultAccess || !!member?.edit_settings,
    reviewRequests: owner || defaultAccess || !!member?.review_requests
  };
}
function createApplicationHandler(db, getUser, cloneOptions = {}) {
  const error = (message, status = 400) => Response.json({ error: message, message, success: false }, { status });
  const projectBy = (key, byId = false) => byId ? db.query("SELECT * FROM projects WHERE id=?").get(Number(key) || -1) : db.query("SELECT * FROM projects WHERE name=?").get(String(key || "").replace(/\.sqlite$/, ""));
  const notify = (userId, projectId, message) => db.run("INSERT INTO user_notifications(user_id,project_id,message) VALUES(?,?,?)", [userId, projectId, message]);
  const record = (project, user) => {
    const access = applicationPermissions(db, user, project);
    const defaultAccess = Number(project?.is_default) === 1;
    return {
      ...project,
      slug: project.name,
      name: project.title || project.name,
      ...access,
      editSettings: access.editSettings && (access.owner || defaultAccess || hasApplicationPermission(user, "application:update")),
      deleteApplication: access.owner,
      manageMembers: access.owner,
      reviewRequests: access.reviewRequests && (access.owner || defaultAccess || hasApplicationPermission(user, "application:review"))
    };
  };
  const hasTable = (name) => !!db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const parseList = (value) => {
    if (Array.isArray(value))
      return value.map(String).map((item) => item.trim()).filter(Boolean);
    if (typeof value !== "string" || !value.trim())
      return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parseList(parsed);
    } catch {}
    return value.split(/[,\uFF0C;\uFF1B\u3001\n]+/).map((item) => item.trim()).filter(Boolean);
  };
  const parseAliasStorage = (value) => {
    if (Array.isArray(value))
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    if (typeof value !== "string" || !value.trim())
      return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parseAliasStorage(parsed);
    } catch {}
    return value.split(/[,\uFF0C;\uFF1B\u3001\n]+/).map((item) => item.trim()).filter(Boolean);
  };
  const countByProject = (table, projectId, extra = "") => {
    if (!hasTable(table))
      return 0;
    return Number(db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE project_id=?${extra}`).get(projectId)?.count || 0);
  };
  const applicationDetails = (project, user) => {
    const projectId = Number(project.id);
    const projectRecord = record(project, user);
    const canSeePrivate = projectRecord.member === true;
    const visibilitySql = canSeePrivate ? "" : " AND (n.visibility IS NULL OR n.visibility <> 'private')";
    const ontologyEntityCount = hasTable("nodes") ? `(SELECT COUNT(*) FROM nodes n WHERE n.project_id=o.project_id AND (n.type=o.id OR lower(n.type)=lower(o.name))${visibilitySql})` : "0";
    const ontologies = hasTable("ontologies") ? db.query(`
      SELECT o.id,o.name,o.description,o.parent_id,o.color,o.sort_order,
        ${ontologyEntityCount} AS entity_count
      FROM ontologies o WHERE o.project_id=? ORDER BY COALESCE(o.sort_order,999999),o.name
    `).all(projectId) : [];
    const categoryEntityCount = hasTable("entity_classes") && hasTable("nodes") ? `(SELECT COUNT(*) FROM entity_classes ec JOIN nodes n ON n.id=ec.entity_id WHERE ec.class_id=c.id AND n.project_id=?${visibilitySql})` : "0";
    const categories = hasTable("classes") ? db.query(`
      SELECT c.id,c.name,c.description,c.parent_id,c.color,c.image,c.tags,c.sort_order,
        ${categoryEntityCount} AS entity_count
      FROM classes c WHERE c.project_id=? ORDER BY COALESCE(c.sort_order,999999),c.name
    `).all(...categoryEntityCount === "0" ? [projectId] : [projectId, projectId]) : [];
    const nodes = hasTable("nodes") ? db.query(`SELECT id,tags,images,videos,visibility FROM nodes n WHERE project_id=?${visibilitySql}`).all(projectId) : [];
    const tagCounts = new Map;
    const addTags = (raw, increment) => parseList(raw).forEach((name) => {
      const key = name.toLocaleLowerCase();
      const current = tagCounts.get(key) || { name, count: 0 };
      current.count += increment;
      tagCounts.set(key, current);
    });
    addTags(project.tags, 0);
    categories.forEach((item) => addTags(item.tags, 0));
    nodes.forEach((item) => addTags(item.tags, 1));
    const mediaCount = nodes.reduce((sum, node) => sum + parseList(node.images).length + parseList(node.videos).length, 0);
    const attributeCount = hasTable("attributes") && hasTable("nodes") ? Number(db.query(`SELECT COUNT(*) AS count FROM attributes a JOIN nodes n ON n.id=a.node_id WHERE n.project_id=?${visibilitySql}`).get(projectId)?.count || 0) : 0;
    return {
      project: projectRecord,
      ontologies,
      categories: categories.map((item) => ({ ...item, tags: parseList(item.tags) })),
      tags: Array.from(tagCounts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN")),
      statistics: {
        knowledge: nodes.length,
        publicKnowledge: nodes.filter((node) => node.visibility !== "private").length,
        privateKnowledge: canSeePrivate ? nodes.filter((node) => node.visibility === "private").length : 0,
        ontologies: ontologies.length,
        categories: categories.length,
        properties: countByProject("properties", projectId),
        attributes: attributeCount,
        media: mediaCount,
        tags: tagCounts.size
      }
    };
  };
  return async function handle(req, url, method) {
    const path = url.pathname;
    const legacy = ["/api/kb/list_projects", "/api/kb/create_project", "/api/kb/update_project", "/api/kb/delete_project"].includes(path);
    if (!legacy && !/^\/api\/(applications|notifications)(\/|$)/.test(path))
      return null;
    const user = getUser(req);
    const body = ["POST", "PATCH", "DELETE"].includes(method) ? await req.clone().json().catch(() => null) : {};
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("\u8BF7\u6C42\u4F53\u987B\u4E3A JSON \u5BF9\u8C61");
    if (body.banner_image !== undefined && (typeof body.banner_image !== "string" || body.banner_image.length > 2000 || body.banner_image.trim() && !/^(https?:\/\/|\/(?!\/))[^\s]*$/i.test(body.banner_image.trim())))
      return error("Banner \u80CC\u666F\u987B\u4E3A http(s) \u56FE\u7247\u5730\u5740\u6216\u7AD9\u5185\u8DEF\u5F84\uFF0C\u6700\u591A 2000 \u5B57");
    if (path === "/api/notifications" && method === "GET") {
      if (!user)
        return error("\u8BF7\u5148\u767B\u5F55", 401);
      return Response.json({ items: db.query("SELECT * FROM user_notifications WHERE user_id=? ORDER BY id DESC LIMIT 100").all(user.id), unread: db.query("SELECT count(*) AS count FROM user_notifications WHERE user_id=? AND read_at IS NULL").get(user.id).count });
    }
    if (path === "/api/notifications/read" && method === "POST") {
      if (!user)
        return error("\u8BF7\u5148\u767B\u5F55", 401);
      if (body.all === true)
        db.run("UPDATE user_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL", [user.id]);
      else
        db.run("UPDATE user_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?", [user.id, Number(body.id) || -1]);
      return Response.json({ success: true });
    }
    if ((path === "/api/applications" || path === "/api/kb/list_projects") && method === "GET") {
      const mine = path === "/api/kb/list_projects" || url.searchParams.get("scope") === "mine";
      const rows = db.query(`SELECT p.*, u.username AS owner_username, u.display_name AS owner_name FROM projects p LEFT JOIN users u ON u.id=p.owner_user_id WHERE p.name <> 'shared' ORDER BY p.id DESC`).all();
      const projects = rows.map((row) => record(row, user)).filter((row) => !mine || row.member);
      return Response.json({ projects, canCreate: hasApplicationPermission(user, "application:create") });
    }
    if (path === "/api/kb/create_project" && method === "GET") {
      const project2 = projectBy(url.searchParams.get("name"));
      if (project2 && cloneOptions.provisionKnowledge) {
        try {
          await cloneOptions.provisionKnowledge(project2.name);
        } catch (cause) {
          return error(`\u521D\u59CB\u5316\u77E5\u8BC6\u6570\u636E\u5E93\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, 503);
        }
      }
      return project2 ? Response.json({ success: true, project: record(project2, user) }) : error("\u5E94\u7528\u4E0D\u5B58\u5728\uFF0C\u8BF7\u767B\u5F55\u540E\u521B\u5EFA", 404);
    }
    if ((path === "/api/applications" || path === "/api/kb/create_project") && method === "POST") {
      if (!user)
        return error("\u8BF7\u5148\u767B\u5F55", 401);
      if (!hasApplicationPermission(user, "application:create"))
        return error("\u672A\u83B7\u6388\u6743\u521B\u5EFA\u5E94\u7528\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u914D\u7F6E\u89D2\u8272\u6743\u9650", 403);
      const name = String(body.name || "").trim() || `app-${crypto.randomUUID()}`;
      const title = String(body.title || name).trim();
      const description = String(body.description || "").trim();
      if (!isValidApplicationName(name, ["app", "shared"], Boolean(process.env.ARANGO_URL)))
        return error(process.env.ARANGO_URL ? "Enterprise \u5E94\u7528\u77ED\u540D\u987B\u4EE5\u5B57\u6BCD\u5F00\u5934\uFF0C\u4E14\u53EA\u80FD\u5305\u542B 1\u201364 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF" : "\u5E94\u7528\u77ED\u540D\u987B\u4E3A 1\u201364 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E0D\u80FD\u4E3A\u7EAF\u6570\u5B57\u3001app \u6216 shared");
      if (!title || title.length > 100 || description.length > 2000)
        return error("\u540D\u79F0\u6700\u591A 100 \u5B57\uFF0C\u63CF\u8FF0\u6700\u591A 2000 \u5B57");
      if (projectBy(name))
        return error("\u5E94\u7528\u77ED\u540D\u5DF2\u5B58\u5728", 409);
      try {
        await cloneOptions.provisionKnowledge?.(name);
      } catch (cause) {
        console.error(`Provisioning application ${name} failed`, cause);
        return error(`\u521B\u5EFA\u77E5\u8BC6\u6570\u636E\u5E93\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, 503);
      }
      db.run("INSERT INTO projects(name,title,description,file,image,theme_color,tags,link,owner_user_id,banner_image) VALUES(?,?,?,'app.sqlite',?,'#ff7a2b','[]',?,?,?)", [name, title, description, String(body.image || ""), String(body.link || ""), user.id, String(body.banner_image || "").trim()]);
      const created = projectBy(name);
      try {
        importOntologies(db, default_core_ontology_default, Number(created.id));
        await cloneOptions.initializeOntology?.(name, Number(created.id), default_core_ontology_default);
      } catch (cause) {
        db.transaction(() => {
          db.run("DELETE FROM ontology_properties WHERE ontology_id IN (SELECT id FROM ontologies WHERE project_id = ?)", [created.id]);
          db.run("DELETE FROM properties WHERE project_id = ?", [created.id]);
          db.run("DELETE FROM ontologies WHERE project_id = ?", [created.id]);
          db.run("DELETE FROM projects WHERE id = ?", [created.id]);
        })();
        return error(`\u521D\u59CB\u5316\u9ED8\u8BA4\u672C\u4F53\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, 503);
      }
      return Response.json({ success: true, project: record(created, user) }, { status: 201 });
    }
    const match = path.match(/^\/api\/applications\/([^/]+)(?:\/(details|access|request|review|member|clone|copy-ontology))?$/);
    const projectKey = legacy ? String(body.name || "") : match ? decodeURIComponent(match[1]) : "";
    const project = legacy ? projectBy(projectKey) : /^\d+$/.test(projectKey) ? projectBy(projectKey, true) : projectBy(projectKey);
    if (!project)
      return error("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
    const permissions = record(project, user);
    if (match?.[2] === "clone" && method === "POST") {
      if (!user)
        return error("\u8BF7\u5148\u767B\u5F55", 401);
      if (!permissions.member)
        return error("\u65E0\u6743\u8BFB\u53D6\u5E76\u514B\u9686\u6B64\u5E94\u7528", 403);
      if (!hasApplicationPermission(user, "application:create"))
        return error("\u672A\u83B7\u6388\u6743\u521B\u5EFA\u5E94\u7528", 403);
      const name = String(body.name || "").trim();
      const title = String(body.title || `${project.title || project.name} \u526F\u672C`).trim();
      if (!isValidApplicationName(name, ["app", "shared", "default"], Boolean(process.env.ARANGO_URL)))
        return error(process.env.ARANGO_URL ? "Enterprise \u65B0\u5E94\u7528\u77ED\u540D\u987B\u4EE5\u5B57\u6BCD\u5F00\u5934\uFF0C\u4E14\u53EA\u80FD\u5305\u542B 1\u201364 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF" : "\u65B0\u5E94\u7528\u77ED\u540D\u987B\u4E3A 1\u201364 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4F7F\u7528\u4FDD\u7559\u540D\u79F0");
      if (!title || title.length > 100)
        return error("\u5E94\u7528\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u6700\u591A 100 \u5B57");
      if (projectBy(name))
        return error("\u5E94\u7528\u77ED\u540D\u5DF2\u5B58\u5728", 409);
      let cloned = null;
      let clonedProjectId = 0;
      try {
        await cloneOptions.provisionKnowledge?.(name);
        cloned = db.transaction(() => {
          db.run("INSERT INTO projects(name,title,description,file,image,theme_color,tags,link,owner_user_id,banner_image) VALUES(?,?,?,'app.sqlite',?,?,?,?,?,?)", [name, title, String(project.description || ""), String(project.image || ""), String(project.theme_color || "#ff7a2b"), String(project.tags || "[]"), String(project.link || ""), user.id, String(project.banner_image || "")]);
          const target = projectBy(name);
          clonedProjectId = Number(target.id);
          cloneApplicationData(db, project, target, cloneOptions);
          const clonedImage = String(project.image || "").replaceAll(`/uploads/${project.id}/`, `/uploads/${target.id}/`);
          db.run("UPDATE projects SET image=? WHERE id=?", [clonedImage, target.id]);
          return target;
        })();
        return Response.json({ success: true, project: record(cloned, user) }, { status: 201 });
      } catch (cause) {
        if (clonedProjectId)
          removeClonedApplicationFiles(clonedProjectId, cloneOptions);
        console.error("clone application failed", cause);
        return error(`\u514B\u9686\u5E94\u7528\u5931\u8D25\uFF1A${cause instanceof Error ? cause.message : String(cause)}`, 500);
      }
    }
    if (match?.[2] === "copy-ontology" && method === "POST") {
      if (!user)
        return error("\u8BF7\u5148\u767B\u5F55", 401);
      if (!permissions.member)
        return error("\u65E0\u6743\u8BFB\u53D6\u6B64\u5E94\u7528\u7684\u672C\u4F53\u7ED3\u6784", 403);
      const targetName = String(body.name || body.slug || body.target || "").trim();
      if (!targetName)
        return error("\u672A\u63D0\u4F9B\u76EE\u6807\u5E94\u7528\u77ED\u540D", 400);
      const targetProject = /^(\d+)$/.test(targetName) ? projectBy(Number(targetName), true) : projectBy(targetName);
      if (!targetProject)
        return error("\u76EE\u6807\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      if (Number(targetProject.id) === Number(project.id))
        return error("\u65E0\u6CD5\u5C06\u672C\u4F53\u590D\u5236\u5230\u5F53\u524D\u5E94\u7528", 409);
      const targetPermissions = record(targetProject, user);
      if (!targetPermissions.member)
        return error("\u65E0\u6743\u8986\u76D6\u76EE\u6807\u5E94\u7528\u7684\u672C\u4F53\u7ED3\u6784", 403);
      if (!hasTable("ontologies"))
        return Response.json({ success: true, copied: 0, target: targetPermissions });
      const ontologyRows = db.query("SELECT * FROM ontologies WHERE project_id=? ORDER BY COALESCE(sort_order, 999999), name").all(project.id);
      const propertyRows = hasTable("properties") ? db.query("SELECT * FROM properties WHERE project_id=?").all(project.id) : [];
      const relationRows = hasTable("ontology_properties") ? db.query("SELECT op.ontology_id, op.property_id FROM ontology_properties op INNER JOIN ontologies o ON o.id = op.ontology_id WHERE o.project_id=?").all(project.id) : [];
      const propertyById = new Map(propertyRows.map((row) => [String(row.id), row]));
      const propertyByOntology = new Map;
      for (const row of relationRows) {
        const ontologyId = String(row.ontology_id || "").trim();
        if (!ontologyId)
          continue;
        const property = propertyById.get(String(row.property_id || ""));
        if (!property)
          continue;
        const list = propertyByOntology.get(ontologyId) || [];
        list.push(property);
        propertyByOntology.set(ontologyId, list);
      }
      const parsePropertyTypes = (value) => {
        if (Array.isArray(value))
          return value.map((item) => String(item ?? "").trim()).filter(Boolean);
        if (typeof value !== "string" || !value.trim())
          return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsePropertyTypes(parsed) : [];
        } catch {
          return value.split(/[,\uFF0C;\uFF1B\u3001\n]+/).map((item) => item.trim()).filter(Boolean);
        }
      };
      const buildOntologyExport = (row) => {
        const children = ontologyRows.filter((child) => String(child.parent_id || "") === String(row.id)).map((child) => buildOntologyExport(child));
        const properties = (propertyByOntology.get(String(row.id)) || []).map((property) => ({
          name: String(property.name || "").trim(),
          alias: parseAliasStorage(property.alias),
          datatype: String(property.datatype || "string").trim() || "string",
          description: String(property.description || "").trim(),
          types: parsePropertyTypes(property.types),
          tail_ontology_id: String(property.tail_ontology_id || "").trim()
        }));
        return {
          name: String(row.name || "").trim(),
          description: String(row.description || "").trim(),
          alias: parseAliasStorage(row.alias),
          color: row.color ? String(row.color).trim() : null,
          display_shape: ["rectangle", "rounded", "circle", "diamond", "hexagon"].includes(String(row.display_shape || "rectangle").trim()) ? String(row.display_shape || "rectangle").trim() : "rectangle",
          properties,
          children
        };
      };
      const roots = ontologyRows.filter((row) => !row.parent_id).map((row) => buildOntologyExport(row));
      if (!roots.length)
        return Response.json({ success: true, copied: 0, target: targetPermissions });
      const copied = importOntologies(db, { version: 1, ontologies: roots }, Number(targetProject.id));
      return Response.json({ success: true, copied: Number(copied.created || 0) + Number(copied.updated || 0), target: targetPermissions });
    }
    if (match?.[2] === "details" && method === "GET") {
      return Response.json(applicationDetails(project, user));
    }
    if (match?.[2] === "access" && method === "GET") {
      return Response.json({ project: record(project, user), members: permissions.owner ? db.query("SELECT m.*,u.username,u.display_name FROM application_members m JOIN users u ON u.id=m.user_id WHERE project_id=? ORDER BY m.created_at").all(project.id) : [], requests: permissions.reviewRequests ? db.query("SELECT r.*,u.username,u.display_name FROM application_requests r JOIN users u ON u.id=r.user_id WHERE project_id=? AND r.status='pending' ORDER BY r.created_at").all(project.id) : [], ownRequest: user ? db.query("SELECT status FROM application_requests WHERE project_id=? AND user_id=?").get(project.id, user.id) : null });
    }
    if (!user)
      return error("\u8BF7\u5148\u767B\u5F55", 401);
    if (path === "/api/kb/delete_project")
      return permissions.deleteApplication ? null : error("\u4EC5\u62E5\u6709\u5220\u9664\u6743\u9650\u7684\u521B\u5EFA\u8005\u53EF\u4EE5\u5220\u9664\u5E94\u7528", 403);
    if (path === "/api/kb/update_project" && method === "POST") {
      if (!permissions.editSettings)
        return error("\u65E0\u6743\u4FEE\u6539\u5E94\u7528\u8BBE\u7F6E", 403);
      const title = String(body.title || "").trim();
      if (!title || title.length > 100 || String(body.description || "").length > 2000)
        return error("\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u6700\u591A 100 \u5B57\uFF0C\u63CF\u8FF0\u6700\u591A 2000 \u5B57");
      return null;
    }
    if (match?.[2] === "request" && method === "POST") {
      if (permissions.member)
        return error("\u4F60\u5DF2\u62E5\u6709\u5E94\u7528\u7EF4\u62A4\u6743\u9650", 409);
      if (!project.owner_user_id && !hasApplicationPermission(user, "application:create"))
        return error("\u8BA4\u9886\u5386\u53F2\u5E94\u7528\u9700\u8981\u521B\u5EFA\u5E94\u7528\u6743\u9650", 403);
      const message = String(body.message || "").trim();
      if (message.length > 1000)
        return error("\u7533\u8BF7\u8BF4\u660E\u6700\u591A 1000 \u5B57");
      const outcome = db.transaction(() => {
        const claimed = db.run("UPDATE projects SET owner_user_id=? WHERE id=? AND owner_user_id IS NULL", [user.id, project.id]);
        if (claimed.changes > 0) {
          db.run("DELETE FROM application_requests WHERE project_id=? AND user_id=?", [project.id, user.id]);
          return "claimed";
        }
        const current = projectBy(project.id, true);
        const previous = db.query("SELECT status FROM application_requests WHERE project_id=? AND user_id=?").get(project.id, user.id);
        if (previous?.status === "pending")
          return "pending";
        db.run("INSERT INTO application_requests(project_id,user_id,message) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET message=excluded.message,status='pending',reviewed_by=NULL,reviewed_at=NULL,created_at=CURRENT_TIMESTAMP", [project.id, user.id, message]);
        const reviewers = db.query("SELECT user_id FROM application_members WHERE project_id=? AND review_requests=1").all(project.id);
        for (const id of new Set([current.owner_user_id, ...reviewers.map((item) => item.user_id)])) {
          if (Number.isSafeInteger(Number(id)) && Number(id) > 0)
            notify(Number(id), project.id, `${user.username} \u7533\u8BF7\u7EF4\u62A4\u5E94\u7528\u300C${project.title || project.name}\u300D`);
        }
        return "requested";
      })();
      if (outcome === "pending")
        return error("\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u7B49\u5F85\u5BA1\u6279", 409);
      return Response.json({ success: true, claimedOwnership: outcome === "claimed" });
    }
    if (match?.[2] === "review" && method === "POST") {
      if (!permissions.reviewRequests)
        return error("\u65E0\u6743\u5BA1\u6279\u7533\u8BF7", 403);
      const target = Number(body.user_id);
      if (!["approve", "reject"].includes(body.decision))
        return error("\u8BF7\u9009\u62E9\u6279\u51C6\u6216\u62D2\u7EDD");
      const pending = db.query("SELECT 1 FROM application_requests WHERE project_id=? AND user_id=? AND status='pending'").get(project.id, target);
      if (!pending)
        return error("\u7533\u8BF7\u4E0D\u5B58\u5728\u6216\u5DF2\u5904\u7406", 409);
      db.transaction(() => {
        if (body.decision === "approve")
          db.run("INSERT OR IGNORE INTO application_members(project_id,user_id) VALUES(?,?)", [project.id, target]);
        db.run("UPDATE application_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE project_id=? AND user_id=?", [body.decision === "approve" ? "approved" : "rejected", user.id, project.id, target]);
        notify(target, project.id, `\u4F60\u5BF9\u300C${project.title || project.name}\u300D\u7684\u7EF4\u62A4\u7533\u8BF7\u5DF2${body.decision === "approve" ? "\u6279\u51C6" : "\u62D2\u7EDD"}`);
      })();
      return Response.json({ success: true });
    }
    if (match?.[2] === "member" && ["POST", "DELETE"].includes(method)) {
      if (!permissions.manageMembers)
        return error("\u4EC5\u62E5\u6709\u6210\u5458\u7BA1\u7406\u6743\u9650\u7684\u521B\u5EFA\u8005\u53EF\u4EE5\u7BA1\u7406\u6210\u5458\u53CA\u6743\u9650", 403);
      const target = body.username ? db.query("SELECT id FROM users WHERE username=? AND COALESCE(status,'active') <> 'disabled'").get(String(body.username).trim()) : { id: Number(body.user_id) };
      if (!Number.isSafeInteger(target?.id) || target.id <= 0 || target.id === user.id || !db.query("SELECT 1 FROM users WHERE id=?").get(target.id))
        return error("\u7528\u6237\u4E0D\u5B58\u5728\u6216\u4E0D\u80FD\u4FEE\u6539\u521B\u5EFA\u8005");
      db.transaction(() => {
        if (method === "DELETE") {
          db.run("DELETE FROM application_members WHERE project_id=? AND user_id=?", [project.id, target.id]);
          db.run("UPDATE application_requests SET status='revoked' WHERE project_id=? AND user_id=?", [project.id, target.id]);
        } else {
          db.run("INSERT INTO application_members(project_id,user_id,edit_settings,review_requests) VALUES(?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET edit_settings=excluded.edit_settings,review_requests=excluded.review_requests", [project.id, target.id, body.edit_settings === true ? 1 : 0, body.review_requests === true ? 1 : 0]);
          db.run("UPDATE application_requests SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE project_id=? AND user_id=? AND status='pending'", [user.id, project.id, target.id]);
        }
        notify(target.id, project.id, method === "DELETE" ? `\u4F60\u5DF2\u88AB\u79FB\u51FA\u5E94\u7528\u300C${project.title || project.name}\u300D` : `\u4F60\u5728\u5E94\u7528\u300C${project.title || project.name}\u300D\u7684\u6210\u5458\u6743\u9650\u5DF2\u66F4\u65B0`);
      })();
      return Response.json({ success: true });
    }
    return error("\u4E0D\u652F\u6301\u7684\u64CD\u4F5C", 405);
  };
}
export {
  isValidApplicationName,
  ensureDefaultApplication,
  ensureApplicationSchema,
  createApplicationHandler,
  applicationPermissions
};
