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

test("class import preserves supplied ids and reuses matching ids", () => {
  const db = setup();
  try {
    const input = { version: 1, classes: [{ id: "class/source", name: "原分类", children: [{ id: "class/child", name: "子分类" }] }] };
    expect(importClasses(db, input, 7)).toEqual({ created: 2, updated: 0, total: 2 });
    expect((db.query("SELECT id FROM classes WHERE name='原分类'").get() as any).id).toBe("class/source");
    expect((db.query("SELECT id,parent_id FROM classes WHERE name='子分类'").get() as any)).toEqual({ id: "class/child", parent_id: "class/source" });

    expect(importClasses(db, { version: 1, classes: [{ id: "class/source", name: "重命名", children: [{ id: "class/child", name: "子分类" }] }] }, 7)).toEqual({ created: 0, updated: 2, total: 2 });
    expect((db.query("SELECT id,name FROM classes WHERE id='class/source'").get() as any)).toEqual({ id: "class/source", name: "重命名" });
    expect((db.query("SELECT id,parent_id FROM classes WHERE id='class/child'").get() as any)).toEqual({ id: "class/child", parent_id: "class/source" });
    expect((db.query("SELECT count(*) AS n FROM classes").get() as any).n).toBe(2);
  } finally { db.close(); }
});

test("class import avoids ids already used by another project", () => {
  const db = setup();
  try {
    db.run("INSERT INTO classes(id,name,project_id) VALUES('class/shared','其他项目',8)");
    importClasses(db, { version: 1, classes: [{ id: "class/shared", name: "导入分类" }] }, 7);
    const imported = db.query("SELECT id FROM classes WHERE name='导入分类' AND project_id=7").get() as any;
    expect(imported.id).not.toBe("class/shared");
    expect((db.query("SELECT name FROM classes WHERE id='class/shared'").get() as any).name).toBe("其他项目");
  } finally { db.close(); }
});

test("class and tag import examples and format documents are downloadable", async () => {
  for (const path of ["/examples/class-import.json", "/examples/class-import-format.md", "/examples/tag-import.json", "/examples/tag-import-format.md"]) {
    const response = await serveStaticRoute(new Request(`http://localhost${path}`), path);
    expect(response?.status).toBe(200);
  }
});

test("workspace classification tree exposes JSON import and export actions", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/assets/scripts/schema-panel.js", import.meta.url), "utf8");
  expect(html).toContain('id="btnClassImport"');
  expect(html).toContain('<span>导入</span>');
  expect(html).toContain('id="classImportFile"');
  expect(html).toContain('id="btnClassExport"');
  expect(html).toContain('<span>导出</span>');
  const styles = readFileSync(new URL("../public/assets/styles/app.css", import.meta.url), "utf8");
  expect(styles).not.toContain(".class-tree-header #btnClassImport,");
  expect(script).toContain('btnClassExport?.addEventListener');
  expect(script).toContain("return { id: row.id, name:");
  expect(script).toContain("const latestRender = pendingClassTreeRender;");
  expect(script).toContain("void exportClassTree()");
  expect(script).toContain('new URL("/api/kb/classes/import"');
});

test('ID updates move and rename categories while preserving omitted metadata and knowledge links', () => {
  const db = setup();
  try {
    db.run('CREATE TABLE node_classes(node_id TEXT, class_id TEXT)');
    importClasses(db,{version:1,classes:[{id:'a',name:'父级',children:[{id:'child',name:'旧名称',description:'保留描述',color:'#123456',tags:['旧标签']}]},{id:'b',name:'新父级'}]},7);
    db.run("INSERT INTO node_classes VALUES('node/1','child')");
    expect(importClasses(db,{version:1,classes:[{id:'b',name:'新父级',children:[{id:'child',name:'新名称',tags:['新标签']}]}]},7)).toEqual({created:0,updated:2,total:2});
    const row = db.query("SELECT * FROM classes WHERE id='child'").get() as any;
    expect(row.name).toBe('新名称'); expect(row.parent_id).toBe('b');
    expect(row.description).toBe('保留描述'); expect(row.color).toBe('#123456');
    expect(JSON.parse(row.tags)).toEqual(['新标签']);
    expect(db.query('SELECT class_id FROM node_classes').get()).toEqual({class_id:'child'});
  } finally { db.close(); }
});
