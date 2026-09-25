import type { Database } from 'bun:sqlite';
import type { KnowledgeUser } from './knowledge-access.ts';
import { hasApplicationPermission } from './application-role-permissions.ts';
import { cloneApplicationData, removeClonedApplicationFiles } from './application-clone.ts';
import { importOntologies } from './ontology-import.ts';

export function ensureApplicationSchema(db: Database) {
  const columns = db.query('PRAGMA table_info(projects)').all() as any[];
  if (!columns.some((column) => column.name === 'owner_user_id')) db.run('ALTER TABLE projects ADD COLUMN owner_user_id INTEGER');
  if (!columns.some((column) => column.name === 'is_default')) db.run('ALTER TABLE projects ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
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

export function ensureDefaultApplication(db: Database) {
  const existing = db.query("SELECT * FROM projects WHERE name='default' LIMIT 1").get() as any;
  if (existing) {
    if (Number(existing.is_default) !== 1) {
      db.run("UPDATE projects SET is_default=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", [existing.id]);
      return db.query('SELECT * FROM projects WHERE id=?').get(existing.id) as any;
    }
    return null;
  }
  db.run(`INSERT INTO projects
    (name,title,description,file,image,theme_color,tags,link,is_default)
    VALUES ('default','默认应用','系统首次初始化创建的默认应用','app.sqlite','','#ff7a2b','[]','',1)`);
  return db.query("SELECT * FROM projects WHERE name='default'").get() as any;
}

export function applicationPermissions(db: Database, user: KnowledgeUser | null, project: any) {
  const owner = !!user && user.id > 0 && Number(project?.owner_user_id) === user.id;
  const member = user && project ? db.query('SELECT * FROM application_members WHERE project_id=? AND user_id=?').get(project.id, user.id) as any : null;
  const defaultAccess = Number(project?.is_default) === 1;
  return {
    owner,
    member: owner || defaultAccess || !!member,
    editSettings: owner || defaultAccess || !!member?.edit_settings,
    reviewRequests: owner || defaultAccess || !!member?.review_requests,
  };
}

export function createApplicationHandler(db: Database, getUser: (req: Request) => KnowledgeUser | null, cloneOptions: { uploadsRoot?: string } = {}) {
  const error = (message: string, status = 400) => Response.json({ error: message, message, success: false }, { status });
  const projectBy = (key: unknown, byId = false) => byId
    ? db.query('SELECT * FROM projects WHERE id=?').get(Number(key) || -1) as any
    : db.query('SELECT * FROM projects WHERE name=?').get(String(key || '').replace(/\.sqlite$/, '')) as any;
  const notify = (userId: number, projectId: number, message: string) => db.run('INSERT INTO user_notifications(user_id,project_id,message) VALUES(?,?,?)', [userId, projectId, message]);
  const record = (project: any, user: KnowledgeUser | null) => {
    const access = applicationPermissions(db, user, project);
    const defaultAccess = Number(project?.is_default) === 1;
    return { ...project, slug: project.name, name: project.title || project.name, ...access,
      editSettings: access.editSettings && (access.owner || defaultAccess || hasApplicationPermission(user, 'application:update')),
      deleteApplication: access.owner,
      manageMembers: access.owner,
      reviewRequests: access.reviewRequests && (access.owner || defaultAccess || hasApplicationPermission(user, 'application:review')),
    };
  };
  const hasTable = (name: string) => !!db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const parseList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    if (typeof value !== 'string' || !value.trim()) return [];
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parseList(parsed); } catch {}
    return value.split(/[,，;；、\n]+/).map((item) => item.trim()).filter(Boolean);
  };
  const parseAliasStorage = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseAliasStorage(parsed);
    } catch {}
    return value.split(/[,，;；、\n]+/).map((item) => item.trim()).filter(Boolean);
  };
  const countByProject = (table: string, projectId: number, extra = '') => {
    if (!hasTable(table)) return 0;
    return Number((db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE project_id=?${extra}`).get(projectId) as any)?.count || 0);
  };
  const applicationDetails = (project: any, user: KnowledgeUser | null) => {
    const projectId = Number(project.id);
    const projectRecord = record(project, user);
    const canSeePrivate = projectRecord.member === true;
    const visibilitySql = canSeePrivate ? '' : " AND (n.visibility IS NULL OR n.visibility <> 'private')";
    const ontologyEntityCount = hasTable('nodes')
      ? `(SELECT COUNT(*) FROM nodes n WHERE n.project_id=o.project_id AND (n.type=o.id OR lower(n.type)=lower(o.name))${visibilitySql})`
      : '0';
    const ontologies = hasTable('ontologies') ? db.query(`
      SELECT o.id,o.name,o.description,o.parent_id,o.color,o.sort_order,
        ${ontologyEntityCount} AS entity_count
      FROM ontologies o WHERE o.project_id=? ORDER BY COALESCE(o.sort_order,999999),o.name
    `).all(projectId) as any[] : [];
    const categoryEntityCount = hasTable('entity_classes') && hasTable('nodes')
      ? `(SELECT COUNT(*) FROM entity_classes ec JOIN nodes n ON n.id=ec.entity_id WHERE ec.class_id=c.id AND n.project_id=?${visibilitySql})`
      : '0';
    const categories = hasTable('classes') ? db.query(`
      SELECT c.id,c.name,c.description,c.parent_id,c.color,c.image,c.tags,c.sort_order,
        ${categoryEntityCount} AS entity_count
      FROM classes c WHERE c.project_id=? ORDER BY COALESCE(c.sort_order,999999),c.name
    `).all(...(categoryEntityCount === '0' ? [projectId] : [projectId, projectId])) as any[] : [];
    const nodes = hasTable('nodes') ? db.query(`SELECT id,tags,images,videos,visibility FROM nodes n WHERE project_id=?${visibilitySql}`).all(projectId) as any[] : [];
    const tagCounts = new Map<string, { name: string; count: number }>();
    const addTags = (raw: unknown, increment: number) => parseList(raw).forEach((name) => {
      const key = name.toLocaleLowerCase();
      const current = tagCounts.get(key) || { name, count: 0 };
      current.count += increment;
      tagCounts.set(key, current);
    });
    addTags(project.tags, 0);
    categories.forEach((item) => addTags(item.tags, 0));
    nodes.forEach((item) => addTags(item.tags, 1));
    const mediaCount = nodes.reduce((sum, node) => sum + parseList(node.images).length + parseList(node.videos).length, 0);
    const attributeCount = hasTable('attributes') && hasTable('nodes')
      ? Number((db.query(`SELECT COUNT(*) AS count FROM attributes a JOIN nodes n ON n.id=a.node_id WHERE n.project_id=?${visibilitySql}`).get(projectId) as any)?.count || 0)
      : 0;
    return {
      project: projectRecord,
      ontologies,
      categories: categories.map((item) => ({ ...item, tags: parseList(item.tags) })),
      tags: Array.from(tagCounts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')),
      statistics: {
        knowledge: nodes.length,
        publicKnowledge: nodes.filter((node) => node.visibility !== 'private').length,
        privateKnowledge: canSeePrivate ? nodes.filter((node) => node.visibility === 'private').length : 0,
        ontologies: ontologies.length,
        categories: categories.length,
        properties: countByProject('properties', projectId),
        attributes: attributeCount,
        media: mediaCount,
        tags: tagCounts.size,
      },
    };
  };
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
      return Response.json({ projects, canCreate: hasApplicationPermission(user, 'application:create') });
    }
    // Existing switchers use this GET. It now only resolves an existing app.
    if (path === '/api/kb/create_project' && method === 'GET') {
      const project = projectBy(url.searchParams.get('name'));
      return project ? Response.json({ success: true, project: record(project, user) }) : error('应用不存在，请登录后创建', 404);
    }
    if ((path === '/api/applications' || path === '/api/kb/create_project') && method === 'POST') {
      if (!user) return error('请先登录', 401);
      if (!hasApplicationPermission(user, 'application:create')) return error('未获授权创建应用，请联系管理员配置角色权限', 403);
      const name = String(body.name || '').trim();
      const title = String(body.title || name).trim();
      const description = String(body.description || '').trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || /^\d+$/.test(name) || ['app', 'shared'].includes(name.toLowerCase())) return error('应用短名须为 1–64 位字母、数字、下划线或短横线，不能为纯数字、app 或 shared');
      if (!title || title.length > 100 || description.length > 2000) return error('名称最多 100 字，描述最多 2000 字');
      if (projectBy(name)) return error('应用短名已存在', 409);
      db.run("INSERT INTO projects(name,title,description,file,image,theme_color,tags,link,owner_user_id) VALUES(?,?,?,'app.sqlite',?,'#ff7a2b','[]',?,?)", [name, title, description, String(body.image || ''), String(body.link || ''), user.id]);
      return Response.json({ success: true, project: record(projectBy(name), user) }, { status: 201 });
    }
    const match = path.match(/^\/api\/applications\/([^/]+)(?:\/(details|access|request|review|member|clone|copy-ontology))?$/);
    const projectKey = legacy ? String(body.name || '') : match ? decodeURIComponent(match[1]!) : '';
    const project = legacy
      ? projectBy(projectKey)
      : /^\d+$/.test(projectKey)
        ? projectBy(projectKey, true)
        : projectBy(projectKey);
    if (!project) return error('应用不存在', 404);
    const permissions = record(project, user);
    if (match?.[2] === 'clone' && method === 'POST') {
      if (!user) return error('请先登录', 401);
      if (!permissions.member) return error('无权读取并克隆此应用', 403);
      if (!hasApplicationPermission(user, 'application:create')) return error('未获授权创建应用', 403);
      const name = String(body.name || '').trim();
      const title = String(body.title || `${project.title || project.name} 副本`).trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || /^\d+$/.test(name) || ['app', 'shared', 'default'].includes(name.toLowerCase())) return error('新应用短名须为 1–64 位字母、数字、下划线或短横线，且不能使用保留名称');
      if (!title || title.length > 100) return error('应用名称不能为空且最多 100 字');
      if (projectBy(name)) return error('应用短名已存在', 409);
      let cloned: any = null;
      let clonedProjectId = 0;
      try {
        cloned = db.transaction(() => {
          db.run("INSERT INTO projects(name,title,description,file,image,theme_color,tags,link,owner_user_id) VALUES(?,?,?,'app.sqlite',?,?,?,?,?)", [name, title, String(project.description || ''), String(project.image || ''), String(project.theme_color || '#ff7a2b'), String(project.tags || '[]'), String(project.link || ''), user.id]);
          const target = projectBy(name);
          clonedProjectId = Number(target.id);
          cloneApplicationData(db, project, target, cloneOptions);
          const clonedImage = String(project.image || '').replaceAll(`/uploads/${project.id}/`, `/uploads/${target.id}/`);
          db.run('UPDATE projects SET image=? WHERE id=?', [clonedImage, target.id]);
          return target;
        })();
        return Response.json({ success: true, project: record(cloned, user) }, { status: 201 });
      } catch (cause) {
        if (clonedProjectId) removeClonedApplicationFiles(clonedProjectId, cloneOptions);
        console.error('clone application failed', cause);
        return error(`克隆应用失败：${cause instanceof Error ? cause.message : String(cause)}`, 500);
      }
    }
    if (match?.[2] === 'copy-ontology' && method === 'POST') {
      if (!user) return error('请先登录', 401);
      if (!permissions.member) return error('无权读取此应用的本体结构', 403);
      const targetName = String(body.name || body.slug || body.target || '').trim();
      if (!targetName) return error('未提供目标应用短名', 400);
      const targetProject = /^(\d+)$/.test(targetName) ? projectBy(Number(targetName), true) : projectBy(targetName);
      if (!targetProject) return error('目标应用不存在', 404);
      if (Number(targetProject.id) === Number(project.id)) return error('无法将本体复制到当前应用', 409);
      const targetPermissions = record(targetProject, user);
      if (!targetPermissions.member) return error('无权覆盖目标应用的本体结构', 403);
      if (!hasTable('ontologies')) return Response.json({ success: true, copied: 0, target: targetPermissions });

      const ontologyRows = db.query('SELECT * FROM ontologies WHERE project_id=? ORDER BY COALESCE(sort_order, 999999), name').all(project.id) as any[];
      const propertyRows = hasTable('properties') ? db.query('SELECT * FROM properties WHERE project_id=?').all(project.id) as any[] : [];
      const relationRows = hasTable('ontology_properties')
        ? db.query('SELECT op.ontology_id, op.property_id FROM ontology_properties op INNER JOIN ontologies o ON o.id = op.ontology_id WHERE o.project_id=?').all(project.id) as any[]
        : [];
      const propertyById = new Map(propertyRows.map((row) => [String(row.id), row]));
      const propertyByOntology = new Map<string, any[]>();
      for (const row of relationRows) {
        const ontologyId = String(row.ontology_id || '').trim();
        if (!ontologyId) continue;
        const property = propertyById.get(String(row.property_id || ''));
        if (!property) continue;
        const list = propertyByOntology.get(ontologyId) || [];
        list.push(property);
        propertyByOntology.set(ontologyId, list);
      }
      const parsePropertyTypes = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
        if (typeof value !== 'string' || !value.trim()) return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsePropertyTypes(parsed) : [];
        } catch {
          return value.split(/[,，;；、\n]+/).map((item) => item.trim()).filter(Boolean);
        }
      };
      const buildOntologyExport = (row: any): any => {
        const children = ontologyRows.filter((child) => String(child.parent_id || '') === String(row.id)).map((child) => buildOntologyExport(child));
        const properties = (propertyByOntology.get(String(row.id)) || []).map((property) => ({
          name: String(property.name || '').trim(),
          alias: parseAliasStorage(property.alias),
          datatype: String(property.datatype || 'string').trim() || 'string',
          description: String(property.description || '').trim(),
          types: parsePropertyTypes(property.types),
          tail_ontology_id: String(property.tail_ontology_id || '').trim(),
        }));
        return {
          name: String(row.name || '').trim(),
          description: String(row.description || '').trim(),
          alias: parseAliasStorage(row.alias),
          color: row.color ? String(row.color).trim() : null,
          display_shape: ['rectangle', 'rounded', 'circle', 'diamond', 'hexagon'].includes(String(row.display_shape || 'rectangle').trim()) ? String(row.display_shape || 'rectangle').trim() : 'rectangle',
          properties,
          children,
        };
      };
      const roots = ontologyRows.filter((row) => !row.parent_id).map((row) => buildOntologyExport(row));
      if (!roots.length) return Response.json({ success: true, copied: 0, target: targetPermissions });
      const copied = importOntologies(db, { version: 1, ontologies: roots }, Number(targetProject.id));
      return Response.json({ success: true, copied: Number(copied.created || 0) + Number(copied.updated || 0), target: targetPermissions });
    }
    if (match?.[2] === 'details' && method === 'GET') {
      return Response.json(applicationDetails(project, user));
    }
    if (match?.[2] === 'access' && method === 'GET') {
      return Response.json({ project: record(project, user), members: permissions.owner ? db.query('SELECT m.*,u.username,u.display_name FROM application_members m JOIN users u ON u.id=m.user_id WHERE project_id=? ORDER BY m.created_at').all(project.id) : [], requests: permissions.reviewRequests ? db.query("SELECT r.*,u.username,u.display_name FROM application_requests r JOIN users u ON u.id=r.user_id WHERE project_id=? AND r.status='pending' ORDER BY r.created_at").all(project.id) : [], ownRequest: user ? db.query('SELECT status FROM application_requests WHERE project_id=? AND user_id=?').get(project.id, user.id) : null });
    }
    if (!user) return error('请先登录', 401);
    if (path === '/api/kb/delete_project') return permissions.deleteApplication ? null : error('仅拥有删除权限的创建者可以删除应用', 403);
    if (path === '/api/kb/update_project' && method === 'POST') {
      if (!permissions.editSettings) return error('无权修改应用设置', 403);
      const title = String(body.title || '').trim();
      if (!title || title.length > 100 || String(body.description || '').length > 2000) return error('名称不能为空且最多 100 字，描述最多 2000 字');
      return null;
    }
    if (match?.[2] === 'request' && method === 'POST') {
      if (permissions.member) return error('你已拥有应用维护权限', 409);
      if (!project.owner_user_id && !hasApplicationPermission(user, 'application:create')) return error('认领历史应用需要创建应用权限', 403);
      const message = String(body.message || '').trim();
      if (message.length > 1000) return error('申请说明最多 1000 字');
      const outcome = db.transaction(() => {
        const claimed = db.run(
          'UPDATE projects SET owner_user_id=? WHERE id=? AND owner_user_id IS NULL',
          [user.id, project.id],
        );
        if (claimed.changes > 0) {
          db.run('DELETE FROM application_requests WHERE project_id=? AND user_id=?', [project.id, user.id]);
          return 'claimed';
        }
        const current = projectBy(project.id, true);
        const previous = db.query('SELECT status FROM application_requests WHERE project_id=? AND user_id=?').get(project.id, user.id) as any;
        if (previous?.status === 'pending') return 'pending';
        db.run("INSERT INTO application_requests(project_id,user_id,message) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET message=excluded.message,status='pending',reviewed_by=NULL,reviewed_at=NULL,created_at=CURRENT_TIMESTAMP", [project.id, user.id, message]);
        const reviewers = db.query('SELECT user_id FROM application_members WHERE project_id=? AND review_requests=1').all(project.id) as any[];
        for (const id of new Set([current.owner_user_id, ...reviewers.map((item) => item.user_id)])) {
          if (Number.isSafeInteger(Number(id)) && Number(id) > 0) notify(Number(id), project.id, `${user.username} 申请维护应用「${project.title || project.name}」`);
        }
        return 'requested';
      })();
      if (outcome === 'pending') return error('申请已提交，请等待审批', 409);
      return Response.json({ success: true, claimedOwnership: outcome === 'claimed' });
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
      if (!permissions.manageMembers) return error('仅拥有成员管理权限的创建者可以管理成员及权限', 403);
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
