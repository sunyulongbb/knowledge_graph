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
    const button = element('button', className, label(node)); button.type = 'button';
    button.addEventListener('click', () => open(node)); return button;
  };
  function draw(host, items) {
    host.replaceChildren();
    const heading = element('header', 'knowledge-family-heading');
    heading.append(element('div', '', '关系谱系'), element('p', '', '按本体浏览实体的亲缘与关联。关系来自当前知识库，点击名称可查看详情。'));
    host.append(heading);
    if (!items.length) { host.append(element('p', 'knowledge-family-empty', '当前筛选下没有可展示的知识。')); return; }
    const groups = new Map();
    for (const item of items) {
      const key = item.node.typeId || item.node.type || 'untyped';
      if (!groups.has(key)) groups.set(key, { name: item.node.typeLabel || '未分类', items: [] });
      groups.get(key).items.push(item);
    }
    const nav = element('nav', 'knowledge-family-nav'); nav.setAttribute('aria-label', '当前页本体分组'); host.append(nav);
    let groupIndex = 0;
    for (const group of groups.values()) {
      const section = element('section', 'knowledge-family-group'); section.id = `knowledgeFamilyGroup${groupIndex++}`;
      const jump = element('button', '', `${group.name} · ${group.items.length}`); jump.type = 'button';
      jump.addEventListener('click', () => section.scrollIntoView({ behavior: 'smooth', block: 'start' })); nav.append(jump);
      section.append(element('h2', '', group.name));
      const grid = element('div', 'knowledge-family-grid');
      for (const item of group.items) {
        const card = element('article', 'knowledge-family-card');
        const header = element('header', 'knowledge-family-card-header');
        const image = item.node.image || item.node.images?.[0];
        if (typeof image === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(image)) {
          const img = element('img', ''); img.src = image; img.alt = ''; img.loading = 'lazy';
          img.addEventListener('error', () => img.remove(), { once: true }); header.append(img);
        }
        const title = element('h3', ''); title.append(link(item.node, 'knowledge-family-name')); header.append(title); card.append(header);
        if (item.node.description) card.append(element('p', 'knowledge-family-description', item.node.description));
        const buckets = { parents: [], partners: [], children: [], other: [] };
        const seen = new Set();
        for (const relation of item.relations || []) {
          const group = kind(relation), identity = `${group}:${relation.node.id}:${group === 'other' ? relation.propertyId + relation.direction : ''}`;
          if (relation.node.id === item.node.id || seen.has(identity)) continue;
          seen.add(identity); buckets[group].push(relation);
        }
        let rendered = 0;
        for (const [key, caption] of [['parents', '亲代'], ['partners', '伴侣'], ['children', '后代'], ['other', '其他关联']]) {
          const relations = buckets[key]; if (!relations.length) continue;
          rendered += relations.length;
          const block = element('div', `knowledge-family-relations knowledge-family-${key}`);
          block.append(element('h4', '', `${caption} · ${relations.length}`));
          const list = element('div', 'knowledge-family-links');
          relations.forEach((relation, index) => {
            const chip = link(relation.node, 'knowledge-family-chip');
            chip.title = `${relation.direction === 'incoming' ? '指向当前实体' : '当前实体指向'} · ${relation.propertyName}`;
            if (key === 'other') chip.append(element('small', '', `${relation.direction === 'incoming' ? '← ' : '→ '}${relation.propertyName}`));
            chip.hidden = index >= 8; list.append(chip);
          });
          block.append(list);
          if (relations.length > 8) {
            let expanded = false;
            const more = element('button', 'knowledge-family-more', `展开其余 ${relations.length - 8} 项`); more.type = 'button'; more.setAttribute('aria-expanded', 'false');
            more.addEventListener('click', () => {
              expanded = !expanded; [...list.children].forEach((child, index) => { child.hidden = !expanded && index >= 8; });
              more.textContent = expanded ? '收起' : `展开其余 ${relations.length - 8} 项`; more.setAttribute('aria-expanded', String(expanded));
            }); block.append(more);
          }
          card.append(block);
        }
        if (!rendered) card.append(element('p', 'knowledge-family-empty', '尚无可见的实体关系'));
        if (item.truncated) card.append(element('small', 'knowledge-family-empty', '关联较多，当前展示部分关系。'));
        grid.append(card);
      }
      section.append(grid); host.append(section);
    }
  }
  window.knowledgeFamily = { kind, draw, cancel: () => { version++; } };
  window.renderKnowledgeFamily = async function (nodes) {
    const host = document.getElementById('knowledgeFamilyView'); if (!host) return;
    const requestVersion = ++version;
    host.replaceChildren(element('p', 'knowledge-family-empty', '正在整理实体关系…'));
    const ids = [...new Set((nodes || []).map(node => String(node.id || node._id || '').replace(/^entity\//, '')).filter(Boolean))];
    if (!ids.length) { draw(host, []); return; }
    const url = new URL('/api/kb/entity/relationships', location.origin);
    const db = new URLSearchParams(location.search).get('db'); if (db) url.searchParams.set('db', db);
    try {
      const items = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        if (requestVersion !== version || window.kbTableLayoutMode !== 'family') return;
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ids.slice(offset, offset + 100) }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '关系加载失败');
        items.push(...(data.items || []));
      }
      if (requestVersion !== version || window.kbTableLayoutMode !== 'family') return;
      draw(host, items);
    } catch (error) {
      if (requestVersion !== version || window.kbTableLayoutMode !== 'family') return;
      const message = element('p', 'knowledge-family-empty', error.message || '关系加载失败'); message.setAttribute('role', 'alert');
      const retry = element('button', 'btn', '重试'); retry.type = 'button'; retry.addEventListener('click', () => window.renderKnowledgeFamily(nodes));
      host.replaceChildren(message, retry);
    }
  };
})();
