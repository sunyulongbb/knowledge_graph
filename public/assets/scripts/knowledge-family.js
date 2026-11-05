(function () {
  let version = 0;
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const label = node => node.name || node.label_zh || node.label || node.id;
  const kind = relation => {
    const id = String(relation.propertyId || '').split('/').pop().toLowerCase();
    const name = String(relation.propertyName || '').trim().toLowerCase();
    const parent = ['p22', 'p25'].includes(id) || ['父亲', '母亲', '父母', '双亲', '亲代', 'father', 'mother', 'parent', 'parents'].includes(name);
    const child = id === 'p40' || ['子女', '孩子', '儿子', '女儿', '后代', 'child', 'children', 'son', 'daughter'].includes(name);
    const partner = id === 'p26' || ['配偶', '伴侣', '丈夫', '妻子', 'spouse', 'partner', 'husband', 'wife'].includes(name);
    if (partner) return 'partners';
    if (parent) return relation.direction === 'outgoing' ? 'parents' : 'children';
    if (child) return relation.direction === 'outgoing' ? 'children' : 'parents';
    return 'other';
  };
  const open = node => {
    window.setTableSelection?.(node.id, true);
    window.setViewMode?.('knowledge_detail', { targetNodeId: node.id, focusDetailOnly: true });
  };
  const link = (node, className) => {
    const button = element('button', className, label(node)); button.type = 'button'; button.title = label(node);
    button.addEventListener('click', () => open(node)); return button;
  };
  const mediaSources = value => {
    if (Array.isArray(value)) return value.flatMap(mediaSources);
    if (value && typeof value === 'object') return mediaSources(value.url || value.src || '');
    if (typeof value !== 'string') return [];
    const text = value.trim();
    if (text.startsWith('[') || text.startsWith('{')) { try { return mediaSources(JSON.parse(text)); } catch { return []; } }
    return /^(https?:\/\/|\/(?!\/)|data:(image|video)\/)/i.test(text) ? [text] : [];
  };
  function draw(host, items, ontologies = []) {
    host.replaceChildren();
    if (!items.length) { host.append(element('p', 'knowledge-family-empty', '当前筛选下没有可展示的知识。')); return; }
    const types = new Map(ontologies.map(type => [String(type.id), type]));
    const pathFor = (key, fallback) => {
      const names = [], seen = new Set();
      let type = types.get(String(key));
      while (type && !seen.has(type.id)) {
        seen.add(type.id); names.unshift(type.name || type.label || type.id);
        type = types.get(String(type.parent_id));
      }
      return names.length ? names.join(' / ') : fallback;
    };
    const groups = new Map();
    for (const item of items) {
      const key = item.node.typeId || item.node.type || 'untyped';
      if (!groups.has(key)) groups.set(key, { name: pathFor(key, item.node.typeLabel || key), items: [] });
      groups.get(key).items.push(item);
    }
    const categoryFor = node => {
      const labels = node.categoryLabels?.length ? node.categoryLabels : (node.classes || []).map(cls => cls.name || cls.label || cls.id);
      return labels.length ? [...labels].sort().join(' / ') : node.classLabel || '未分类';
    };
    const nav = element('nav', 'knowledge-family-nav'); nav.setAttribute('aria-label', '本体分类导航'); host.append(nav);
    let groupIndex = 0;
    for (const group of [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) {
      const section = element('section', 'knowledge-family-group'); section.id = `knowledgeFamilyGroup${groupIndex++}`;
      const jump = element('button', '', `${group.name} · ${group.items.length}`); jump.type = 'button';
      jump.addEventListener('click', () => section.scrollIntoView({ behavior: 'smooth', block: 'start' })); nav.append(jump);
      const groupHeading = element('div', 'knowledge-family-group-heading');
      groupHeading.append(element('h2', '', group.name), element('span', 'knowledge-family-count', String(group.items.length)));
      section.append(groupHeading);
      const categories = element('div', 'knowledge-family-categories');
      let grid, textFlow, categorySection;
      const categoryCounts = new Map();
      for (const item of group.items) {
        const key = categoryFor(item.node);
        categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
      }
      let category = null;
      for (const item of group.items.sort((a, b) => categoryFor(a.node).localeCompare(categoryFor(b.node), 'zh-CN') || label(a.node).localeCompare(label(b.node), 'zh-CN'))) {
        const nextCategory = categoryFor(item.node);
        if (nextCategory !== category) {
          category = nextCategory;
          categorySection = element('details', 'knowledge-family-category-group'); categorySection.open = true;
          const summary = element('summary', 'knowledge-family-category-summary');
          const count = categoryCounts.get(category);
          summary.append(element('h3', 'knowledge-family-category', category), element('span', 'knowledge-family-count', String(count)));
          grid = element('div', 'knowledge-family-grid');
          textFlow = element('div', 'knowledge-family-text-flow');
          categorySection.append(summary, grid, textFlow); categories.append(categorySection);
        }
        const card = element('article', 'knowledge-family-card');
        const textTarget = textFlow;
        const node = item.node;
        const media = link(node, 'knowledge-family-media'); media.textContent = '';
        media.setAttribute('aria-label', label(node));
        const image = mediaSources([node.covers, node.cover, node.image, node.images, node._attr_images])[0];
        const video = mediaSources([node.videos, node.video, node._attr_videos])[0];
        const hideMedia = () => {
          media.hidden = true;
          card.className = 'knowledge-family-card knowledge-family-card-text';
          if (image || video) textTarget.append(card);
        };
        if (image) {
          const img = element('img', ''); img.src = image; img.alt = ''; img.loading = 'lazy';
          img.addEventListener('error', hideMedia, { once: true }); media.append(img);
        } else if (video) {
          const preview = element('video', ''); preview.src = video; preview.muted = true;
          preview.playsInline = true; preview.preload = 'metadata';
          preview.addEventListener('error', hideMedia, { once: true }); media.append(preview);
        } else hideMedia();
        if (video) {
          const badge = element('span', 'knowledge-family-video-badge');
          badge.append(element('i', 'fa-solid fa-play')); media.append(badge);
        }
        if (image || video) card.append(media);
        const header = element('header', 'knowledge-family-card-header');
        const title = element('h3', ''); title.append(link(node, 'knowledge-family-name'));
        header.append(title); card.append(header);
        (image || video ? grid : textTarget).append(card);
      }
      section.append(categories); host.append(section);
    }
  }
  window.knowledgeFamily = { kind, draw, cancel: () => { version++; } };
  window.renderKnowledgeFamily = async function (nodes) {
    const host = document.getElementById('knowledgeFamilyView'); if (!host) return;
    const requestVersion = ++version;
    host.replaceChildren(element('p', 'knowledge-family-empty', '正在整理实体关系…'));
    const db = new URLSearchParams(location.search).get('db');
    try {
      let ontologies = [];
      const records = new Map((Array.isArray(nodes) ? nodes : []).map(node => [String(node.id || node._id), node]));
      const active = () => requestVersion === version && window.kbTableLayoutMode === 'family';
      const read = async url => {
        const response = await fetch(url, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '知识加载失败');
        return data;
      };
      if (!Array.isArray(nodes)) {
        const search = new URL('/api/kb/entity_search', location.origin);
        Object.entries(nodes || {}).forEach(([key, value]) => search.searchParams.set(key, value));
        if (db) search.searchParams.set('db', db);
        search.searchParams.set('order', 'id'); search.searchParams.set('limit', '500');
        for (let offset = 0; ; ) {
          if (!active()) return;
          search.searchParams.set('offset', String(offset));
          const page = await read(search);
          if (!active()) return;
          const batch = page.nodes || [];
          for (const node of batch) {
            const id = String(node.id || node._id || '').replace(/^entity\//, '');
            records.set(id, node);
          }
          offset += batch.length;
          if (offset >= Number(page.total || 0)) break;
          if (!batch.length) throw new Error('知识列表未完整加载，请重试');
        }
        const treeUrl = new URL('/api/kb/ontology/tree', location.origin);
        if (db) treeUrl.searchParams.set('db', db);
        const tree = await read(treeUrl);
        if (!active()) return;
        const flatten = rows => (rows || []).flatMap(row => [row, ...flatten(row.children)]);
        ontologies = tree.flat || flatten(tree.items);
      }
      const items = [...records.values()].map(node => ({ node }));
      if (requestVersion !== version || window.kbTableLayoutMode !== 'family') return;
      draw(host, items, ontologies);
      window.kbTableNodes = items.map(item => item.node);
      window.kbTableTotalNodes = items.length;
      const count = document.getElementById("tblCount");
      if (count && !Array.isArray(nodes)) count.textContent = `共 ${items.length} 条知识 · 按本体分类整理`;
    } catch (error) {
      if (requestVersion !== version || window.kbTableLayoutMode !== 'family') return;
      const message = element('p', 'knowledge-family-empty', error.message || '关系加载失败'); message.setAttribute('role', 'alert');
      const retry = element('button', 'btn', '重试'); retry.type = 'button'; retry.addEventListener('click', () => window.renderKnowledgeFamily(nodes));
      host.replaceChildren(message, retry);
    }
  };
})();
