import type { Database } from 'bun:sqlite';
import { documentKey } from './arangodb.ts';
import { canAccessKnowledge, type KnowledgeUser } from './knowledge-access.ts';
import { EnterpriseKnowledgeStore, arangoNodeResponse, canUseArangoKnowledge, cleanKnowledgeId, KnowledgeStoreError } from './enterprise-knowledge.ts';

type Row = Record<string, any>;
const privateJson = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { 'Cache-Control': 'no-store' } });
export function ensureAccountActivitySchema(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS account_knowledge_activity (
    user_id INTEGER NOT NULL, project_id INTEGER NOT NULL, node_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('history','favorite')), created_at TEXT NOT NULL,
    PRIMARY KEY(user_id, project_id, node_id, kind))`);
  db.run('CREATE INDEX IF NOT EXISTS account_activity_recent ON account_knowledge_activity(user_id,kind,created_at)');
}
export function createAccountActivity(deps: { db: Database; store: EnterpriseKnowledgeStore | null; getUser: (req: Request) => any; getProject: (slug: string) => any }) {
  const { db, store } = deps; ensureAccountActivitySchema(db);
  const accessUser = (user: Row, project: Row): KnowledgeUser => ({ ...user, id: Number(user.id), username: String(user.username || ''), ...(project.name === 'default' ? { fullAccess: true } : {}),
    ownedProjectIds: (db.query('SELECT id FROM projects WHERE owner_user_id=?').all(user.id) as Row[]).map(row => row.id),
    memberProjectIds: (db.query('SELECT project_id FROM application_members WHERE user_id=?').all(user.id) as Row[]).map(row => row.project_id) });
  async function readable(user: Row, project: Row, id: string) {
    if (store) {
      const node = await store.get(project.name, id);
      return node && canUseArangoKnowledge(node, accessUser(user, project)) ? arangoNodeResponse(node, accessUser(user, project)) : null;
    }
    const node = db.query('SELECT * FROM nodes WHERE id=? AND project_id=?').get(id, project.id) as Row | null;
    return node && canAccessKnowledge(db, user as any, id) ? node : null;
  }
  const unavailable = (created_at: string) => ({ id: null, name: null, project_slug: null, project_title: null, created_at });
  async function records(user: Row, section: string): Promise<Row[]> {
    if (section === 'likes') {
      if (!store) throw new Error('Lite profile uses existing SQLite likes');
      const projects = db.query("SELECT id,name,title FROM projects WHERE name <> 'shared'").all() as Row[];
      const all = await Promise.all(projects.map(async project => {
        let rows: Row[];
        try { rows = await store.query(project.name, `FOR doc IN entity FILTER @uid IN NOT_NULL(doc.interactions.likes, []) RETURN KEEP(doc,'id','sqlite_id','labels','name','type','project_id','visibility','owner_user_id','maintainer_ids')`, { uid: user.id }); }
        catch (error: any) { if (error.status === 404) return []; throw error; }
        const reader = accessUser(user, project);
        return rows.map(node => canUseArangoKnowledge(node, reader) ? {
          id: cleanKnowledgeId(node.sqlite_id || node.id), name: arangoNodeResponse(node, reader).name,
          type: node.type, project_slug: project.name, project_title: project.title || project.name, created_at: null,
        } : unavailable(''));
      }));
      return all.flat().sort((a,b) => String(a.project_slug || '').localeCompare(String(b.project_slug || '')) || String(a.name || '').localeCompare(String(b.name || ''),'zh-CN'));
    }
    const kind = section === 'history' ? 'history' : 'favorite';
    const rows = db.query(`SELECT h.*,p.name AS slug,p.title FROM account_knowledge_activity h LEFT JOIN projects p ON p.id=h.project_id WHERE h.user_id=? AND h.kind=? ORDER BY h.created_at DESC,h.project_id,h.node_id`).all(user.id, kind) as Row[];
    if (kind === 'favorite') {
      const legacy = db.query(`SELECT h.created_at,REPLACE(h.knowledge_id,'entity/','') AS node_id,n.project_id,p.name AS slug,p.title FROM knowledge_favorites h LEFT JOIN nodes n ON n.id=REPLACE(h.knowledge_id,'entity/','') LEFT JOIN projects p ON p.id=n.project_id WHERE h.user_id=?`).all(user.id) as Row[];
      for (const row of legacy) if (!rows.some(item => item.node_id === row.node_id && item.project_id === row.project_id)) rows.push(row);
    }
    const hydrated = new Map<string, Row>();
    if (store) {
      const groups = new Map<string, Row[]>();
      for (const row of rows) if (row.slug) groups.set(row.slug,[...(groups.get(row.slug)||[]),row]);
      await Promise.all([...groups].map(async ([slug, group]) => {
        let nodes: Row[];
        try { nodes = await store.query(slug, `FOR key IN @keys LET doc=DOCUMENT('entity',key) FILTER doc != null RETURN KEEP(doc,'id','sqlite_id','labels','name','type','project_id','visibility','owner_user_id','maintainer_ids')`, {keys:[...new Set(group.map(row=>documentKey(row.node_id)))]}); }
        catch(error:any) { if(error.status===404)return;throw error; }
        const reader=accessUser(user,{name:slug});
        for(const raw of nodes)if(canUseArangoKnowledge(raw,reader)){const node=arangoNodeResponse(raw,reader);hydrated.set(`${slug}:${node.id}`,node);}
      }));
    }
    const items = await Promise.all(rows.map(async row => {
      if (!row.slug) return unavailable(row.created_at);
      const project = { id: row.project_id, name: row.slug, title: row.title };
      let node;
      try { node = store ? hydrated.get(`${row.slug}:${row.node_id}`) : await readable(user, project, row.node_id); } catch (error: any) { if (error.status !== 404) throw error; }
      return node ? { id: row.node_id, name: node.name, type: node.type, project_slug: row.slug, project_title: row.title || row.slug, created_at: row.created_at } : unavailable(row.created_at);
    }));
    return items.sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }
  async function counts(user: Row) {
    const likes = store ? (await records(user,'likes')).length : Number((db.query('SELECT COUNT(*) AS total FROM knowledge_likes WHERE user_id=?').get(user.id) as Row).total);
    const favorites = (await records(user,'favorites')).length;
    const history = Number((db.query("SELECT COUNT(*) AS total FROM account_knowledge_activity WHERE user_id=? AND kind='history'").get(user.id) as Row).total);
    return { likes, favorites, history };
  }
  async function handle(req: Request, url: URL): Promise<Response | null> {
    if (!url.pathname.startsWith('/api/account/knowledge/')) return null;
    try {
      const kind = url.pathname === '/api/account/knowledge/history' ? 'history' : url.pathname === '/api/account/knowledge/favorites' ? 'favorite' : '';
      if (!kind) throw new KnowledgeStoreError('记录接口不存在',404);
      const user = deps.getUser(req); if (!user || user.id <= 0 || user.status === 'disabled') throw new KnowledgeStoreError('请先登录',401);
      const project = deps.getProject(url.searchParams.get('db') || 'default'); if (!project) throw new KnowledgeStoreError('应用不存在',404);
      const id = cleanKnowledgeId(url.searchParams.get('id')); if (!id || id.length > 512) throw new KnowledgeStoreError('知识 ID 无效');
      if (req.method === 'DELETE' && kind === 'favorite') {
        db.run("DELETE FROM account_knowledge_activity WHERE user_id=? AND project_id=? AND node_id=? AND kind='favorite'",[user.id,project.id,id]);
        // Remove legacy entries only when their application is known to match.
        db.run('DELETE FROM knowledge_favorites WHERE user_id=? AND knowledge_id IN (?,?) AND EXISTS(SELECT 1 FROM nodes WHERE id=? AND project_id=?)',[user.id,id,`entity/${id}`,id,project.id]);
        return privateJson({ favorited: false });
      }
      if (!['POST','GET'].includes(req.method) || (kind === 'history' && req.method !== 'POST')) throw new KnowledgeStoreError('不支持的操作',405);
      if (!await readable(user,project,id)) throw new KnowledgeStoreError('知识不存在或无权访问',404);
      if (req.method === 'GET') {
        const found = db.query("SELECT 1 FROM account_knowledge_activity WHERE user_id=? AND project_id=? AND node_id=? AND kind='favorite'").get(user.id,project.id,id);
        const legacy = db.query('SELECT 1 FROM knowledge_favorites h JOIN nodes n ON n.id=REPLACE(h.knowledge_id,\'entity/\',\'\') WHERE h.user_id=? AND n.id=? AND n.project_id=?').get(user.id,id,project.id);
        return privateJson({ favorited: Boolean(found || legacy) });
      }
      db.transaction(() => {
        db.run('INSERT INTO account_knowledge_activity(user_id,project_id,node_id,kind,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,project_id,node_id,kind) DO UPDATE SET created_at=excluded.created_at', [user.id,project.id,id,kind,new Date().toISOString()]);
        if (kind === 'history') db.run("DELETE FROM account_knowledge_activity WHERE user_id=? AND kind='history' AND rowid NOT IN (SELECT rowid FROM account_knowledge_activity WHERE user_id=? AND kind='history' ORDER BY created_at DESC,rowid DESC LIMIT 500)",[user.id,user.id]);
      })();
      return privateJson(kind === 'favorite' ? { favorited: true } : { ok: true });
    } catch (error) {
      if (error instanceof KnowledgeStoreError) return privateJson({error:error.message},{status:error.status});
      console.error('Account activity failed',error); return privateJson({error:'个人记录服务暂不可用'},{status:503});
    }
  }
  return { handle, counts, records, enterprise: Boolean(store) };
}
