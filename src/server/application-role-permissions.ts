import type { Database } from 'bun:sqlite';

export const applicationPermissionNames = {
  'application:create': '创建应用',
  'application:update': '编辑应用',
  'application:delete': '删除应用',
  'application:members': '管理应用成员',
  'application:review': '审批维护申请',
};

export function hasApplicationPermission(user: any, permission: string) {
  return !!user && user.status !== 'disabled' && (user.role === 'admin' || user.permissions?.includes('*') || user.permissions?.includes(permission));
}

export function ensureApplicationRolePermissions(db: Database) {
  db.transaction(() => {
    for (const [code, name] of Object.entries(applicationPermissionNames)) {
      const result = db.run("INSERT OR IGNORE INTO permissions(code,name,module) VALUES(?,?,'application')", [code, name]);
      // Preserve existing ownership workflows on first migration only. Revoked grants stay revoked.
      if (result.changes) {
        db.run("INSERT OR IGNORE INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code IN ('user','super_admin') AND p.code=?", [code]);
      }
    }
  })();
}
