import type { Database } from 'bun:sqlite';

export type EntityTable = { id: string; name: string; sourceType: string; sourceKey: string; columns: string[]; rows: Record<string, any>[]; rowCount: number; createdAt: string };
export type FlowNode = { id: string; type: string; x: number; y: number; config: Record<string, any> };
export type Flow = { id: string; name: string; nodes: FlowNode[]; edges: { from: string; to: string }[] };
export const NODE_TYPES = ['input', 'ontology', 'properties', 'alignment', 'fusion', 'output'];
export const MAX_ROWS = 10000;

export function normalizeTable(input: any) {
  const name = String(input.name || '').trim();
  const sourceType = String(input.sourceType || '');
  const sourceKey = String(input.sourceKey || '').trim();
  if (!name || name.length > 200 || !sourceKey || sourceKey.length > 1000) throw new Error('请填写表名称和数据来源标识');
  if (!['mysql', 'file', 'wikidata'].includes(sourceType)) throw new Error('数据源类型无效');
  const columns: string[] = Array.isArray(input.columns) ? input.columns.map(String) : [];
  if (!columns.length || columns.length > 200 || new Set(columns).size !== columns.length || columns.some(c => !c.trim() || c.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(c))) throw new Error('字段必须非空且不重复，最多 200 列');
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > MAX_ROWS) throw new Error(`实体表需包含 1–${MAX_ROWS} 条记录`);
  const rows = input.rows.map((row: any) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('每条记录必须是字段对象');
    return Object.fromEntries(columns.map(c => [c, row[c] ?? null]));
  });
  if (JSON.stringify(rows).length > 20 * 1024 * 1024) throw new Error('原型单表最大 20 MB');
  return { name, sourceType, sourceKey, columns, rows };
}

/** All staging/flow access is scoped to an application and its author. */
export class PipelineStore {
  constructor(public db: Database, public projectId: number | null, public userId: number) {}

