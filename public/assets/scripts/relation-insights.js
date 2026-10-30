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
    host.append(element('p', 'relation-hint', '根据共同关联的实体和相似关系推荐，帮助你发现值得进一步了解的知识。推荐线索不代表已确认的实体关系。'));
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
    const grid = element('div', 'relation-card-grid');
    const cards = recommendations.map(item => {
      const card = element('article', 'relation-card relation-recommendation');
      const heading = element('div', 'relation-card-heading');
      heading.append(nodeButton(item.node, 'relation-entity-link'), element('span', 'relation-entity-type', item.node.typeLabel || item.node.ontology?.name || '实体'));
      card.append(heading, element('span', 'relation-recommendation-label', item.evidenceLabel));
      if (item.node.description) card.append(element('p', 'relation-card-description', item.node.description));
      const reasons = element('ul', 'relation-recommendation-reasons');
      for (const reason of item.reasons || []) reasons.append(element('li', '', reason));
      card.append(reasons);
      const details = element('details', 'relation-recommendation-evidence');
      details.append(element('summary', '', '为什么推荐'));
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
    cards.forEach((card, index) => { card.hidden = index >= 6; grid.append(card); }); host.append(grid);
    if (cards.length > 6) {
      let expanded = false;
      const more = element('button', 'relation-more', `查看更多推荐（${cards.length - 6}）`); more.type = 'button'; more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', () => {
        expanded = !expanded; cards.forEach((card, index) => { card.hidden = !expanded && index >= 6; });
        more.textContent = expanded ? '收起推荐' : `查看更多推荐（${cards.length - 6}）`; more.setAttribute('aria-expanded', String(expanded));
      }); host.append(more);
    }
    if (insights.truncated) host.append(element('p', 'relation-limit-note', '当前推荐基于已分析的部分关联数据。'));
    return true;
  };
})();
