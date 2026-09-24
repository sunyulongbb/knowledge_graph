import type { Database } from "bun:sqlite";
import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";

type CloneOptions = { uploadsRoot?: string };

function tableExists(db: Database, name: string) {
  return !!db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function columns(db: Database, table: string): string[] {
  return (db.query(`PRAGMA table_info(${table})`).all() as any[]).map((item) => String(item.name));
}

function insertRow(db: Database, table: string, row: any, values: Record<string, unknown> = {}, omit: string[] = []) {
  const names = columns(db, table).filter((name) => !omit.includes(name) && (name in values || name in row));
  const placeholders = names.map(() => "?").join(",");
  db.run(`INSERT INTO ${table} (${names.join(",")}) VALUES (${placeholders})`, names.map((name) => name in values ? values[name] : row[name]));
}

function replaceReferences(value: unknown, ids: Map<string, string>, sourceProjectId: number, targetProjectId: number): unknown {
  if (typeof value !== "string" || !value) return value;
  const mapValue = (item: any): any => {
    if (typeof item === "string") return ids.get(item) || item.replaceAll(`/uploads/${sourceProjectId}/`, `/uploads/${targetProjectId}/`);
    if (Array.isArray(item)) return item.map(mapValue);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, mapValue(nested)]));
    return item;
  };
  try { return JSON.stringify(mapValue(JSON.parse(value))); } catch { return mapValue(value); }
}

function cloneMappedTable(db: Database, table: string, projectId: number, targetProjectId: number, prefix: string, ids: Map<string, string>) {
  if (!tableExists(db, table)) return;
  const rows = db.query(`SELECT * FROM ${table} WHERE project_id=?`).all(projectId) as any[];
  for (const row of rows) ids.set(String(row.id), prefix ? `${prefix}/${crypto.randomUUID()}` : `clone-${crypto.randomUUID()}`);
  for (const row of rows) {
    const mapped: Record<string, unknown> = { id: ids.get(String(row.id)), project_id: targetProjectId };
    for (const [key, value] of Object.entries(row)) {
      if (key !== "id" && key !== "project_id") mapped[key] = replaceReferences(value, ids, projectId, targetProjectId);
    }
    insertRow(db, table, row, mapped);
  }
}

export function cloneApplicationData(db: Database, sourceProject: any, targetProject: any, options: CloneOptions = {}) {
  const sourceId = Number(sourceProject.id);
  const targetId = Number(targetProject.id);
  const ids = new Map<string, string>();

  cloneMappedTable(db, "ontologies", sourceId, targetId, "ontology", ids);
  cloneMappedTable(db, "properties", sourceId, targetId, "property", ids);
  cloneMappedTable(db, "classes", sourceId, targetId, "class", ids);
  cloneMappedTable(db, "nodes", sourceId, targetId, "", ids);

  // Parent/type/tail and JSON fields can only be fully rewritten after every map exists.
  for (const table of ["ontologies", "properties", "classes", "nodes"]) {
    if (!tableExists(db, table)) continue;
    const rows = db.query(`SELECT * FROM ${table} WHERE project_id=?`).all(targetId) as any[];
    const tableColumns = columns(db, table);
    const mutable = tableColumns.filter((name) => !["id", "project_id", "created_at", "updated_at"].includes(name));
    for (const row of rows) {
      const values = mutable.map((name) => replaceReferences(row[name], ids, sourceId, targetId));
      if (mutable.length) db.run(`UPDATE ${table} SET ${mutable.map((name) => `${name}=?`).join(",")} WHERE id=?`, [...values, row.id]);
    }
  }

  const cloneRelations = (table: string, query: string, mapping: Record<string, string>) => {
    if (!tableExists(db, table)) return;
    for (const row of db.query(query).all(sourceId) as any[]) {
      const values: Record<string, unknown> = {};
      for (const [column, sourceColumn] of Object.entries(mapping)) values[column] = ids.get(String(row[sourceColumn])) || row[sourceColumn];
      insertRow(db, table, row, values);
    }
  };
  if (tableExists(db, "attributes")) {
    for (const row of db.query("SELECT a.* FROM attributes a JOIN nodes n ON n.id=a.node_id WHERE n.project_id=?").all(sourceId) as any[]) {
      insertRow(db, "attributes", row, {
        id: `attribute/${crypto.randomUUID()}`,
        node_id: ids.get(String(row.node_id)),
        key: ids.get(String(row.key)) || row.key,
        value: replaceReferences(row.value, ids, sourceId, targetId),
        statement_json: replaceReferences(row.statement_json, ids, sourceId, targetId),
      });
    }
  }
  cloneRelations("entity_classes", "SELECT ec.* FROM entity_classes ec JOIN nodes n ON n.id=ec.entity_id WHERE n.project_id=?", { entity_id: "entity_id", class_id: "class_id" });
  cloneRelations("class_properties", "SELECT cp.* FROM class_properties cp JOIN classes c ON c.id=cp.class_id WHERE c.project_id=?", { class_id: "class_id", property_id: "property_id" });
  cloneRelations("property_properties", "SELECT pp.* FROM property_properties pp JOIN properties p ON p.id=pp.parent_property_id WHERE p.project_id=?", { parent_property_id: "parent_property_id", child_property_id: "child_property_id" });
  cloneRelations("ontology_properties", "SELECT op.* FROM ontology_properties op JOIN ontologies o ON o.id=op.ontology_id WHERE o.project_id=?", { ontology_id: "ontology_id", property_id: "property_id" });

  if (tableExists(db, "entry_tasks")) cloneMappedTable(db, "entry_tasks", sourceId, targetId, "entry-task", ids);
  if (tableExists(db, "knowledge_reports")) cloneMappedTable(db, "knowledge_reports", sourceId, targetId, "report", ids);

  const uploadsRoot = options.uploadsRoot || resolve(import.meta.dir, "..", "..", "uploads");
  const sourceDir = resolve(uploadsRoot, String(sourceId));
  const targetDir = resolve(uploadsRoot, String(targetId));
  if (existsSync(sourceDir)) {
    mkdirSync(uploadsRoot, { recursive: true });
    cpSync(sourceDir, targetDir, { recursive: true, errorOnExist: true });
  }
  return { idMap: ids, filesCloned: existsSync(sourceDir) };
}

