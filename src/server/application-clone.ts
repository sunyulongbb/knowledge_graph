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
  let output = value.replaceAll(`/uploads/${sourceProjectId}/`, `/uploads/${targetProjectId}/`);
  for (const [before, after] of ids) output = output.replaceAll(before, after);
  return output;
}

function cloneMappedTable(db: Database, table: string, projectId: number, targetProjectId: number, prefix: string, ids: Map<string, string>) {
  if (!tableExists(db, table)) return;
  const rows = db.query(`SELECT * FROM ${table} WHERE project_id=?`).all(projectId) as any[];
  for (const row of rows) ids.set(String(row.id), `${prefix}/${crypto.randomUUID()}`);
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
  cloneMappedTable(db, "nodes", sourceId, targetId, "entity", ids);

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
