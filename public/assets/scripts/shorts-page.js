(function () {
  const panel = document.getElementById('shortsPanel');
  const host = document.createElement('div');
  host.id = 'shortsKnowledgeHost';
  host.setAttribute('aria-label', '短视频与知识详情');
  panel.append(host);
  panel.classList.add('shorts-knowledge-page');
  document.getElementById('applicationHomePanel').append(panel);
  let version = 0, activeId = '', controller, initialLoad = true;
  let activeCategoryId = '', activeCategoryName = '';
  const normalize = value => String(value || '').replace(/^entity\//, '');
  function writeShortsRoute(nodeId = '') {
    const params = new URLSearchParams({ view: 'shorts' });
    if (nodeId) params.set('node', nodeId);
    if (activeCategoryId) {
      params.set('class_id', activeCategoryId);
      if (activeCategoryName) params.set('category', activeCategoryName);
    }
    const url = new URL(location.href);
    url.hash = params;
    window.history.replaceState(window.history.state, '', url);
  }
  function openNode(id, nodes, category) {
    activeId = normalize(id);
    host.replaceChildren();
    window.homeKnowledgeMediaViewer.open(activeId, {
      nodes, category: category || activeCategoryName || '知识发现',
      page: { host, onNodeChange(nodeId) {
        if (window.kbViewMode !== 'shorts') return;
        activeId = nodeId;
        writeShortsRoute(nodeId);
      } },
    });
  }
  window.closeShortsPage = function () {
    version++; controller?.abort(); activeId = '';
    if (window.homeKnowledgeMediaViewer?.isPage()) window.homeKnowledgeMediaViewer.close();
  };
  window.refreshShortsPage = function () {
    if (window.kbViewMode !== 'shorts') return;
    window.kbShortsLaunch = null;
    window.closeShortsPage();
    return window.loadShortsPage();
  };
  window.loadShortsPage = async function (id = '') {
    if (window.kbViewMode !== 'shorts') return;
    if (initialLoad && !window.kbShortsLaunch && performance.getEntriesByType?.('navigation')[0]?.type === 'reload') id = '';
    initialLoad = false;
    id = normalize(id);
    if (!id && activeId && window.homeKnowledgeMediaViewer.isPage()) return;
    if (id && id === activeId && window.homeKnowledgeMediaViewer.isPage()) return;
    const token = ++version;
    controller?.abort(); controller = new AbortController();
    const route = new URLSearchParams(location.hash.replace(/^#/, ''));
    const launch = window.kbShortsLaunch || {};
    if (window.kbShortsLaunch) {
      activeCategoryId = String(launch.classId || '').trim();
      activeCategoryName = String(launch.category || '').trim();
    } else {
      activeCategoryId = String(route.get('class_id') || '').trim();
      activeCategoryName = String(route.get('category') || '').trim();
    }
    window.kbShortsLaunch = null;
    const nodes = Array.isArray(launch.nodes) ? launch.nodes : [];
    if (activeCategoryId) setTimeout(() => {
      if (token === version && window.kbViewMode === 'shorts') writeShortsRoute(id || activeId);
    }, 0);
    if (id) openNode(id, nodes, launch.category);
    else {
      if (window.homeKnowledgeMediaViewer.isPage()) window.homeKnowledgeMediaViewer.close();
      host.textContent = '正在加载知识…';
    }
    if (nodes.length && id) return;
    try {
      const url = new URL('/api/kb/recommendations', location.origin);
      const db = window.getCurrentDbParam();
      if (db) url.searchParams.set('db', db);
      if (activeCategoryId) url.searchParams.set('class_id', activeCategoryId);
      url.searchParams.set('limit', '100'); url.searchParams.set('surface', 'shorts'); url.searchParams.set('recommendation_seed', crypto.randomUUID());
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`知识加载失败（${response.status}）`);
      const data = await response.json();
      if (token !== version || window.kbViewMode !== 'shorts') return;
      const feed = data.nodes || [];
      if (id) window.homeKnowledgeMediaViewer.updateFeed(feed);
      else if (feed.length) {
        openNode(normalize(feed[0].id || feed[0]._id), feed);
        if (activeCategoryId) writeShortsRoute(activeId);
      }
      else host.textContent = '暂无可浏览的知识';
    } catch (error) {
      if (token !== version || error.name === 'AbortError') return;
      if (id) return; // The selected detail has its own independent request and error state.
      host.textContent = error.message || '知识加载失败';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn'; retry.textContent = '重试';
      retry.onclick = () => window.loadShortsPage(); host.append(retry);
    }
  };
  if (window.kbViewMode === 'shorts') {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    void window.loadShortsPage(params.get('node') || '');
  }
})();
