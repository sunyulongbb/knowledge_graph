import type { Database } from 'bun:sqlite';
import { applicationPermissions } from './application-access.ts';
import { canAccessKnowledge, knowledgeId, type KnowledgeUser } from './knowledge-access.ts';

export function createGraphCanvasHandler(db: Database, getUser: (req: Request) => KnowledgeUser | null, getProject: (slug: string) => any) {
  let initialized = false;
  const error = (message: string, status = 400) => Response.json({ error: message }, { status });
  return async (req: Request, url: URL): Promise<Response | null> => {
    if (!url.pathname.startsWith('/api/graph-canvases')) return null;
    const match = /^\/api\/graph-canvases(?:\/([a-zA-Z0-9-]+))?$/.exec(url.pathname);
    if (!match) return error('画布不存在', 404);
    const user = getUser(req);
    if (!user || user.id <= 0) return error('请先登录后创建个人画布', 401);
    const project = getProject(url.searchParams.get('db') || '');
    if (!project || !applicationPermissions(db, user, project).member) return error('需要当前应用成员权限', 403);
    if (!initialized) {
      db.run(`CREATE TABLE IF NOT EXISTS graph_canvases(id TEXT PRIMARY KEY, project_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
        name TEXT NOT NULL, graph_json TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      db.run('CREATE INDEX IF NOT EXISTS graph_canvases_scope ON graph_canvases(project_id,user_id)');
      initialized = true;
    }
    const id = match[1];
    const row = id ? db.query('SELECT * FROM graph_canvases WHERE id=? AND project_id=? AND user_id=?').get(id, project.id, user.id) as any : null;
    if (id && !row) return error('画布不存在或无权访问', 404);
    if (req.method === 'GET') {
      if (!id) return Response.json({ items: db.query('SELECT id,name,revision,updated_at FROM graph_canvases WHERE project_id=? AND user_id=? ORDER BY updated_at,id').all(project.id,user.id) });
      const graph = JSON.parse(row.graph_json);
      const nodes = (graph.nodes || []).filter((n: any) => {
        const node = db.query('SELECT project_id FROM nodes WHERE id=?').get(knowledgeId(n.data.id)) as any;
        return node && Number(node.project_id) === Number(project.id) && canAccessKnowledge(db,user,n.data.id);
      });
      const ids = new Set(nodes.map((n: any) => n.data.id));
      return Response.json({ id:row.id,name:row.name,revision:row.revision, graph:{...graph,nodes,edges:(graph.edges || []).filter((e: any) => ids.has(e.data.source) && ids.has(e.data.target))} });
    }
    if (req.method === 'DELETE' && id) {
      db.run('DELETE FROM graph_canvases WHERE id=? AND user_id=? AND project_id=?',[id,user.id,project.id]);
      return Response.json({ok:true});
    }
    if (req.method !== 'POST' && req.method !== 'PUT') return error('不支持的操作',405);
    if ((req.method === 'PUT') !== Boolean(id)) return error('不支持的操作',405);
    const body = await req.json().catch(() => null) as any;
    const name = String(body?.name || '').trim();
    if (!name || name.length > 80) return error('画布名称须为 1–80 个字符');
    const graph = body.graph || {nodes:[],edges:[],zoom:1,pan:{x:0,y:0}};
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.nodes.length > 2000 || graph.edges.length > 5000) return error('画布数据无效或超过节点数量限制');
    const ids = new Set<string>();
    for (const n of graph.nodes) {
      if (!n?.data?.id || ids.has(n.data.id) || !Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y)) return error('节点数据无效');
      const node = db.query('SELECT project_id FROM nodes WHERE id=?').get(knowledgeId(n.data.id)) as any;
      if (!node || Number(node.project_id) !== Number(project.id) || !canAccessKnowledge(db,user,n.data.id)) return error('节点不存在或不属于当前应用',403);
      ids.add(n.data.id);
    }
    if (graph.edges.some((e: any) => !e?.data?.id || !ids.has(e.data.source) || !ids.has(e.data.target))) return error('连线数据无效');
    if (!Number.isFinite(graph.zoom) || graph.zoom < .2 || graph.zoom > 3 || !Number.isFinite(graph.pan?.x) || !Number.isFinite(graph.pan?.y)) return error('视口数据无效');
    const serialized = JSON.stringify(graph);
    if (serialized.length > 4_000_000) return error('画布内容过大',413);
    if (id) {
      if (body.revision !== row.revision) return error('画布已在其他设备更新，请重新打开后再编辑',409);
      const update = db.run('UPDATE graph_canvases SET name=?,graph_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND user_id=? AND project_id=?',[name,serialized,id,body.revision,user.id,project.id]);
      if (!update.changes) return error('画布已在其他设备更新，请重新打开后再编辑',409);
      return Response.json({id,name,revision:row.revision+1});
    }
    const newId = crypto.randomUUID();
    db.run('INSERT INTO graph_canvases(id,project_id,user_id,name,graph_json) VALUES(?,?,?,?,?)',[newId,project.id,user.id,name,serialized]);
    return Response.json({id:newId,name,revision:1}, {status:201});
  };
}
