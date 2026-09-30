import type { Database } from "bun:sqlite";

export class ClassImportError extends Error {}

type ClassInput = {
  name: string;
  description: string;
  color: string | null;
  image: string | null;
  tags: string[];
  children: ClassInput[];
  provided: string[];
};

export function parseClassImport(input: unknown): ClassInput[] {
  const fail = (message: string): never => { throw new ClassImportError(message); };
  const object = (value: unknown, path: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} 必须是对象`);
    return value as Record<string, unknown>;
  };
  const root = object(input, "文件");
  if (root.version !== 1) fail("version 必须为 1，请参考示例文件");
  for (const key of Object.keys(root)) if (!["version", "classes"].includes(key)) fail(`文件包含不支持的字段：${key}`);
  if (!Array.isArray(root.classes) || !root.classes.length) fail("classes 必须是非空数组");
  let count = 0;
  const parse = (value: unknown, path: string, depth: number): ClassInput => {
    if (++count > 1000) fail("一次最多导入 1000 个分类");
    if (depth > 32) fail("分类层级不能超过 32 层");
    const row = object(value, path);
    const fields = ["name", "description", "color", "image", "tags", "children"];
    for (const key of Object.keys(row)) if (!fields.includes(key)) fail(`${path} 包含不支持的字段：${key}`);
    if (typeof row.name !== "string" || !row.name.trim()) fail(`${path}.name 必须是非空字符串`);
    if (row.description !== undefined && typeof row.description !== "string") fail(`${path}.description 必须是字符串`);
    if (row.color != null && (typeof row.color !== "string" || !/^#[\da-f]{6}$/i.test(row.color))) fail(`${path}.color 必须是 #RRGGBB 格式`);
    if (row.image != null && typeof row.image !== "string") fail(`${path}.image 必须是字符串或 null`);
    if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string" || !tag.trim()))) fail(`${path}.tags 必须是非空字符串组成的数组`);
    if (row.children !== undefined && !Array.isArray(row.children)) fail(`${path}.children 必须是数组`);
    const tags = [...new Map(((row.tags || []) as string[]).map((tag) => [tag.trim().toLowerCase(), tag.trim()])).values()];
    return {
      name: (row.name as string).trim(),
      description: String(row.description || "").trim(),
      color: (row.color as string) || null,
      image: row.image == null ? null : String(row.image).trim(),
      tags,
      children: ((row.children || []) as unknown[]).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1)),
      provided: Object.keys(row),
    };
  };
  return (root.classes as unknown[]).map((row, index) => parse(row, `classes[${index}]`, 1));
}

export function importClasses(db: Database, input: unknown, projectId: number | null) {
  const roots = parseClassImport(input);
  return db.transaction(() => {
    let created = 0;
    let updated = 0;
    const siblings = db.query("SELECT id, name FROM classes WHERE parent_id IS ? AND project_id IS ?");
    const insert = db.prepare("INSERT INTO classes(id,name,description,parent_id,project_id,color,image,tags,sort_order) VALUES(?,?,?,?,?,?,?,?,?)");
    const importNode = (node: ClassInput, parentId: string | null) => {
      const rows = siblings.all(parentId, projectId) as { id: string; name: string }[];
      const existing = rows.find((row) => row.name.trim().toLowerCase() === node.name.toLowerCase());
      let id = existing?.id;
      if (id) {
        const fields = ["description", "color", "image", "tags"] as const;
        const supplied = fields.filter((field) => node.provided.includes(field));
        if (supplied.length) {
          const values = supplied.map((field) => field === "tags" ? JSON.stringify(node.tags) : node[field]);
          db.run(`UPDATE classes SET ${supplied.map((field) => `${field}=?`).join(",")} WHERE id=? AND project_id IS ?`, [...values, id, projectId]);
        }
        updated++;
      } else {
        id = `class/${crypto.randomUUID()}`;
        const order = db.query("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM classes WHERE parent_id IS ? AND project_id IS ?").get(parentId, projectId) as { next: number };
        insert.run(id, node.name, node.description, parentId, projectId, node.color, node.image, JSON.stringify(node.tags), order.next);
        created++;
      }
      for (const child of node.children) importNode(child, id);
    };
    for (const root of roots) importNode(root, null);
    return { created, updated, total: created + updated };
  })();
}
