import type { Database } from 'bun:sqlite';
import { canAccessKnowledge, type KnowledgeUser } from './knowledge-access.ts';
import { canUseArangoKnowledge, cleanKnowledgeId, KnowledgeStoreError } from './enterprise-knowledge.ts';

type Project = { id: number; name: string };
export function createKnowledgeViews(deps: {
  db: Database; getUser: (req: Request) => KnowledgeUser | null;
  getProject: (slug: string) => Project | null;
  store: { get: (database: string, id: string) => Promise<any> } | null;
  now?: () => number;
}) {
  const { db } = deps;
  db.run('CREATE TABLE IF NOT EXISTS knowledge_view_counts(project_id INTEGER NOT NULL,node_id TEXT NOT NULL,view_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,node_id))');
  db.run('CREATE TABLE IF NOT EXISTS knowledge_view_visitors(project_id INTEGER NOT NULL,node_id TEXT NOT NULL,visitor TEXT NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(project_id,node_id,visitor))');
  db.run('CREATE INDEX IF NOT EXISTS knowledge_view_visitors_seen ON knowledge_view_visitors(last_seen)');
  const json = (body: unknown, status = 200, cookie = '') => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...(cookie ? {'Set-Cookie':cookie} : {}) } });
  const count = (project: number, id: string) => Number((db.query('SELECT view_count FROM knowledge_view_counts WHERE project_id=? AND node_id=?').get(project,id) as any)?.view_count || 0);
  async function handle(req: Request, url: URL): Promise<Response | null> {
    const match = url.pathname.match(/^\/api\/knowledge\/([^/]+)\/(view|views)$/);
    if (!match) return null;
    if (!((req.method === 'POST' && match[2] === 'view') || (req.method === 'GET' && match[2] === 'views'))) return json({error:'不支持的操作'},405);
    try {
      const id = cleanKnowledgeId(decodeURIComponent(match[1]!));
      if (!id || id.length > 512) return json({error:'知识 ID 无效'},400);
      const project = deps.getProject(url.searchParams.get('db') || 'default');
      if (!project) return json({error:'应用不存在'},404);
      const user = deps.getUser(req);
      const node = deps.store ? await deps.store.get(project.name,id) : db.query('SELECT id,project_id FROM nodes WHERE id=? AND project_id=?').get(id,project.id);
      const readable = deps.store ? canUseArangoKnowledge(node,user) : !!node && canAccessKnowledge(db,user,id);
      if (!readable) return json({error:'知识不存在或无权访问'},404);
      if (req.method === 'GET') return json({viewCount:count(project.id,id)});
      const cookieId = (req.headers.get('cookie') || '').match(/(?:^|;\s*)kb_viewer=([a-zA-Z0-9-]{16,80})(?:;|$)/)?.[1];
      const visitorId = cookieId || crypto.randomUUID();
      const visitor = user && user.id > 0 ? `user:${user.id}` : `guest:${visitorId}`;
      const now = (deps.now || Date.now)();
      const counted = db.transaction(() => {
        const previous = db.query('SELECT last_seen FROM knowledge_view_visitors WHERE project_id=? AND node_id=? AND visitor=?').get(project.id,id,visitor) as any;
        if (previous && now - Number(previous.last_seen) < 30_000) return false;
        db.run('INSERT INTO knowledge_view_counts(project_id,node_id,view_count) VALUES(?,?,1) ON CONFLICT(project_id,node_id) DO UPDATE SET view_count=view_count+1',[project.id,id]);
        db.run('INSERT INTO knowledge_view_visitors(project_id,node_id,visitor,last_seen) VALUES(?,?,?,?) ON CONFLICT(project_id,node_id,visitor) DO UPDATE SET last_seen=excluded.last_seen',[project.id,id,visitor,now]);
        db.run('DELETE FROM knowledge_view_visitors WHERE last_seen<?',[now-86_400_000]);
        return true;
      })();
      const cookie = !cookieId && !(user && user.id > 0) ? `kb_viewer=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}` : '';
      return json({viewCount:count(project.id,id),counted},200,cookie);
    } catch (error) {
      if (error instanceof KnowledgeStoreError) return json({error:error.message},error.status);
      if (error instanceof URIError) return json({error:'知识 ID 无效'},400);
      console.error('Knowledge view count failed',error);
      return json({error:'浏览量服务暂不可用'},503);
    }
  }
  async function decorate(response: Response, url: URL): Promise<Response> {
    if (!response.ok || !['/api/kb/discover/search','/api/kb/node','/api/kb/recommendations'].includes(url.pathname)) return response;
    const project = deps.getProject(url.searchParams.get('db') || 'default');
    if (!project) return response;
    const data = await response.clone().json().catch(() => null);
    if (!data) return response;
    const nodes: any[] = Array.isArray(data.nodes) ? data.nodes : data.node ? [data.node] : [];
    const ids = nodes.map(node => cleanKnowledgeId(node.id || node._id)).filter(Boolean);
    const counts = new Map<string,number>();
    for (let i=0;i<ids.length;i+=500) {
      const batch=ids.slice(i,i+500);
      const rows=db.query(`SELECT node_id,view_count FROM knowledge_view_counts WHERE project_id=? AND node_id IN (${batch.map(()=>'?').join(',')})`).all(project.id,...batch) as any[];
      rows.forEach(row=>counts.set(row.node_id,Number(row.view_count)));
    }
    nodes.forEach(node=>{node.viewCount=counts.get(cleanKnowledgeId(node.id||node._id))||0;});
    const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
    return Response.json(data,{status:response.status,headers});
  }
  return {handle,decorate};
}
