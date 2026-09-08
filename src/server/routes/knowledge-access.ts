import { adminDb as db, getProjectByIdentifier } from '../db.ts';
import { getCurrentUser } from '../auth-context.ts';
import { canAccessKnowledge, knowledgeId } from '../knowledge-access.ts';
import { applicationPermissions } from '../application-access.ts';

const response = (error: string, status: number) => Response.json({ error }, { status });

export async function handleKnowledgeAccessRoutes(req: Request, url: URL, method: string) {
  if (!['/api/kb/knowledge-access', '/api/kb/knowledge-maintenance/request', '/api/kb/knowledge-maintenance/review', '/api/kb/knowledge-maintenance/remove'].includes(url.pathname)) return null;
  const user = getCurrentUser(req);
  const body: any = method === 'POST' ? await req.json().catch(() => ({})) : {};
  const id = knowledgeId(body.id || url.searchParams.get('id'));
  if (!canAccessKnowledge(db, user, id)) return response('知识不存在或无权访问', 404);
  const node = db.query('SELECT id, owner_user_id, creator_username, visibility FROM nodes WHERE id = ?').get(id) as any;
  const canManage = canAccessKnowledge(db, user, id, 'manage');
  if (method === 'GET' && url.pathname === '/api/kb/knowledge-access') {
    const owner = node.owner_user_id ? db.query('SELECT id, username, display_name FROM users WHERE id = ?').get(node.owner_user_id) : null;
    const maintainers = db.query('SELECT u.id, u.username, u.display_name, m.created_at FROM knowledge_maintainers m JOIN users u ON u.id = m.user_id WHERE m.node_id = ? ORDER BY m.created_at, u.id').all(id);
    const requests = canManage ? db.query("SELECT r.user_id, u.username, u.display_name, r.message, r.created_at FROM knowledge_maintenance_requests r JOIN users u ON u.id = r.user_id WHERE r.node_id = ? AND r.status = 'pending' ORDER BY r.created_at").all(id) : [];
    const ownRequest = user ? db.query('SELECT status FROM knowledge_maintenance_requests WHERE node_id = ? AND user_id = ?').get(id, user.id) : null;
    return Response.json({ id, visibility: node.visibility, owner, creatorUsername: node.creator_username, maintainers, requests, ownRequest, canManage, canEdit: canAccessKnowledge(db, user, id, 'edit'), canRequest: !!user && !canAccessKnowledge(db, user, id, 'edit') });
  }
  if (method !== 'POST') return response('不支持的操作', 405);
  if (!user) return response('请先登录', 401);
  if (url.pathname.endsWith('/request')) {
    if (canAccessKnowledge(db, user, id, 'edit')) return response('你已拥有维护权限', 409);
    const message = String(body.message || '').trim();
    if (message.length > 1000) return response('申请说明不能超过 1000 字', 400);
    db.run(`INSERT INTO knowledge_maintenance_requests (node_id, user_id, message) VALUES (?, ?, ?)
      ON CONFLICT(node_id, user_id) DO UPDATE SET message = excluded.message, status = 'pending', reviewed_by = NULL, reviewed_at = NULL, created_at = CURRENT_TIMESTAMP`, [id, user.id, message]);
    return Response.json({ ok: true });
  }
  if (!canManage) return response('仅创建者可以管理维护权限', 403);
  const target = Number(body.user_id);
  if (!Number.isSafeInteger(target) || target <= 0) return response('用户无效', 400);
  if (url.pathname.endsWith('/remove')) {
    db.transaction(() => {
      db.run('DELETE FROM knowledge_maintainers WHERE node_id = ? AND user_id = ?', [id, target]);
      db.run("UPDATE knowledge_maintenance_requests SET status = 'revoked', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE node_id = ? AND user_id = ?", [user.id, id, target]);
    })();
    return Response.json({ ok: true });
  }
  if (!['approve', 'reject'].includes(body.decision)) return response('请选择批准或拒绝', 400);
  const pending = db.query("SELECT 1 FROM knowledge_maintenance_requests WHERE node_id = ? AND user_id = ? AND status = 'pending'").get(id, target);
  if (!pending) return response('申请不存在或已处理', 409);
  db.transaction(() => {
    if (body.decision === 'approve') db.run('INSERT OR IGNORE INTO knowledge_maintainers (node_id, user_id, approved_by) VALUES (?, ?, ?)', [id, target, user.id]);
    db.run('UPDATE knowledge_maintenance_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE node_id = ? AND user_id = ?', [body.decision === 'approve' ? 'approved' : 'rejected', user.id, id, target]);
  })();
  return Response.json({ ok: true });
}

