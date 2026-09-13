(function () {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let scope = 'market', projects = [], activeProject = null, listVersion = 0, detailVersion = 0, infoVersion = 0;
  const updateScope = () => { const value = new URLSearchParams(location.search).get('db'); window.kbApplicationScope = value && value !== 'app' ? value : ''; window.dispatchEvent(new CustomEvent('kb-application-access-change')); };
  updateScope();
  window.addEventListener('kb:url-param-changed', updateScope);
  window.addEventListener('popstate', updateScope);
  async function api(path, body, method = 'POST') {
    const response = await fetch(path, body === undefined ? { cache: 'no-store' } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || '请求失败');
    return data;
  }
  const status = (message) => { byId('applicationStatus').textContent = message || ''; };
  const safeUrl = (value, allowImageData = false) => {
    const source = String(value || '').trim();
    if (allowImageData && /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);/i.test(source)) return source;
    try { const url = new URL(source, location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const initials = (project) => String(project.title || project.name || '应用').trim().slice(0, 2).toUpperCase();
  const logo = (project, className = 'application-logo') => { const source = safeUrl(project.image, true); return `<div class="${className}" style="--application-color:${escape(project.theme_color || '#6366f1')}"><span aria-hidden="true">${escape(initials(project))}</span>${source ? `<img src="${escape(source)}" alt="${escape(project.title || project.name)} Logo" loading="lazy" />` : ''}</div>`; };
  function render() {
    const keyword = byId('applicationSearch').value.trim().toLowerCase();
    const items = projects.filter((project) => `${project.title} ${project.description} ${project.slug}`.toLowerCase().includes(keyword));
    byId('applicationCards').innerHTML = items.map((project) => `<article class="application-card application-market-card">
      <button class="application-card-cover" type="button" data-app-detail="${project.id}" aria-label="查看 ${escape(project.title || project.name)} 详情">${logo(project)}</button>
      <div class="application-card-content"><div class="application-card-heading"><h3 title="${escape(project.title || project.name)}">${escape(project.title || project.name)}</h3><span class="knowledge-role">${project.owner ? '我创建的' : project.member ? '维护成员' : '应用市场'}</span></div>
      <p class="application-card-description">${escape(project.description || '暂无描述')}</p><small class="muted">创建者：${escape(project.owner_name || project.owner_username || '历史应用未记录')} · ${escape(project.slug)}</small>
      <div class="application-card-actions"><button class="btn primary" type="button" data-app-detail="${project.id}">查看详情</button><button class="btn" type="button" data-app-open="${escape(project.slug)}">打开应用</button><button class="btn icon" type="button" data-app-access="${project.id}" title="维护管理" aria-label="维护管理"><i class="fa-solid fa-user-gear"></i></button></div></div></article>`).join('') || '<div class="application-empty"><i class="fa-regular fa-folder-open"></i><p>暂无应用。你可以创建一个应用，或到市场申请维护。</p></div>';
    byId('btnApplicationCreate').disabled = !window.authUser;
    byId('btnApplicationCreate').title = window.authUser ? '创建应用' : '请先登录';
  }
  function renderTaxonomy(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<p class="muted application-detail-empty">${emptyText}</p>`;
    const byParent = new Map();
    const ids = new Set(items.map((item) => String(item.id)));
    items.forEach((item) => {
      const parent = item.parent_id && ids.has(String(item.parent_id)) ? String(item.parent_id) : '';
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(item);
    });
    const seen = new Set();
    const branch = (parent = '') => (byParent.get(parent) || []).map((item) => {
      if (seen.has(String(item.id))) return '';
      seen.add(String(item.id));
      const children = branch(String(item.id));
      return `<li><span class="application-model-item"><i class="fa-solid fa-${children ? 'folder-tree' : 'circle-dot'}"></i><span>${escape(item.name || item.id)}</span><small>${Number(item.entity_count || 0)} 个实体</small></span>${children ? `<ul>${children}</ul>` : ''}</li>`;
    }).join('');
    return `<ul class="application-model-tree">${branch()}</ul>`;
  }
  async function loadDetails(id) {
    const token = ++infoVersion;
    const catalog = byId('applicationCatalog'), target = byId('applicationDetail');
    catalog.hidden = true; target.hidden = false; target.innerHTML = '<div class="application-detail-loading"><span class="loading-spinner"></span>正在加载应用详情…</div>';
    try {
      const data = await api(`/api/applications/${id}/details`);
      if (token !== infoVersion) return;
      const project = data.project, stats = data.statistics || {};
      const projectLink = safeUrl(project.link);
      target.innerHTML = `<div class="application-detail-topbar"><button class="btn" type="button" data-app-detail-back><i class="fa-solid fa-arrow-left"></i> 返回应用</button><div><button class="btn" type="button" data-app-open="${escape(project.slug)}">打开应用</button><button class="btn primary" type="button" data-app-access="${project.id}">维护管理</button></div></div>
        <header class="application-detail-hero">${logo(project, 'application-detail-logo')}<div class="application-detail-intro"><div class="application-detail-title"><h2>${escape(project.title || project.name)}</h2><span class="knowledge-role">${project.owner ? '我创建的' : project.member ? '维护成员' : '应用市场'}</span></div><p>${escape(project.description || '暂无描述')}</p><div class="application-detail-meta"><span><i class="fa-regular fa-user"></i> ${escape(project.owner_name || project.owner_username || '历史应用未记录')}</span><span><i class="fa-solid fa-code"></i> ${escape(project.slug)}</span>${project.created_at ? `<span><i class="fa-regular fa-calendar"></i> ${escape(String(project.created_at).slice(0, 10))}</span>` : ''}${projectLink ? `<a href="${escape(projectLink)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> 官方链接</a>` : ''}</div></div></header>
        <section class="application-stat-grid">${[
          ['knowledge','知识实体','fa-database'],['ontologies','本体','fa-sitemap'],['categories','分类','fa-folder-tree'],['tags','标签','fa-tags'],['properties','属性','fa-list-check'],['attributes','属性值','fa-table-list'],['media','媒体','fa-photo-film']
        ].map(([key,label,icon]) => `<div class="application-stat-card"><i class="fa-solid ${icon}"></i><strong>${Number(stats[key] || 0).toLocaleString()}</strong><span>${label}</span></div>`).join('')}</section>
        <div class="application-detail-columns"><section class="application-detail-section"><div class="application-detail-section-head"><h3>本体信息</h3><span>${data.ontologies.length} 项</span></div>${renderTaxonomy(data.ontologies, '该应用暂未配置本体')}</section>
        <section class="application-detail-section"><div class="application-detail-section-head"><h3>分类信息</h3><span>${data.categories.length} 项</span></div>${renderTaxonomy(data.categories, '该应用暂未配置分类')}</section></div>
        <section class="application-detail-section application-tags-section"><div class="application-detail-section-head"><h3>标签信息</h3><span>${data.tags.length} 项</span></div><div class="application-detail-tags">${data.tags.map((tag) => `<span class="application-detail-tag">${escape(tag.name)}${tag.count ? `<small>${tag.count}</small>` : ''}</span>`).join('') || '<p class="muted application-detail-empty">该应用暂无标签</p>'}</div></section>`;
    } catch (error) {
      if (token === infoVersion) target.innerHTML = `<div class="application-detail-error"><p>${escape(error.message)}</p><button class="btn" type="button" data-app-detail-back>返回应用</button><button class="btn primary" type="button" data-app-detail="${id}">重试</button></div>`;
    }
  }
  async function loadApplications() {
    const token = ++listVersion;
    status('正在加载应用…');
    try {
      const data = await api(`/api/applications?scope=${scope}`);
      if (token !== listVersion) return;
      projects = data.projects; render(); status('');
    } catch (error) { if (token === listVersion) status(error.message); }
  }
  async function loadAccess(id) {
    const token = ++detailVersion, target = byId('applicationAccess');
    activeProject = id; target.hidden = false; target.textContent = '正在加载应用权限…';
    try {
      const data = await api(`/api/applications/${id}/access`);
      if (token !== detailVersion) return;
      const project = data.project;
      const pending = data.ownRequest?.status === 'pending';
      target.innerHTML = `<div class="application-card-heading"><h3>${escape(project.title || project.name)} · 维护管理</h3><button type="button" class="btn" data-app-close>关闭</button></div>
        <p class="muted">维护成员可在此应用中新增自己的知识。知识原有访问权限独立生效；只有创建者可以增删成员及授权。</p>
        ${!window.authUser ? '<p>请先登录后申请维护。</p>' : !project.member ? pending ? '<p>维护申请已提交，等待审批。</p>' : `<form data-app-request>${project.owner_user_id ? '' : '<p class="muted">此历史应用尚未登记创建者，首位申请者将自动成为创建者。</p>'}<label>申请说明<textarea name="message" class="kb-input" rows="3" maxlength="1000" placeholder="介绍你希望参与的维护工作（选填）"></textarea></label><button type="submit" class="btn primary">${project.owner_user_id ? '提交维护申请' : '申请并成为创建者'}</button></form>` : '<p>你已拥有此应用的维护权限。</p>'}
        ${project.member && !project.owner ? `<p>修改应用设置：${project.editSettings ? '允许' : '未授权'}；审批维护申请：${project.reviewRequests ? '允许' : '未授权'}</p>` : ''}
        ${project.owner ? `<h4>Members · 成员与权限</h4><form data-member-add class="application-member-add"><input name="username" class="kb-input" required placeholder="输入已有用户的用户名" aria-label="成员用户名" /><button type="submit" class="btn primary">添加成员</button></form><div class="application-members">${data.members.map((member) => `<form data-member-id="${member.user_id}" class="application-member"><strong>${escape(member.display_name || member.username)} <small>@${escape(member.username)}</small></strong><label><input type="checkbox" name="edit_settings" ${member.edit_settings ? 'checked' : ''}/> 修改应用设置</label><label><input type="checkbox" name="review_requests" ${member.review_requests ? 'checked' : ''}/> 审批维护申请</label><button type="submit" class="btn">保存权限</button><button type="button" class="btn danger" data-member-remove="${member.user_id}">移除</button></form>`).join('') || '<p class="muted">尚无维护成员。</p>'}</div>` : ''}
        ${project.reviewRequests ? `<h4>待审批申请</h4>${data.requests.map((item) => `<div class="application-member"><div><strong>${escape(item.display_name || item.username)} @${escape(item.username)}</strong><p>${escape(item.message || '未填写说明')}</p></div><button class="btn primary" type="button" data-app-review="approve" data-user="${item.user_id}">批准</button><button class="btn" type="button" data-app-review="reject" data-user="${item.user_id}">拒绝</button></div>`).join('') || '<p class="muted">暂无待审批申请。</p>'}` : ''}<p data-access-status class="muted" role="status"></p>`;
    } catch (error) { if (token === detailVersion) target.textContent = error.message; }
  }
  async function refreshAfterChange(id) {
    await Promise.all([loadApplications(), loadAccess(id), loadNotifications(), window.loadProjectsToSidebar?.()]);
  }
  byId('btnViewApplications').addEventListener('click', (event) => { event.preventDefault(); window.setViewMode('applications'); });
  byId('applicationSearch').addEventListener('input', render);
  byId('btnApplicationCreate').addEventListener('click', () => { if (window.authUser) { byId('applicationCreateForm').hidden = false; byId('applicationCreateForm').elements.title.focus(); } });
  byId('btnApplicationCreateCancel').addEventListener('click', () => { byId('applicationCreateForm').hidden = true; });
  byId('applicationCreateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target, button = form.querySelector('[type=submit]'); button.disabled = true;
    try { const data = await api('/api/applications', Object.fromEntries(new FormData(form))); form.reset(); form.hidden = true; await refreshAfterChange(data.project.id); status('应用创建成功'); }
    catch (error) { status(error.message); } finally { button.disabled = false; }
  });
  byId('applicationsPanel').addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.appScope) { scope = button.dataset.appScope; document.querySelectorAll('[data-app-scope]').forEach((item) => item.classList.toggle('accent', item === button)); loadApplications(); return; }
    if (button.dataset.appDetail) { await loadDetails(button.dataset.appDetail); return; }
    if (button.hasAttribute('data-app-detail-back')) { infoVersion++; byId('applicationDetail').hidden = true; byId('applicationCatalog').hidden = false; return; }
    if (button.dataset.appOpen) { const url = new URL(location.href); url.searchParams.set('db', button.dataset.appOpen); url.searchParams.delete('node'); url.searchParams.delete('view'); url.hash = 'view=table'; location.href = url; return; }
    if (button.dataset.appAccess) { byId('applicationDetail').hidden = true; byId('applicationCatalog').hidden = false; await loadAccess(button.dataset.appAccess); byId('applicationAccess').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (button.hasAttribute('data-app-close')) { detailVersion++; activeProject = null; byId('applicationAccess').hidden = true; return; }
    if (!button.dataset.appReview && !button.dataset.memberRemove) return;
    const id = activeProject;
    if (button.dataset.memberRemove && !confirm('确认移除此应用成员？其应用维护权限将立即撤销。')) return;
    button.disabled = true;
    try {
      if (button.dataset.appReview) await api(`/api/applications/${id}/review`, { user_id: Number(button.dataset.user), decision: button.dataset.appReview });
      else await api(`/api/applications/${id}/member`, { user_id: Number(button.dataset.memberRemove) }, 'DELETE');
      await refreshAfterChange(id);
    } catch (error) { status(error.message); } finally { button.disabled = false; }
  });
  byId('applicationsPanel').addEventListener('error', (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.closest('.application-logo,.application-detail-logo')) image.remove();
  }, true);
  byId('applicationAccess').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.target, id = activeProject, button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      if (form.hasAttribute('data-app-request')) await api(`/api/applications/${id}/request`, { message: form.elements.message.value });
      else if (form.hasAttribute('data-member-add')) await api(`/api/applications/${id}/member`, { username: form.elements.username.value });
      else await api(`/api/applications/${id}/member`, { user_id: Number(form.dataset.memberId), edit_settings: form.elements.edit_settings.checked, review_requests: form.elements.review_requests.checked });
      await refreshAfterChange(id);
    } catch (error) { const output = byId('applicationAccess').querySelector('[data-access-status]'); if (output) output.textContent = error.message; } finally { button.disabled = false; }
  });
  const notifications = document.createElement('section'); notifications.id = 'notificationPanel'; notifications.className = 'notification-panel'; notifications.hidden = true; notifications.setAttribute('aria-label', '消息通知');
  notifications.innerHTML = '<div class="application-card-heading"><h3>消息通知</h3><button type="button" class="btn" id="btnNotificationsReadAll">全部已读</button><button type="button" class="btn" id="btnNotificationsClose" aria-label="关闭通知">关闭</button></div><div id="notificationItems"></div>';
  document.body.appendChild(notifications);
  let notificationVersion = 0;
  let lastNotificationId = 0;
  async function loadNotifications() {
    const token = ++notificationVersion;
    if (!window.authUser) { byId('notificationBadge').hidden = true; byId('notificationItems').textContent = '登录后查看消息通知'; byId('btnNotificationsReadAll').disabled = true; return; }
    try {
      const data = await api('/api/notifications'); if (token !== notificationVersion) return;
      const latestId = data.items[0]?.id || 0;
      if (latestId !== lastNotificationId) { lastNotificationId = latestId; window.loadProjectsToSidebar?.(); }
      byId('notificationBadge').hidden = !data.unread; byId('notificationBadge').textContent = data.unread > 99 ? '99+' : data.unread;
      byId('btnNotificationsReadAll').disabled = !data.unread;
      byId('notificationItems').innerHTML = data.items.map((item) => `<button type="button" class="notification-item ${item.read_at ? '' : 'is-unread'}" data-notification="${item.id}" data-project="${item.project_id || ''}"><span>${escape(item.message)}</span><small>${escape(item.created_at)}${item.read_at ? ' · 已读' : ' · 未读'}</small></button>`).join('') || '<p class="muted">暂无消息通知</p>';
    } catch (error) { if (token === notificationVersion) byId('notificationItems').textContent = error.message; }
  }
  function closeNotifications() { notifications.hidden = true; byId('btnNotifications').setAttribute('aria-expanded', 'false'); }
  byId('btnNotifications').addEventListener('click', () => { notifications.hidden = !notifications.hidden; byId('btnNotifications').setAttribute('aria-expanded', String(!notifications.hidden)); if (!notifications.hidden) loadNotifications(); });
  byId('btnNotificationsClose').addEventListener('click', closeNotifications);
  byId('btnNotificationsReadAll').addEventListener('click', async () => { try { await api('/api/notifications/read', { all: true }); await loadNotifications(); } catch (error) { byId('notificationItems').textContent = error.message; } });
  notifications.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notification]'); if (!item) return;
    try { await api('/api/notifications/read', { id: Number(item.dataset.notification) }); await loadNotifications(); if (item.dataset.project) { closeNotifications(); window.setViewMode('applications'); await loadAccess(item.dataset.project); } }
    catch (error) { byId('notificationItems').textContent = error.message; }
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNotifications(); });
  document.addEventListener('click', (event) => { if (!event.target.closest('#notificationPanel,#btnNotifications')) closeNotifications(); });
  window.addEventListener('kb-auth-change', () => { projects = []; render(); byId('applicationCreateForm').hidden = true; loadNotifications(); window.loadProjectsToSidebar?.(); if (window.kbViewMode === 'applications') loadApplications(); if (activeProject) loadAccess(activeProject); });
  setInterval(() => { if (!document.hidden && window.authUser) loadNotifications(); }, 30000);
  window.loadApplications = loadApplications;
  loadNotifications();
  if (window.kbViewMode === 'applications') loadApplications();
})();
