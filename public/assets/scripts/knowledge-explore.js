(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function buildExploreTree(rows) {
    const byId = new Map();
    for (const row of rows) {
      const id = String(row.id || '');
      if (id && !byId.has(id)) byId.set(id, { ...row, id, parent_id: String(row.parent_id || row.parent || '') });
    }
    const children = new Map();
    for (const row of byId.values()) {
      const seen = new Set([row.id]);
      let parent = row.parent_id;
      while (parent && byId.has(parent) && !seen.has(parent)) {
        seen.add(parent); parent = byId.get(parent).parent_id;
      }
      if (!byId.has(row.parent_id) || (parent && seen.has(parent))) row.parent_id = '';
      if (!children.has(row.parent_id)) children.set(row.parent_id, []);
      children.get(row.parent_id).push(row);
    }
    return { byId, children, roots: children.get('') || [] };
  }
  const panel = document.createElement('section');
  panel.id = 'knowledgeExplorePage';
  panel.setAttribute('aria-label', '探索知识分类');
  document.getElementById('applicationHomePanel').append(panel);
  const pinKey = () => 'kb:pinned-types:' + (window.authUser?.id || 'anonymous') + ':' + (window.getCurrentDbParam() || 'default');
  function readPins() { try { const value = JSON.parse(localStorage.getItem(pinKey()) || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string') : []; } catch { return []; } }
  const pinNav = document.createElement('nav'); pinNav.className = 'home-discovery-nav home-pinned-types'; pinNav.setAttribute('aria-label', '\u5df2\u52a0\u5165\u7684\u7c7b\u578b');
  document.querySelector('.home-discovery-footer')?.before(pinNav);
  let draggedPin = null, suppressPinClickUntil = 0;
  const pinStatus=document.createElement('span');pinStatus.className='pin-sort-status';pinStatus.setAttribute('role','status');pinStatus.setAttribute('aria-live','polite');pinNav.after(pinStatus);
  let pinsLoadedKey = '', pinSaveQueue = Promise.resolve();
  function writePins(pins) {
    try { localStorage.setItem(pinKey(),JSON.stringify(pins)); }
    catch { throw Error('类型列表无法保存在此浏览器'); }
  }
  async function joinedTypesRequest(method='GET', typeIds) {
    const url = new URL('/api/account/joined-types', location.origin);
    const db = window.getCurrentDbParam();
    if (db) url.searchParams.set('db',db);
    const response = await fetch(url,{method,credentials:'include',headers:typeIds?{'Content-Type':'application/json'}:undefined,body:typeIds?JSON.stringify({typeIds}):undefined});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw Error(data.error || `类型同步失败（${response.status}）`);
    return data.types;
  }
  async function loadJoinedTypes() {
    const key=pinKey();
    if (!window.authUser?.id || pinsLoadedKey===key) return;
    try {
      let types=await joinedTypesRequest();
      if(key!==pinKey())return;
      const cached=readPins();
      if(!types.length && cached.length) types=await joinedTypesRequest('PUT',cached.map(item=>item.id));
      if(key!==pinKey())return;
      writePins(types);
      pinsLoadedKey=key;
      render();
    } catch(error) {
      if(key!==pinKey())return;
      pinStatus.textContent=`类型同步失败，保留本机列表：${error.message}`;
      renderPins();
    }
  }
  function savePins(pins, successMessage) {
    const key=pinKey();
    if(!window.authUser?.id) {
      try { writePins(pins); render(); pinStatus.textContent='已保存在此浏览器，登录后可同步到其他设备'; }
      catch(error) { pinStatus.textContent=error.message; }
      return;
    }
    pinStatus.textContent='正在保存已加入的类型…';
    pinSaveQueue=pinSaveQueue.catch(()=>{}).then(async()=>{
      if(key!==pinKey())return;
      await loadJoinedTypes();
      if(key!==pinKey())return;
      const types=await joinedTypesRequest('PUT',pins.map(item=>item.id));
      if(key!==pinKey())return;
      writePins(types);
      pinsLoadedKey=key;
      render();
      pinStatus.textContent=successMessage;
    }).catch(error=>{
      if(key===pinKey())pinStatus.textContent=`保存失败：${error.message}`;
    });
  }
  async function movePin(id, targetId, after=false) {
    await loadJoinedTypes();
    const pins=readPins();const index=pins.findIndex(item=>item.id===id);
    if(index<0 || id===targetId)return;
    const [item]=pins.splice(index,1);const target=pins.findIndex(item=>item.id===targetId);
    if(target<0)return;pins.splice(target+(after?1:0),0,item);
    savePins(pins,'\u987a\u5e8f\u5df2\u4fdd\u5b58');
  }
  function renderPins() {
    pinNav.replaceChildren();
    for (const item of readPins()) {
      const button = document.createElement('button'); button.type = 'button'; button.title = item.name;
      const icon = document.createElement('i'); icon.className = 'fa-solid fa-tag'; icon.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.textContent = item.name; button.append(icon, label);
      if (window.kbViewMode === 'joined_type' && selected === item.id) button.setAttribute('aria-current','page');
      button.draggable=true;button.dataset.pinId=item.id;
      button.title=item.name+' \u00b7 \u62d6\u52a8\u6392\u5e8f';
      button.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown');
      button.addEventListener('dragstart',event=>{
        draggedPin={id:item.id,key:pinKey()};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id);button.classList.add('is-dragging');
      });
      button.addEventListener('dragover',event=>{
        if(!draggedPin || draggedPin.key!==pinKey() || draggedPin.id===item.id)return;
        event.preventDefault();event.dataTransfer.dropEffect='move';
        const after=event.clientY>button.getBoundingClientRect().top+button.offsetHeight/2;
        button.classList.toggle('pin-drop-after',after);button.classList.toggle('pin-drop-before',!after);
      });
      button.addEventListener('dragleave',()=>button.classList.remove('pin-drop-before','pin-drop-after'));
      button.addEventListener('drop',event=>{
        if(!draggedPin || draggedPin.key!==pinKey())return;
        event.preventDefault();event.stopPropagation();suppressPinClickUntil=Date.now()+300;
        movePin(draggedPin.id,item.id,event.clientY>button.getBoundingClientRect().top+button.offsetHeight/2);draggedPin=null;
      });
      button.addEventListener('dragend',()=>{
        draggedPin=null;suppressPinClickUntil=Date.now()+300;
        pinNav.querySelectorAll('button').forEach(node=>node.classList.remove('is-dragging','pin-drop-before','pin-drop-after'));
      });
      button.addEventListener('keydown',event=>{
        if(!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key))return;
        event.preventDefault();const pins=readPins(),index=pins.findIndex(pin=>pin.id===item.id),down=event.key==='ArrowDown',target=pins[index+(down?1:-1)];
        if(!target)return;void movePin(item.id,target.id,down);
        Array.from(pinNav.querySelectorAll('button')).find(node=>node.dataset.pinId===item.id)?.focus();
      });
      button.onclick = () => {
        if(Date.now()<suppressPinClickUntil)return;
        const url = window.projectViewUrl('joined_type'); url.searchParams.set('type_id', item.id); url.searchParams.delete('explore_category'); url.searchParams.delete('explore_tag'); url.searchParams.delete('explore_page');
        history.pushState(null, '', url); window.setViewMode('joined_type');
      };
      pinNav.append(button);
    }
    pinNav.hidden = !pinNav.childElementCount;
  }
  let selectedTag = '';
  let tree = buildExploreTree([]), selected = '', items = [], total = 0, page = 1;
  let loadingTree = false, loadingItems = false, treeError = '', itemsError = '', treeVersion = 0, itemsVersion = 0;
  const pageSize = 12;
  let treeReady = false, loadedDatabase = null, savedScrollTop = 0;
  let exhausted = false, scrollTimer = 0, retryPage = 1, retryAppend = false;
  function writeExploreRoute() {
    if(!['app_explore','joined_type'].includes(window.kbViewMode))return;
    const url=new URL(location.href);
    const categoryKey = window.kbViewMode === 'joined_type' ? 'type_id' : 'explore_category';
    if(selected)url.searchParams.set(categoryKey,selected);else url.searchParams.delete(categoryKey);
    if(selectedTag)url.searchParams.set('explore_tag',selectedTag);else url.searchParams.delete('explore_tag');
    if((selected||selectedTag)&&page>1)url.searchParams.set('explore_page',String(page));else url.searchParams.delete('explore_page');
    window.history.replaceState(window.history.state,'',url);
  }
  const name = row => row?.name || row?.label || row?.id || selectedTag;
  const childrenOf = id => tree.children.get(id) || [];
  function rootOf(id) {
    let row = tree.byId.get(id);
    while (row && tree.byId.has(row.parent_id)) row = tree.byId.get(row.parent_id);
    return row?.id || '';
  }
  const imageUrl = value => typeof value === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(value.trim()) ? value.trim() : '';
  async function api(path, params = {}) {
    const url = new URL(path, location.origin);
    const db = window.getCurrentDbParam();
    if (db) url.searchParams.set('db', db);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw Error(`加载失败（${response.status}）`);
    return response.json();
  }
  function categoryCard(row) {
    const image = imageUrl(row.image), color = /^#[\da-f]{6}$/i.test(row.color || '') ? row.color : '';
    const count = Math.max(0, Number(row.instance_count) || 0);
    return `<button class="explore-category-card" type="button" data-explore-category="${escape(row.id)}">
      <span class="explore-category-icon" ${color ? `style="--category-color:${color}"` : ''}>${image ? `<img src="${escape(image)}" alt="" loading="lazy">` : '<i class="fa-solid fa-shapes" aria-hidden="true"></i>'}</span>
      <span class="explore-category-info"><strong>${escape(name(row))}</strong>${count ? `<small>${count} 条知识</small>` : ''}</span>
      <i class="explore-category-open fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>`;
  }
  function group(title, rows, parentId = '') {
    return `<section class="explore-group"><div class="explore-group-heading"><h2>${parentId?`<button type="button" data-explore-category="${escape(parentId)}">${escape(title)}</button>`:escape(title)}</h2>${parentId ? `<button type="button" data-explore-category="${escape(parentId)}">查看全部 <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>` : ''}</div>
      <div class="explore-category-grid">${rows.map(categoryCard).join('')}</div>
    </section>`;
  }
  function knowledgeSection() {
    const current = tree.byId.get(selected);
    if (!current && !selectedTag) return '';
    const content = loadingItems && !items.length ? '<div class="explore-state" role="status">正在加载分类知识…</div>'
      : itemsError && !items.length ? `<div class="explore-state" role="alert">${escape(itemsError)} <button type="button" data-explore-retry-items>重试</button></div>`
      : items.length ? `<div class="explore-knowledge-grid">${items.map(item => {
        const media = window.homeKnowledgeMediaViewer?.collectMedia(item) || [];
        const urlOf = value => imageUrl(typeof value === 'object' && value ? value.url || value.src : value);
        const video = media.find(value => value.kind === 'video')?.url || urlOf(item.video || item.videos?.[0]);
        const images = media.filter(value => value.kind === 'image');
        const cover = urlOf(item.cover || item.covers?.[0]);
        const image = (video ? cover : '') || images[0]?.url || urlOf(item.image || item.images?.[0]) || cover;
        const title = item.name || item.label || item.id;
        return `<article class="explore-knowledge-card explore-media-tile${!image&&!video?' is-text':''}" ><button type="button" class="explore-tile-media" data-explore-node="${escape(item.id || item._id)}" aria-label="查看 ${escape(title)}" title="${escape(title)}">${image ? `<img src="${escape(image)}" alt="" loading="lazy" decoding="async">` : video ? `<video src="${escape(video)}" muted playsinline preload="metadata"></video>` : '<span class="explore-tile-placeholder"><i class="fa-regular fa-lightbulb" aria-hidden="true"></i></span>'}${video||images.length>1?`<span class="explore-tile-kind" aria-label="${video?'视频':'多图'}"><i class="${video?'fa-solid fa-play':'fa-regular fa-clone'}" aria-hidden="true"></i></span>`:''}</button><span class="explore-tile-caption"><button type="button" data-explore-detail="${escape(item.id || item._id)}"><strong>${escape(title)}</strong></button><small>${escape(item.description || '查看知识详情')}</small><small class="explore-knowledge-views"><i class="fa-regular fa-eye" aria-hidden="true"></i> <b data-knowledge-views="${escape(item.id || item._id)}">${Number(item.viewCount)||0}</b> 次浏览</small></span></article>`;
      }).join('')}</div>` : '<div class="explore-state">该分类下暂无可浏览的知识，可继续探索子分类。</div>';
    const status = loadingItems ? '<span role="status">正在加载知识…</span>'
      : itemsError ? `<span role="alert">${escape(itemsError)}</span> <button type="button" data-explore-retry-items>重试</button>`
      : exhausted || page * pageSize >= total ? '<span role="status">已经看完全部知识</span>'
      : '<button type="button" data-explore-load-more>加载更多</button>';
    return `<section class="explore-group">${content}<div class="explore-pagination" data-explore-load-status>${status}</div></section>`;
  }
  function subcategoryFilter() {
    if (!selected) return '';
    const children = childrenOf(selected);
    if (!children.length) return '';
    return `<section class="explore-subcategory-section" aria-label="子分类">
      <nav class="recommendation-filter-bar explore-subcategory-filter" aria-label="子分类筛选">
        <div class="recommendation-type-filter">
          <button type="button" data-explore-category="${escape(selected)}" aria-pressed="true">全部</button>
          ${children.map(row => `<button type="button" data-explore-category="${escape(row.id)}" aria-pressed="${row.id === selected}">${escape(name(row))}</button>`).join('')}
        </div>
      </nav>
    </section>`;
  }
  function topCategoryFilter() {
    if (loadingTree || !tree.roots.length) return '';
    const activeRoot = rootOf(selected);
    return `<nav class="recommendation-filter-bar explore-top-category-bar" aria-label="一级分类筛选">
      <div class="recommendation-type-filter">
        <button type="button" data-explore-category="" aria-pressed="${!selected && !selectedTag}">全部</button>
        ${tree.roots.map(row => `<button type="button" data-explore-category="${escape(row.id)}" aria-pressed="${row.id === activeRoot}">${escape(name(row))}</button>`).join('')}
      </div>
    </nav>`;
  }

  function render() {
    const scrollTop = ['app_explore','joined_type'].includes(window.kbViewMode) ? panel.scrollTop : savedScrollTop;
    savedScrollTop = scrollTop;
    let content;
    if (loadingTree) content = '<div class="explore-state" role="status">正在加载分类…</div>';
    else if (treeError) content = `<div class="explore-state" role="alert">${escape(treeError)} <button type="button" data-explore-retry>重新加载</button></div>`;
    else if (!selectedTag && !tree.byId.size) content = '<div class="explore-state"><i class="fa-solid fa-shapes" aria-hidden="true"></i><h2>还没有分类</h2><p>在知识库中建立分类后，即可在这里探索。</p><button type="button" data-explore-workspace>管理分类</button></div>';
    else if (selected || selectedTag) {
      content = subcategoryFilter();
      content += knowledgeSection();
    } else {
      const recommended = [...tree.byId.values()].filter(row => Number(row.instance_count) > 0)
        .sort((a, b) => Number(b.instance_count) - Number(a.instance_count)).slice(0, 6);
      content = recommended.length ? group('从这些分类开始', recommended) : '';
      for (const root of tree.roots) content += group(name(root), childrenOf(root.id).length ? childrenOf(root.id) : [root], root.id);
    }
    renderPins();
    const categoryFilter = topCategoryFilter();
    const currentCategory = tree.byId.get(selected);
    const categoryImage = imageUrl(currentCategory?.image);
    const categoryColor = /^#[\da-f]{6}$/i.test(currentCategory?.color || '') ? currentCategory.color : '';
    const headingTitle = currentCategory ? name(currentCategory) : selectedTag ? '#' + selectedTag : '探索分类';
    const categoryStats = currentCategory ? [
      Number(currentCategory.instance_count) > 0 ? `${Number(currentCategory.instance_count)} 条直属知识` : '',
    ].filter(Boolean).join(' · ') : '';
    const headingDescription = currentCategory
      ? currentCategory.description || categoryStats
      : selectedTag ? '正在浏览此标签下的知识。' : '按分类发现、浏览和管理知识。';
    const heading = `<header class="explore-heading">
      <div class="explore-community-banner" ${categoryColor ? `style="--category-color:${categoryColor}"` : ''} aria-hidden="true">${categoryImage ? `<img src="${escape(categoryImage)}" alt="">` : ''}</div>
      <div class="explore-heading-row">
        <div class="explore-heading-main">
          <span class="explore-community-avatar" ${categoryColor ? `style="--category-color:${categoryColor}"` : ''}>${categoryImage ? `<img src="${escape(categoryImage)}" alt="">` : `<i class="fa-solid ${currentCategory ? 'fa-shapes' : selectedTag ? 'fa-hashtag' : 'fa-compass' }" aria-hidden="true"></i>`}</span>
          <div class="explore-heading-copy"><h1>${escape(headingTitle)}</h1><p>${escape(headingDescription)}</p></div>
        </div>
        <div class="explore-heading-actions">
          ${currentCategory ? `<div class="explore-type-actions"><button type="button" class="btn" data-explore-join>${readPins().some(item => item.id === selected) ? '\u5df2\u52a0\u5165' : 'Join'}</button><button type="button" class="btn primary" data-explore-create><i class="fa-solid fa-plus" aria-hidden="true"></i> \u65b0\u589e\u77e5\u8bc6</button></div>
          <button class="btn explore-icon-action" type="button" data-explore-short-video title="\u5728\u77ed\u89c6\u9891\u4e2d\u63a2\u7d22\u6b64\u5206\u7c7b" aria-label="\u5728\u77ed\u89c6\u9891\u4e2d\u63a2\u7d22\u6b64\u5206\u7c7b"><i class="fa-solid fa-clapperboard" aria-hidden="true"></i></button>` : ''}
          <button class="btn explore-icon-action" type="button" data-explore-big-bang title="Big Bang \u77e5\u8bc6\u5b87\u5b99" aria-label="Big Bang \u77e5\u8bc6\u5b87\u5b99"><i class="fa-solid fa-atom" aria-hidden="true"></i></button>
        </div>
      </div>
    </header>`;
    panel.innerHTML = `<div class="explore-content">${heading}${categoryFilter}${content}</div>`;
    panel.scrollTop = scrollTop;
  }
  async function loadItems(nextPage = 1, append = false) {
    if (append && (loadingItems || exhausted || nextPage !== page + 1)) return false;
    const version = ++itemsVersion, category = selected, tag = selectedTag;
    retryPage = nextPage; retryAppend = append;
    loadingItems = true; itemsError = '';
    if (!append) { items = []; exhausted = false; }
    render();
    try {
      const data = await api('/api/kb/discover/search', { class_id: category, tag, order: 'richness', limit: pageSize, offset: (nextPage - 1) * pageSize });
      if (version !== itemsVersion || selected !== category || selectedTag !== tag) return false;
      total = Math.max(0, Number(data.total) || 0);
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (!append && nextPage > lastPage) return loadItems(lastPage);
      const seen = new Set(append ? items.map(item => String(item.id || item._id)) : []);
      const incoming = (data.nodes || []).filter(item => {
        const id = String(item.id || item._id);
        if (seen.has(id)) return false;
        seen.add(id); return true;
      });
      items = append ? [...items, ...incoming] : incoming;
      page = nextPage;
      exhausted = !incoming.length || page * pageSize >= total;
      writeExploreRoute();
      return true;
    } catch (error) { if (version === itemsVersion) itemsError = error.message || '知识加载失败'; return false; }
    finally { if (version === itemsVersion) { loadingItems = false; render(); } }
  }
  function loadMoreItems() {
    if (!['app_explore','joined_type'].includes(window.kbViewMode) || (!selected && !selectedTag) || loadingTree || loadingItems || itemsError || exhausted || page * pageSize >= total) return;
    void loadItems(page + 1, true);
  }
  panel.addEventListener('scroll', () => {
    if (!['app_explore','joined_type'].includes(window.kbViewMode)) return;
    savedScrollTop = panel.scrollTop;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 150) loadMoreItems();
    }, 120);
  }, { passive: true });
  function selectCategory(id) {
    if (id && !tree.byId.has(id)) return;
    selectedTag = '';
    clearTimeout(scrollTimer); exhausted = false;
    itemsVersion++; selected = id; items = []; total = 0; page = 1; itemsError = ''; loadingItems = false;
    writeExploreRoute();
    savedScrollTop = 0; panel.scrollTop = 0;
    render(); if (id) void loadItems();
  }
  window.loadKnowledgeExplore = async function ({ force = false } = {}) {
    const params = new URLSearchParams(location.search);
    const database = window.getCurrentDbParam() || 'default';
    void loadJoinedTypes();
    const requestedTag = (params.get('explore_tag') || '').trim();
    const requestedCategory = requestedTag ? '' : params.get(window.kbViewMode === 'joined_type' ? 'type_id' : 'explore_category') || '';
    const requestedPage = Number(params.get('explore_page') || 1);
    const targetPage = (requestedCategory || requestedTag) && Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    // Returning from the viewer/details must retain the accumulated cards and DOM scroll state.
    if (!force && treeReady && !treeError && loadedDatabase === database &&
        requestedTag === selectedTag && requestedCategory === selected && targetPage <= page) {
      panel.scrollTop = savedScrollTop;
      writeExploreRoute();
      return;
    }
    clearTimeout(scrollTimer); itemsVersion++; loadingItems = false; items = []; exhausted = false; itemsError = '';
    treeReady = false; loadedDatabase = database;
    savedScrollTop = 0; panel.scrollTop = 0;
    const version = ++treeVersion;
    selectedTag = requestedTag;
    loadingTree = true; treeError = ''; render();
    try {
      const data = await api('/api/kb/classes?counts=0');
      if (version !== treeVersion) return;
      tree = buildExploreTree(Array.isArray(data) ? data : data.items || []);
      selected=tree.byId.has(requestedCategory)?requestedCategory:'';
      page = 1;
      treeReady = true;
      writeExploreRoute();
      loadingTree = false; render();
      if (selected || selectedTag) {
        if (!await loadItems(1)) return;
        // A refreshed/bookmarked infinite list represents a prefix, not just its last page.
        while (version === treeVersion && page < targetPage && !exhausted) {
          if (!await loadItems(page + 1, true)) break;
        }
      }
    } catch (error) {
      if (version !== treeVersion) return;
      loadingTree = false; treeError = error.message || '分类加载失败'; render();
    }
  };
  panel.addEventListener('click', event => {
    if (event.target.closest('[data-explore-join]') && tree.byId.has(selected)) {
      const typeId=selected, typeName=name(tree.byId.get(selected));
      void (async()=>{
        await loadJoinedTypes();
        if(!tree.byId.has(typeId))return;
        const pins = readPins(), existing = pins.some(item => item.id === typeId);
        const next = existing ? pins.filter(item => item.id !== typeId) : [...pins, {id:typeId, name:typeName}];
        savePins(next,existing?'已从已加入列表移除':'已加入类型');
      })();
      return;
    }
    if (event.target.closest('[data-explore-create]') && tree.byId.has(selected)) { window.openQuickKnowledge?.({categoryId:selected}); return; }

    if (event.target.closest('[data-explore-short-video]') && tree.byId.has(selected)) {
      savedScrollTop = panel.scrollTop; clearTimeout(scrollTimer);
      window.kbShortsLaunch = { classId: selected, category: name(tree.byId.get(selected)) };
      window.setViewMode('shorts'); return;
    }
    if(event.target.closest('[data-explore-big-bang]')) { savedScrollTop=panel.scrollTop; clearTimeout(scrollTimer); window.setViewMode('big_bang'); return; }
    const category = event.target.closest('[data-explore-category]');
    if (category) { selectCategory(category.dataset.exploreCategory); return; }
    if (event.target.closest('[data-explore-load-more]')) { loadMoreItems(); return; }
    const detail = event.target.closest('[data-explore-detail]');
    if (detail) { savedScrollTop = panel.scrollTop; clearTimeout(scrollTimer); window.setViewMode('knowledge_detail', { targetNodeId: detail.dataset.exploreDetail }); return; }
    const node = event.target.closest('[data-explore-node]');
    if (node) {
      savedScrollTop = panel.scrollTop; clearTimeout(scrollTimer);
      window.kbShortsLaunch = { nodes: items.slice(), category: name(tree.byId.get(selected)) };
      window.setViewMode('shorts', { targetNodeId: node.dataset.exploreNode }); return;
    }
    if (event.target.closest('[data-explore-retry]')) void window.loadKnowledgeExplore({ force: true });
    if (event.target.closest('[data-explore-retry-items]')) void loadItems(retryPage, retryAppend);
    if (event.target.closest('[data-explore-workspace]')) window.setViewMode('table');
  });
  renderPins();
  window.addEventListener('kb-auth-change', () => {
    pinsLoadedKey='';
    renderPins();
    void loadJoinedTypes();
    treeReady = false; loadedDatabase = null;
    treeVersion++; itemsVersion++; tree = buildExploreTree([]); items = []; selected = '';
    if (['app_explore','joined_type'].includes(window.kbViewMode)) void window.loadKnowledgeExplore();
  });
  if (['app_explore','joined_type'].includes(window.kbViewMode)) void window.loadKnowledgeExplore();
})();