  static migrate(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS entity_tables (id TEXT PRIMARY KEY, project_id INTEGER, owner_id INTEGER NOT NULL, name TEXT NOT NULL, source_type TEXT NOT NULL, source_key TEXT NOT NULL, row_count INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS entity_table_columns (table_id TEXT NOT NULL REFERENCES entity_tables(id) ON DELETE CASCADE, position INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(table_id, position));
      CREATE TABLE IF NOT EXISTS entity_table_rows (table_id TEXT NOT NULL REFERENCES entity_tables(id) ON DELETE CASCADE, position INTEGER NOT NULL, data_json TEXT NOT NULL, PRIMARY KEY(table_id, position));
      CREATE TABLE IF NOT EXISTS cleaning_flows (id TEXT PRIMARY KEY, project_id INTEGER, owner_id INTEGER NOT NULL, name TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS cleaning_flow_nodes (flow_id TEXT NOT NULL REFERENCES cleaning_flows(id) ON DELETE CASCADE, id TEXT NOT NULL, type TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, config_json TEXT NOT NULL, PRIMARY KEY(flow_id, id));
      CREATE TABLE IF NOT EXISTS cleaning_flow_edges (flow_id TEXT NOT NULL REFERENCES cleaning_flows(id) ON DELETE CASCADE, source TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(flow_id, source, target));
      CREATE TABLE IF NOT EXISTS cleaning_runs (id TEXT PRIMARY KEY, flow_id TEXT NOT NULL, project_id INTEGER, owner_id INTEGER NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT);
      CREATE TABLE IF NOT EXISTS cleaning_entity_sources (scope TEXT NOT NULL, source_key TEXT NOT NULL, source_id TEXT NOT NULL, ontology_id TEXT NOT NULL, node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, PRIMARY KEY(scope, source_key, source_id, ontology_id));
      CREATE INDEX IF NOT EXISTS entity_tables_scope ON entity_tables(project_id, owner_id);
      CREATE INDEX IF NOT EXISTS cleaning_runs_scope ON cleaning_runs(project_id, owner_id);
    `);
  }
  listTables() {
    return this.db.query('SELECT id, name, source_type AS sourceType, source_key AS sourceKey, row_count AS rowCount, created_at AS createdAt, (SELECT COUNT(*) FROM entity_table_columns c WHERE c.table_id = t.id) AS columnCount FROM entity_tables t WHERE project_id IS ? AND owner_id = ? ORDER BY created_at DESC, rowid DESC').all(this.projectId, this.userId);
  }
  getTable(id: string): EntityTable {
    const table = this.db.query('SELECT id, name, source_type AS sourceType, source_key AS sourceKey, row_count AS rowCount, created_at AS createdAt FROM entity_tables WHERE id = ? AND project_id IS ? AND owner_id = ?').get(id, this.projectId, this.userId) as EntityTable | null;
    if (!table) throw new Error('实体表不存在或无权访问');
    table.columns = (this.db.query('SELECT name FROM entity_table_columns WHERE table_id = ? ORDER BY position').all(id) as { name: string }[]).map(c => c.name);
    table.rows = (this.db.query('SELECT data_json FROM entity_table_rows WHERE table_id = ? ORDER BY position').all(id) as { data_json: string }[]).map(r => JSON.parse(r.data_json));
    return table;
  }
  saveTable(input: any) {
    const table = normalizeTable(input), id = crypto.randomUUID();
    this.db.transaction(() => {
      this.db.run('INSERT INTO entity_tables (id, project_id, owner_id, name, source_type, source_key, row_count) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, this.projectId, this.userId, table.name, table.sourceType, table.sourceKey, table.rows.length]);
      table.columns.forEach((c, i) => this.db.run('INSERT INTO entity_table_columns VALUES (?, ?, ?)', [id, i, c]));
      table.rows.forEach((r: any, i: number) => this.db.run('INSERT INTO entity_table_rows VALUES (?, ?, ?)', [id, i, JSON.stringify(r)]));
    })();
    return this.getTable(id);
  }
  listFlows() { return this.db.query('SELECT id, name, updated_at AS updatedAt FROM cleaning_flows WHERE project_id IS ? AND owner_id = ? ORDER BY updated_at DESC, rowid DESC').all(this.projectId, this.userId); }
  getFlow(id: string): Flow {
    const flow = this.db.query('SELECT id, name FROM cleaning_flows WHERE id = ? AND project_id IS ? AND owner_id = ?').get(id, this.projectId, this.userId) as Flow | null;
    if (!flow) throw new Error('流程不存在或无权访问');
    flow.nodes = (this.db.query('SELECT * FROM cleaning_flow_nodes WHERE flow_id = ? ORDER BY rowid').all(id) as any[]).map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: JSON.parse(n.config_json) }));
    flow.edges = this.db.query('SELECT source AS "from", target AS "to" FROM cleaning_flow_edges WHERE flow_id = ? ORDER BY rowid').all(id) as Flow['edges'];
    return flow;
  }
  saveFlow(input: any) {
    const id = String(input.id || crypto.randomUUID()), name = String(input.name || '').trim();
    if (input.id) this.getFlow(id);
    if (!name || name.length > 200 || !Array.isArray(input.nodes) || input.nodes.length > 6 || !Array.isArray(input.edges) || input.edges.length > 5) throw new Error('流程名称或节点数量无效');
    const ids = new Set<string>();
    for (const n of input.nodes) {
      if (!n.id || ids.has(n.id) || !NODE_TYPES.includes(n.type) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || !n.config || typeof n.config !== 'object') throw new Error('流程节点无效');
      ids.add(n.id);
    }
    if (input.edges.some((e: any) => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to)) throw new Error('连接无效');
    if (JSON.stringify(input).length > 1024 * 1024) throw new Error('流程配置过大');
    this.db.transaction(() => {
      this.db.run('INSERT INTO cleaning_flows (id, project_id, owner_id, name) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=CURRENT_TIMESTAMP', [id, this.projectId, this.userId, name]);
      this.db.run('DELETE FROM cleaning_flow_nodes WHERE flow_id = ?', [id]);
      this.db.run('DELETE FROM cleaning_flow_edges WHERE flow_id = ?', [id]);
      for (const n of input.nodes) this.db.run('INSERT INTO cleaning_flow_nodes VALUES (?, ?, ?, ?, ?, ?)', [id, n.id, n.type, n.x, n.y, JSON.stringify(n.config)]);
      for (const e of input.edges) this.db.run('INSERT INTO cleaning_flow_edges VALUES (?, ?, ?)', [id, e.from, e.to]);
    })();
    return this.getFlow(id);
  }
  saveRun(flowId: string, mode: string, result: any) {
    const id = crypto.randomUUID(), status = mode === 'preview' ? 'previewed' : 'pending';
    // Row-level preview data is transient and can be very large. Keep it in the
    // current response, but never persist it in the run history.
    const persistedResult = { ...result };
    delete persistedResult.rows;
    this.db.run('INSERT INTO cleaning_runs (id, flow_id, project_id, owner_id, mode, status, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, flowId, this.projectId, this.userId, mode, status, JSON.stringify(persistedResult)]);
    return { ...this.getRun(id), result };
  }
  listRuns() { return (this.db.query('SELECT id, flow_id AS flowId, mode, status, created_at AS createdAt, result_json FROM cleaning_runs WHERE project_id IS ? AND owner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100').all(this.projectId, this.userId) as any[]).map(({ result_json, ...r }) => ({ ...r, summary: JSON.parse(result_json).summary })); }
  getRun(id: string): any {
    const row = this.db.query('SELECT * FROM cleaning_runs WHERE id = ? AND project_id IS ? AND owner_id = ?').get(id, this.projectId, this.userId) as any;
    if (!row) throw new Error('运行记录不存在或无权访问');
    return { id: row.id, flowId: row.flow_id, mode: row.mode, status: row.status, createdAt: row.created_at, result: JSON.parse(row.result_json) };
  }
}
