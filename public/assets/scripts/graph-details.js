(() => {
  const get = (id) => document.getElementById(id);
  const host = get('visDetailHost');
  if (!host) return;
  let current = '';
  let boundCy = null;
  const nodes = () => window.kbCy?.nodes().toArray().filter((node) => !node.data('isCompound')) || [];
  const feed = () => nodes().map((node) => ({ ...node.data(), id: node.id() }));
  const viewer = () => window.homeKnowledgeMediaViewer;
  function refresh() {
    const items = nodes();
    viewer()?.updateFeed(feed());
    if (current && !items.some((node) => node.id() === current)) release();
    syncClassification();
  }
  function tab(detail) {
    get('visRecommendContent').hidden = detail;
    get('visDetailContent').hidden = !detail;
    get('visRecommendTab').setAttribute('aria-selected', String(!detail));
    get('visDetailTab').setAttribute('aria-selected', String(detail));
    get('visRecommendPanel').classList.toggle('is-detail', detail);
    const title = get('visRecommendPanel').querySelector?.('.vis-recommend-panel__title > span');
    if (title) title.textContent = detail ? '知识详情' : '知识推荐';
    if (detail) {
      get('visRecommendPanel').classList.remove('is-collapsed');
      get('cy_btnRecommendPanel').setAttribute('aria-expanded', 'true');
      refresh();
    } else if (viewer()?.isEmbedded()) viewer().close();
  }
  function release() {
    if (viewer()?.isEmbedded()) viewer().close();
    current = '';
    get('visDetailEmpty').hidden = false;
    tab(false);
  }
  function open(id) {
    if (window.kbViewMode !== 'vis' || !id || !viewer()) return;
    tab(true);
    viewer().open(String(id), {
      nodes: feed(), category: '当前画布',
      embedded: {
        host,
        onNodeChange(nodeId) {
          const node = nodes().find((node) => node.id().replace(/^entity\//, '') === nodeId);
          if (!node || window.kbViewMode !== 'vis') return;
          current = node.id();
          window.kbSelectGraphDetailNode?.(current);
        },
        onClose() { current = ''; get('visDetailEmpty').hidden = false; },
      },
    });
    current = String(id);
    get('visDetailEmpty').hidden = true;
  }
  function targets() {
    const ids = nodes().map((node) => node.id());
    const index = ids.indexOf(current);
    return { previous: index > 0 ? ids[index - 1] : '', next: index >= 0 ? ids[index + 1] || '' : '' };
  }
  window.kbGraphDetails = { open, release, close: release, isActive: () => viewer()?.isEmbedded() || false, targets };
  get('visRecommendTab').addEventListener('click', () => tab(false));
  get('visDetailTab').addEventListener('click', () => tab(true));
  for (const id of ['visRecommendTab', 'visDetailTab']) {
    get(id).addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const detail = id === 'visRecommendTab';
      tab(detail);
      get(detail ? 'visDetailTab' : 'visRecommendTab').focus();
    });
  }
  function bindGraph() {
    const cy = window.kbCy;
    if (cy && cy !== boundCy) {
      boundCy?.off('add remove data', refresh);
      boundCy?.off('select unselect', syncClassification);
      boundCy = cy;
      cy.on('add remove data', refresh);
      cy.on('select unselect', syncClassification);
      refresh();
      syncClassification();
    }
  }
  function syncClassification() {
    queueMicrotask(() => {
      const selected = window.kbCy?.nodes(':selected');
      void window.kbGraphClassification?.sync(window.kbViewMode === 'vis' && selected?.length === 1 ? selected[0].id() : '');
    });
  }
  bindGraph();
  new MutationObserver(bindGraph).observe(get('cy'), { childList: true });
})();