export function removeClonedApplicationFiles(projectId: number, options: CloneOptions = {}) {
  const uploadsRoot = options.uploadsRoot || resolve(import.meta.dir, "..", "..", "uploads");
  const targetDir = resolve(uploadsRoot, String(projectId));
  if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
}

export function repairLegacyClonedEntityIds(db: Database) {
  if (!tableExists(db, "nodes")) return 0;
  const rows = db.query("SELECT * FROM nodes WHERE id GLOB 'entity/????????-????-????-????-????????????'").all() as any[];
  if (!rows.length) return 0;
  const nodeColumns = columns(db, "nodes");
  return db.transaction(() => {
    let repaired = 0;
    for (const row of rows) {
      const oldId = String(row.id);
      const nextId = `clone-${oldId.slice('entity/'.length)}`;
      if (db.query("SELECT 1 FROM nodes WHERE id=?").get(nextId)) continue;
      insertRow(db, "nodes", row, { id: nextId });
      if (tableExists(db, "attributes")) {
        db.run("UPDATE attributes SET node_id=? WHERE node_id=?", [nextId, oldId]);
        db.run("UPDATE attributes SET value=REPLACE(value,?,?), statement_json=REPLACE(statement_json,?,?) WHERE value LIKE ? OR statement_json LIKE ?", [oldId, nextId, oldId, nextId, `%${oldId}%`, `%${oldId}%`]);
      }
      if (tableExists(db, "entity_classes")) db.run("UPDATE entity_classes SET entity_id=? WHERE entity_id=?", [nextId, oldId]);
      if (tableExists(db, "cleaning_entity_sources")) db.run("UPDATE cleaning_entity_sources SET node_id=? WHERE node_id=?", [nextId, oldId]);
      for (const table of ["knowledge_likes", "knowledge_comments", "knowledge_shares", "knowledge_favorites"]) {
        if (tableExists(db, table) && columns(db, table).includes("knowledge_id")) db.run(`UPDATE OR IGNORE ${table} SET knowledge_id=? WHERE knowledge_id=?`, [nextId, oldId]);
      }
      for (const column of ["data", "relation_order", "jev_analysis_json", "jev_analysis_signature"]) {
        if (nodeColumns.includes(column)) db.run(`UPDATE nodes SET ${column}=REPLACE(${column},?,?) WHERE ${column} LIKE ?`, [oldId, nextId, `%${oldId}%`]);
      }
      db.run("DELETE FROM nodes WHERE id=?", [oldId]);
      repaired++;
    }
    return repaired;
  })();
}
