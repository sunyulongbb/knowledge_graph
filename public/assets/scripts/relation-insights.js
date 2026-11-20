(function () {
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const label = (node) => node.name || node.label_zh || node.label || node.id || '未命名实体';
  window.renderKnowledgeRelations = function (insights, center, fallback) {
    const section = document.getElementById('detailIncomingRelations');
    const host = document.getElementById('detailIncomingRelationGroups');
    if (!section || !host || !insights) return false;
    host.replaceChildren(); section.hidden = false;
    const title = document.getElementById('detailRelationHeading');
    const status = document.getElementById('detailIncomingRelationStatus');
    const count = document.getElementById('detailIncomingRelationCount');
    if (title) title.textContent = '相关推荐';
    if (status) status.textContent = '';
    const recommendations = insights.recommendations || [];
    if (count) count.textContent = `${recommendations.length} 个潜在关联实体`;
    host.classList.add('relation-gallery');
    if (!recommendations.length) {
      host.append(element('p', 'relation-empty', '暂未发现足够明确的关联线索。'));
      return true;
    }
    const open = (node) => {
      const id = String(node.id || node._id || '').replace(/^entity\//, '');
      if (!id) return;
      if (window.kbGraphDetails?.isActive()) { window.kbGraphDetails.open(id); return; }
      const mode = window.kbViewMode === 'knowledge_detail' ? 'knowledge_detail' : 'detail';
      if (typeof window.setViewMode === 'function') window.setViewMode(mode, { targetNodeId: id, focusDetailOnly: mode === 'knowledge_detail', detailCrumbLabel: label(node) });
      else if (typeof fallback === 'function') fallback(id);
    };
    const nodeButton = (node, className, text = label(node)) => {
      const button = element('button', className, text);
      button.type = 'button'; button.title = `查看 ${label(node)}`;
      button.addEventListener('click', () => open(node));
      return button;
    };
    const grid = element('div', 'relation-recommendation-list');
    grid.setAttribute('role', 'list');
    const cards = recommendations.map(item => {
      const card = element('article', 'relation-card relation-recommendation');
      card.setAttribute('role', 'listitem');
      const heading = element('div', 'relation-card-heading');
      heading.append(nodeButton(item.node, 'relation-entity-link'), element('span', 'relation-entity-type', item.node.typeLabel || item.node.ontology?.name || '实体'));
      heading.append(element('span', 'relation-recommendation-label', item.evidenceLabel));
      const media = nodeButton(item.node, 'relation-gallery-media', '');
      let candidate = item.node.thumbnail || item.node.image || item.node.image_url || item.node.images?.[0] || '';
      if (typeof candidate === 'object') candidate = candidate.url || candidate.src || '';
      let imageUrl = ''; try { const url = new URL(candidate, location.origin); if (candidate && ['http:','https:'].includes(url.protocol)) imageUrl = url.href; } catch {}
      const placeholder = element('span','relation-gallery-placeholder',label(item.node).slice(0,1));
      if (imageUrl) { const image = document.createElement('img'); image.src=imageUrl; image.alt=label(item.node); image.loading='lazy'; image.addEventListener('error',()=>image.replaceWith(placeholder),{once:true}); media.append(image); } else media.append(placeholder);
      card.append(media, heading);
      if (item.node.description) card.append(element('p', 'relation-card-description', item.node.description));
      const reasons = element('ul', 'relation-recommendation-reasons');
      for (const reason of item.reasons || []) reasons.append(element('li', '', reason));
      const details = element('details', 'relation-recommendation-evidence');
      details.append(element('summary', '', '为什么推荐'));
      if (reasons.children.length) details.append(reasons);
      for (const path of item.paths || []) {
        const chain = element('div', 'relation-path');
        path.nodes.forEach((node, index) => {
          if (index) {
            const step = path.steps[index - 1];
            chain.append(element('span', 'relation-path-edge', step.direction === 'outgoing' ? `— ${step.propertyName} →` : `← ${step.propertyName} —`));
          }
          chain.append(index === 0 ? element('span', 'relation-path-center', label(node)) : nodeButton(node, 'relation-path-node'));
        });
        details.append(chain);
      }
      if (item.pathCount > (item.paths || []).length) details.append(element('small', 'relation-hint', `展示其中 ${item.paths.length} 条依据`));
      card.append(details, nodeButton(item.node, 'relation-more', '查看实体'));
      return card;
    });
    let selected = '', pageIndex = 0;
    const pageSize = 8, tabs = element('div','relation-gallery-tabs');
    tabs.setAttribute('aria-label','推荐分类');
    const typeOf = item => item.node.typeLabel || item.node.ontology?.name || '实体';
    const categories = [...new Set(recommendations.map(typeOf))];
    const controls = element('div','relation-gallery-controls');
    const previous = element('button','relation-gallery-arrow','‹'), next = element('button','relation-gallery-arrow','›');
    previous.type=next.type='button'; previous.setAttribute('aria-label','上一页推荐');next.setAttribute('aria-label','下一页推荐');
    const indicators = element('div','relation-gallery-indicators');
    const statusText=element('span','relation-gallery-status'); statusText.setAttribute('aria-live','polite');
    function draw() {
      const visible = cards.filter((_,i)=>!selected || typeOf(recommendations[i])===selected);
      const pages = Math.max(1,Math.ceil(visible.length/pageSize));pageIndex=Math.min(pageIndex,pages-1);
      cards.forEach(card=>{card.hidden=true});visible.slice(pageIndex*pageSize,(pageIndex+1)*pageSize).forEach(card=>{card.hidden=false});
      previous.disabled=pageIndex===0;next.disabled=pageIndex===pages-1;statusText.textContent=`${pageIndex+1} / ${pages}`;
      indicators.replaceChildren();for(let i=0;i<pages;i++){const dot=element('button','relation-gallery-indicator');dot.type='button';dot.setAttribute('aria-label',`第 ${i+1} 页`);dot.setAttribute('aria-current',String(i===pageIndex));dot.onclick=()=>{pageIndex=i;draw()};indicators.append(dot)}
      tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===selected)));
    }
    for(const category of ['',...categories]) {const button=element('button','relation-gallery-tab');button.type='button';button.dataset.category=category;const icon=element('i',category?'fa-solid fa-tag':'fa-solid fa-list');icon.setAttribute('aria-hidden','true');button.append(icon,document.createTextNode(category||'全部'));button.onclick=()=>{selected=category;pageIndex=0;draw()};tabs.append(button)}
    previous.onclick=()=>{pageIndex--;draw()};next.onclick=()=>{pageIndex++;draw()};
    cards.forEach(card=>grid.append(card));controls.append(previous,indicators,statusText,next);host.append(tabs,controls,grid);draw();
    if (insights.truncated) host.append(element('p', 'relation-limit-note', '当前推荐基于已分析的部分关联数据。'));
    return true;
  };
})();