export async function guardKnowledgeRequest(req: Request, url: URL, method: string) {
  const user = getCurrentUser(req);
  const path = url.pathname;
  const denied = (id: unknown, mode: 'read' | 'edit' | 'manage' = 'read') => !canAccessKnowledge(db, user, id, mode);
  const mediaPath = path.replace(/\/{2,}/g, '/');
  if (/^\/static\/uploads\/(?:.*\/)?(node-images|node-videos|node-pdfs)\//i.test(mediaPath)) {
    const needle = `%${mediaPath}%`;
    const references = db.query(`SELECT DISTINCT n.id FROM nodes n LEFT JOIN attributes a ON a.node_id = n.id
      WHERE n.images LIKE ? OR n.covers LIKE ? OR n.videos LIKE ? OR n.pdf LIKE ? OR n.data LIKE ? OR n.wiki_md LIKE ? OR a.value LIKE ? OR a.statement_json LIKE ?`).all(needle, needle, needle, needle, needle, needle, needle, needle) as { id: string }[];
    if (references.length ? !references.some((node) => !denied(node.id)) : !user) return response('附件不存在或无权访问', 404);
    return null;
  }
  if (path.startsWith('/api/knowledge/')) {
    const id = decodeURIComponent(path.split('/')[3] || '');
    if (denied(id)) return response('知识不存在或无权访问', 404);
    return null;
  }
  if (method === 'GET') {
    if (path.startsWith('/api/kb/entry/tasks') && user?.role !== 'admin') return response('该操作需要管理员权限', 403);
    if (['/api/kb/node', '/api/kb/node/graph', '/api/kb/node/attributes', '/api/kb/node/relations', '/api/wiki/page'].includes(path)) {
      const id = url.searchParams.get('id') || url.searchParams.get('entityId') || url.searchParams.get('entity_id');
      if (id && denied(id)) return response('知识不存在或无权访问', 404);
    }
    return null;
  }
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || (!path.startsWith('/api/kb/') && !path.startsWith('/api/wiki/') && !path.startsWith('/api/sparql/import'))) return null;
  if (!user) return response('请先登录', 401);
  if (path.startsWith('/api/kb/knowledge-')) return null;
  if (path.startsWith('/api/kb/upload-')) return null;
  const body: any = /application\/json/i.test(req.headers.get('content-type') || '') ? await req.clone().json().catch(() => ({})) : {};
  if (['/api/kb/update_project', '/api/kb/delete_project'].includes(path)) {
    const project = db.query('SELECT * FROM projects WHERE name=?').get(String(body.name || ''));
    const permission = applicationPermissions(db, user, project);
    return (path.endsWith('delete_project') ? permission.owner : permission.editSettings) ? null : response('无权管理该应用', 403);
  }
  const check = (id: unknown, mode: 'read' | 'edit' | 'manage') => denied(id, mode) ? response(mode === 'read' ? '知识不存在或无权访问' : '无权修改该知识', mode === 'read' ? 404 : 403) : null;
  if ((path === '/api/kb/nodes' || path === '/api/kb/entity/resolve') && method === 'POST') {
    const appSlug = url.searchParams.get('db');
    if (appSlug && appSlug !== 'app') {
      const project = getProjectByIdentifier(appSlug);
      if (!project || !applicationPermissions(db, user, project).member) return response('仅应用创建者和维护成员可以在此应用中新增知识', 403);
    }
  }
  if (path === '/api/kb/nodes' && method === 'POST') {
    if (body.visibility !== undefined && !['public', 'private'].includes(body.visibility)) return response('访问级别无效', 400);
    if (body.id && db.query('SELECT 1 FROM nodes WHERE id = ?').get(knowledgeId(body.id))) return response('知识 ID 已存在', 409);
    return null;
  }
  if (path === '/api/kb/nodes/update') {
    const error = check(body.id, 'edit');
    if (error) return error;
    if (body.visibility !== undefined) {
      if (!['public', 'private'].includes(body.visibility)) return response('访问级别无效', 400);
      const existing = db.query('SELECT visibility FROM nodes WHERE id = ?').get(knowledgeId(body.id)) as any;
      if (body.visibility !== existing?.visibility) return check(body.id, 'manage');
    }
    return null;
  }
  if (path === '/api/kb/nodes' && method === 'DELETE') return check(url.searchParams.get('id'), 'manage');
  if (path === '/api/wiki/page/save') return check(body.entityId || body.entity_id, 'edit');
  if (path === '/api/kb/entity/class') return check(body.entity_id || body.id || url.searchParams.get('entity_id'), 'edit');
  if (path === '/api/kb/attributes/save') {
    const error = check(body.node_id || body.entity_id, 'edit');
    if (error) return error;
    if (body.id) {
      const previous = db.query('SELECT node_id FROM attributes WHERE id = ?').get(body.id) as any;
      if (previous && denied(previous.node_id, 'edit')) return response('无权修改该属性', 403);
    }
    const references = (value: any): boolean => {
      if (!value || typeof value !== 'object') return false;
      if (value.id && db.query('SELECT 1 FROM nodes WHERE id = ?').get(knowledgeId(value.id)) && denied(value.id)) return true;
      return Object.values(value).some(references);
    };
    return references(body) ? response('关联知识不可访问', 403) : null;
  }
  if (path.startsWith('/api/kb/attributes/') && method === 'DELETE') {
    const id = decodeURIComponent(path.slice('/api/kb/attributes/'.length));
    const attribute = db.query('SELECT node_id FROM attributes WHERE id = ?').get(id) as any;
    return attribute ? check(attribute.node_id, 'edit') : response('属性不存在', 404);
  }
  if (path === '/api/kb/relations/create') return check(body.source, 'edit') || check(body.target, 'read');
  if (path.startsWith('/api/kb/relations/') && method === 'DELETE' && !path.endsWith('/clear')) {
    const id = decodeURIComponent(path.slice('/api/kb/relations/'.length)).split(':')[0];
    const attribute = db.query('SELECT node_id FROM attributes WHERE id = ?').get(id) as any;
    return attribute ? check(attribute.node_id, 'edit') : response('关系不存在', 404);
  }
  if (path === '/api/kb/nodes/engagement') return check(body.id, 'read');
  if (path === '/api/kb/entity/resolve') return null;
  // Schema changes, bulk import/cleanup and task execution remain administrative.
  if (user.role !== 'admin') return response('该操作需要管理员权限', 403);
  return null;
}
