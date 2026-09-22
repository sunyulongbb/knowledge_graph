(function () {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let homeVersion = 0, searchVersion = 0, typesVersion = 0, page = 1, total = 0;
  let currentHomeApplicationId = '';
  let homeNodes = [], homeVisibleNodes = [], homeCategories = [], homeSelectedCategory = '', homeInspirationIndex = 0, homeDrawCount = 1;
  const pageSize = 20;
  const fields = { q: 'appSearchQuery', type: 'appSearchType', property_id: 'appSearchProperty', property_value: 'appSearchValue', order: 'appSearchOrder' };
  async function api(path, params = {}) {
    const url = new URL(path, location.origin);
    const db = new URLSearchParams(location.search).get('db');
    if (db) url.searchParams.set('db', db);
    Object.entries(params).forEach(([key, value]) => { if (value !== '') url.searchParams.set(key, value); });
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`加载失败（${response.status}）`);
    return response.json();
  }
  function nodeUrl(node) {
    const url = new URL(location.href);
    url.searchParams.delete('node'); url.searchParams.delete('view');
    url.hash = new URLSearchParams({ view: 'knowledge_detail', node: node.id || node._id });
    return url.href;
  }
  function card(node) {
    let picture = '';
    const source = node.image || node.images?.[0];
    if (typeof source === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(source)) picture = `<img src="${escape(source)}" alt="" width="92" height="72" loading="lazy">`;
    return `<article class="app-knowledge-item">${picture}<div><a href="${escape(nodeUrl(node))}">${escape(node.name || node.label || node.id)}</a><p>${escape(node.description || node.desc_zh || '暂无描述')}</p><small class="muted">${escape(node.typeLabel || node.type || '未设置本体')} · ${escape((node.updated_at || node.created_at || '').slice(0, 10))}</small></div></article>`;
  }
  function firstImage(node) {
    const candidates = [node.image, ...(Array.isArray(node.images) ? node.images : []), ...(Array.isArray(node._attr_images) ? node._attr_images : [])];
    return candidates.find((value) => typeof value === 'string' && /^(https?:\/\/|\/(?!\/)|data:image\/)/i.test(value)) || '';
  }
  function firstVideo(node) {
    const rawVideos = Array.isArray(node.videos) ? node.videos : (typeof node.videos === 'string' ? (() => { try { const parsed = JSON.parse(node.videos); return Array.isArray(parsed) ? parsed : [node.videos]; } catch { return [node.videos]; } })() : []);
    const candidates = [...rawVideos, ...(Array.isArray(node._attr_videos) ? node._attr_videos : []), node.video];
    return candidates.map((value) => typeof value === 'string' ? value : value?.url || value?.src || '').find((value) => /^(https?:\/\/|\/(?!\/)|data:video\/)/i.test(value)) || '';
  }
  function shortDate(value) {
    const date = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replace(/-/g, '.') : '最近更新';
  }
  function homeKnowledgeCard(node) {
    const image = firstImage(node);
    const video = image ? '' : firstVideo(node);
    const title = node.name || node.label || node.id;
    return `<article class="app-home-knowledge-card">
      <a class="app-home-card-media${image || video ? '' : ' is-placeholder'}" href="${escape(nodeUrl(node))}" aria-label="查看 ${escape(title)}">${image ? `<img src="${escape(image)}" alt="" loading="lazy">` : video ? `<video src="${escape(video)}" muted playsinline preload="metadata"></video><span class="app-media-type"><i class="fa-solid fa-play" aria-hidden="true"></i> 视频</span>` : '<i class="fa-solid fa-lightbulb" aria-hidden="true"></i>'}</a>
      <div class="app-home-card-body"><div class="app-home-card-meta"><span>${escape(node.typeLabel || node.type || '知识实体')}</span><time>${escape(shortDate(node.updated_at || node.created_at))}</time></div><a class="app-home-card-title" href="${escape(nodeUrl(node))}">${escape(title)}</a><p>${escape(node.description || node.desc_zh || '等待补充更多知识描述。')}</p><div class="app-home-card-footer"><span class="app-home-card-id">${escape(node.id || node._id || '')}</span><span>查看详情 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div></div>
    </article>`;
  }
  function categoryTree(items) {
    const byParent = new Map();
    (items || []).forEach((item) => {
      const parent = item.parent_id || '';
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(item);
    });
    const ids = new Set((items || []).map((item) => item.id));
    const roots = (items || []).filter((item) => !item.parent_id || !ids.has(item.parent_id));
    const branch = (item, depth, seen) => {
      if (seen.has(item.id)) return '';
      const nextSeen = new Set(seen); nextSeen.add(item.id);
      const children = byParent.get(item.id) || [];
      return `<li><button type="button" class="app-category-item${homeSelectedCategory === item.id ? ' is-active' : ''}" data-home-category="${escape(item.id)}" style="--tree-depth:${depth}"><i class="fa-solid ${children.length ? 'fa-folder-tree' : 'fa-tag'}" aria-hidden="true"></i><span>${escape(item.name || item.id)}</span><small>${Number(item.instance_count) || 0}</small></button>${children.length ? `<ul>${children.map((child) => branch(child, depth + 1, nextSeen)).join('')}</ul>` : ''}</li>`;
    };
    return roots.map((item) => branch(item, 0, new Set())).join('');
  }
  function inspirationCard(node) {
    if (!node) return '<div class="app-inspiration-empty"><i class="fa-regular fa-lightbulb" aria-hidden="true"></i><strong>等待第一条知识</strong><span>创建知识后，就可以从这里随机抽取灵感。</span></div>';
    const image = firstImage(node);
    const video = image ? '' : firstVideo(node);
    const media = image ? `<img src="${escape(image)}" alt="" loading="eager">` : video ? `<video src="${escape(video)}" muted playsinline preload="metadata" controls></video>` : '';
    return `<article class="app-inspiration-card" data-home-inspiration-card>
      <div class="app-inspiration-card-top"><span><i class="fa-regular fa-star" aria-hidden="true"></i> 潜力知识</span><small>${escape(shortDate(node.updated_at || node.created_at))}</small></div>
      ${media ? `<div class="app-inspiration-media-stage">${media}<span><i class="fa-solid ${video ? 'fa-video' : 'fa-image'}" aria-hidden="true"></i> ${video ? '视频' : '图片'}</span></div>` : ''}
      <div class="app-inspiration-identity">${media ? '' : '<div class="app-inspiration-visual is-placeholder"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></div>'}<div><h2>${escape(node.name || node.label || node.id)}</h2><span>${escape(node.id || node._id || '')}</span></div></div>
      <div class="app-inspiration-meta"><span>${escape(node.typeLabel || node.type || '知识实体')}</span>${video ? '<span>视频</span>' : image ? '<span>图片</span>' : ''}</div>
      <p>${escape(node.description || node.desc_zh || '从知识库里重新发现一条值得关注的信息。')}</p>
      <a href="${escape(nodeUrl(node))}" class="app-inspiration-link"><span>查看知识详情</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    </article>`;
  }
  function inspirationDrawContent(node) {
    const drawStep = ((homeDrawCount - 1) % 10) + 1;
    return `<div class="app-inspiration-progress"><div><span>第 <strong>${drawStep}</strong> 抽</span><small>${drawStep}/10</small></div><div class="app-inspiration-progress-track">${Array.from({ length: 10 }, (_, index) => `<i class="${index < drawStep ? 'is-active' : ''}"></i>`).join('')}</div></div>${inspirationCard(node)}<button type="button" class="btn app-inspiration-draw" data-home-inspire ${homeNodes.length ? '' : 'disabled'}><i class="fa-solid fa-rotate" aria-hidden="true"></i> ${homeDrawCount > 1 ? '再抽一张' : '抽取灵感'}</button>`;
  }
  function renderHome(nodes = homeVisibleNodes) {
    const content = byId('appHomeContent');
    if (!content) return;
    content.classList.remove('is-filtering');
    const inspiration = homeNodes.length ? homeNodes[homeInspirationIndex % homeNodes.length] : null;
    const activeCategory = homeCategories.find((item) => item.id === homeSelectedCategory);
    content.innerHTML = `<div class="app-home-quickbar"><button type="button" class="app-inspiration-trigger" data-home-inspiration-open aria-label="抽取知识灵感" title="抽取知识灵感"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></button></div>
      <dialog class="app-inspiration-modal" data-home-inspiration-modal aria-labelledby="appInspirationTitle"><div class="app-inspiration-modal-head"><div><span class="app-home-eyebrow"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> DISCOVERY</span><h2 id="appInspirationTitle">抽张知识灵感卡</h2><p>把熟悉的排序放一边，遇见一条可能没看过的知识。</p></div><button type="button" class="app-inspiration-close" data-home-inspiration-close aria-label="关闭"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div class="app-inspiration-draw-shell">${inspirationDrawContent(inspiration)}</div></dialog>
      <div class="app-home-workspace"><aside class="app-category-panel"><div class="app-home-section-heading compact"><div><span class="app-home-eyebrow">KNOWLEDGE MAP</span><h2>分类树</h2></div><span class="app-category-total">${homeCategories.length}</span></div><nav aria-label="知识分类"><button type="button" class="app-category-item${homeSelectedCategory ? '' : ' is-active'}" data-home-category=""><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>全部知识</span><small>${Number(byId('appHomeCount')?.dataset.total) || 0}</small></button><ul class="app-category-tree">${categoryTree(homeCategories)}</ul></nav></aside>
      <section class="app-knowledge-panel"><div class="app-home-section-heading compact"><div><span class="app-home-eyebrow">KNOWLEDGE LIBRARY</span><h2>${escape(activeCategory?.name || '知识列表')}</h2></div><span class="app-list-count">${nodes.length} 条</span></div><div class="app-home-knowledge-grid">${nodes.map(homeKnowledgeCard).join('') || '<div class="app-home-empty"><i class="fa-solid fa-inbox" aria-hidden="true"></i><strong>该分类暂无知识</strong><span>选择其他分类，或创建一条新知识。</span></div>'}</div></section></div>`;
  }
  function flatten(items, depth = 0) {
    return (items || []).flatMap((item) => [{ id: item.id, name: `${'　'.repeat(depth)}${item.name || item.id}` }, ...flatten(item.children, depth + 1)]);
  }
  async function syncHomeMaintenanceAction() {
    const button = byId('appHomeMaintenance');
    if (!button) return;
    const slug = new URLSearchParams(location.search).get('db') || 'default';
    try {
      const data = await api('/api/applications', { scope: 'market' });
      const project = (data.projects || []).find((item) => item.slug === slug);
      if (!project) throw new Error('应用不存在');
      currentHomeApplicationId = String(project.id);
      const label = !window.authUser ? '登录后申请维护' : project.member ? '维护管理' : '申请维护';
      button.querySelector('span').textContent = label;
      button.title = label;
      button.hidden = false;
      button.classList.toggle('primary', Boolean(window.authUser && !project.member));
    } catch {
      currentHomeApplicationId = '';
      button.hidden = true;
    }
  }
  async function populateTypes(selected = '') {
    const version = ++typesVersion;
    const data = await api('/api/kb/ontology/tree');
    if (version !== typesVersion) return;
    selected = byId('appSearchType').value;
    byId('appSearchTypeHint').textContent = '包含所选本体及所有子本体';
    byId('appSearchType').innerHTML = '<option value="">全部本体</option>' + flatten(data.items).map((item) => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join('');
    if (selected && !Array.from(byId('appSearchType').options).some((item) => item.value === selected)) {
      const option = new Option(selected, selected); byId('appSearchType').append(option);
    }
    byId('appSearchType').value = selected;
  }
  window.loadApplicationHome = async function () {
    const version = ++homeVersion;
    byId('appHomeName').textContent = byId('headerProjectName')?.textContent.trim() || '应用首页';
    byId('appHomeContent').innerHTML = '<p class="muted">正在加载应用知识…</p>';
    homeSelectedCategory = '';
    const results = await Promise.allSettled([
      api('/api/kb/entity_search', { order: 'modified_desc', limit: 24, hide_entity: '1' }),
      api('/api/kb/classes'),
    ]);
    if (version !== homeVersion) return;
    homeNodes = results[0].status === 'fulfilled' ? results[0].value.nodes || [] : [];
    homeVisibleNodes = homeNodes;
    homeCategories = results[1].status === 'fulfilled' ? results[1].value || [] : [];
    homeInspirationIndex = Math.floor(Math.random() * Math.max(homeNodes.length, 1));
    const total = results[0].status === 'fulfilled' ? Number(results[0].value.total) || 0 : 0;
    byId('appHomeCount').textContent = results[0].status === 'fulfilled' ? `${total} 条知识 · ${homeCategories.length} 个分类` : '知识加载失败，请稍后重试';
    byId('appHomeCount').dataset.total = String(total);
    renderHome();
    void syncHomeMaintenanceAction();
  };
  function writeSearchRoute() {
    if (window.kbViewMode !== 'app_search') return;
    const url = new URL(location.href);
    Object.entries(fields).forEach(([key, id]) => { const value = byId(id).value.trim(); if (value) url.searchParams.set(`search_${key}`, value); else url.searchParams.delete(`search_${key}`); });
    if (byId('appSearchImage').checked) url.searchParams.set('search_image', '1'); else url.searchParams.delete('search_image');
    url.searchParams.set('search_page', page);
    history.replaceState(history.state, '', url);
  }
  async function search() {
    const version = ++searchVersion;
    const params = Object.fromEntries(Object.entries(fields).map(([key, id]) => [key, byId(id).value.trim()]));
    params.limit = pageSize; params.offset = (page - 1) * pageSize; params.hide_entity = '1';
    if (byId('appSearchImage').checked) params.has_image = '1';
    writeSearchRoute();
    byId('appSearchResults').innerHTML = '<p class="muted" role="status">正在搜索…</p>';
    byId('appSearchPaging').hidden = true;
    try {
      const data = await api('/api/kb/entity_search', params);
      if (version !== searchVersion || window.kbViewMode !== 'app_search') return;
      total = Number(data.total) || 0;
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (page > lastPage) { page = lastPage; return search(); }
      byId('appSearchResults').innerHTML = `<p class="muted" role="status">找到 ${total} 条知识</p>${(data.nodes || []).map(card).join('') || '<p class="app-search-empty">没有找到匹配的知识，请尝试减少筛选条件。</p>'}`;
      byId('appSearchPaging').hidden = total === 0;
      byId('appSearchPageLabel').textContent = `第 ${page} / ${lastPage} 页`;
      byId('appSearchPrev').disabled = page <= 1;
      byId('appSearchNext').disabled = page >= lastPage;
    } catch (error) {
      if (version === searchVersion) byId('appSearchResults').innerHTML = `<p role="alert">${escape(error.message)}</p><button type="button" class="btn" data-search-retry>重试</button>`;
    }
  }
  window.loadApplicationSearch = function () {
    const params = new URLSearchParams(location.search);
    Object.entries(fields).forEach(([key, id]) => {
      const value = params.get(`search_${key}`) || (key === 'order' ? 'modified_desc' : '');
      if (key === 'type' && value && !Array.from(byId(id).options).some((item) => item.value === value)) byId(id).append(new Option(value, value));
      byId(id).value = value;
    });
    byId('appSearchImage').checked = params.get('search_image') === '1';
    byId('appSearchAdvanced').open = ['type', 'property_id', 'property_value'].some((key) => params.has(`search_${key}`)) || byId('appSearchImage').checked;
    const requested = Number(params.get('search_page') || 1); page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
    populateTypes(params.get('search_type') || '').catch(() => { byId('appSearchTypeHint').textContent = '本体选项加载失败，可继续搜索或重新进入页面重试。'; });
    search();
  };
  byId('btnApplicationSearch').addEventListener('click', () => window.setViewMode('app_search'));
  byId('appHomeSearch').addEventListener('click', () => window.setViewMode('app_search'));
  byId('appHomeBrowse').addEventListener('click', () => window.setViewMode('table'));
  byId('appHomeMaintenance').addEventListener('click', () => {
    if (currentHomeApplicationId) window.openApplicationDetails?.(currentHomeApplicationId);
  });
  byId('appSearchForm').addEventListener('submit', (event) => { event.preventDefault(); page = 1; search(); });
  byId('appSearchReset').addEventListener('click', () => { Object.entries(fields).forEach(([key, id]) => { byId(id).value = key === 'order' ? 'modified_desc' : ''; }); byId('appSearchImage').checked = false; page = 1; search(); });
  byId('appSearchPrev').addEventListener('click', () => { if (page > 1) { page--; search(); } });
  byId('appSearchNext').addEventListener('click', () => { if (page * pageSize < total) { page++; search(); } });
  byId('appHomeContent').addEventListener('click', (event) => {
    const modal = byId('appHomeContent').querySelector('[data-home-inspiration-modal]');
    if (event.target.closest('[data-home-inspiration-open]')) { modal?.showModal(); return; }
    if (event.target.closest('[data-home-inspiration-close]')) { modal?.close(); return; }
    const inspire = event.target.closest('[data-home-inspire]');
    if (inspire && homeNodes.length) {
      let next = homeInspirationIndex;
      if (homeNodes.length > 1) while (next === homeInspirationIndex) next = Math.floor(Math.random() * homeNodes.length);
      homeInspirationIndex = next; homeDrawCount += 1;
      const shell = modal?.querySelector('.app-inspiration-draw-shell');
      if (shell) shell.innerHTML = inspirationDrawContent(homeNodes[homeInspirationIndex]);
      return;
    }
    const category = event.target.closest('[data-home-category]');
    if (category) {
      homeSelectedCategory = category.dataset.homeCategory || '';
      const version = ++homeVersion;
      byId('appHomeContent').classList.add('is-filtering');
      api('/api/kb/entity_search', { order: 'modified_desc', limit: 24, class_id: homeSelectedCategory, hide_entity: '1' }).then((data) => {
        if (version !== homeVersion) return;
        homeVisibleNodes = data.nodes || []; renderHome();
      }).catch(() => { if (version === homeVersion) { homeVisibleNodes = []; renderHome(); } });
      return;
    }
  });
  byId('appHomeContent').addEventListener('click', (event) => {
    const modal = event.target.closest('[data-home-inspiration-modal]');
    if (modal && event.target === modal) modal.close();
  });
  byId('appSearchResults').addEventListener('click', (event) => { if (event.target.closest('[data-search-retry]')) search(); });
  const refresh = () => { homeVersion++; searchVersion++; if (window.kbViewMode === 'app_home') window.loadApplicationHome(); if (window.kbViewMode === 'app_search') window.loadApplicationSearch(); };
  window.addEventListener('kb-auth-change', refresh);
  window.addEventListener('popstate', () => { if (window.kbViewMode === 'app_search') window.loadApplicationSearch(); });
  new MutationObserver(() => { byId('appHomeName').textContent = byId('headerProjectName').textContent.trim() || '应用首页'; }).observe(byId('headerProjectName'), { childList: true, subtree: true, characterData: true });
  refresh();
})();
