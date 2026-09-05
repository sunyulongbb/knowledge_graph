(function () {
  const byId = (id) => document.getElementById(id);
  const nav = byId("btnViewUsers"), list = byId("userManagementList"), message = byId("userManagementMessage");
  const tabs = byId("systemManagementTabs"), searchInput = byId("systemManagementSearch"), createButton = byId("btnSystemManagementCreate");
  const roleDialog = byId("systemRoleDialog"), roleForm = byId("systemRoleForm");
  const validTabs = new Set(["users", "roles", "permissions", "login-logs", "operation-logs"]);
  let activeTab = (() => { try { const saved = localStorage.getItem("kbSystemManagementTab"); return validTabs.has(saved) ? saved : "users"; } catch { return "users"; } })();
  let authResolved = false, permissions = [], currentItems = [];
  const isAdmin = () => window.authUser?.role === "admin";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const api = async (url, options) => { const response = await fetch(url, { credentials: "include", ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "操作失败"); return data; };
  const updateEntry = () => { if (nav) nav.style.display = isAdmin() ? "" : "none"; if (authResolved && !isAdmin() && window.kbViewMode === "user_management") window.setViewMode?.("table", { replaceRoute: true }); };
  const permissionNames = {
    "user:view": "查看用户", "user:create": "新增用户", "user:update": "编辑用户", "user:delete": "删除用户",
    "role:view": "查看角色", "role:create": "新增角色", "role:update": "编辑角色与授权", "role:delete": "删除角色",
    "permission:view": "查看权限", "permission:update": "管理权限",
    "knowledge:view": "查看知识", "knowledge:create": "新增知识", "knowledge:update": "编辑知识", "knowledge:delete": "删除知识",
    "knowledge:audit": "审核知识", "knowledge:like": "点赞知识", "knowledge:comment": "评论知识", "knowledge:share": "分享知识", "knowledge:favorite": "收藏知识",
    "system:config": "系统配置", "system:log": "查看系统日志",
  };
  const permissionGroups = { user: "用户管理", role: "角色管理", permission: "权限管理", knowledge: "知识管理", system: "系统管理" };
  const permissionLabel = (permission) => permissionNames[permission.code] || (permission.name !== permission.code ? permission.name : permission.code);
  function groupPermissions(items) {
    return items.reduce((groups, permission) => {
      const module = permission.module || String(permission.code || "other").split(":")[0];
      (groups[module] ||= []).push(permission); return groups;
    }, {});
  }
  function permissionGroupMarkup(items, selected) {
    const groups = groupPermissions(items);
    const modules = [...Object.keys(permissionGroups), ...Object.keys(groups).filter((module) => !permissionGroups[module])];
    return modules.filter((module) => groups[module]?.length).map((module) => `<section class="permission-group"><header><strong>${permissionGroups[module] || "其他权限"}</strong><span>${groups[module].length} 项</span></header><div class="permission-group__items">${groups[module].map((p) => selected ? `<label><input type="checkbox" value="${esc(p.code)}" ${selected.has(p.code) ? "checked" : ""}/><span><b>${esc(permissionLabel(p))}</b><small>${esc(p.code)}</small></span></label>` : `<article class="permission-item"><i class="fa-solid fa-key" aria-hidden="true"></i><div><strong>${esc(permissionLabel(p))}</strong><small>${esc(p.code)}</small></div></article>`).join("")}</div></section>`).join("");
  }

  function renderUsers(items) {
    list.innerHTML = items.map((u) => `<article class="user-management-page__row" data-user-id="${u.id}"><div class="user-management-identity"><span class="user-management-avatar">${esc((u.nickname || u.username || "?").charAt(0))}</span><div><strong>${esc(u.nickname || u.username)}</strong><small>@${esc(u.username)} · ${esc(u.roles || "未分配角色")}</small></div></div><select data-role aria-label="账号角色"><option value="user" ${u.role !== "admin" ? "selected" : ""}>普通用户</option><option value="admin" ${u.role === "admin" ? "selected" : ""}>管理员</option></select><select data-status aria-label="账号状态"><option value="active" ${u.status !== "disabled" ? "selected" : ""}>正常</option><option value="disabled" ${u.status === "disabled" ? "selected" : ""}>已禁用</option></select><button class="btn sm primary" data-save-user type="button">保存</button></article>`).join("") || '<div class="user-management-empty muted">暂无用户</div>';
  }
  function renderRoles(items) {
    list.innerHTML = items.map((r) => `<article class="user-management-page__row user-management-role-row" data-role-id="${r.id}"><div><strong>${esc(r.name)}</strong><small>${esc(r.code)} · ${r.permission_count || 0} 项权限</small></div><span class="status-chip ${r.status === "disabled" ? "is-disabled" : ""}">${r.status === "disabled" ? "已停用" : "启用"}</span><span>${r.data_scope === "own" ? "本人数据" : "全部数据"} · ${r.user_count || 0} 人</span><button class="btn sm" data-edit-role type="button" ${r.code === "super_admin" ? "disabled title='系统角色不可修改'" : ""}><i class="fa-solid fa-pen"></i> 管理</button></article>`).join("") || '<div class="user-management-empty muted">暂无角色</div>';
  }
  function renderReadOnly(items) {
    list.innerHTML = items.map((item) => `<article class="user-management-page__row user-management-log-row"><div><strong>${esc(item.name || item.module || item.username || "系统记录")}</strong><small>${esc(item.code || item.action || item.failure_reason || item.path || "")}</small></div><span class="status-chip ${item.success === 0 ? "is-disabled" : ""}">${item.success === 0 ? "失败" : item.success === 1 ? "成功" : esc(item.module || "—")}</span><time>${esc(item.created_at || item.login_at || "")}</time></article>`).join("") || '<div class="user-management-empty muted">暂无记录</div>';
  }
  function renderPermissions(items) {
    list.innerHTML = `<div class="permission-groups">${permissionGroupMarkup(items, null)}</div>`;
  }
  async function loadCurrentTab() {
    if (!isAdmin() || !list) return;
    list.innerHTML = '<div class="user-management-empty muted">加载中…</div>';
    try {
      const endpoints = { users: "/api/system/users", roles: "/api/system/roles", permissions: "/api/system/permissions", "login-logs": "/api/system/login-logs", "operation-logs": "/api/system/operation-logs" };
      const url = new URL(endpoints[activeTab], location.origin);
      if (activeTab === "users" && searchInput?.value.trim()) url.searchParams.set("q", searchInput.value.trim());
      const data = await api(url); currentItems = data.items || [];
      if (activeTab === "permissions") permissions = currentItems;
      activeTab === "users" ? renderUsers(currentItems) : activeTab === "roles" ? renderRoles(currentItems) : activeTab === "permissions" ? renderPermissions(currentItems) : renderReadOnly(currentItems);
      message.textContent = `共 ${data.total ?? currentItems.length} 条记录`;
    } catch (error) { list.innerHTML = `<div class="user-management-empty muted">${esc(error.message || "加载失败")}</div>`; }
  }
  async function ensurePermissions() { if (!permissions.length) permissions = (await api("/api/system/permissions")).items || []; }
  async function openRoleDialog(role) {
    await ensurePermissions(); const selected = new Set(String(role?.permission_codes || "").split(",").filter(Boolean));
    byId("systemRoleDialogTitle").textContent = role ? "管理角色" : "新增角色"; byId("systemRoleId").value = role?.id || "";
    byId("systemRoleCode").value = role?.code || ""; byId("systemRoleCode").disabled = Boolean(role); byId("systemRoleName").value = role?.name || "";
    byId("systemRoleStatus").value = role?.status || "active"; byId("systemRoleScope").value = role?.data_scope || "all";
    byId("systemRolePermissions").innerHTML = permissionGroupMarkup(permissions, selected);
    byId("systemRoleDialogMessage").textContent = ""; roleDialog.showModal();
  }
  async function saveRole() {
    const id = byId("systemRoleId").value, payload = { code: byId("systemRoleCode").value.trim(), name: byId("systemRoleName").value.trim(), status: byId("systemRoleStatus").value, dataScope: byId("systemRoleScope").value };
    if (!payload.code || !payload.name) throw new Error("角色编码和名称不能为空");
    const opts = { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    const result = id ? await api(`/api/system/roles/${id}`, { method: "PATCH", ...opts }) : await api("/api/system/roles", { method: "POST", ...opts });
    const roleId = id || result.id, selected = [...byId("systemRolePermissions").querySelectorAll("input:checked")].map((input) => input.value);
    await api(`/api/system/roles/${roleId}/permissions`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: selected }) });
  }

  function syncActiveTabControls() {
    tabs?.querySelectorAll("[data-system-tab]").forEach((item) => {
      const active = item.dataset.systemTab === activeTab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    const searchable = activeTab === "users";
    if (searchInput) {
      searchInput.disabled = !searchable;
      searchInput.placeholder = searchable ? "搜索用户名、昵称或邮箱…" : "当前分类无需检索";
    }
    if (createButton) createButton.style.display = activeTab === "roles" ? "inline-flex" : "none";
  }

  byId("btnUserManagementRefresh")?.addEventListener("click", loadCurrentTab);
  tabs?.addEventListener("click", (event) => { const button = event.target.closest("[data-system-tab]"); if (!button || !validTabs.has(button.dataset.systemTab)) return; activeTab = button.dataset.systemTab; try { localStorage.setItem("kbSystemManagementTab", activeTab); } catch {} syncActiveTabControls(); loadCurrentTab(); });
  byId("btnSystemManagementSearch")?.addEventListener("click", loadCurrentTab); byId("btnSystemManagementReset")?.addEventListener("click", () => { searchInput.value = ""; loadCurrentTab(); });
  searchInput?.addEventListener("keydown", (event) => { if (event.key === "Enter") loadCurrentTab(); }); createButton?.addEventListener("click", () => openRoleDialog(null).catch((e) => { message.textContent = e.message; }));
  list?.addEventListener("click", async (event) => { const edit = event.target.closest("[data-edit-role]"); if (edit) return openRoleDialog(currentItems.find((item) => String(item.id) === edit.closest("[data-role-id]").dataset.roleId)); const save = event.target.closest("[data-save-user]"); if (!save) return; const row = save.closest("[data-user-id]"); try { save.disabled = true; await api(`/api/auth/users/${row.dataset.userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: row.querySelector("[data-role]").value, status: row.querySelector("[data-status]").value }) }); message.textContent = "用户权限已保存"; await loadCurrentTab(); } catch (e) { message.textContent = e.message; } finally { save.disabled = false; } });
  roleForm?.addEventListener("submit", async (event) => { if (event.submitter?.value === "cancel") return; event.preventDefault(); const save = byId("btnSystemRoleSave"); try { save.disabled = true; await saveRole(); roleDialog.close(); message.textContent = "角色配置已保存"; await loadCurrentTab(); } catch (e) { byId("systemRoleDialogMessage").textContent = e.message; } finally { save.disabled = false; } });
  window.addEventListener("kb-auth-change", () => { authResolved = true; updateEntry(); if (isAdmin() && window.kbViewMode === "user_management") loadCurrentTab(); });
  window.loadUserManagement = () => { syncActiveTabControls(); return loadCurrentTab(); };
  syncActiveTabControls(); updateEntry();
})();
