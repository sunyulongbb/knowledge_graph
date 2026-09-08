import type { Database } from 'bun:sqlite';

export class OntologyImportError extends Error {}
type OntologyInput = { name: string; description: string; alias: string[]; color: string | null; display_shape: string; children: OntologyInput[]; provided: string[] };
const shapes = new Set(['rectangle', 'rounded', 'circle', 'diamond', 'hexagon']);

export function parseOntologyImport(input: unknown): OntologyInput[] {
  const fail = (message: string): never => { throw new OntologyImportError(message); };
  const object = (value: unknown, path: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} 必须是对象`);
    return value as Record<string, unknown>;
  };
  const root = object(input, '文件');
  if (root.version !== 1) fail('version 必须为 1，请参考示例文件');
  for (const key of Object.keys(root)) if (!['version', 'ontologies'].includes(key)) fail(`文件包含不支持的字段：${key}`);
  if (!Array.isArray(root.ontologies) || !root.ontologies.length) fail('ontologies 必须是非空数组');
  let count = 0;
  const parse = (value: unknown, path: string, depth: number): OntologyInput => {
    if (++count > 1000) fail('一次最多导入 1000 个本体');
    if (depth > 32) fail('本体层级不能超过 32 层');
    const row = object(value, path);
    for (const key of Object.keys(row)) if (!['name', 'description', 'alias', 'color', 'display_shape', 'children'].includes(key)) fail(`${path} 包含不支持的字段：${key}`);
    if (typeof row.name !== 'string' || !row.name.trim()) fail(`${path}.name 必须是非空字符串`);
    if (row.description !== undefined && typeof row.description !== 'string') fail(`${path}.description 必须是字符串`);
    if (row.alias !== undefined && (!Array.isArray(row.alias) || row.alias.some((item) => typeof item !== 'string' || !item.trim()))) fail(`${path}.alias 必须是非空字符串组成的数组`);
    if (row.color != null && (typeof row.color !== 'string' || !/^#[\da-f]{6}$/i.test(row.color))) fail(`${path}.color 必须是 #RRGGBB 格式`);
    if (row.display_shape !== undefined && !shapes.has(String(row.display_shape))) fail(`${path}.display_shape 不支持该形状`);
    if (row.children !== undefined && !Array.isArray(row.children)) fail(`${path}.children 必须是数组`);
    return {
      provided: Object.keys(row),
      name: (row.name as string).trim(), description: String(row.description || '').trim(),
      alias: [...new Set([(row.name as string).trim(), ...((row.alias || []) as string[]).map((item) => item.trim())])],
      color: (row.color as string) || null, display_shape: String(row.display_shape || 'rectangle'),
      children: ((row.children || []) as unknown[]).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1)),
    };
  };
  return (root.ontologies as unknown[]).map((row, index) => parse(row, `ontologies[${index}]`, 1));
}

export function importOntologies(db: Database, input: unknown, projectId: number | null) {
  const roots = parseOntologyImport(input);
  return db.transaction(() => {
    let created = 0, updated = 0;
    const siblings = db.query('SELECT id, name, alias FROM ontologies WHERE parent_id IS ? AND project_id IS ?');
    const insert = db.prepare('INSERT INTO ontologies (id, name, alias, description, parent_id, project_id, color, display_shape, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const importNode = (node: OntologyInput, parentId: string | null) => {
      const rows = siblings.all(parentId, projectId) as { id: string; name: string; alias: string | null }[];
      const existing = rows.find((row) => row.name.trim().toLowerCase() === node.name.toLowerCase());
      let id = existing?.id;
      if (!id || node.provided.includes('alias')) {
        const aliases = new Set(node.alias.map((value) => value.toLowerCase()));
        for (const row of rows) {
          if (row.id === id) continue;
          let stored: unknown = row.alias;
          try { stored = JSON.parse(row.alias || '[]'); } catch { stored = (row.alias || '').split(/[,，;；、\n]+/); }
          const values = Array.isArray(stored) ? stored : [stored];
          if ([row.name, ...values].some((value) => aliases.has(String(value || '').trim().toLowerCase()))) {
            throw new OntologyImportError(`本体“${node.name}”的名称或别名与同级本体“${row.name}”冲突`);
          }
        }
      }
      if (id) {
        const fields = ['description', 'alias', 'color', 'display_shape'] as const;
        const supplied = fields.filter((field) => node.provided.includes(field));
        if (supplied.length) {
          const values = supplied.map((field) => field === 'alias' ? JSON.stringify(node.alias) : node[field]);
          db.run(`UPDATE ontologies SET ${supplied.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND project_id IS ?`, [...values, id, projectId]);
        }
        updated++;
      } else {
        id = `ontology/${crypto.randomUUID()}`;
        const order = db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ontologies WHERE parent_id IS ? AND project_id IS ?').get(parentId, projectId) as { next: number };
        insert.run(id, node.name, JSON.stringify(node.alias), node.description, parentId, projectId, node.color, node.display_shape, order.next);
        created++;
      }
      for (const child of node.children) importNode(child, id);
    };
    for (const root of roots) importNode(root, null);
    return { created, updated, total: created + updated };
  })();
}
