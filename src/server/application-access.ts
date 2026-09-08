import type { Database } from 'bun:sqlite';
import type { KnowledgeUser } from './knowledge-access.ts';

export function ensureApplicationSchema(db: Database) {
  const columns = db.query('PRAGMA table_info(projects)').all() as any[];
  if (!columns.some((column) => column.name === 'owner_user_id')) db.run('ALTER TABLE projects ADD COLUMN owner_user_id INTEGER');
  db.run(`CREATE TABLE IF NOT EXISTS application_members (
    project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, edit_settings INTEGER NOT NULL DEFAULT 0,
    review_requests INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id,user_id), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS application_requests (
    project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
    PRIMARY KEY(project_id,user_id), FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, project_id INTEGER,
    message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  db.run('CREATE INDEX IF NOT EXISTS notifications_user_read ON user_notifications(user_id,read_at,id)');
}

export function applicationPermissions(db: Database, user: KnowledgeUser | null, project: any) {
  const owner = !!user && Number(project?.owner_user_id) === user.id;
  const member = user && project ? db.query('SELECT * FROM application_members WHERE project_id=? AND user_id=?').get(project.id, user.id) as any : null;
  return { owner, member: owner || !!member, editSettings: owner || !!member?.edit_settings, reviewRequests: owner || !!member?.review_requests };
}

export function createApplicationHandler(db: Database, getUser: (req: Request) => KnowledgeUser | null) {
  const error = (message: string, status = 400) => Response.json({ error: message, message, success: false }, { status });
  const projectBy = (key: unknown, byId = false) => byId
    ? db.query('SELECT * FROM projects WHERE id=?').get(Number(key) || -1) as any
    : db.query('SELECT * FROM projects WHERE name=?').get(String(key || '').replace(/\.sqlite$/, '')) as any;
  const notify = (userId: number, projectId: number, message: string) => db.run('INSERT INTO user_notifications(user_id,project_id,message) VALUES(?,?,?)', [userId, projectId, message]);
  const record = (project: any, user: KnowledgeUser | null) => ({ ...project, slug: project.name, name: project.title || project.name, ...applicationPermissions(db, user, project) });
  return async function handle(req: Request, url: URL, method: string): Promise<Response | null> {
    const path = url.pathname;
    const legacy = ['/api/kb/list_projects', '/api/kb/create_project', '/api/kb/update_project', '/api/kb/delete_project'].includes(path);
    if (!legacy && !/^\/api\/(applications|notifications)(\/|$)/.test(path)) return null;
    const user = getUser(req);
    const body: any = ['POST', 'PATCH', 'DELETE'].includes(method) ? await req.clone().json().catch(() => null) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return error('请求体须为 JSON 对象');
    if (path === '/api/notifications' && method === 'GET') {
      if (!user) return error('请先登录', 401);
      return Response.json({ items: db.query('SELECT * FROM user_notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id), unread: (db.query('SELECT count(*) AS count FROM user_notifications WHERE user_id=? AND read_at IS NULL').get(user.id) as any).count });
    }
    if (path === '/api/notifications/read' && method === 'POST') {
      if (!user) return error('请先登录', 401);
      if (body.all === true) db.run('UPDATE user_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL', [user.id]);
      else db.run('UPDATE user_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?', [user.id, Number(body.id) || -1]);
      return Response.json({ success: true });
    }
    if ((path === '/api/applications' || path === '/api/kb/list_projects') && method === 'GET') {
      const mine = path === '/api/kb/list_projects' || url.searchParams.get('scope') === 'mine';
      const rows = db.query(`SELECT p.*, u.username AS owner_username, u.display_name AS owner_name FROM projects p LEFT JOIN users u ON u.id=p.owner_user_id WHERE p.name <> 'shared' ORDER BY p.id DESC`).all() as any[];
      const projects = rows.map((row) => record(row, user)).filter((row) => !mine || row.member);
      return Response.json({ projects });
    }
    // Existing switchers use this GET. It now only resolves an existing app.
    if (path === '/api/kb/create_project' && method === 'GET') {
      const project = projectBy(url.searchParams.get('name'));
      return project ? Response.json({ success: true, project: record(project, user) }) : error('应用不存在，请登录后创建', 404);
    }
    if ((path === '/api/applications' || path === '/api/kb/create_project') && method === 'POST') {
      if (!user) return error('请先登录', 401);
      const name = String(body.name || '').trim();
      const title = String(body.title || name).trim();
      const description = String(body.description || '').trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || /^\d+$/.test(name) || ['app', 'shared'].includes(name.toLowerCase())) return error('应用短名须为 1–64 位字母、数字、下划线或短横线，不能为纯数字、app 或 shared');
      if (!title || title.length > 100 || description.length > 2000) return error('名称最多 100 字，描述最多 2000 字');
      if (projectBy(name)) return error('应用短名已存在', 409);
      db.run("INSERT INTO projects(name,title,description,file,image,theme_color,tags,link,owner_user_id) VALUES(?,?,?,'app.sqlite',?,'#ff7a2b','[]',?,?)", [name, title, description, String(body.image || ''), String(body.link || ''), user.id]);
      return Response.json({ success: true, project: record(projectBy(name), user) }, { status: 201 });
    }
    const match = path.match(/^\/api\/applications\/([^/]+)(?:\/(access|request|review|member))?$/);
    const project = projectBy(legacy ? body.name : match ? decodeURIComponent(match[1]!) : '', !legacy);
    if (!project) return error('应用不存在', 404);
    const permissions = applicationPermissions(db, user, project);
    if (match?.[2] === 'access' && method === 'GET') {
      return Response.json({ project: record(project, user), members: permissions.owner ? db.query('SELECT m.*,u.username,u.display_name FROM application_members m JOIN users u ON u.id=m.user_id WHERE project_id=? ORDER BY m.created_at').all(project.id) : [], requests: permissions.reviewRequests ? db.query("SELECT r.*,u.username,u.display_name FROM application_requests r JOIN users u ON u.id=r.user_id WHERE project_id=? AND r.status='pending' ORDER BY r.created_at").all(project.id) : [], ownRequest: user ? db.query('SELECT status FROM application_requests WHERE project_id=? AND user_id=?').get(project.id, user.id) : null });
    }
    if (!user) return error('请先登录', 401);
    if (path === '/api/kb/delete_project') return permissions.owner ? null : error('仅创建者可以删除应用', 403);
    if (path === '/api/kb/update_project' && method === 'POST') return permissions.editSettings ? null : error('无权修改应用设置', 403);
    if (match?.[2] === 'request' && method === 'POST') {
      if (!project.owner_user_id) return error('历史应用尚未登记创建者，暂不接受维护申请', 409);
      if (permissions.member) return error('你已拥有应用维护权限', 409);
      const message = String(body.message || '').trim();
      if (message.length > 1000) return error('申请说明最多 1000 字');
      const previous = db.query('SELECT status FROM application_requests WHERE project_id=? AND user_id=?').get(project.id, user.id) as any;
      if (previous?.status === 'pending') return error('申请已提交，请等待审批', 409);
      db.transaction(() => {
        db.run("INSERT INTO application_requests(project_id,user_id,message) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET message=excluded.message,status='pending',reviewed_by=NULL,reviewed_at=NULL,created_at=CURRENT_TIMESTAMP", [project.id, user.id, message]);
        const reviewers = db.query('SELECT user_id FROM application_members WHERE project_id=? AND review_requests=1').all(project.id) as any[];
        for (const id of new Set([project.owner_user_id, ...reviewers.map((item) => item.user_id)])) notify(id, project.id, `${user.username} 申请维护应用「${project.title || project.name}」`);
      })();
      return Response.json({ success: true });
    }
    if (match?.[2] === 'review' && method === 'POST') {
      if (!permissions.reviewRequests) return error('无权审批申请', 403);
      const target = Number(body.user_id);
      if (!['approve', 'reject'].includes(body.decision)) return error('请选择批准或拒绝');
      const pending = db.query("SELECT 1 FROM application_requests WHERE project_id=? AND user_id=? AND status='pending'").get(project.id, target);
      if (!pending) return error('申请不存在或已处理', 409);
      db.transaction(() => {
        if (body.decision === 'approve') db.run('INSERT OR IGNORE INTO application_members(project_id,user_id) VALUES(?,?)', [project.id, target]);
        db.run('UPDATE application_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE project_id=? AND user_id=?', [body.decision === 'approve' ? 'approved' : 'rejected', user.id, project.id, target]);
        notify(target, project.id, `你对「${project.title || project.name}」的维护申请已${body.decision === 'approve' ? '批准' : '拒绝'}`);
      })();
      return Response.json({ success: true });
    }
    if (match?.[2] === 'member' && ['POST', 'DELETE'].includes(method)) {
      if (!permissions.owner) return error('仅创建者可以管理成员及权限', 403);
      const target = body.username ? db.query("SELECT id FROM users WHERE username=? AND COALESCE(status,'active') <> 'disabled'").get(String(body.username).trim()) as any : { id: Number(body.user_id) };
      if (!Number.isSafeInteger(target?.id) || target.id <= 0 || target.id === user.id || !db.query('SELECT 1 FROM users WHERE id=?').get(target.id)) return error('用户不存在或不能修改创建者');
      db.transaction(() => {
        if (method === 'DELETE') {
          db.run('DELETE FROM application_members WHERE project_id=? AND user_id=?', [project.id, target.id]);
          db.run("UPDATE application_requests SET status='revoked' WHERE project_id=? AND user_id=?", [project.id, target.id]);
        } else {
          db.run('INSERT INTO application_members(project_id,user_id,edit_settings,review_requests) VALUES(?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET edit_settings=excluded.edit_settings,review_requests=excluded.review_requests', [project.id, target.id, body.edit_settings === true ? 1 : 0, body.review_requests === true ? 1 : 0]);
          db.run("UPDATE application_requests SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE project_id=? AND user_id=? AND status='pending'", [user.id, project.id, target.id]);
        }
        notify(target.id, project.id, method === 'DELETE' ? `你已被移出应用「${project.title || project.name}」` : `你在应用「${project.title || project.name}」的成员权限已更新`);
      })();
      return Response.json({ success: true });
    }
    return error('不支持的操作', 405);
  };
}
