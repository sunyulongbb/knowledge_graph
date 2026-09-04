(function () {
  const panel = document.getElementById("userManagementPanel");
  const nav = document.getElementById("btnViewUsers");
  const list = document.getElementById("userManagementList");
  const message = document.getElementById("userManagementMessage");
  const refresh = document.getElementById("btnUserManagementRefresh");
  const tabs = document.getElementById("systemManagementTabs");
  const searchInput = document.getElementById("systemManagementSearch");
  const searchButton = document.getElementById("btnSystemManagementSearch");
  const resetButton = document.getElementById("btnSystemManagementReset");
  let activeTab = "users";
  const isAdmin = () => window.authUser?.role === "admin";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
  function updateEntry() {
    if (nav) nav.style.display = isAdmin() ? "" : "none";
    if (!isAdmin() && window.kbViewMode === "user_management") window.setViewMode?.("table", { replaceRoute: true });
  }
  async function loadUsers() {
    if (!isAdmin() || !list) return;
    list.innerHTML = '<div class="muted">加载用户中…</div>';
    try {
      const endpoints = { users: "/api/system/users", roles: "/api/system/roles", permissions: "/api/system/permissions", "login-logs": "/api/system/login-logs", "operation-logs": "/api/system/operation-logs" };
      const requestUrl = new URL(endpoints[activeTab], window.location.origin);
      if (activeTab === "users" && searchInput?.value.trim()) requestUrl.searchParams.set("q", searchInput.value.trim());
      const response = await fetch(requestUrl, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载失败");
      const items = data.items || [];
      if (activeTab === "users") list.innerHTML = items.map((user) => `<div class="user-management-page__row"><div><strong>${escapeHtml(user.nickname || user.username)}</strong><small>@${escapeHtml(user.username)} · ${escapeHtml(user.roles || "未分配角色")}</small></div><span>${user.status === "disabled" ? "已禁用" : "正常"}</span><span>${escapeHtml(user.last_login_at || "从未登录")}</span></div>`).join("") || '<div class="muted">暂无用户</div>';
      else if (activeTab === "roles") list.innerHTML = items.map((role) => `<div class="user-management-page__row"><div><strong>${escapeHtml(role.name)}</strong><small>${escapeHtml(role.code)} · 数据范围：${role.data_scope === "own" ? "本人数据" : "全部数据"}</small></div><span>${role.status === "disabled" ? "已禁用" : "正常"}</span><span>${role.user_count || 0} 位用户</span></div>`).join("") || '<div class="muted">暂无角色</div>';
      else list.innerHTML = items.map((item) => `<div class="user-management-page__row"><div><strong>${escapeHtml(item.name || item.module || item.username || "系统日志")}</strong><small>${escapeHtml(item.code || item.action || item.failure_reason || "")}</small></div><span>${escapeHtml(item.created_at || item.login_at || "")}</span></div>`).join("") || '<div class="muted">暂无记录</div>';
      if (message) message.textContent = `共 ${data.total ?? items.length} 条记录`;
    } catch (error) { list.innerHTML = `<div class="muted">${escapeHtml(error.message || "加载失败")}</div>`; }
  }
  refresh?.addEventListener("click", loadUsers);
  tabs?.addEventListener("click", (event) => { const button = event.target.closest("[data-system-tab]"); if (!button) return; activeTab = button.dataset.systemTab; tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); if (searchInput) searchInput.placeholder = activeTab === "users" ? "搜索用户名、昵称或邮箱…" : "当前页面暂不支持检索"; loadUsers(); });
  searchButton?.addEventListener("click", loadUsers);
  resetButton?.addEventListener("click", () => { if (searchInput) searchInput.value = ""; loadUsers(); });
  searchInput?.addEventListener("keydown", (event) => { if (event.key === "Enter") loadUsers(); });
  list?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-save]"); if (!button) return;
    const row = button.closest("[data-user-id]");
    try {
      button.disabled = true;
      const response = await fetch(`/api/auth/users/${row.dataset.userId}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: row.querySelector("[data-role]").value, status: row.querySelector("[data-status]").value }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "保存失败");
      if (message) message.textContent = "用户权限已保存";
      await loadUsers();
    } catch (error) { if (message) message.textContent = error.message || "保存失败"; } finally { button.disabled = false; }
  });
  window.addEventListener("kb-auth-change", updateEntry);
  window.loadUserManagement = loadUsers;
  updateEntry();
})();
