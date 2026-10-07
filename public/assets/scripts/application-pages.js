(function () {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let homeVersion = 0, searchVersion = 0, typesVersion = 0, page = 1, total = 0;
  let currentHomeApplicationId = '';
  let homeApplication = null;
  let homeHoverCategory = '', homeHoverTimer;
  let homePage = 1, homeTotal = 0, homeBusy = false, homeError = '';
  const homePageSize = 24;
  let homeRetry = { page: 1, category: '' };
  let homeNodes = [], homeVisibleNodes = [], homeCategories = [], homeSelectedCategory = '', homeInspirationIndex = 0, homeDrawCount = 1;
  const inspirationScoreCache = new Map();
  let inspirationScoreVersion = 0;
  let activePortraitRoot = null;
  const portraitModal = () => activePortraitRoot || byId('appHomeContent').querySelector('[data-home-inspiration-modal]');
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
  function imageCandidates(value) {
    if (Array.isArray(value)) return value.flatMap(imageCandidates);
    if (value && typeof value === 'object') return imageCandidates(value.url || value.src || '');
    if (typeof value !== 'string') return [];
    const source = value.trim();
    if (source.startsWith('[') || source.startsWith('{')) { try { return imageCandidates(JSON.parse(source)); } catch { return []; } }
    return /^(https?:\/\/|\/(?!\/)|data:image\/)/i.test(source) ? [source] : [];
  }
  function firstImage(node) {
    return imageCandidates([node.image, node.images, node._attr_images])[0] || '';
  }
  function firstCover(node) {
    return imageCandidates([node.covers, node.cover, node.poster, ...(Array.isArray(node.videos) ? node.videos.map((video) => video?.poster || video?.cover) : [])])[0] || '';
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
  let homeDetailDrawer = null;
  let homeDetailMount = null;
  let homeDetailFlipLock = false;
  function getHomeDetailNodeList() {
    return homeVisibleNodes.length ? homeVisibleNodes : homeNodes;
  }
  function findHomeDetailIndex(id) {
    const list = getHomeDetailNodeList();
    return list.findIndex((item) => (item.id || item._id) === id);
  }
  function flipHomeDetail(direction = 1) {
    const list = getHomeDetailNodeList();
    if (!list.length) return;
    const currentId = byId('detailPanel')?.dataset.entityId || window.kbActiveDetailNodeId || '';
    const currentIndex = findHomeDetailIndex(currentId.replace(/^entity\//, ''));
    const startIndex = currentIndex >= 0 ? currentIndex : Math.floor(Math.random() * list.length);
    let nextIndex = startIndex;
    if (list.length > 1) {
      const candidates = list.map((_, index) => index).filter((index) => index !== startIndex);
      nextIndex = candidates[Math.floor(Math.random() * candidates.length)] || startIndex;
      if (direction !== 0 && currentIndex >= 0) {
        const stepIndex = (currentIndex + direction + list.length) % list.length;
        if (stepIndex !== currentIndex) nextIndex = stepIndex;
      }
    }
    const node = list[nextIndex];
    if (!node) return;
    openHomeDetailDrawer(node.id || node._id);
  }
  function restoreHomeDetailPanel() {
    const saved = homeDetailMount;
    homeDetailMount = null;
    if (!saved) return;
    saved.panel.querySelectorAll('video,audio,media-player').forEach((media) => { try { media.pause?.(); } catch {} });
    if (saved.panel.parentNode === homeDetailDrawer) {
      saved.marker.replaceWith(saved.panel);
      saved.panel.style.display = saved.display;
      saved.panel.classList.remove('app-home-detail-open');
    } else saved.marker.remove();
    if (saved.focus?.isConnected) saved.focus.focus({ preventScroll: true });
  }
  function closeHomeDetailDrawer() {
    window.homeKnowledgeMediaViewer?.close();
    if (homeDetailDrawer?.open) homeDetailDrawer.close();
    restoreHomeDetailPanel();
  }
  function openHomeDetailDrawer(id) {
    if (window.homeKnowledgeMediaViewer) { window.homeKnowledgeMediaViewer.open(id, { nodes: homeVisibleNodes, category: homeCategories.find((item) => item.id === homeSelectedCategory)?.name || '全部知识' }); return true; }
    const panel = byId('detailPanel');
    if (!panel || typeof window.showNodeDetailInline !== 'function') return false;
    if (!homeDetailDrawer) {
      homeDetailDrawer = document.createElement('dialog');
      homeDetailDrawer.id = 'homeKnowledgeDrawer';
      homeDetailDrawer.className = 'home-knowledge-drawer';
      homeDetailDrawer.setAttribute('aria-label', '知识详情');
      homeDetailDrawer.innerHTML = '<div class="home-knowledge-drawer-header"><div class="home-drawer-brand"><span class="home-drawer-mark" aria-hidden="true"><i class="fa-solid fa-bolt"></i></span><div><strong>知识 · 发现</strong><small>探索每一条知识背后的故事</small></div></div><button type="button" class="btn" data-close-home-detail aria-label="关闭知识详情"><span aria-hidden="true">×</span></button></div>';
      document.body.appendChild(homeDetailDrawer);
      homeDetailDrawer.addEventListener('close', () => { if (!homeDetailDrawer.open) restoreHomeDetailPanel(); document.body.style.overflow = ''; });
      homeDetailDrawer.addEventListener('click', (event) => {
        if (event.target === homeDetailDrawer) {
          const rect = homeDetailDrawer.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeHomeDetailDrawer();
        }
      });
      homeDetailDrawer.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-home-detail],#btnDetailBack')) {
          event.preventDefault(); event.stopImmediatePropagation(); closeHomeDetailDrawer();
        }
      }, true);
      homeDetailDrawer.addEventListener('wheel', (event) => {
        if (!homeDetailDrawer.open || homeDetailFlipLock) return;
        if (Math.abs(event.deltaY) < 12) return;
        event.preventDefault();
        homeDetailFlipLock = true;
        window.setTimeout(() => { homeDetailFlipLock = false; }, 420);
        flipHomeDetail(event.deltaY > 0 ? 1 : -1);
      }, { passive: false });
      document.addEventListener('keydown', (event) => {
        if (!homeDetailDrawer?.open) return;
        if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
          event.preventDefault();
          if (!homeDetailFlipLock) {
            homeDetailFlipLock = true;
            window.setTimeout(() => { homeDetailFlipLock = false; }, 420);
            flipHomeDetail(1);
          }
        }
        if (event.key === 'ArrowUp' || event.key === 'PageUp') {
          event.preventDefault();
          if (!homeDetailFlipLock) {
            homeDetailFlipLock = true;
            window.setTimeout(() => { homeDetailFlipLock = false; }, 420);
            flipHomeDetail(-1);
          }
        }
        if (event.key === 'Escape') {
          closeHomeDetailDrawer();
        }
      });
    }
    if (!homeDetailMount) {
      const marker = document.createComment('home detail panel original position');
      panel.before(marker);
      homeDetailMount = { panel, marker, display: panel.style.display, focus: document.activeElement };
      homeDetailDrawer.appendChild(panel);
    }
    panel.style.display = 'flex';
    panel.classList.add('app-home-detail-open');
    document.body.style.overflow = 'hidden';
    if (!homeDetailDrawer.open) homeDetailDrawer.showModal();
    void window.showNodeDetailInline(id, { preserveSidebarState: true });
    return true;
  }

  function openHomeNodeDetail(node) {
    const id = node?.id || node?._id;
    if (!id) return;
    if (openHomeDetailDrawer(id)) return;
    if (typeof window.setViewMode === 'function') {
      window.setViewMode('detail', { targetNodeId: id, focusDetailOnly: true, skipRouteUpdate: true });
      return;
    }
    const url = new URL(location.href);
    url.searchParams.delete('node'); url.searchParams.delete('view');
    url.hash = new URLSearchParams({ view: 'knowledge_detail', node: id });
    location.hash = url.hash;
  }
  function homeKnowledgeCard(node) {
    const image = firstImage(node);
    const video = firstVideo(node);
    const cover = image || firstCover(node);
    const title = node.name || node.label || node.id;
    const id = node.id || node._id || '';
    return `<article class="app-home-knowledge-card" data-home-node-id="${escape(id)}">
      <button type="button" class="app-home-card-media${cover || video ? '' : ' is-placeholder'}" data-home-node-id="${escape(id)}" aria-label="查看 ${escape(title)}">${cover ? `<img src="${escape(cover)}" alt="" loading="lazy">` : video ? `<video src="${escape(video)}" muted playsinline preload="metadata"></video><span class="app-media-type"><i class="fa-solid fa-play" aria-hidden="true"></i> 视频</span>` : '<i class="fa-solid fa-lightbulb" aria-hidden="true"></i>'}</button>
      <div class="app-home-card-body"><div class="app-home-card-meta"><span>${escape(node.typeLabel || node.type || '知识实体')}</span><time>${escape(shortDate(node.updated_at || node.created_at))}</time></div><button type="button" class="app-home-card-title" data-home-node-id="${escape(id)}">${escape(title)}</button><div class="app-home-card-footer"><span class="app-home-card-id">${escape(id)}</span><span>查看详情 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div></div>
    </article>`;
  }
  function applicationBanner() {
    const project = homeApplication || {};
    const name = String(project.title || project.name || byId('headerProjectName')?.textContent || '应用首页').trim();
    const description = String(project.description || '').trim();
    const background = String(project.banner_image || '').trim();
    const hasBackground = /^(https?:\/\/|\/(?!\/))/i.test(background);
    if (!hasBackground) return '';
    return `<section class="app-home-banner${hasBackground ? ' has-background' : ''}" aria-label="当前应用">
      ${hasBackground ? `<img class="app-home-banner-background" src="${escape(background)}" alt="" />` : ''}
      <div class="app-home-banner-content"><h1>${escape(name)}</h1>${description ? `<p>${escape(description)}</p>` : ''}</div>
    </section>`;
  }
  function applicationSidebarBrand() {
    const project = homeApplication || {};
    const name = String(project.title || project.name || byId('headerProjectName')?.textContent || '应用首页').trim();
    const initials = (name || '应用').replace(/\s+/g, '').slice(0, 2).toUpperCase();
    const image = typeof project.image === 'string' && /^(https?:\/\/|\/(?!\/)|data:image\/)/i.test(project.image.trim()) ? project.image.trim() : '';
    return `<div class="app-home-rail-brand" aria-label="当前应用 Logo">
      <div class="app-home-rail-brandmark"><span aria-hidden="true">${escape(initials)}</span>${image ? `<img src="${escape(image)}" alt="${escape(name)} Logo" loading="lazy" onerror="this.remove()">` : ''}</div>
    </div>`;
  }
  function homeCategoryNavigation() {
    const byId = new Map(homeCategories.map((item) => [String(item.id), item]));
    const children = (id) => homeCategories.filter((item) => String(item.parent_id || item.parent || '') === id);
    const ancestry = [], seen = new Set(); let current = byId.get(String(homeHoverCategory));
    while (current && !seen.has(String(current.id))) { seen.add(String(current.id)); ancestry.unshift(current); current = byId.get(String(current.parent_id || current.parent || '')); }
    const chip = (item) => {
      const id = String(item.id), active = id === String(homeSelectedCategory);
      return '<button type="button" class="home-category-chip' + (active ? ' is-active' : seen.has(id) ? ' is-ancestor' : '') + '" data-home-category="' + escape(id) + '" aria-pressed="' + active + '"><span>' + escape(item.name || item.label || id) + '</span><small>' + (Number(item.instance_count) || 0) + '</small></button>';
    };
    const roots = homeCategories.filter((item) => !byId.has(String(item.parent_id || item.parent || '')));
    const all = '<button type="button" class="home-category-chip' + (!homeSelectedCategory ? ' is-active' : '') + '" data-home-category="" aria-pressed="' + !homeSelectedCategory + '">全部知识</button>';
    const rows = ['<div class="home-category-level"><span class="home-category-level-label">分类</span><div>' + all + roots.map(chip).join('') + '</div></div>'];
    const subRows = [];
    for (const parent of ancestry) {
      const items = children(String(parent.id)); if (!items.length) continue;
      subRows.push('<div class="home-category-level"><span class="home-category-level-label" title="' + escape(parent.name || parent.id) + '">' + escape(parent.name || parent.id) + '</span><div>' + items.map(chip).join('') + '</div></div>');
    }
    return '<nav class="home-category-navigation" aria-label="知识分类筛选">' + rows.join('') + '<div class="home-category-submenu"' + (subRows.length ? '' : ' hidden') + '>' + subRows.join('') + '</div></nav>';
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
    if (!node) return '<div class="app-inspiration-empty"><i class="fa-regular fa-lightbulb" aria-hidden="true"></i><strong>当前筛选暂无知识</strong><span>请选择其他分类后查看知识画像。</span></div>';
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
  function readableProfileValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(readableProfileValue).filter(Boolean).join('；');
    if (typeof value !== 'object') return String(value);
    if (value.datavalue?.value !== undefined) return readableProfileValue(value.datavalue.value);
    const id = String(value.id || value['entity-id'] || value.entity_id || value.target || '').replace(/^entity\//, '');
    const label = String(value.label_zh || value.entity_label_zh || value.label || value.name || '').trim();
    if (id) return label ? `${label}（${id}）` : id;
    if (typeof value.text === 'string') return `${value.text}${value.language ? `（${value.language}）` : ''}`;
    if (value.time) return String(value.time).replace(/^\+/, '').replace(/T00:00:00Z$/, '');
    if (value.amount != null) return `${value.amount}${value.unit && value.unit !== '1' ? ` ${value.unit}` : ''}`;
    if (value.latitude != null && value.longitude != null) return `${value.latitude}, ${value.longitude}`;
    const ignored = new Set(['precision', 'calendar', 'calendarmodel', 'globe', 'entity-type', 'numeric-id']);
    return Object.entries(value).filter(([key, nested]) => !ignored.has(key.toLowerCase()) && nested != null && nested !== '').map(([key, nested]) => `${key}：${readableProfileValue(nested)}`).join('；');
  }
  function formatProfileEvidence(value) {
    const text = String(value || '').trim();
    if (!text) return '未提供明确证据';
    const candidates = [0, text.indexOf('：') + 1, text.indexOf(':') + 1].filter((index, position, values) => index >= 0 && values.indexOf(index) === position);
    for (const start of candidates) {
      const source = text.slice(start).trim();
      if (!source || !['{', '['].includes(source[0])) continue;
      try {
        const readable = readableProfileValue(JSON.parse(source));
        if (readable) return `${text.slice(0, start)}${readable}`;
      } catch {}
    }
    if (/(?:^|：|:)\s*[{[]/.test(text)) return text.replace(/\\?"(?:entity-type|numeric-id|precision|calendarmodel|globe)\\?"\s*:\s*[^,}\]]+,?/gi, '').replace(/[{}\[\]"]/g, '').replace(/\s*,\s*/g, '；').replace(/\s*:\s*/g, '：');
    return text;
  }
  function revealJevProfile(profiles, meta = {}) {
    const layer = portraitModal()?.querySelector('[data-jev-profile-layer]');
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
      const evidenceList = Array.isArray(profile.evidence) ? profile.evidence.map(formatProfileEvidence) : [];
      const evidence = evidenceList[0] || '未命中明确属性证据';
      const keywordEvidence = Array.isArray(profile.keywordEvidence) ? profile.keywordEvidence : [];
      const orderedKeywords = [...keywordEvidence].sort((left, right) => Number(Boolean(right.matched)) - Number(Boolean(left.matched)));
      const relatedEvidence = Array.isArray(profile.relatedEvidence) ? profile.relatedEvidence.map((item) => ({ ...item, evidence: formatProfileEvidence(item?.evidence) })) : [];
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
        <div class="app-profile-keywords">${orderedKeywords.map((item) => `<mark class="${item.matched ? 'is-hit' : ''}">${escape(item.keyword)}</mark>`).join('')}</div>
        <div class="app-profile-evidence"><span><i class="fa-solid fa-link" aria-hidden="true"></i> 核心证据 <small>${evidenceList.length || 1} 条</small></span>${(evidenceList.length ? evidenceList : [evidence]).map((item, evidenceIndex) => `<p title="${escape(item)}"><b>${String(evidenceIndex + 1).padStart(2, '0')}</b><span>${escape(item)}</span></p>`).join('')}</div>
        ${relatedEvidence.length ? `<div class="app-profile-related"><div><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> 关联知识 <small>${relatedEvidence.length} 条</small></div>${relatedEvidence.map((item) => `<span title="${escape(item.evidence)}"><i class="fa-solid fa-arrow-turn-up" aria-hidden="true"></i><strong>${escape(item.sourceName)}</strong><b>${escape(item.relation)}</b><em>${item.evidence ? escape(item.evidence) : ''}</em></span>`).join('')}</div>` : ''}
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
  function groupIncomingEntities(relations, targetId) {
    const groups = new Map();
    const normalize = id => String(id || '').replace(/^entity\//, '');
    for (const relation of relations || []) {
      const source = relation.source, id = normalize(source?.id || source?._id);
      if (!id || id === normalize(targetId)) continue;
      if (!groups.has(id)) groups.set(id, { source, relations: new Map() });
      const key = String(relation.propertyId || relation.propertyName || '关联');
      groups.get(id).relations.set(key, relation.propertyName || relation.propertyId || '关联');
    }
    return [...groups.values()].map(group => ({ source: group.source, relations: [...group.relations.values()] }));
  }
  async function showIncomingPortrait(node, layer, version) {
    if (!layer) return;
    layer.hidden = false; layer.classList.remove('has-selection');
    layer.classList.add('is-visible');
    layer.innerHTML = '<div class="app-profile-empty" role="status">正在读取指向该知识的关联实体…</div>';
    try {
      const data = await api('/api/kb/node', { id: node.id || node._id });
      if (version !== inspirationScoreVersion || !layer.isConnected) return;
      const groups = groupIncomingEntities(data.incomingRelations, node.id || node._id);
      if (!groups.length) { layer.innerHTML = '<div class="app-profile-empty" role="status">暂无指向该知识的关联实体</div>'; return; }
      const corners = Array.from({ length: 4 }, () => []);
      groups.forEach((group, index) => corners[index % 4].push(group));
      layer.innerHTML = corners.map((items, index) => `<article class="app-profile-node app-incoming-portrait" style="--profile-index:${index}" aria-label="关联实体分组 ${index + 1}"><div class="app-profile-card-head"><span>指向当前知识</span><span>${items.length} 个实体</span></div><div class="app-incoming-entities">${items.map(({ source, relations }) => `<section class="app-incoming-entity"><a href="${escape(nodeUrl(source))}">${escape(source.name || source.label || source.id || source._id)}</a><p>${escape(source.description || source.desc_zh || '暂无描述')}</p><div>${relations.map(relation => `<span>${escape(relation)} → ${escape(node.name || node.label || node.id)}</span>`).join('')}</div></section>`).join('') || '<p class="muted">暂无更多关联实体</p>'}</div></article>`).join('');
    } catch (error) {
      if (version !== inspirationScoreVersion || !layer.isConnected) return;
      layer.innerHTML = `<div class="app-profile-empty" role="status">${escape(error.message || '关联实体加载失败')}<button type="button" class="btn" data-jev-retry>重试</button></div>`;
    }
  }
  async function scoreInspiration(node, force = false) {
    const version = ++inspirationScoreVersion;
    if (!node) return;
    const modal = portraitModal();
    const rating = modal?.querySelector(`[data-jev-rating][data-node-id="${CSS.escape(String(node.id || node._id || ''))}"]`);
    const profileLayer = modal?.querySelector('[data-jev-profile-layer]');
    if (!rating) {
      return showIncomingPortrait(node, profileLayer, version);
    }
    rating.hidden = false;
    const database = new URLSearchParams(location.search).get('db') || 'default';
    const cacheKey = `${database}:${node.id || node._id}`;
    if (!force && inspirationScoreCache.has(cacheKey)) return revealJevScore(rating, inspirationScoreCache.get(cacheKey));
    if (force) inspirationScoreCache.delete(cacheKey);
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
        return showIncomingPortrait(node, profileLayer, version);
      }
      rating.classList.remove('is-loading'); rating.classList.add('is-error');
      rating.querySelector('[data-jev-status]').textContent = error.message || '评分暂不可用';
      rating.querySelector('[data-jev-retry]').hidden = false;
      if (profileLayer) { profileLayer.innerHTML = `<div class="app-profile-empty">${escape(error.message || '画像分析暂不可用')}</div>`; profileLayer.classList.add('is-visible'); }
    }
  }
  function openPortraitViewer(node) {
    const root = document.createElement('div');
    root.dataset.portraitContent = ''; root.dataset.homeInspirationModal = '';
    root.className = 'home-viewer-portrait';
    root.innerHTML = '<div class="app-inspiration-profile-layer" data-jev-profile-layer></div><div data-portrait-rating hidden></div>';
    let current = node;
    root.addEventListener('click', event => {
      if (event.target.closest('[data-jev-profile-refresh],[data-jev-retry]')) { void scoreInspiration(current, true); return; }
      if (event.target.closest('a')) return;
      const card = event.target.closest('.app-profile-node:not(.is-loading):not(.app-incoming-portrait)');
      if (card) { const expanded = card.classList.toggle('is-portrait-expanded'); card.setAttribute('aria-pressed', String(expanded)); }
    });
    root.addEventListener('keydown', event => {
      const card = event.target.closest('.app-profile-node[role="button"]');
      if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); }
    });
    window.homeKnowledgeMediaViewer.open(node.id || node._id, {
      nodes: homeVisibleNodes, category: '知识画像',
      portrait: {
        element: root,
        onNodeChange(loaded) {
          activePortraitRoot = root; current = loaded;
          homeInspirationIndex = homeVisibleNodes.findIndex(item => (item.id || item._id) === (loaded.id || loaded._id));
          const template = document.createElement('template');
          template.innerHTML = inspirationCard(loaded);
          const rating = template.content.querySelector('[data-jev-rating]');
          root.querySelector('[data-portrait-rating]').replaceChildren(...(rating ? [rating] : []));
          void scoreInspiration(loaded);
        },
        onClose() { inspirationScoreVersion++; if (activePortraitRoot === root) activePortraitRoot = null; root.remove(); },
      },
    });
    activePortraitRoot = root;
  }
  function pickHomeInspiration(avoidCurrent = false) {
    const count = homeVisibleNodes.length;
    if (!count) { homeInspirationIndex = 0; return null; }
    const current = homeInspirationIndex;
    if (avoidCurrent && count > 1 && current >= 0 && current < count) {
      const next = Math.floor(Math.random() * (count - 1));
      homeInspirationIndex = next >= current ? next + 1 : next;
    } else homeInspirationIndex = Math.floor(Math.random() * count);
    return homeVisibleNodes[homeInspirationIndex];
  }
  function inspirationDrawContent(node) {
    const drawStep = ((homeDrawCount - 1) % 10) + 1;
    return `<div class="app-inspiration-progress"><div><span>第 <strong>${drawStep}</strong> 抽</span><small>${drawStep}/10</small></div><div class="app-inspiration-progress-track">${Array.from({ length: 10 }, (_, index) => `<i class="${index < drawStep ? 'is-active' : ''}"></i>`).join('')}</div></div>${inspirationCard(node)}<button type="button" class="btn app-inspiration-draw" data-home-inspire ${homeVisibleNodes.length ? '' : 'disabled'}><i class="fa-solid fa-rotate" aria-hidden="true"></i> ${homeDrawCount > 1 ? '再抽一张' : '抽取画像'}</button>`;
  }
  function homePagination() {
    const pages = Math.max(1, Math.ceil(homeTotal / homePageSize));
    return '<nav class="app-home-pagination" aria-label="知识列表分页">' +
      '<span role="status">共 ' + homeTotal + ' 条 · 第 ' + homePage + ' / ' + pages + ' 页</span>' +
      '<div><button class="btn" data-home-page="1" ' + (homeBusy || homePage <= 1 ? 'disabled' : '') + '>首页</button>' +
      '<button class="btn" data-home-page="' + (homePage - 1) + '" ' + (homeBusy || homePage <= 1 ? 'disabled' : '') + '>上一页</button>' +
      '<button class="btn" data-home-page="' + (homePage + 1) + '" ' + (homeBusy || homePage >= pages ? 'disabled' : '') + '>下一页</button>' +
      '<button class="btn" data-home-page="' + pages + '" ' + (homeBusy || homePage >= pages ? 'disabled' : '') + '>末页</button></div></nav>' +
      (homeBusy ? '<p role="status">正在加载知识…</p>' : homeError ? '<p role="alert">' + escape(homeError) + ' <button class="btn" data-home-page-retry>重试</button></p>' : '');
  }
  async function loadHomePage(nextPage = 1, category = homeSelectedCategory) {
    const version = ++homeVersion;
    homeBusy = true; homeError = ''; homeRetry = { page: nextPage, category }; renderHome();
    try {
      const data = await api('/api/kb/entity_search', { order: 'modified_desc', limit: homePageSize, offset: (nextPage - 1) * homePageSize, class_id: category, hide_entity: '1', defined_class_only: '1' });
      if (version !== homeVersion) return;
      const count = Math.max(0, Number(data.total) || 0);
      const lastPage = Math.max(1, Math.ceil(count / homePageSize));
      if (nextPage > lastPage) return loadHomePage(lastPage, category);
      homePage = nextPage; homeTotal = count; homeSelectedCategory = category;
      homeNodes = homeVisibleNodes = data.nodes || []; homeBusy = false; renderHome();

    } catch (error) {
      if (version !== homeVersion) return;
      homeBusy = false; homeError = error.message || '加载失败'; renderHome();
    }
  }
  function renderHome(nodes = homeVisibleNodes) {
    const content = byId('appHomeContent');
    if (!content) return;
    const scrollPanel = byId('applicationHomePanel');
    const scrollTop = scrollPanel?.scrollTop || 0;
    content.classList.remove('is-filtering');
    homeVisibleNodes = nodes;
    homeInspirationIndex = homeVisibleNodes.length ? homeInspirationIndex % homeVisibleNodes.length : 0;
    const inspiration = homeVisibleNodes[homeInspirationIndex] || null;
    const showJev = Boolean(inspiration?.hasJevAnalysis || window.authUser?.hasJevApiKey);
    const activeCategory = homeCategories.find((item) => item.id === homeSelectedCategory);
    content.innerHTML = `
      <dialog class="app-inspiration-modal" data-home-inspiration-modal aria-label="知识画像"><div class="app-inspiration-profile-layer" data-jev-profile-layer ${showJev ? '' : 'hidden'}>${showJev ? profileLoading() : ''}</div><div class="app-inspiration-modal-core"><button type="button" class="app-inspiration-close" data-home-inspiration-close aria-label="关闭"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button><div class="app-inspiration-draw-shell">${inspirationDrawContent(inspiration)}</div></div></dialog>
      <div class="app-home-workspace app-home-workspace--horizontal">
      <section class="app-knowledge-panel">${applicationBanner()}${homeCategoryNavigation()}<div class="app-home-section-heading compact app-knowledge-list-heading"><div><h2>${escape(activeCategory?.name || '知识列表')}</h2></div><div class="app-knowledge-list-actions"><span class="app-list-count">共 ${homeTotal} 条 · 本页 ${nodes.length} 条</span><button id="knowledgeRoamLaunch" type="button" class="btn" data-home-roam-open data-home-roam-class="${escape(homeSelectedCategory)}"><i class="fa-solid fa-route" aria-hidden="true"></i><span>知识漫游</span></button><button type="button" class="btn" data-home-inspiration-open><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>知识画像</span></button></div></div><div class="app-home-knowledge-grid">${nodes.map(homeKnowledgeCard).join('') || '<div class="app-home-empty"><i class="fa-solid fa-inbox" aria-hidden="true"></i><strong>该分类暂无知识</strong><span>选择其他分类，或创建一条新知识。</span></div>'}</div>${homePagination()}</section></div>`;
    if (scrollPanel) scrollPanel.scrollTop = scrollTop;
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
  window.addEventListener('kb-application-updated', (event) => {
    const updated = event.detail;
    if (!homeApplication || updated?.slug !== homeApplication.slug) return;
    homeApplication = { ...homeApplication, ...updated };
    if (window.kbViewMode === 'app_home') renderHome();
  });
  window.closeHomeDetailDrawer = closeHomeDetailDrawer;
  window.addEventListener('hashchange', closeHomeDetailDrawer);
  window.loadApplicationHome = async function () {
    const version = ++homeVersion;
    byId('appHomeName').textContent = byId('headerProjectName')?.textContent.trim() || '应用首页';
    byId('appHomeContent').innerHTML = '<p class="muted">正在加载应用知识…</p>';
    homeHoverCategory = '';
    homeSelectedCategory = ''; homePage = 1; homeTotal = 0; homeBusy = false; homeError = '';
    const results = await Promise.allSettled([
      api('/api/kb/entity_search', { order: 'modified_desc', limit: homePageSize, offset: 0, hide_entity: '1', defined_class_only: '1' }),
      api('/api/kb/classes'),
      api('/api/applications', { scope: 'market' }),
    ]);
    if (version !== homeVersion) return;
    homeNodes = results[0].status === 'fulfilled' ? results[0].value.nodes || [] : [];
    homeVisibleNodes = homeNodes;
    homeTotal = results[0].status === 'fulfilled' ? Number(results[0].value.total) || 0 : 0;
    homeError = results[0].status === 'rejected' ? '知识加载失败' : '';
    homeRetry = { page: 1, category: '' };
    homeCategories = results[1].status === 'fulfilled' ? results[1].value || [] : [];
    const currentSlug = new URLSearchParams(location.search).get('db') || 'default';
    homeApplication = results[2].status === 'fulfilled'
      ? (results[2].value.projects || []).find((project) => project.slug === currentSlug) || null
      : null;
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
  function revealCategoryChildren(event) {
    if (event.target.closest('.home-category-navigation')) clearTimeout(homeHoverTimer);
    const chip = event.target.closest('[data-home-category]');
    if (!chip) return;
    clearTimeout(homeHoverTimer);
    const id = chip.dataset.homeCategory || '';
    if (id === homeHoverCategory) return;
    homeHoverCategory = id;
    const nav = chip.closest('.home-category-navigation');
    if (!nav) return;
    const template = document.createElement('template'); template.innerHTML = homeCategoryNavigation();
    const next = template.content.querySelector('.home-category-submenu');
    const focusedId = event.type === 'focusin' ? id : null;
    nav.querySelector('.home-category-submenu')?.replaceWith(next);
    if (focusedId !== null && !chip.isConnected) {
      Array.from(nav.querySelectorAll('[data-home-category]')).find((item) => item.dataset.homeCategory === focusedId)?.focus({ preventScroll: true });
    }
  }
  byId('appHomeContent').addEventListener('mouseover', revealCategoryChildren);
  byId('appHomeContent').addEventListener('focusin', revealCategoryChildren);
  byId('appHomeContent').addEventListener('mouseout', (event) => {
    const nav = event.target.closest('.home-category-navigation');
    if (!nav || nav.contains(event.relatedTarget)) return;
    homeHoverTimer = setTimeout(() => { homeHoverCategory = ''; const submenu = byId('appHomeContent').querySelector('.home-category-submenu'); if (submenu) submenu.hidden = true; }, 180);
  });
  byId('appHomeContent').addEventListener('click', (event) => {
    const paging = event.target.closest('[data-home-page]');
    if (paging) { if (!homeBusy && !paging.disabled) void loadHomePage(Number(paging.dataset.homePage)); return; }
    if (event.target.closest('[data-home-page-retry]')) { void loadHomePage(homeRetry.page, homeRetry.category); return; }
    const modal = byId('appHomeContent').querySelector('[data-home-inspiration-modal]');
    const homeNodeButton = event.target.closest('[data-home-node-id]');
    if (homeNodeButton) {
      const node = homeNodes.find((item) => (item.id || item._id) === homeNodeButton.dataset.homeNodeId) || homeVisibleNodes.find((item) => (item.id || item._id) === homeNodeButton.dataset.homeNodeId);
      if (node) {
        openHomeNodeDetail(node);
      }
      return;
    }
    if (event.target.closest('[data-home-inspiration-open]')) {
      const node = pickHomeInspiration(); homeDrawCount = 1;
      if (node && window.homeKnowledgeMediaViewer) { openPortraitViewer(node); return; }
      clearProfileCardSelection(modal);
      const shell = modal?.querySelector('.app-inspiration-draw-shell');
      if (shell) shell.innerHTML = inspirationDrawContent(node);
      modal?.showModal(); void scoreInspiration(node); return;
    }
    if (event.target.closest('[data-home-inspiration-close]')) { clearProfileCardSelection(modal); modal?.close(); return; }
    if (event.target.closest('[data-jev-profile-refresh]')) { void scoreInspiration(homeVisibleNodes[homeInspirationIndex], true); return; }
    if (event.target.closest('[data-jev-retry]')) { void scoreInspiration(homeVisibleNodes[homeInspirationIndex], true); return; }
    const profileCard = event.target.closest('.app-profile-node:not(.is-loading):not(.app-incoming-portrait)');
    if (profileCard) { toggleProfileCard(profileCard); return; }
    if (event.target.closest('.app-inspiration-modal-core.is-profile-swapped')) { clearProfileCardSelection(modal, true); return; }
    if (modal?.querySelector('[data-jev-profile-layer].has-selection') && event.target.closest('[data-home-inspiration-modal]')) { clearProfileCardSelection(modal, true); return; }
    const inspire = event.target.closest('[data-home-inspire]');
    if (inspire && homeVisibleNodes.length) {
      pickHomeInspiration(true); homeDrawCount += 1;
      const shell = modal?.querySelector('.app-inspiration-draw-shell');
      if (shell) shell.innerHTML = inspirationDrawContent(homeVisibleNodes[homeInspirationIndex]);
      void scoreInspiration(homeVisibleNodes[homeInspirationIndex]);
      return;
    }
    const category = event.target.closest('[data-home-category]');
    if (category) {
      event.preventDefault();
      clearTimeout(homeHoverTimer); homeHoverCategory = '';
      void loadHomePage(1, category.dataset.homeCategory || '');
      return;
    }
  });
  byId('appHomeContent').addEventListener('keydown', (event) => {
    const modal = byId('appHomeContent').querySelector('[data-home-inspiration-modal]');
    const card = event.target.closest?.('.app-profile-node:not(.is-loading):not(.app-incoming-portrait)');
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
  byId('appSearchResults').addEventListener('click', (event) => { if (event.target.closest('[data-search-retry]')) search(); });
  const refresh = () => { homeVersion++; searchVersion++; if (window.kbViewMode === 'app_home') window.loadApplicationHome(); if (window.kbViewMode === 'app_search') window.loadApplicationSearch(); };
  window.addEventListener('kb-auth-change', refresh);
  window.addEventListener('popstate', () => { if (window.kbViewMode === 'app_search') window.loadApplicationSearch(); });
  new MutationObserver(() => { byId('appHomeName').textContent = byId('headerProjectName').textContent.trim() || '应用首页'; }).observe(byId('headerProjectName'), { childList: true, subtree: true, characterData: true });
  refresh();
})();
