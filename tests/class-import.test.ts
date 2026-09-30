import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { importClasses, parseClassImport } from "../src/server/class-import.ts";
import { serveStaticRoute } from "../src/server/static.ts";

const example = JSON.parse(readFileSync(new URL("../public/examples/class-import.json", import.meta.url), "utf8"));

function setup() {
  const db = new Database(":memory:");
  db.run(`CREATE TABLE classes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, parent_id TEXT,
    project_id INTEGER, color TEXT, image TEXT, tags TEXT, sort_order INTEGER
  )`);
  return db;
}

test("class import creates hierarchy and incrementally updates supplied fields", () => {
  const db = setup();
  try {
    expect(importClasses(db, example, 7)).toEqual({ created: 2, updated: 0, total: 2 });
    const parent = db.query("SELECT * FROM classes WHERE name='人物'").get() as any;
    const child = db.query("SELECT * FROM classes WHERE name='科学家'").get() as any;
    expect(parent.project_id).toBe(7);
    expect(child.parent_id).toBe(parent.id);
    expect(JSON.parse(child.tags)).toEqual(["科学", "研究人员"]);

    importClasses(db, { version: 1, classes: [{ name: "人物", description: "更新说明", children: [{ name: "科学家", color: "#112233" }] }] }, 7);
    expect((db.query("SELECT description,color,tags FROM classes WHERE id=?").get(parent.id) as any)).toEqual({ description: "更新说明", color: "#6366F1", tags: '["人物","重要实体"]' });
    expect((db.query("SELECT color FROM classes WHERE id=?").get(child.id) as any).color).toBe("#112233");
  } finally { db.close(); }
});

test("invalid nested class rejects the whole document before writing", () => {
  const db = setup();
  try {
    expect(() => importClasses(db, { version: 1, classes: [{ name: "有效", children: [{ name: "" }] }] }, null)).toThrow();
    expect((db.query("SELECT count(*) AS n FROM classes").get() as any).n).toBe(0);
    expect(() => parseClassImport({ version: 1, classes: [{ name: "A", unknown: true }] })).toThrow("不支持的字段");
  } finally { db.close(); }
});

test("class and tag import examples and format documents are downloadable", async () => {
  for (const path of ["/examples/class-import.json", "/examples/class-import-format.md", "/examples/tag-import.json", "/examples/tag-import-format.md"]) {
    const response = await serveStaticRoute(new Request(`http://localhost${path}`), path);
    expect(response?.status).toBe(200);
  }
});
