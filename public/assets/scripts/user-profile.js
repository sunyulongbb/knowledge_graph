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
  function contributionHeatmap(activity = {}) {
    const year = Number(activity.year) || new Date().getFullYear();
    const countsByDate = new Map((activity.days || []).map((item) => [item.date, Number(item.count) || 0]));
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    const gridStart = new Date(start); gridStart.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const cells = [];
    const months = [];
    let lastMonth = -1, maxCount = 0;
    countsByDate.forEach((count) => { maxCount = Math.max(maxCount, count); });
    for (let cursor = new Date(gridStart), index = 0; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1), index++) {
      const inYear = cursor.getUTCFullYear() === year;
      const date = cursor.toISOString().slice(0, 10);
      const count = inYear ? countsByDate.get(date) || 0 : 0;
      const level = count ? Math.max(1, Math.min(4, Math.ceil((count / Math.max(maxCount, 1)) * 4))) : 0;
      const week = Math.floor(index / 7) + 1;
      if (inYear && cursor.getUTCMonth() !== lastMonth) {
        lastMonth = cursor.getUTCMonth();
        months.push(`<span style="grid-column:${week}">${cursor.toLocaleDateString('zh-CN', { month: 'short', timeZone: 'UTC' })}</span>`);
      }
      cells.push(`<i class="${inYear ? '' : 'is-outside'}" data-level="${level}" style="grid-column:${week};grid-row:${cursor.getUTCDay() + 1}" title="${inYear ? `${date}：${count} 次活动` : ''}"></i>`);
    }
    return `<section class="account-contribution"><div class="account-contribution-head"><h3>${Number(activity.total) || 0} 次活动 · ${year}</h3><span>年度活动</span></div><div class="account-contribution-scroll"><div class="account-contribution-chart"><div class="account-contribution-months">${months.join('')}</div><div class="account-contribution-body"><div class="account-contribution-weekdays"><span>周一</span><span>周三</span><span>周五</span></div><div class="account-contribution-grid">${cells.join('')}</div></div><div class="account-contribution-foot"><span>根据知识维护与互动记录统计</span><span class="account-contribution-legend">少 ${[0,1,2,3,4].map((level) => `<i data-level="${level}"></i>`).join('')} 多</span></div></div></div></section>`;
  }
  function applicationTile(item, index) {
    const title = String(item.title || item.slug || '未命名应用').trim();
    const initials = Array.from(title.replace(/\s+/g, '') || '应用').slice(0, 2).join('').toUpperCase();
    const image = String(item.image || item.logo || '').trim();
    const imageUrl = /^data:image\/(?:avif|gif|jpeg|jpg|png|svg\+xml|webp);/i.test(image)
      ? image
      : /^https?:\/\//i.test(image)
        ? image
        : /^\/(?:static\/)?uploads\//i.test(image)
          ? image
          : /^(?:static\/)?uploads\//i.test(image)
            ? `/${image}`
            : '';
    return `<button class="account-application-tile${imageUrl ? ' has-image' : ''}" type="button" data-profile-app="${Number(item.id)}" aria-label="打开应用 ${escape(title)}">
      <span class="account-application-logo"><b aria-hidden="true">${escape(initials)}</b>${imageUrl ? `<img src="${escape(imageUrl)}" alt="${escape(title)} Logo" loading="eager" decoding="async">` : ''}</span>
      <span class="account-application-copy"><span class="account-application-role">${item.relationship === 'owner' ? '我创建的' : '参与维护'}</span><strong>${escape(title)}</strong><small>${escape(item.description || '暂无应用描述')}</small><em>${escape(item.slug || '')}</em></span>
      <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
    </button>`;
  }
  function renderSummary(data) {
    const user = data.user;
    byId('accountSummary').innerHTML = `<div class="account-profile-overview"><div class="account-identity"><div class="account-avatar">${avatar(user)}</div><div><h2>${escape(user.displayName)}</h2><p class="muted">@${escape(user.username)} · ${user.role === 'admin' ? '管理员' : '普通用户'}</p></div></div><div class="account-statistics">${Object.entries(sections).map(([key, label]) => `<button type="button" class="account-stat" data-profile-section="${key}"><strong>${Number(data.counts[key] || 0)}</strong><span>${label}</span></button>`).join('')}</div></div>${contributionHeatmap(data.activity)}`;
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
    byId('accountActivity').classList.toggle('is-application-wall', section === 'applications');
    byId('accountActivity').innerHTML = '<div class="account-empty muted">正在加载记录…</div>';
    byId('accountPageInfo').textContent = '';
    try {
      const data = await api(section, page);
      if (token !== listVersion) return;
      page = data.page; totalPages = Math.max(1, Math.ceil(data.total / data.pageSize)); counts[section] = data.total;
      byId('accountActivity').innerHTML = data.items.map((item, index) => {
        if (section === 'applications') return applicationTile(item, index);
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
  byId('accountActivity').addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement) event.target.remove(); }, true);
  window.addEventListener('kb-auth-change', () => {
    summaryVersion++; listVersion++; byId('accountSummary').replaceChildren(); byId('accountActivity').replaceChildren(); byId('accountRecords').hidden = true; byId('btnProfileEdit').disabled = true;
    if (window.kbViewMode === 'profile') loadUserProfile();
  });
  window.addEventListener('popstate', () => { if (window.kbViewMode === 'profile') loadUserProfile(); });
  window.loadUserProfile = loadUserProfile;
  if (window.kbViewMode === 'profile') loadUserProfile();
})();
