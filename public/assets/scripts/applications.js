(function () {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let scope = 'market', projects = [], activeProject = null, listVersion = 0, detailVersion = 0;
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
  function render() {
    const keyword = byId('applicationSearch').value.trim().toLowerCase();
    const items = projects.filter((project) => `${project.title} ${project.description} ${project.slug}`.toLowerCase().includes(keyword));
    byId('applicationCards').innerHTML = items.map((project) => `<article class="application-card"><div class="application-card-heading"><h3>${escape(project.title || project.name)}</h3><span class="knowledge-role">${project.owner ? '我创建的' : project.member ? '维护成员' : '应用市场'}</span></div><p>${escape(project.description || '暂无描述')}</p><small class="muted">创建者：${escape(project.owner_name || project.owner_username || '历史应用未记录')} · ${escape(project.slug)}</small><div class="application-card-actions"><button class="btn" type="button" data-app-open="${escape(project.slug)}">打开应用</button><button class="btn primary" type="button" data-app-access="${project.id}">${project.owner ? '成员与申请管理' : project.reviewRequests ? '维护申请管理' : project.member ? '查看维护权限' : '申请维护'}</button></div></article>`).join('') || '<p class="muted">暂无应用。你可以创建一个应用，或到市场申请维护。</p>';
    byId('btnApplicationCreate').disabled = !window.authUser;
    byId('btnApplicationCreate').title = window.authUser ? '创建应用' : '请先登录';
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
        ${!window.authUser ? '<p>请先登录后申请维护。</p>' : !project.member ? pending ? '<p>维护申请已提交，等待审批。</p>' : project.owner_user_id ? '<form data-app-request><label>申请说明<textarea name="message" class="kb-input" rows="3" maxlength="1000" placeholder="介绍你希望参与的维护工作（选填）"></textarea></label><button type="submit" class="btn primary">提交维护申请</button></form>' : '<p>历史应用未登记创建者，暂不接受维护申请。</p>' : '<p>你已拥有此应用的维护权限。</p>'}
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
    if (button.dataset.appOpen) { const url = new URL(location.href); url.searchParams.set('db', button.dataset.appOpen); url.searchParams.delete('node'); url.searchParams.delete('view'); url.hash = 'view=table'; location.href = url; return; }
    if (button.dataset.appAccess) { await loadAccess(button.dataset.appAccess); byId('applicationAccess').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
