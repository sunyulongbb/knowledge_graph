import type { Database } from 'bun:sqlite';

import { PipelineStore } from './store.ts';
import { CleaningEngine } from './engine.ts';
import { readMysql, readWikidata } from './sources.ts';
import { loadOntologyProperties } from '../ontology-properties.ts';

export function createPipelineHandler(adminDb: Database, db: Database, getCurrentUser: (req: Request) => any, getProjectByIdentifier: (slug: string) => any) {
let migrated = false;
return async function handlePipelineRoutes(req: Request, url: URL, method: string) {
  if (!url.pathname.startsWith('/api/kb/pipeline/')) return null;
  const user = getCurrentUser(req);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: '批量录入和清洗需要管理员权限' }, { status: 403 });
  const slug = url.searchParams.get('db');
  const project = slug && slug !== 'app' ? getProjectByIdentifier(slug) : null;
  if (slug && slug !== 'app' && !project) return Response.json({ error: '应用不存在' }, { status: 404 });
  if (!migrated) { PipelineStore.migrate(adminDb); migrated = true; }
  const store = new PipelineStore(adminDb, project?.id || null, user.id);
  const engine = new CleaningEngine(store, db, user);
  try {
    const path = url.pathname.slice('/api/kb/pipeline/'.length);
    const body: any = method === 'POST' ? await req.json() : {};
    if (path === 'mysql' && method === 'POST') return Response.json(await readMysql(body));
    if (path === 'wikidata' && method === 'POST') return Response.json(await readWikidata(body));
    if (path === 'tables' && method === 'GET') return Response.json({ items: store.listTables() });
    if (path === 'tables' && method === 'POST') return Response.json(store.saveTable(body));
    if (path.startsWith('tables/') && method === 'GET') return Response.json(store.getTable(decodeURIComponent(path.slice(7))));
    if (path === 'flows' && method === 'GET') return Response.json({ items: store.listFlows() });
    if (path === 'flows' && method === 'POST') return Response.json(store.saveFlow(body));
    if (path.startsWith('flows/') && method === 'GET') return Response.json(store.getFlow(decodeURIComponent(path.slice(6))));
    if (path === 'properties' && method === 'GET') return Response.json({ items: loadOntologyProperties(db, url.searchParams.get('ontologyId') || '', store.projectId, true) });
    if (path === 'runs' && method === 'GET') return Response.json({ items: store.listRuns() });
    if (path.startsWith('runs/') && method === 'GET') {
      const run = store.getRun(decodeURIComponent(path.slice(5)));
      const { changes, bindings, fingerprint, ...result } = run.result;
      return Response.json({ ...run, result });
    }
    if (path === 'run' && method === 'POST') {
      if (!['preview', 'full'].includes(body.mode)) throw new Error('运行方式无效');
      const flow = store.getFlow(String(body.flowId || ''));
      const decisions = body.decisions || {};
      if (typeof decisions !== 'object' || Array.isArray(decisions)) throw new Error('对齐决策无效');
      const plan = engine.plan(flow, body.mode, decisions);
      const run = store.saveRun(flow.id, body.mode, plan);
      const { changes, bindings, fingerprint, ...result } = plan;
      return Response.json({ ...run, result });
    }
    if (path === 'confirm' && method === 'POST') {
      if (body.confirm !== true) throw new Error('请确认执行结果后再保存知识库');
      const run = engine.confirm(String(body.runId || ''));
      const { changes, bindings, fingerprint, ...result } = run.result;
      return Response.json({ ...run, result });
    }
    return Response.json({ error: '接口不存在' }, { status: 404 });
  } catch (error) { return Response.json({ error: (error as Error).message || '操作失败' }, { status: 400 }); }
}

}
