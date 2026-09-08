import { AsyncLocalStorage } from 'node:async_hooks';
import type { Database } from 'bun:sqlite';

export type KnowledgeUser = { id: number; username: string; displayName?: string; role?: string };
export const knowledgeContext = new AsyncLocalStorage<{ user: KnowledgeUser | null }>();
export const knowledgeId = (value: unknown) => String(value || '').replace(/^entity\//, '').trim();
export class KnowledgeAccessError extends Error {}

export function ensureKnowledgeAccessSchema(db: Database) {
  const columns = new Set((db.query('PRAGMA table_info(nodes)').all() as { name: string }[]).map((column) => column.name));
  for (const [name, definition] of [['visibility', "TEXT NOT NULL DEFAULT 'public'"], ['owner_user_id', 'INTEGER'], ['creator_username', "TEXT NOT NULL DEFAULT ''"], ['updated_by_user_id', 'INTEGER']] as const) {
    if (!columns.has(name)) db.run(`ALTER TABLE nodes ADD COLUMN ${name} ${definition}`);
  }
  db.run(`CREATE TABLE IF NOT EXISTS knowledge_maintainers (
    node_id TEXT NOT NULL, user_id INTEGER NOT NULL, approved_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(node_id, user_id),
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS knowledge_maintenance_requests (
    node_id TEXT NOT NULL, user_id INTEGER NOT NULL, message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', reviewed_by INTEGER, reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(node_id, user_id),
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE)`);
  db.run('CREATE INDEX IF NOT EXISTS nodes_access_owner ON nodes(owner_user_id, visibility)');
}

export function accessCondition(user: KnowledgeUser | null, alias = 'n', edit = false): string {
  const uid = Number.isSafeInteger(user?.id) ? Number(user!.id) : -1;
  if (user?.role === 'admin') return '1';
  const member = `(${alias}.owner_user_id = ${uid} OR EXISTS (SELECT 1 FROM main.knowledge_maintainers km WHERE km.node_id = ${alias}.id AND km.user_id = ${uid}))`;
  return edit ? (user ? member : '0') : `(${alias}.visibility = 'public' OR ${member})`;
}

export function canAccessKnowledge(db: Database, user: KnowledgeUser | null, id: unknown, mode: 'read' | 'edit' | 'manage' = 'read') {
  const node = db.query('SELECT * FROM main.nodes WHERE id = ?').get(knowledgeId(id)) as any;
  if (!node) return false;
  // Administrators may read for system management, but editing an owned
  // knowledge item still requires ownership or approved maintenance access.
  if (user?.role === 'admin' && (mode === 'read' || !node.owner_user_id)) return true;
  if (mode === 'read' && node.visibility === 'public') return true;
  if (!user) return false;
  if (Number(node.owner_user_id) === user.id) return true;
  if (mode === 'manage') return false;
  return !!db.query('SELECT 1 FROM main.knowledge_maintainers WHERE node_id = ? AND user_id = ?').get(node.id, user.id);
}

// Request-local CTEs cover all existing SELECT paths, including search, counts,
// graph expansion, wiki pages, suggestions and semantic-map queries.
export function scopeKnowledgeSql(sql: string, user: KnowledgeUser | null, columns: string[] = []): string {
  if (!/^\s*(SELECT|WITH)\b/i.test(sql) || !/\b(nodes|attributes|entity_classes|semantic_nodes|knowledge_comments|knowledge_favorites|knowledge_shares)\b/i.test(sql)) return sql;
  const projection = columns.length ? columns.map((column) => {
    const quoted = `n."${column.replace(/"/g, '""')}"`;
    if (column !== 'data' || user?.role === 'admin') return quoted;
    return `CASE WHEN EXISTS (SELECT 1 FROM json_tree(CASE WHEN json_valid(n.data) THEN n.data ELSE '{}' END) j
      JOIN main.nodes hidden ON j.value = hidden.id OR j.value = 'entity/' || hidden.id OR j.key = hidden.id OR j.key = 'entity/' || hidden.id
      WHERE NOT ${accessCondition(user, 'hidden')})
      THEN json_remove(CASE WHEN json_valid(n.data) THEN n.data ELSE '{}' END, '$._relationGraphSnapshot', '$.mentions') ELSE n.data END AS data`;
  }).join(', ') : 'n.*';
  const definitions = [`nodes AS (SELECT n.rowid AS rowid, ${projection} FROM main.nodes n WHERE ${accessCondition(user)})`];
  if (/\battributes\b/i.test(sql)) {
    definitions.push(`attributes AS (SELECT a.* FROM main.attributes a WHERE a.node_id IN (SELECT id FROM nodes)
      AND NOT EXISTS (SELECT 1 FROM json_tree(CASE WHEN json_valid(a.value) THEN a.value ELSE '{}' END) j
        JOIN main.nodes hidden ON j.value = hidden.id OR j.value = 'entity/' || hidden.id
        WHERE hidden.id NOT IN (SELECT id FROM nodes))
      AND NOT EXISTS (SELECT 1 FROM json_tree(CASE WHEN json_valid(a.statement_json) THEN a.statement_json ELSE '{}' END) j
        JOIN main.nodes hidden ON j.value = hidden.id OR j.value = 'entity/' || hidden.id
        WHERE hidden.id NOT IN (SELECT id FROM nodes)))`);
  }
  if (/\bentity_classes\b/i.test(sql)) definitions.push('entity_classes AS (SELECT * FROM main.entity_classes WHERE entity_id IN (SELECT id FROM nodes))');
  if (/\bsemantic_nodes\b/i.test(sql)) definitions.push('semantic_nodes AS (SELECT * FROM main.semantic_nodes WHERE id IN (SELECT id FROM nodes))');
  for (const table of ['knowledge_comments', 'knowledge_favorites', 'knowledge_shares']) {
    if (sql.toLowerCase().includes(table)) definitions.push(`${table} AS (SELECT * FROM main.${table} WHERE replace(knowledge_id, 'entity/', '') IN (SELECT id FROM nodes))`);
  }
  const prefix = definitions.join(', ');
  if (/^\s*WITH\s+RECURSIVE\b/i.test(sql)) return sql.replace(/^\s*WITH\s+RECURSIVE\b/i, `WITH RECURSIVE ${prefix},`);
  if (/^\s*WITH\b/i.test(sql)) return sql.replace(/^\s*WITH\b/i, `WITH ${prefix},`);
  return `WITH ${prefix} ${sql}`;
}

export function createKnowledgeDatabase(raw: Database): Database {
  let nodeColumns: string[] = [];
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const transform = (sql: string) => {
    const context = knowledgeContext.getStore();
    if (!context) return sql;
    const user = context.user;
    // All existing creation paths use explicit columns and VALUES. Stamp server
    // identity here as well as in the form endpoint; client owner fields are ignored.
    if (/^\s*INSERT(?:\s+OR\s+\w+)?\s+INTO\s+nodes\s*\(/i.test(sql) && !/\bowner_user_id\b/i.test(sql)) {
      if (!user) throw new KnowledgeAccessError('请先登录');
      sql = sql.replace(/(INTO\s+nodes\s*\()([^)]*)(\)\s*VALUES\s*\()/i,
        (_match, opening, columns, values) => `${opening}owner_user_id, creator_username, updated_by_user_id, ${columns}${values}${user.id}, ${quote(user.username)}, ${user.id}, `);
    }
    if (!nodeColumns.length) nodeColumns = (raw.query('PRAGMA table_info(nodes)').all() as { name: string }[]).map((column) => column.name);
    return scopeKnowledgeSql(sql, user, nodeColumns);
  };
  return new Proxy(raw, {
    get(target, key) {
      if (key === 'query' || key === 'prepare') return (sql: string, ...args: any[]) => (target[key] as any).call(target, transform(sql), ...args);
      if (key === 'run' || key === 'exec') return (sql: string, ...args: any[]) => (target[key] as any).call(target, transform(sql), ...args);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
