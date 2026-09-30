import { buildNetwork, shortestRoute, learningRoutes, learningMap, buildTransitMap, transitIslands, transitIslandName } from './knowledge-roam-graph.js?v=20260929-island-names';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const palette = ['#2563eb', '#059669', '#e87924', '#a855f7', '#db2777', '#0891b2'];
let dialog, network, graph, route, step = -1, controller;
let journeySidebar = null;
const visited = new Set();
let overview, choices, transit;
let selectedClass = '';
let islands = [], activeIsland = -1;
const label = id => network.nodes.get(id)?.name || network.nodes.get(id)?.label || id;
const get = id => dialog.querySelector(`#roam-${id}`);

function create() {
  dialog = document.createElement('dialog');
  dialog.className = 'knowledge-roam';
  dialog.setAttribute('aria-label', '知识漫游');
  dialog.innerHTML = `<div class="roam-shell"><button type="button" class="btn" id="roam-close" aria-label="关闭知识漫游">✕</button><div class="roam-body"><div class="roam-map-wrap"><div id="roam-map" class="roam-map" aria-label="知识地铁线路图"></div><button class="btn roam-fit" id="roam-fit" type="button">适应画布</button></div><aside class="roam-sidebar"><label>起点站<select id="roam-start" aria-label="起点站"></select></label><label>终点站<select id="roam-end" aria-label="终点站"></select></label><p class="roam-hint">点击站点可依次选择起点和终点。线路颜色代表关系类型，可拖动、缩放地图。关系按双向连接计算最少站数。</p><p id="roam-status" role="status" aria-live="polite"></p><button class="btn" id="roam-retry" type="button" hidden>重新加载</button><button class="btn primary" id="roam-begin" type="button" disabled>开始学习通关</button><button class="btn" id="roam-reset" type="button" hidden>重新选线</button><div id="roam-learning"></div><ol id="roam-stations" class="roam-stations"></ol></aside></div><footer id="roam-legend" class="roam-legend"></footer></div>`;
  document.body.append(dialog);
  const tabs = document.createElement('div');
  tabs.id = 'roam-islands';
  tabs.className = 'roam-islands';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '独立线路图');
  tabs.hidden = true;
  dialog.querySelector('.roam-body').before(tabs);
  dialog.querySelector('.roam-body').id = 'roam-island-panel';
  tabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-island]');
    if (tab) selectIsland(Number(tab.dataset.island));
  });
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? islands.length - 1
      : (activeIsland + (event.key === 'ArrowRight' ? 1 : -1) + islands.length) % islands.length;
    selectIsland(index);
    tabs.querySelector(`[data-island="${index}"]`)?.focus();
  });
  get('close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); document.getElementById('knowledgeRoamLaunch')?.focus(); });
  get('fit').onclick = () => graph?.fit(undefined, 45);
  get('retry').onclick = load;
  get('start').onchange = get('end').onchange = selectRoute;
  get('begin').onclick = startLearning;
  get('reset').onclick = () => { step = -1; render(); };
}

