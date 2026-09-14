(function () {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sections = { applications: '关联应用', knowledge: '关联知识', likes: '点赞历史', favorites: '收藏历史', comments: '评论历史' };
  const modules = { user: '用户', role: '角色', permission: '权限', application: '应用', knowledge: '知识', system: '系统' };
  const actions = { view: '查看', create: '创建', update: '编辑', delete: '删除', audit: '审核', like: '点赞', comment: '评论', share: '分享', favorite: '收藏', config: '配置', log: '日志', members: '管理成员', review: '审批申请' };
  let summaryVersion = 0, listVersion = 0, currentSection = 'applications', page = 1, totalPages = 1, counts = {}, busy = false;
  const date = (value) => value ? escape(String(value).replace('T', ' ').slice(0, 19)) : '暂无记录';
  async function api(section, pageNumber = 1) {
    const url = new URL('/api/account/profile', location.origin);
    url.searchParams.set('section', section); url.searchParams.set('page', pageNumber);
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || '加载失败'); error.status = response.status; throw error; }
    return data;
  }
  function avatar(user) {
    const value = String(user.avatar || '').trim();
    if (value) {
      try {
        const url = new URL(value, location.origin);
        if (/^(https?:\/\/|\/)/i.test(value) && ['http:', 'https:'].includes(url.protocol)) return `<img src="${escape(url.href)}" alt="" />`;
      } catch {}
      if (!/[<>]/.test(value) && Array.from(value).length <= 8) return escape(value);
    }
    return escape(Array.from(user.displayName || user.username || '?').slice(0, 2).join(''));
  }
  function permissionName(permission) {
    if (permission.name && permission.name !== permission.code) return permission.name;
    const [module, action] = permission.code.split(':');
    return `${actions[action] || action || ''}${modules[module] || module || ''}`;
  }
  function renderSummary(data) {
    const user = data.user;
    const groups = new Map();
    data.permissions.forEach((permission) => { const key = permission.module || 'other'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(permission); });
    const fields = [['用户名', user.username], ['邮箱', user.email || '未填写'], ['手机号', user.phone || '未填写'], ['账号状态', user.status === 'active' ? '正常' : user.status], ['注册时间', user.createdAt || '暂无记录'], ['最近登录', user.lastLoginAt || '暂无记录']];
    byId('accountSummary').innerHTML = `<div class="account-identity"><div class="account-avatar">${avatar(user)}</div><div><h2>${escape(user.displayName)}</h2><p class="muted">@${escape(user.username)} · ${user.role === 'admin' ? '管理员' : '普通用户'}</p></div></div>
      <div class="account-statistics">${Object.entries(sections).map(([key, label]) => `<button type="button" class="account-stat" data-profile-section="${key}"><strong>${Number(data.counts[key] || 0)}</strong><span>${label}</span></button>`).join('')}</div>
      <div class="account-info-grid"><section class="account-info-card"><h3>基本信息</h3><dl>${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>
      <section class="account-info-card"><h3>权限信息</h3><div class="account-role-list">${data.roles.map((role) => `<span class="knowledge-role" title="${escape(role.code)}">${escape(role.name || role.code)}</span>`).join('') || '<span class="muted">未分配角色</span>'}</div><p class="muted">数据范围：${user.dataScope === 'all' ? '全部数据' : '本人数据'}${data.unrestricted ? ' · 管理员功能权限' : ''}</p><p class="muted">应用操作和知识编辑仍受创建者及维护授权限制。</p><details class="account-permissions"><summary>功能权限（${data.permissions.length} 项）</summary>${[...groups].map(([key, permissions]) => `<div class="account-permission-group"><h4>${escape(modules[key] || key)}</h4><div>${permissions.map((permission) => `<span title="${escape(permission.code)}">${escape(permissionName(permission))}</span>`).join('')}</div></div>`).join('') || '<p class="muted">暂无功能权限</p>'}</details></section></div>`;
  }
  function renderTabs() {
    byId('accountTabs').innerHTML = Object.entries(sections).map(([key, label]) => `<button id="accountTab-${key}" type="button" role="tab" aria-controls="accountActivity" aria-selected="${key === currentSection}" tabindex="${key === currentSection ? 0 : -1}" class="${key === currentSection ? 'active' : ''}" data-profile-section="${key}">${label} <span>${Number(counts[key] || 0)}</span></button>`).join('');
    byId('accountActivity').setAttribute('aria-labelledby', `accountTab-${currentSection}`);
    byId('accountRecordHint').textContent = currentSection === 'applications' || currentSection === 'knowledge' ? '本人创建或参与维护的内容。' : currentSection === 'comments' ? '展示保留的评论记录；无权访问的知识内容不会显示。' : '展示当前保留的点赞或收藏记录，已取消的记录不在此列。';
  }
  function syncPagination() {
    byId('btnProfilePrevious').disabled = busy || page <= 1;
    byId('btnProfileNext').disabled = busy || page >= totalPages;
  }
  function writeRoute() {
    if (window.kbViewMode !== 'profile') return;
    const url = new URL(location.href); url.searchParams.set('profileTab', currentSection); url.searchParams.set('profilePage', page);
    history.replaceState(history.state, '', url);
  }
  async function loadRecords() {
    const token = ++listVersion, section = currentSection;
    busy = true; syncPagination(); renderTabs();
    byId('accountActivity').innerHTML = '<div class="account-empty muted">正在加载记录…</div>';
    byId('accountPageInfo').textContent = '';
    try {
      const data = await api(section, page);
      if (token !== listVersion) return;
      page = data.page; totalPages = Math.max(1, Math.ceil(data.total / data.pageSize)); counts[section] = data.total;
      byId('accountActivity').innerHTML = data.items.map((item) => {
        if (section === 'applications') return `<article class="account-record"><div><strong>${escape(item.title || item.slug)}</strong><p class="muted">${escape(item.description || '暂无描述')}</p><small>${item.relationship === 'owner' ? '我创建的' : '参与维护'} · ${escape(item.slug)}</small></div><button class="btn sm" type="button" data-profile-app="${Number(item.id)}">查看应用</button></article>`;
        const available = item.id !== null && item.id !== undefined;
        return `<article class="account-record"><div><strong>${available ? escape(item.name || item.id) : '知识已删除或无权访问'}</strong>${section === 'comments' && available ? `<p class="account-comment">${escape(item.content)}</p>` : ''}<small>${section === 'knowledge' ? `${item.relationship === 'owner' ? '我创建的' : '参与维护'} · ${item.visibility === 'private' ? '私有' : '公开'} · ` : ''}${available ? `${escape(item.project_title || item.project_slug || '未归属应用')} · ` : ''}${date(item.created_at || item.updated_at)}</small></div>${available ? `<button type="button" class="btn sm" data-profile-node="${escape(item.id)}" data-project-slug="${escape(item.project_slug || '')}">查看知识</button>` : ''}</article>`;
      }).join('') || `<div class="account-empty muted">暂无${sections[section]}</div>`;
      byId('accountPageInfo').textContent = `共 ${data.total} 条 · 第 ${page} / ${totalPages} 页`;
      renderTabs(); writeRoute();
    } catch (error) {
      if (token !== listVersion) return;
      byId('accountActivity').innerHTML = `<div class="account-empty"><p>${escape(error.message)}</p><button type="button" class="btn" data-profile-retry>重试</button></div>`;
    } finally { if (token === listVersion) { busy = false; syncPagination(); } }
  }
  async function loadUserProfile() {
    const token = ++summaryVersion; listVersion++;
    byId('accountRecords').hidden = true; byId('btnProfileEdit').disabled = true;
    byId('accountSummary').innerHTML = '<div class="account-empty muted">正在加载个人详情…</div>';
    try {
      const data = await api('summary');
      if (token !== summaryVersion) return;
      const params = new URLSearchParams(location.search);
      currentSection = Object.hasOwn(sections, params.get('profileTab')) ? params.get('profileTab') : 'applications';
      page = Math.max(1, Number(params.get('profilePage')) || 1); if (!Number.isSafeInteger(page)) page = 1;
      counts = data.counts; renderSummary(data); byId('btnProfileEdit').disabled = false; byId('accountRecords').hidden = false;
      await loadRecords();
    } catch (error) {
      if (token !== summaryVersion) return;
      byId('accountSummary').innerHTML = `<div class="account-empty"><p>${escape(error.message)}</p><button type="button" class="btn primary" ${error.status === 401 ? 'data-profile-login' : 'data-profile-refresh'}>${error.status === 401 ? '登录' : '重试'}</button></div>`;
    }
  }
  byId('btnProfileEdit').addEventListener('click', () => window.openProfileModal?.());
  byId('btnProfilePrevious').addEventListener('click', () => { if (!busy && page > 1) { page--; loadRecords(); } });
  byId('btnProfileNext').addEventListener('click', () => { if (!busy && page < totalPages) { page++; loadRecords(); } });
  byId('userProfilePanel').addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.profileSection) { currentSection = button.dataset.profileSection; page = 1; writeRoute(); loadRecords(); return; }
    if (button.hasAttribute('data-profile-login')) { window.openAuthModal?.(false); return; }
    if (button.hasAttribute('data-profile-refresh')) { loadUserProfile(); return; }
    if (button.hasAttribute('data-profile-retry')) { loadRecords(); return; }
    if (button.dataset.profileApp) { window.openApplicationDetails?.(button.dataset.profileApp); return; }
    if (button.dataset.profileNode) {
      const url = new URL(location.href); url.searchParams.set('db', button.dataset.projectSlug || 'app'); url.searchParams.delete('node'); url.searchParams.delete('view');
      url.hash = new URLSearchParams({ view: 'detail', node: button.dataset.profileNode }).toString(); location.href = url;
    }
  });
  byId('accountTabs').addEventListener('keydown', (event) => {
    const keys = Object.keys(sections), index = keys.indexOf(currentSection);
    const next = event.key === 'ArrowRight' ? keys[(index + 1) % keys.length] : event.key === 'ArrowLeft' ? keys[(index + keys.length - 1) % keys.length] : event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1) : null;
    if (!next) return; event.preventDefault(); currentSection = next; page = 1; writeRoute(); loadRecords(); byId(`accountTab-${next}`)?.focus();
  });
  byId('accountSummary').addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement) event.target.remove(); }, true);
  window.addEventListener('kb-auth-change', () => {
    summaryVersion++; listVersion++; byId('accountSummary').replaceChildren(); byId('accountActivity').replaceChildren(); byId('accountRecords').hidden = true; byId('btnProfileEdit').disabled = true;
    if (window.kbViewMode === 'profile') loadUserProfile();
  });
  window.addEventListener('popstate', () => { if (window.kbViewMode === 'profile') loadUserProfile(); });
  window.loadUserProfile = loadUserProfile;
  if (window.kbViewMode === 'profile') loadUserProfile();
})();
