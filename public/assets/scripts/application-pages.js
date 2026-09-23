(function () {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let homeVersion = 0, searchVersion = 0, typesVersion = 0, page = 1, total = 0;
  let currentHomeApplicationId = '';
  let homeNodes = [], homeVisibleNodes = [], homeCategories = [], homeSelectedCategory = '', homeInspirationIndex = 0, homeDrawCount = 1;
  const inspirationScoreCache = new Map();
  let inspirationScoreVersion = 0;
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
    const showJev = Boolean(node?.hasJevAnalysis || window.authUser?.hasJevApiKey);
    return `<article class="app-inspiration-card" data-home-inspiration-card>
      <div class="app-inspiration-card-top"><span><i class="fa-regular fa-star" aria-hidden="true"></i> 潜力知识</span><small>${escape(shortDate(node.updated_at || node.created_at))}</small></div>
      ${media ? `<div class="app-inspiration-media-stage">${media}<span><i class="fa-solid ${video ? 'fa-video' : 'fa-image'}" aria-hidden="true"></i> ${video ? '视频' : '图片'}</span></div>` : ''}
      <div class="app-inspiration-identity">${media ? '' : '<div class="app-inspiration-visual is-placeholder"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></div>'}<div><h2>${escape(node.name || node.label || node.id)}</h2><span>${escape(node.id || node._id || '')}</span></div></div>
      <div class="app-inspiration-meta"><span>${escape(node.typeLabel || node.type || '知识实体')}</span>${video ? '<span>视频</span>' : image ? '<span>图片</span>' : ''}</div>
      <p>${escape(node.description || node.desc_zh || '从知识库里重新发现一条值得关注的信息。')}</p>
      ${showJev ? `<section class="app-jev-rating is-loading" data-jev-rating data-node-id="${escape(node.id || node._id || '')}" aria-live="polite">
        <div class="app-jev-rating-head"><span><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> JEV 知识评分</span><small data-jev-status>正在评分…</small></div>
        <div class="app-jev-stars" data-jev-stars aria-label="JEV 正在评分">${Array.from({ length: 5 }, (_, index) => `<i class="fa-solid fa-star" style="--star-index:${index}" aria-hidden="true"></i>`).join('')}</div>
        <button type="button" class="app-jev-retry" data-jev-retry hidden>重新评分</button>
      </section>` : ''}
      <a href="${escape(nodeUrl(node))}" class="app-inspiration-link"><span>查看知识详情</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    </article>`;
  }
  function revealJevScore(rating, result) {
    if (!rating) return;
    const score = Math.max(1, Math.min(5, Number(result.score) || 1));
    const stars = Array.from(rating.querySelectorAll('[data-jev-stars] i'));
    const starBox = rating.querySelector('[data-jev-stars]');
    const confidence = Number(result.confidence);
    rating.classList.remove('is-loading', 'is-error');
    rating.querySelector('[data-jev-retry]').hidden = true;
    rating.querySelector('[data-jev-status]').textContent = Number.isFinite(confidence) ? `${score}/5 · 置信度 ${Math.round(confidence * 100)}%` : `${score}/5 · JEV`;
    starBox.setAttribute('aria-label', `JEV 知识评分 ${score} 星，共 5 星`);
    stars.forEach((star) => star.classList.remove('is-filled', 'is-revealed'));
    requestAnimationFrame(() => stars.forEach((star, index) => window.setTimeout(() => {
      star.classList.toggle('is-filled', index < score);
      star.classList.add('is-revealed');
    }, index * 110)));
    revealJevProfile(result.profiles || [], result);
  }
  function profileLoading() {
    return Array.from({ length: 4 }, (_, index) => `<article class="app-profile-node is-loading" style="--profile-index:${index}"><div class="app-profile-card-head"><span>ANALYSIS 0${index + 1}</span><i></i></div><strong>读取分析角度</strong><p>正在关联知识属性与证据信息…</p><div class="app-profile-skeleton"></div></article>`).join('');
  }
  function revealJevProfile(profiles, meta = {}) {
    const layer = byId('appHomeContent').querySelector('[data-jev-profile-layer]');
    if (!layer) return;
    layer.classList.remove('has-selection');
    layer.hidden = false;
    const profileHeader = `<div class="app-profile-actions"><button type="button" data-jev-profile-refresh title="重新调用 JEV 更新画像" aria-label="刷新目标画像"><i class="fa-solid fa-rotate" aria-hidden="true"></i><span>刷新分析</span></button></div>`;
    if (!profiles.length) {
      layer.innerHTML = `${profileHeader}<div class="app-profile-empty">请先在知识所属分类中配置分析角度</div>`;
      layer.classList.add('is-visible');
      return;
    }
    const tone = (value) => value === '积极支持' ? 'positive' : value === '务实合作' ? 'cooperative' : value === '限制竞争' ? 'restrictive' : value === '信息不足' ? 'unknown' : 'neutral';
    layer.innerHTML = `${profileHeader}${profiles.map((profile, index) => {
      const evidenceList = Array.isArray(profile.evidence) ? profile.evidence : [];
      const evidence = evidenceList[0] || '未命中明确属性证据';
      const keywordEvidence = Array.isArray(profile.keywordEvidence) ? profile.keywordEvidence : [];
      const relatedEvidence = Array.isArray(profile.relatedEvidence) ? profile.relatedEvidence : [];
      const hitCount = keywordEvidence.filter((item) => item.matched).length;
      const hitRate = keywordEvidence.length ? Math.round(hitCount / keywordEvidence.length * 100) : 0;
      const confidence = Number.isFinite(Number(profile.confidence)) ? Math.round(Math.max(0, Math.min(1, Number(profile.confidence))) * 100) : 0;
      const evidenceCount = evidenceList.length + relatedEvidence.length;
      const evidenceStrength = Math.min(5, Math.max(1, hitCount + relatedEvidence.length));
      return `<article class="app-profile-node is-${tone(profile.classification)}" style="--profile-index:${index};--confidence:${confidence};--hit-rate:${hitRate};--evidence-strength:${evidenceStrength}" title="${escape(evidenceList.join('\n') || evidence)}" role="button" tabindex="0" aria-pressed="false" aria-label="放大查看${escape(profile.angle)}分析">
        <div class="app-profile-card-head"><span>${escape(profile.category || '分类分析')} · 0${index + 1}</span><i></i></div>
        <div class="app-profile-angle"><strong>${escape(profile.angle)}</strong></div>
        <p>${escape(profile.content || '')}</p>
        <div class="app-profile-verdict"><span>分析结论</span><strong>${escape(profile.classification)}</strong><small>${confidence ? `置信度 ${confidence}%` : '证据待补充'}</small></div>
        <div class="app-profile-viz">
          <div class="app-profile-confidence" aria-label="置信度 ${confidence}%"><span>${confidence}</span><small>%</small></div>
          <div class="app-profile-metrics"><label><span>关键词命中</span><strong>${hitCount}/${keywordEvidence.length}</strong></label><div class="app-profile-meter"><i></i></div><label><span>证据强度</span><strong>${evidenceCount}</strong></label><div class="app-profile-signal">${Array.from({ length: 5 }, (_, level) => `<i class="${level < evidenceStrength ? 'is-on' : ''}" style="--signal-index:${level}"></i>`).join('')}</div></div>
        </div>
        <div class="app-profile-keywords">${keywordEvidence.map((item) => `<mark class="${item.matched ? 'is-hit' : ''}">${escape(item.keyword)}</mark>`).join('')}</div>
        <div class="app-profile-evidence"><span><i class="fa-solid fa-link" aria-hidden="true"></i> 核心证据 · ${evidenceList.length || 1}</span>${(evidenceList.length ? evidenceList : [evidence]).map((item) => `<p>${escape(item)}</p>`).join('')}</div>
        ${relatedEvidence.length ? `<div class="app-profile-related">${relatedEvidence.map((item) => `<span title="${escape(item.evidence)}"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${escape(item.sourceName)} <b>${escape(item.relation)}</b><em>${item.evidence ? escape(item.evidence) : ''}</em></span>`).join('')}</div>` : ''}
      </article>`;
    }).join('')}`;
    layer.classList.add('is-visible');
  }
  function toggleProfileCard(card) {
    const layer = card?.closest('[data-jev-profile-layer]');
    if (!layer || card.classList.contains('is-loading')) return;
    const selected = card.classList.contains('is-selected');
    const modal = layer.closest('[data-home-inspiration-modal]');
    const core = modal?.querySelector('.app-inspiration-modal-core');
    const cardStart = card.getBoundingClientRect();
    const coreStart = core?.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    layer.querySelectorAll('.app-profile-node.is-selected').forEach((item) => { if (item !== card) { item.classList.remove('is-selected'); item.setAttribute('aria-pressed', 'false'); } });
    if (!selected && core && coreStart) {
      card.style.setProperty('--profile-focus-left', `${coreStart.left - layerRect.left}px`);
      card.style.setProperty('--profile-focus-top', `${coreStart.top - layerRect.top}px`);
      card.style.setProperty('--profile-focus-width', `${coreStart.width}px`);
      card.style.setProperty('--profile-focus-height', `${coreStart.height}px`);
      core.style.setProperty('--profile-swap-x', `${cardStart.left + cardStart.width / 2 - (coreStart.left + coreStart.width / 2)}px`);
      core.style.setProperty('--profile-swap-y', `${cardStart.top + cardStart.height / 2 - (coreStart.top + coreStart.height / 2)}px`);
      core.style.setProperty('--profile-swap-scale', String(Math.min(.72, cardStart.width / coreStart.width)));
    }
    layer.classList.toggle('has-selection', !selected);
    if (!selected) {
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');
      if (core) {
        core.classList.add('is-profile-swapped');
        core.setAttribute('role', 'button');
        core.setAttribute('tabindex', '0');
        core.setAttribute('aria-label', '恢复灵感卡与分析卡位置');
      }
      card.focus({ preventScroll: true });
    } else {
      card.classList.remove('is-selected');
      card.setAttribute('aria-pressed', 'false');
      if (core) {
        core.classList.remove('is-profile-swapped');
        core.removeAttribute('role');
        core.removeAttribute('tabindex');
        core.removeAttribute('aria-label');
      }
    }
    if (typeof card.animate === 'function') {
      const cardEnd = card.getBoundingClientRect();
      card.animate([
        { transform: `translate(${cardStart.left - cardEnd.left}px, ${cardStart.top - cardEnd.top}px) scale(${cardStart.width / Math.max(cardEnd.width, 1)}, ${cardStart.height / Math.max(cardEnd.height, 1)})`, opacity: selected ? 1 : .72 },
        { transform: 'none', opacity: 1 },
      ], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
      if (core && coreStart) {
        const coreEnd = core.getBoundingClientRect();
        core.animate([
          { transform: `translate(${coreStart.left - coreEnd.left}px, ${coreStart.top - coreEnd.top}px) scale(${coreStart.width / Math.max(coreEnd.width, 1)}, ${coreStart.height / Math.max(coreEnd.height, 1)})`, opacity: 1 },
          { transform: getComputedStyle(core).transform, opacity: selected ? 1 : .86 },
        ], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }
  }
  function clearProfileCardSelection(modal, animate = false) {
    const layer = modal?.querySelector('[data-jev-profile-layer]');
    if (!layer) return;
    const selected = layer.querySelector('.app-profile-node.is-selected');
    if (selected && animate) { toggleProfileCard(selected); return; }
    layer.classList.remove('has-selection');
    layer.querySelectorAll('.app-profile-node.is-selected').forEach((item) => {
      item.classList.remove('is-selected');
      item.setAttribute('aria-pressed', 'false');
    });
    const core = modal?.querySelector('.app-inspiration-modal-core');
    core?.classList.remove('is-profile-swapped');
    core?.removeAttribute('role');
    core?.removeAttribute('tabindex');
    core?.removeAttribute('aria-label');
  }
  async function scoreInspiration(node, force = false) {
    if (!node) return;
    const modal = byId('appHomeContent').querySelector('[data-home-inspiration-modal]');
    const rating = modal?.querySelector(`[data-jev-rating][data-node-id="${CSS.escape(String(node.id || node._id || ''))}"]`);
    const profileLayer = modal?.querySelector('[data-jev-profile-layer]');
    if (!rating) {
      if (profileLayer) { profileLayer.hidden = true; profileLayer.classList.remove('is-visible'); profileLayer.innerHTML = ''; }
      return;
    }
    rating.hidden = false;
    const database = new URLSearchParams(location.search).get('db') || 'default';
    const cacheKey = `${database}:${node.id || node._id}`;
    if (!force && inspirationScoreCache.has(cacheKey)) return revealJevScore(rating, inspirationScoreCache.get(cacheKey));
    if (force) inspirationScoreCache.delete(cacheKey);
    const version = ++inspirationScoreVersion;
    rating.classList.add('is-loading'); rating.classList.remove('is-error');
    if (profileLayer) { profileLayer.hidden = false; profileLayer.classList.remove('is-visible'); profileLayer.innerHTML = profileLoading(); }
    rating.querySelector('[data-jev-status]').textContent = force ? '正在刷新分析…' : '正在评分…';
    rating.querySelector('[data-jev-retry]').hidden = true;
    try {
      const url = new URL('/api/jev/score', location.origin);
      if (database) url.searchParams.set('db', database);
      const response = await fetch(url, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: node.id || node._id, force }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const failure = new Error(result.error || `评分失败（${response.status}）`);
        failure.code = result.code || '';
        throw failure;
      }
      if (version !== inspirationScoreVersion || !rating.isConnected) return;
      inspirationScoreCache.set(cacheKey, result);
      revealJevScore(rating, result);
    } catch (error) {
      if (version !== inspirationScoreVersion || !rating.isConnected) return;
      if (error?.code === 'JEV_NOT_CONFIGURED' || error?.code === 'JEV_LOGIN_REQUIRED') {
        rating.hidden = true;
        if (profileLayer) { profileLayer.hidden = true; profileLayer.classList.remove('is-visible'); profileLayer.innerHTML = ''; }
        return;
      }
      rating.classList.remove('is-loading'); rating.classList.add('is-error');
      rating.querySelector('[data-jev-status]').textContent = error.message || '评分暂不可用';
      rating.querySelector('[data-jev-retry]').hidden = false;
      if (profileLayer) { profileLayer.innerHTML = `<div class="app-profile-empty">${escape(error.message || '画像分析暂不可用')}</div>`; profileLayer.classList.add('is-visible'); }
    }
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
    const showJev = Boolean(inspiration?.hasJevAnalysis || window.authUser?.hasJevApiKey);
    const activeCategory = homeCategories.find((item) => item.id === homeSelectedCategory);
    content.innerHTML = `<div class="app-home-quickbar"><button type="button" class="app-inspiration-trigger" data-home-inspiration-open aria-label="抽取知识灵感" title="抽取知识灵感"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></button></div>
      <dialog class="app-inspiration-modal" data-home-inspiration-modal aria-labelledby="appInspirationTitle"><div class="app-inspiration-profile-layer" data-jev-profile-layer ${showJev ? '' : 'hidden'}>${showJev ? profileLoading() : ''}</div><div class="app-inspiration-modal-core"><div class="app-inspiration-modal-head"><div><span class="app-home-eyebrow"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> DISCOVERY</span><h2 id="appInspirationTitle">抽张知识灵感卡</h2><p>把熟悉的排序放一边，遇见一条可能没看过的知识。</p></div><button type="button" class="app-inspiration-close" data-home-inspiration-close aria-label="关闭"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div class="app-inspiration-draw-shell">${inspirationDrawContent(inspiration)}</div></div></dialog>
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
      api('/api/kb/entity_search', { order: 'modified_desc', limit: 24, hide_entity: '1', defined_class_only: '1' }),
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
    if (event.target.closest('[data-home-inspiration-open]')) { modal?.showModal(); void scoreInspiration(homeNodes[homeInspirationIndex]); return; }
    if (event.target.closest('[data-home-inspiration-close]')) { clearProfileCardSelection(modal); modal?.close(); return; }
    if (event.target.closest('[data-jev-profile-refresh]')) { void scoreInspiration(homeNodes[homeInspirationIndex], true); return; }
    if (event.target.closest('[data-jev-retry]')) { void scoreInspiration(homeNodes[homeInspirationIndex], true); return; }
    const profileCard = event.target.closest('.app-profile-node:not(.is-loading)');
    if (profileCard) { toggleProfileCard(profileCard); return; }
    if (event.target.closest('.app-inspiration-modal-core.is-profile-swapped')) { clearProfileCardSelection(modal, true); return; }
    if (modal?.querySelector('[data-jev-profile-layer].has-selection') && event.target.closest('[data-home-inspiration-modal]')) { clearProfileCardSelection(modal, true); return; }
    const inspire = event.target.closest('[data-home-inspire]');
    if (inspire && homeNodes.length) {
      let next = homeInspirationIndex;
      if (homeNodes.length > 1) while (next === homeInspirationIndex) next = Math.floor(Math.random() * homeNodes.length);
      homeInspirationIndex = next; homeDrawCount += 1;
      const shell = modal?.querySelector('.app-inspiration-draw-shell');
      if (shell) shell.innerHTML = inspirationDrawContent(homeNodes[homeInspirationIndex]);
      void scoreInspiration(homeNodes[homeInspirationIndex]);
      return;
    }
    const category = event.target.closest('[data-home-category]');
    if (category) {
      homeSelectedCategory = category.dataset.homeCategory || '';
      const version = ++homeVersion;
      byId('appHomeContent').classList.add('is-filtering');
      api('/api/kb/entity_search', { order: 'modified_desc', limit: 24, class_id: homeSelectedCategory, hide_entity: '1', defined_class_only: '1' }).then((data) => {
        if (version !== homeVersion) return;
        homeVisibleNodes = data.nodes || []; renderHome();
      }).catch(() => { if (version === homeVersion) { homeVisibleNodes = []; renderHome(); } });
      return;
    }
  });
  byId('appHomeContent').addEventListener('keydown', (event) => {
    const modal = byId('appHomeContent').querySelector('[data-home-inspiration-modal]');
    const card = event.target.closest?.('.app-profile-node:not(.is-loading)');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      toggleProfileCard(card);
      return;
    }
    if (event.target.closest?.('.app-inspiration-modal-core.is-profile-swapped') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      clearProfileCardSelection(modal, true);
      return;
    }
    if (event.key === 'Escape' && modal?.querySelector('[data-jev-profile-layer].has-selection')) {
      event.preventDefault();
      event.stopPropagation();
      clearProfileCardSelection(modal, true);
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