function startLearning() {
  if (!route || !window.homeKnowledgeMediaViewer) return;
  step = 0; visited.clear();
  const mapWrap = get('map').parentElement;
  const placeholder = document.createComment('roaming map');
  mapWrap.before(placeholder);
  journeySidebar = document.createElement('aside');
  journeySidebar.className = 'roam-journey-sidebar';
  journeySidebar.dataset.journeySidebar = '';
  journeySidebar.innerHTML = `<header><p data-journey-status role="status" aria-live="polite">正在前往起点…</p></header><div class="roam-journey-map-host"></div><div class="roam-journey-stops" aria-label="学习路线"></div><footer><p>上下滑动详情切换站点，线路图同步跟随。也可点击线路站点跳转。</p><button type="button" data-journey-finish>完成学习通关</button><button type="button" data-journey-back>返回选线</button></footer>`;
  journeySidebar.querySelector('.roam-journey-map-host').append(mapWrap);
  journeySidebar.querySelector('[data-journey-back]').onclick = () => window.homeKnowledgeMediaViewer.close();
  const finish = () => {
    const remaining = route.nodes.length - visited.size;
    journeySidebar.querySelector('[data-journey-status]').textContent = remaining ? `还有 ${remaining} 站未浏览，请继续沿线路学习。` : '恭喜通关！已漫游整条知识线路。';
    if (!remaining) journeySidebar.classList.add('is-finished');
  };
  journeySidebar.querySelector('[data-journey-finish]').onclick = finish;
  journeySidebar.querySelector('.roam-journey-stops').onclick = event => {
    const button = event.target.closest('[data-station]');
    if (button) void window.homeKnowledgeMediaViewer.goTo(button.dataset.station, route.nodes.indexOf(button.dataset.station) < step ? -1 : 1);
  };
  dialog.close();
  window.homeKnowledgeMediaViewer.open(route.nodes[0], {
    nodes: route.nodes.map(id => network.nodes.get(id)), category: '知识漫游',
    journey: {
      sidebar: journeySidebar,
      onNodeChange(id) {
        step = route.nodes.indexOf(id); if (step < 0) return;
        visited.add(id); render();
        journeySidebar.querySelector('[data-journey-status]').textContent = `第 ${step + 1} / ${route.nodes.length} 站 · ${label(id)} · 已浏览 ${visited.size} 站`;
        const stops = journeySidebar.querySelector('.roam-journey-stops');
        stops.innerHTML = `<div class="roam-metro-train">${route.nodes.map((station, i) => {
          const current = i === step, done = visited.has(station);
          const status = current ? '当前站' : done ? '已浏览' : '待到站';
          return `<button type="button" data-station="${escape(station)}" aria-current="${current ? 'step' : 'false'}" aria-label="第 ${i + 1} 站，${escape(label(station))}，${status}" title="${escape(label(station))}" class="roam-metro-car ${done ? 'is-visited' : ''}"><span class="roam-metro-roof" aria-hidden="true"><b>${String(i + 1).padStart(2, '0')}</b><span>${current ? '● ' : done ? '✓ ' : ''}${status}</span></span><span class="roam-metro-windows" aria-hidden="true"><i></i><i></i><i></i></span><span class="roam-metro-name">${escape(label(station))}</span></button>`;
        }).join('')}</div>`;
        const currentCar = stops.querySelector('[aria-current="step"]');
        if (currentCar) {
          const carRect = currentCar.getBoundingClientRect(), stopsRect = stops.getBoundingClientRect();
          stops.scrollTo({ left: stops.scrollLeft + carRect.left - stopsRect.left - (stops.clientWidth - carRect.width) / 2, behavior: 'instant' });
        }
        graph.stop(); graph.animate({ center: { eles: graph.getElementById(id) }, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
      },
      onFinish: finish,
      onClose() {
        placeholder.replaceWith(mapWrap); journeySidebar.remove(); journeySidebar = null;
        step = -1; render();
        if (window.kbViewMode === 'app_home') dialog.showModal();
        requestAnimationFrame(() => { graph.resize(); graph.fit(undefined, 45); });
      },
    },
  });
  requestAnimationFrame(() => { graph.resize(); graph.fit(graph.elements('.route'), 60); });
}

async function load() {
  controller?.abort(); controller = new AbortController();
  const requestController = controller;
  graph?.destroy(); graph = null; network = null; route = null; step = -1;
  islands = []; activeIsland = -1;
  get('islands').replaceChildren(); get('islands').hidden = true;
  get('start').innerHTML = get('end').innerHTML = '<option value="">请选择站点</option>';
  get('start').disabled = get('end').disabled = true;
  get('begin').disabled = true; get('reset').hidden = true; get('retry').hidden = true;
  get('learning').innerHTML = get('stations').innerHTML = get('legend').innerHTML = '';
  get('status').textContent = '正在加载知识网络…';
  try {
    const url = new URL('/api/kb/graph', location.origin);
    const scope = new URLSearchParams(location.search).get('db');
    if (scope) url.searchParams.set('db', scope);
    if (selectedClass) url.searchParams.set('class_id', selectedClass);
    const response = await fetch(url, { signal: requestController.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`加载失败（${response.status}）`);
    const data = await response.json();
    if (requestController !== controller || requestController.signal.aborted) return;
    network = buildNetwork(data);
    overview = learningMap(network);
    if (!dialog.open) return;
    if (!overview.nodes.size) { get('status').textContent = selectedClass ? '当前类型内暂无经过至少 4 个知识点的线路，请在首页选择其他类型。' : '暂无经过至少 4 个知识点的最短线路，较短线路已自动隐藏。'; return; }
    if (typeof window.cytoscape !== 'function') throw new Error('线路图组件加载失败，请刷新页面重试');
    islands = transitIslands(network, overview);
    get('islands').innerHTML = islands.map((island, index) => {
      const name = escape(transitIslandName(network, island));
      return `<button type="button" role="tab" id="roam-island-${index}" data-island="${index}" aria-controls="roam-island-panel" aria-selected="false" tabindex="-1" title="${name}"><strong class="roam-island-name">${name}</strong><span>${island.nodes.size} 站</span></button>`;
    }).join('');
    get('islands').hidden = islands.length < 2;
    selectIsland(0);
  } catch (error) {
    if (error.name === 'AbortError' || requestController !== controller || requestController.signal.aborted) return;
    get('status').textContent = error.message || '知识网络加载失败'; get('retry').hidden = false;
  }
}

function selectIsland(index) {
  if (!islands[index] || index === activeIsland || journeySidebar) return;
  activeIsland = index;
  overview = islands[index];
  route = null; step = -1; visited.clear();
  graph?.destroy(); graph = null;
  get('islands').querySelectorAll('[data-island]').forEach(tab => {
    const selected = Number(tab.dataset.island) === index;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  const panel = get('island-panel');
  if (islands.length > 1) {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `roam-island-${index}`);
  } else {
    panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby');
  }
  get('start').innerHTML = '<option value="">请选择站点</option>' + [...overview.nodes].map(id => `<option value="${escape(id)}">${escape(label(id))} · ${escape(id)}</option>`).join('');
  get('end').innerHTML = '<option value="">请先选择起点</option>';
  draw(); selectRoute();
  graph.resize(); graph.fit(undefined, 45);
}

function draw() {
  transit = buildTransitMap(network, overview);
  const lineColor = id => palette[id % palette.length];
  graph = window.cytoscape({ container: get('map'), elements: [
    ...[...overview.nodes].map(id => ({ data: { id, label: label(id), color: lineColor(transit.stationLine.get(id)) }, classes: transit.transfers.has(id) ? 'transfer' : '', position: transit.positions.get(id) })),
    ...network.edges.filter(e => overview.edges.has(e.id)).map(e => ({ data: { ...e, color: transit.edgeLine.has(e.id) ? lineColor(transit.edgeLine.get(e.id)) : '#94a3b8' }, classes: transit.connectors.has(e.id) ? 'connector' : transit.edges.has(e.id) ? '' : 'secondary' })),
  ], layout: { name: 'preset', padding: 45 }, minZoom: 0.05, maxZoom: 3, autoungrabify: true, style: [
    { selector: 'node', style: { 'background-color': '#fff', 'border-color': 'data(color)', 'border-width': 4, width: 17, height: 17, label: 'data(label)', color: getComputedStyle(dialog).color, 'font-size': 12, 'text-valign': 'bottom', 'text-margin-y': 12, 'text-wrap': 'ellipsis', 'text-max-width': 150 } },
    { selector: 'edge', style: { width: 5, 'line-color': 'data(color)', 'curve-style': 'straight', 'line-cap': 'round' } },
    { selector: 'node.transfer', style: { 'border-width': 5, 'border-style': 'double', width: 25, height: 25 } },
    { selector: 'edge.connector', style: { width: 3, 'line-style': 'dashed', 'curve-style': 'segments',
      'edge-distances': 'node-position', 'segment-distances': [60, 60],
      'segment-weights': edge => {
        const distance = Math.abs(edge.source().position('y') - edge.target().position('y'));
        const turn = Math.min(0.4, 60 / Math.max(1, distance));
        return [turn, 1 - turn];
      } } },
    { selector: 'edge.secondary', style: { display: 'none', 'curve-style': 'bezier' } },
    { selector: '.dim', style: { opacity: 0.16 } },
    { selector: '.short-route', style: { display: 'none' } },
    { selector: 'edge.route', style: { display: 'element', width: 8, 'line-style': 'solid', 'z-index': 5 } },
    { selector: 'node.route', style: { 'border-color': '#2563eb', 'border-width': 5, width: 23, height: 23 } },
    { selector: 'node.completed', style: { 'background-color': '#059669', 'border-color': '#059669' } },
    { selector: 'node.current', style: { 'background-color': '#fbbf24', 'border-color': '#d97706', width: 30, height: 30 } },
  ] });
  graph.on('tap', 'node', event => {
    if (journeySidebar) {
      const id = event.target.id(), index = route.nodes.indexOf(id);
      if (index >= 0) void window.homeKnowledgeMediaViewer.goTo(id, index < step ? -1 : 1);
      return;
    }
    if (step >= 0) return;
    const id = event.target.id();
    if (!get('start').value || get('end').value) {
      get('start').value = id; get('end').value = '';
    } else {
      if (!choices.destinations.has(id)) {
        get('status').textContent = '终点须与起点连通，且最短线路至少经过 4 个知识点。';
        return;
      }
      get('end').value = id;
    }
    selectRoute();
  });
  get('legend').innerHTML = transit.lines.filter(line => line.edges.length).map(line => `<span><i style="background:${lineColor(line.id)}"></i>${line.id + 1} 号线 · ${line.nodes.length} 站</span>`).join('') + '<span><i style="background:#94a3b8"></i>换乘连接 · 双圈为换乘站</span>';
  get('map').setAttribute('aria-label', '知识地铁线路图，长主线与换乘连接');
  dialog.querySelector('.roam-hint').textContent = '先沿长主线浏览，再通过换乘站连接其他线路。颜色代表线路，虚线代表换乘连接。可拖动画布、缩放地图；选择起终点后显示真实关联中的最短路线。';

}

function selectRoute() {
  step = -1;
  const start = get('start').value, previousEnd = get('end').value;
  choices = learningRoutes(network, start);
  choices.destinations = new Set([...choices.destinations].filter(id => overview.nodes.has(id)));
  get('end').innerHTML = `<option value="">${start ? '请选择至少经过 4 站的终点' : '请先选择起点'}</option>` + [...choices.destinations].map(id => `<option value="${escape(id)}">${escape(label(id))} · ${escape(id)}</option>`).join('');
  get('end').value = choices.destinations.has(previousEnd) ? previousEnd : '';
  route = shortestRoute(network, get('start').value, get('end').value);
  render();
}

function render() {
  const active = step >= 0, finished = active && step === route.nodes.length;
  get('start').disabled = active;
  get('end').disabled = active || !choices.destinations.size;
  get('begin').hidden = active; get('begin').disabled = !route;
  get('reset').hidden = !active;
  get('status').textContent = finished ? '恭喜通关！这条知识路线已全部完成。' : active ? `正在学习第 ${step + 1} / ${route.nodes.length} 站` : route ? `最短路线：${route.nodes.length} 站 · ${route.edges.length} 次连接` : get('start').value && get('end').value ? '这两个站点尚未连通，请更换起点或终点。' : `共 ${network.nodes.size} 个知识站点，请选择起点和终点。`;
  get('stations').innerHTML = route ? route.nodes.map((id, i) => `<li class="${active && i < step ? 'done' : active && i === step ? 'current' : ''}">${escape(label(id))}${active && i < step ? ' ✓' : ''}${i === 0 ? ' · 起点' : ''}${i === route.nodes.length - 1 ? ' · 终点' : ''}</li>`).join('') : '';
  get('learning').innerHTML = '';
  if (!active && !route) get('status').textContent = get('start').value ? choices.destinations.size ? `可选 ${choices.destinations.size} 个终点，线路至少经过 4 个知识点。` : '从该起点出发暂无经过至少 4 个知识点的最短线路，请更换起点。' : `已整理 ${transit.lines.filter(line => line.edges.length).length} 条线路、${overview.nodes.size} 个站点，请选择起点。`;
  graph.batch(() => {
    const visible = overview;
    graph.nodes().forEach(node => node.toggleClass('short-route', !visible.nodes.has(node.id()) && node.id() !== get('start').value));
    graph.edges().forEach(edge => edge.toggleClass('short-route', !visible.edges.has(edge.id()) && !route?.edges.includes(edge.id())));
    graph.elements().removeClass('dim route current completed');
    if (!route) return;
    graph.elements().addClass('dim');
    route.nodes.forEach((id, i) => { const node = graph.getElementById(id); node.removeClass('dim').addClass('route'); if (active && visited.has(id)) node.addClass('completed'); if (active && i === step) node.addClass('current'); });
    route.edges.forEach(id => graph.getElementById(id).removeClass('dim').addClass('route'));
  });
}

document.getElementById('appHomeContent')?.addEventListener('click', event => {
  const launch = event.target.closest('[data-home-roam-open]');
  if (!launch) return;
  if (!dialog) create();
  selectedClass = launch.dataset.homeRoamClass || '';
  dialog.showModal();
  void load();
});
