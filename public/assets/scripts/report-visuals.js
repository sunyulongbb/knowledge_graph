(function () {
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  window.renderReportStatistics = function (host, stats) {
    if (!host) return;
    host.replaceChildren(); host.hidden = !stats;
    if (!stats) return;
    host.append(element('h2', '', '知识统计'));
    const metrics = element('div', 'report-stat-metrics');
    for (const [key, label] of [['mainEntityCount', '主实体'], ['entityCount', '报告实体'], ['relationCount', '关联关系'], ['attributeCount', '主实体属性']]) {
      const metric = element('div', 'report-stat-metric');
      metric.append(element('strong', '', String(stats[key] || 0)), element('span', '', label)); metrics.append(metric);
    }
    host.append(metrics);
    const charts = element('div', 'report-stat-charts');
    for (const [key, label] of [['entityTypes', '实体类型分布'], ['relationTypes', '关系类型分布'], ['mainConnections', '主实体关联数量']]) {
      const chart = element('section', 'report-stat-chart'); chart.append(element('h3', '', label));
      const values = (Array.isArray(stats[key]) ? stats[key] : []).filter(item => Number.isFinite(item.value) && item.value >= 0);
      const rows = values.slice(0, 8);
      if (values.length > 8) rows.push({ label: '其他', value: values.slice(8).reduce((sum, item) => sum + item.value, 0) });
      if (!rows.length) chart.append(element('p', 'muted', '暂无统计数据'));
      else {
        const maximum = Math.max(1, ...rows.map(item => item.value));
        const table = element('table', 'report-stat-table'); table.setAttribute('aria-label', label);
        const body = element('tbody', '');
        for (const row of rows) {
          const tr = element('tr', ''), name = element('th', '', row.label), cell = element('td', ''); name.setAttribute('scope', 'row');
          const bar = element('div', 'report-stat-bar'); bar.style.setProperty('--report-bar-width', `${row.value / maximum * 100}%`);
          bar.append(element('span', 'report-stat-value', String(row.value))); cell.append(bar); tr.append(name, cell); body.append(tr);
        }
        table.append(body); chart.append(table);
      }
      charts.append(chart);
    }
    host.append(charts, element('p', 'knowledge-report-canvas-hint', `统计范围：${stats.scope || '报告所展示的实体与关系'}。${stats.truncated ? '关联较多，当前统计基于报告已展示的部分数据。' : ''}`));
  };

  window.renderGeneratedReportGraph = function (host, graph) {
    if (!host || typeof window.cytoscape !== 'function' || !graph?.nodes?.length) return null;
    const cy = window.cytoscape({ container: host, elements: [...graph.nodes, ...(graph.edges || [])],
      style: [
        { selector: 'node', style: { label: 'data(label)', 'background-color': 'data(color)', color: '#334155', 'text-background-color': '#ffffff', 'text-background-opacity': 0.85,
          'text-background-padding': '3px', 'font-size': 11, 'text-wrap': 'wrap', 'text-max-width': 100, 'text-valign': 'bottom', 'text-margin-y': 7, width: 30, height: 30 } },
        { selector: 'node[isMain = 1]', style: { width: 48, height: 48, 'border-width': 4, 'border-color': '#0ea5e9', 'border-opacity': 0.7, 'font-weight': 'bold' } },
        { selector: 'edge', style: { label: 'data(label)', width: 1.5, 'line-color': '#94a3b8', 'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle',
          'curve-style': 'bezier', 'font-size': 9, color: '#64748b', 'text-rotation': 'autorotate', 'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': '2px' } },
        { selector: '.report-focused', style: { 'border-width': 4, 'border-color': '#f59e0b', opacity: 1 } },
        { selector: '.report-dimmed', style: { opacity: 0.15 } },
      ], layout: { name: 'concentric', concentric: node => node.data('isMain') ? 3 : node.degree() > 3 ? 2 : 1,
        levelWidth: () => 1, minNodeSpacing: 45, fit: true, padding: 40 }, wheelSensitivity: 0.2, minZoom: 0.1, maxZoom: 4 });
    cy.on('tap', 'node', event => {
      cy.elements().removeClass('report-focused report-dimmed');
      cy.elements().addClass('report-dimmed'); event.target.closedNeighborhood().removeClass('report-dimmed'); event.target.addClass('report-focused');
    });
    cy.on('tap', event => { if (event.target === cy) cy.elements().removeClass('report-focused report-dimmed'); });
    cy.on('dbltap', 'node', event => window.setViewMode?.('knowledge_detail', { targetNodeId: event.target.id(), focusDetailOnly: true }));
    return cy;
  };
})();
