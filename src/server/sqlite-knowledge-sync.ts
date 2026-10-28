import type { Database } from 'bun:sqlite';
import { knowledgeMedia } from '../shared/knowledge-media.ts';
import { ArangoClient, ElasticsearchClient, configFromEnvironment, ensureApplicationDatabase, entityDocument, edgeDocuments } from './arangodb.ts';
import { EnterpriseKnowledgeStore, ArangoElasticsearchSync } from './enterprise-knowledge.ts';

/** Explicit imports only: never rebuild the graph at application startup. */
export function createSqliteKnowledgeSync(deps: {
  db: Database; getUser: (req: Request) => any; getProject: (id: string) => any;
  store?: EnterpriseKnowledgeStore | null; sync?: ArangoElasticsearchSync;
}) {
  const jobs = new Map<string, any>();
  let running = false;
  return async (req: Request, url: URL): Promise<Response | null> => {
    if (!['/api/kb/knowledge-sync/sqlite/status', '/api/kb/knowledge-sync/sqlite/start'].includes(url.pathname)) return null;
    const user = deps.getUser(req);
    if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: '需要系统管理员权限' }, { status: 403 });
    const project = deps.getProject(url.searchParams.get('db') || 'default');
    if (!project) return Response.json({ error: '应用不存在' }, { status: 404 });
    const name = String(project.name);
    if (url.pathname.endsWith('/status') && req.method === 'GET') {
      return Response.json({ configured: Boolean(process.env.ARANGO_URL && process.env.ARANGO_USERNAME && process.env.ARANGO_PASSWORD && process.env.ELASTICSEARCH_URL), ...(jobs.get(name) || { state: 'idle' }) });
    }
    if (!url.pathname.endsWith('/start') || req.method !== 'POST') return Response.json({ error: '不支持的请求方法' }, { status: 405 });
    if (running) return Response.json({ error: '已有知识同步任务正在运行，请稍后重试' }, { status: 409 });
    let store: EnterpriseKnowledgeStore, sync: ArangoElasticsearchSync;
    try {
      const config = configFromEnvironment();
      const es = process.env.ELASTICSEARCH_URL?.trim();
      if (!config || !es) throw new Error('请配置 ArangoDB 和 Elasticsearch 连接');
      store = deps.store || new EnterpriseKnowledgeStore(new ArangoClient(config));
      sync = deps.sync || new ArangoElasticsearchSync(store, new ElasticsearchClient({ url: es.replace(/\/+$/, '') }));
    } catch (error: any) { return Response.json({ error: error.message }, { status: 503 }); }
    const job = { state: 'running', phase: 'sqlite', entities: 0, links: 0, total: 0, startedAt: new Date().toISOString(), finishedAt: '', error: '' };
    jobs.set(name, job);
    running = true;
    void (async () => {
      try {
        // Take a consistent local snapshot before the first network request.
        const snapshot = deps.db.transaction(() => {
          const nodes = deps.db.query('SELECT * FROM nodes WHERE project_id=? OR (project_id IS NULL AND ?=(SELECT id FROM projects WHERE is_default=1 LIMIT 1)) ORDER BY id').all(project.id, project.id) as any[];
          return nodes.map(node => {
            const classes = (deps.db.query('SELECT class_id FROM entity_classes WHERE entity_id=?').all(node.id) as any[]).map(row => row.class_id);
            const maintainers = (deps.db.query('SELECT user_id FROM knowledge_maintainers WHERE node_id=?').all(node.id) as any[]).map(row => row.user_id);
            const attributes = deps.db.query('SELECT * FROM attributes WHERE node_id=? ORDER BY id').all(node.id) as any[];
            return { entity: { ...entityDocument(node, undefined, classes), ...knowledgeMedia(node, attributes), maintainer_ids: maintainers }, edges: edgeDocuments(node, attributes) };
          });
        })();
        job.total = snapshot.length;
        job.phase = 'arangodb';
        await ensureApplicationDatabase(store.client, name);
        for (let offset = 0; offset < snapshot.length; offset += 100) {
          const batch = snapshot.slice(offset, offset + 100);
          await store.transaction(name, async trx => {
            const headers = { 'x-arango-trx-id': trx };
            for (const { entity, edges } of batch) {
              await store.client.database(name, '/_api/document/entity?overwriteMode=replace', { method: 'POST', headers, body: JSON.stringify(entity) });
              await store.query(name, 'FOR edge IN link FILTER edge._from == @vertex REMOVE edge IN link', { vertex: `entity/${entity._key}` }, trx);
              if (edges.length) await store.client.database(name, '/_api/document/link?overwriteMode=replace', { method: 'POST', headers, body: JSON.stringify(edges) }).then(({ body }) => {
                if (Array.isArray(body) && body.some(row => row.error)) throw new Error('关系写入失败');
              });
            }
          });
          job.entities += batch.length;
          job.links += batch.reduce((count, item) => count + item.edges.length, 0);
        }
        job.phase = 'elasticsearch';
        await sync.afterWrite(name);
        job.state = 'completed';
      } catch (error: any) { job.state = 'failed'; job.error = error.message || String(error); }
      finally { job.finishedAt = new Date().toISOString(); running = false; }
    })();
    return Response.json({ ...job }, { status: 202 });
  };
}
