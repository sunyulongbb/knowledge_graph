import { openPipelineTree, closePipelineTree } from './pipeline-tree.js';
import { parseCsv, parseJsonTable, matrixToTable, defaultFlow, layoutFlow, layoutBranches, NODE_TYPES, NODE_WIDTH, NODE_HEIGHT } from './pipeline-data.js?v=20261010-branches';
import { BASIC_FIELDS, inferBasicFields } from './pipeline-fields.js';

const labels = { input: '实体表输入', ontology: '本体对齐', properties: '属性对齐', alignment: '实体对齐', fusion: '知识融合', output: '知识库输出' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = v => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
const options = (items, selected, label = '请选择') => `<option value="">${label}</option>` + items.map(i => `<option value="${esc(i.id)}" ${i.id === selected ? 'selected' : ''}>${esc(i.name || i.id)}</option>`).join('');
let entryRoot, cleanRoot, source = 'file', staged = null, tables = [], flows = [], ontologies = [];
let flow = defaultFlow(), selected = 'input', result = null, decisions = {}, dirty = false;
const grids = new Map();
let ontologyTree = [], canvasZoom = 1, canvasObserver, dock = '', drawflowEditor = null, locked = false;
let flowAnalysis = { branches: [], issues: [], cyclic: false, valid: false };
const tableCache = new Map(), propertyCache = new Map();
const icons = { input:'table', ontology:'sitemap', properties:'list-check', alignment:'link', fusion:'code-merge', output:'database', 'new-flow':'plus', 'save-flow':'floppy-disk', preview:'play', full:'forward', confirm:'database', 'delete-node':'trash-can', 'clear-canvas':'trash-can', 'connect-all':'link', disconnect:'link-slash', layout:'layout', 'export-flow':'upload', 'import-flow':'download', lock:'lock', unlock:'unlock', 'fit-canvas':'expand', 'zoom-in':'plus', 'zoom-out':'minus', 'read-file':'file-import', 'save-table':'floppy-disk', 'mysql-test':'plug', 'mysql-fields':'list', 'mysql-read':'download' };
const iconPaths = {
  table:'M3 3h18v18H3z M3 9h18 M9 9v12', sitemap:'M9 2h6v5H9z M2 17h6v5H2z M16 17h6v5h-6z M12 7v5 M5 17v-5h14v5',
  'list-check':'m3 6 2 2 3-4 M11 6h10 m-18 9 2 2 3-4 M11 15h10', link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  'code-merge':'M6 5v14 M18 5c0 8-12 4-12 10 M4 3h4v4H4z M16 3h4v4h-4z M4 17h4v4H4z', database:'M3 5c0-4 18-4 18 0s-18 4-18 0v14c0 4 18 4 18 0V5 M3 12c0 4 18 4 18 0',
  plus:'M12 5v14 M5 12h14', minus:'M5 12h14', 'floppy-disk':'M3 3h15l3 3v15H3z M7 3v6h10V3 M7 21v-8h10v8', play:'m7 3 14 9-14 9z', forward:'m3 5 9 7-9 7z m9 0 9 7-9 7z',
  'trash-can':'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7', 'link-slash':'M3 3l18 18 M14 5l1-1a4 4 0 0 1 6 6l-1 1 M10 19l-1 1a4 4 0 0 1-6-6l1-1',
  expand:'M9 3H3v6 M15 3h6v6 M21 15v6h-6 M3 15v6h6', 'file-import':'M14 2H4v7 M4 17v5h16V8l-6-6v6h6 M2 13h10 m-4-4 4 4-4 4', plug:'M8 2v5 M16 2v5 M5 7h14 M7 7v5a5 5 0 0 0 10 0V7 M12 17v5',
  list:'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1', download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  filter:'M3 3h18l-7 8v8l-4 2V11z', 'chevron-down':'m5 9 7 7 7-7',
  layout:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z', upload:'M12 15V3 m-5 5 5-5 5 5 M4 17v4h16v-4',
  lock:'M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5 M5 10.5h14V21H5z M12 14.5v3', unlock:'M7.5 10.5V8a4.5 4.5 0 0 1 8.6-1.9 M5 10.5h14V21H5z M12 14.5v3',
};
const icon = name => `<svg class="pipeline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[icons[name] || name] || iconPaths.list}"/></svg>`;
const tool = (cmd,label,extra='') => '<button type="button" class="btn pipeline-icon-btn" data-action="'+cmd+'" title="'+label+'" aria-label="'+label+'" '+extra+'>'+icon(cmd)+'</button>';
function decorate(root) {
  root.querySelectorAll('button[data-action],button[data-table-view],button[data-table-clean],button[data-run-id]').forEach(b=>{
    if (b.querySelector('.pipeline-icon')) return;
    const label=b.textContent.trim(), name=icons[b.dataset.action] || (b.dataset.tableView?'eye':b.dataset.tableClean?'filter':'list');
    b.title=label; b.setAttribute('aria-label',label); b.classList.add('pipeline-icon-btn'); b.innerHTML=icon(name);
  });
}
function showDock(value) {
  dock=value; const el=cleanRoot?.querySelector('[data-dock]'); if (!el) return;
  el.dataset.dock=value;
  el.querySelectorAll('[data-dock-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.dockTab===value); b.setAttribute('aria-expanded',String(b.dataset.dockTab===value));});
  requestAnimationFrame(()=>{ for (const grid of grids.values()) grid.resize?.(); });
}
function syncView() {
  if (!drawflowEditor || !cleanRoot) return;
  canvasZoom = drawflowEditor.zoom;
  const label = cleanRoot.querySelector('[data-zoom]');
  if (label) label.textContent = Math.round(canvasZoom * 100) + '%';
  const viewport = cleanRoot.querySelector('.pipeline-canvas-scroll');
  if (viewport) {
    viewport.style.backgroundSize = (16 * canvasZoom) + 'px ' + (16 * canvasZoom) + 'px';
    viewport.style.backgroundPosition = drawflowEditor.canvas_x + 'px ' + drawflowEditor.canvas_y + 'px';
  }
}
function fitCanvas() {
  const viewport = cleanRoot?.querySelector('.pipeline-canvas-scroll');
  if (!viewport || !viewport.clientWidth || !drawflowEditor) return;
  const width = Math.max(NODE_WIDTH + 40, ...flow.nodes.map(n => n.x + NODE_WIDTH + 40));
  const height = Math.max(NODE_HEIGHT + 40, ...flow.nodes.map(n => n.y + NODE_HEIGHT + 40));
  drawflowEditor.zoom = Math.max(.35, Math.min(1, (viewport.clientWidth - 24) / width, (viewport.clientHeight - 24) / height));
  centerCanvas();
  drawflowEditor.zoom_refresh();
  syncView();
}
function centerCanvas() {
  if (!drawflowEditor || !cleanRoot) return;
  const viewport = cleanRoot.querySelector('.pipeline-canvas-scroll');
  if (!viewport) return;
  const nodes = flow.nodes;
  if (!nodes.length) {
    drawflowEditor.canvas_x = 0;
    drawflowEditor.canvas_y = 0;
    return;
  }
  const minX = Math.min(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxX = Math.max(...nodes.map(node => node.x + NODE_WIDTH));
  const maxY = Math.max(...nodes.map(node => node.y + NODE_HEIGHT));
  drawflowEditor.canvas_x = (viewport.clientWidth - (maxX - minX) * canvasZoom) / 2 - minX * canvasZoom;
  drawflowEditor.canvas_y = (viewport.clientHeight - (maxY - minY) * canvasZoom) / 2 - minY * canvasZoom;
}
function nodeSummary(node) {
  const branch = branchOfNode(node.id);
  if (node.type === 'input') return tableCache.get(String(node.config.tableId))?.name || (node.config.tableId ? '实体表不可用' : '选择实体表');
  if (node.type === 'ontology') return ontologies.find(o => o.id === node.config.ontologyId)?.name || '选择目标本体';
  if (node.type === 'properties') {
    const mappings = Object.values(node.config.mapping || {}).filter(Boolean).length;
    const shared = flowAnalysis.branches.filter(item => item.nodeIds.includes(node.id)).length;
    return [node.config.nameField ? '名称：' + node.config.nameField : '配置基础字段与属性', mappings ? `${mappings} 个属性` : '', shared > 1 ? `${shared} 条支路共用` : ''].filter(Boolean).join(' · ');
  }
  if (node.type === 'alignment') return '来源 ID / 名称匹配';
  if (node.type === 'fusion') return { keep: '冲突保留原值', replace: '冲突使用新值', merge: '合并为多值' }[node.config.strategy] || '设置融合策略';
  if (branch && !branch.ready && branch.issues.length) return branch.issues[0];
  const target = ontologies.find(ontology => ontology.id === branch?.ontology?.config.ontologyId);
  return target ? `写入 ${target.name}` : '确认后写入知识库';
}
function listMappingControls(node, key) {
  const option = node.config.mappingOptions?.[key] || {};
  const separator = option.separator ?? ' ';
  const checked = option.multi === true;
  return `<span class="pipeline-mapping-options"><label><input type="checkbox" data-mapping-option="${esc(key)}" data-mapping-option-key="multi" ${checked ? 'checked' : ''}>多值</label><input class="pipeline-mapping-separator" data-mapping-option="${esc(key)}" data-mapping-option-key="separator" value="${esc(separator)}" placeholder="分隔符（默认空格）" aria-label="${esc(key)}分隔符" ${checked ? '' : 'hidden'}></span>`;
}
/** Mirrors the server rules so the canvas can explain problems while the flow is edited. */
function analyzeFlow(input) {
  const nodes = input.nodes, edges = input.edges, byId = new Map(nodes.map(node => [node.id, node]));
  const issues = [], inbound = new Map(), outbound = new Map();
  for (const node of nodes) { inbound.set(node.id, []); outbound.set(node.id, []); }
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    outbound.get(edge.from).push(edge.to);
    inbound.get(edge.to).push(edge.from);
  }
  const warn = (id, message) => { if (!issues.some(issue => issue.id === id)) issues.push({ id, message }); };
  for (const node of nodes) {
    const ins = inbound.get(node.id).length, outs = outbound.get(node.id).length;
    if (node.type === 'input' && ins) warn(node.id, '数据源不能再接入上游节点');
    if (node.type !== 'input' && !ins) warn(node.id, '缺少上游连接');
    if (node.type !== 'input' && ins > 1) warn(node.id, '只能有一个上游连接');
    if (node.type === 'output' && outs) warn(node.id, '输出节点不能再连接下游');
    if (node.type !== 'output' && !outs) warn(node.id, '缺少下游连接');
  }
  const pending = new Map(nodes.map(node => [node.id, inbound.get(node.id).length]));
  const queue = nodes.filter(node => !inbound.get(node.id).length).map(node => node.id);
  let settled = 0;
  while (queue.length) {
    const id = queue.shift(); settled += 1;
    for (const next of outbound.get(id)) {
      const left = pending.get(next) - 1;
      pending.set(next, left);
      if (!left) queue.push(next);
    }
  }
  const cyclic = settled !== nodes.length;
  const branches = [], used = new Set();
  for (const output of nodes.filter(node => node.type === 'output')) {
    const branch = { id: output.id, name: nodeLabel(output, nodes), nodeIds: [], nodes: [], issues: [], ready: false };
    const chain = [output], types = new Set([output.type]), visited = new Set([output.id]);
    let current = output;
    while (current.type !== 'input') {
      const parents = inbound.get(current.id);
      if (parents.length !== 1) { branch.issues.push(parents.length ? '上游存在多条连接，只能保留一条' : '支路缺少上游连接'); break; }
      const parent = byId.get(parents[0]);
      if (visited.has(parent.id)) { branch.issues.push('支路存在循环连接'); break; }
      if (types.has(parent.type)) { branch.issues.push(`支路里重复出现“${labels[parent.type]}”节点`); break; }
      visited.add(parent.id);
      types.add(parent.type); chain.unshift(parent); current = parent;
    }
    branch.nodes = chain;
    branch.nodeIds = chain.map(node => node.id);
    branch.input = chain.find(node => node.type === 'input') || null;
    branch.ontology = chain.find(node => node.type === 'ontology') || null;
    branch.properties = chain.find(node => node.type === 'properties') || null;
    branch.fusion = chain.find(node => node.type === 'fusion') || null;
    branch.strategy = String(branch.fusion?.config.strategy || 'keep');
    if (!chain.some(node => node.type === 'input')) branch.issues.push('支路没有接到“实体表输入”');
    if (branch.input && !branch.input.config.tableId) branch.issues.push('请选择二维实体表');
    if (!branch.ontology) branch.issues.push('缺少“本体对齐”节点');
    else if (!branch.ontology.config.ontologyId) branch.issues.push('请选择目标本体');
    if (branch.properties && !branch.properties.config.nameField) branch.issues.push('请选择名称字段');
    for (const id of branch.nodeIds) used.add(id);
    branches.push(branch);
  }
  for (const node of nodes) if (!used.has(node.id) && !issues.some(issue => issue.id === node.id)) warn(node.id, '该节点没有通向“知识库输出”的连接');
  const tableOntology = new Map();
  for (const branch of branches) {
    const tableId = branch.input?.config.tableId, ontologyId = branch.ontology?.config.ontologyId;
    if (!tableId || !ontologyId) continue;
    const key = tableId + '\u0000' + ontologyId;
    if (tableOntology.has(key)) branch.issues.push(`与“${tableOntology.get(key).name}”使用同一张实体表和同一个本体`);
    else tableOntology.set(key, branch);
  }
  for (const branch of branches) branch.ready = branch.issues.length === 0;
  if (cyclic) issues.push({ id: '', message: '流程存在循环连接' });
  return { branches, issues, cyclic, valid: !cyclic && !issues.length && branches.length > 0 && branches.every(branch => branch.ready) };
}
function nodeLabel(node, nodes) {
  const same = nodes.filter(item => item.type === node.type);
  return same.length > 1 ? `${labels[node.type]} #${same.findIndex(item => item.id === node.id) + 1}` : labels[node.type];
}
function nodeIssue(id) { return flowAnalysis.issues.find(issue => issue.id === id) || null; }
function branchOfNode(id) { return flowAnalysis.branches.find(branch => branch.nodeIds.includes(id)) || null; }
function nodeStatus(node) {
  if (nodeIssue(node.id)) return 'error';
  if (node.type === 'input') return node.config.tableId ? 'ready' : 'pending';
  if (node.type === 'ontology') return node.config.ontologyId ? 'ready' : 'pending';
  if (node.type === 'properties') return node.config.nameField ? 'ready' : 'pending';
  if (node.type === 'fusion') return node.config.strategy ? 'ready' : 'pending';
  return 'ready';
}
function markSelectedNode() {
  const canvas = cleanRoot?.querySelector('[data-canvas]');
  if (!canvas) return;
  canvas.querySelectorAll('.drawflow-node[data-selected]').forEach(el => el.removeAttribute('data-selected'));
  if (selected) canvas.querySelector('#node-' + CSS.escape(selected))?.setAttribute('data-selected', 'true');
}
/** Repaints node cards after a flow change without re-importing the whole canvas. */
function refreshNodeTexts() {
  const canvas = cleanRoot?.querySelector('[data-canvas]');
  if (!canvas) return;
  for (const node of flow.nodes) {
    const element = canvas.querySelector('#node-' + CSS.escape(node.id));
    if (!element) continue;
    const title = element.querySelector('.pipeline-node-head strong');
    if (title) title.textContent = nodeLabel(node, flow.nodes);
    const status = element.querySelector('.pipeline-node-status');
    if (status) {
      const state = nodeStatus(node);
      status.setAttribute('data-ready', state);
      status.title = nodeIssue(node.id)?.message || (state === 'ready' ? '已配置' : '需要配置');
    }
    const body = element.querySelector('.pipeline-node-body small');
    if (body) body.textContent = nodeSummary(node);
  }
  markIssues();
}
function markIssues() {
  const canvas = cleanRoot?.querySelector('[data-canvas]');
  if (!canvas) return;
  canvas.querySelectorAll('.drawflow-node[data-problem]').forEach(el => { el.removeAttribute('data-problem'); el.removeAttribute('title'); });
  for (const issue of flowAnalysis.issues) {
    const element = issue.id ? canvas.querySelector('#node-' + CSS.escape(issue.id)) : null;
    if (!element) continue;
    element.setAttribute('data-problem', 'true');
    element.title = issue.message;
  }
}
function refreshEditorState() {
  if (!cleanRoot?.querySelector('[data-canvas]')) return;
  refreshAnalysis();
  const fullAnalysis = flowAnalysis;
  for (const button of cleanRoot.querySelectorAll('[data-add-node]')) {
    const count = flow.nodes.filter(node => node.type === button.dataset.addNode).length;
    button.disabled = count >= 6;
    button.title = count ? `再添加一个${labels[button.dataset.addNode]}（已有 ${count} 个）` : `拖拽或点击添加：${labels[button.dataset.addNode]}`;
    const badge = button.querySelector('.pipeline-palette-count');
    if (badge) { badge.hidden = count < 2; badge.textContent = String(count); }
  }
  const lockButton = cleanRoot.querySelector('[data-action="lock"]');
  if (lockButton) {
    const label = locked ? '解锁画布' : '锁定画布';
    lockButton.innerHTML = icon(locked ? 'unlock' : 'lock');
    lockButton.title = label; lockButton.setAttribute('aria-label', label); lockButton.setAttribute('aria-pressed', String(locked));
  }
  const state = cleanRoot.querySelector('[data-flow-state]');
  if (state) { state.hidden = !dirty; state.textContent = dirty ? '未保存' : ''; }
  const empty = cleanRoot.querySelector('[data-canvas-empty]');
  if (empty) empty.hidden = flow.nodes.length > 0;
  const summary = cleanRoot.querySelector('[data-branch-summary]');
  if (summary) {
    const ready = fullAnalysis.branches.filter(branch => branch.ready).length;
    const invalid = fullAnalysis.issues.length || fullAnalysis.branches.length !== ready;
    summary.textContent = fullAnalysis.branches.length ? `支路 ${ready} / ${fullAnalysis.branches.length} 就绪` : '尚无支路';
    summary.classList.toggle('is-ready', Boolean(fullAnalysis.branches.length) && !invalid);
    summary.classList.toggle('is-problem', Boolean(invalid));
    summary.title = fullAnalysis.issues[0]?.message || fullAnalysis.branches.find(branch => !branch.ready)?.issues[0] || '所有支路都可以运行';
  }
  const runButton = cleanRoot.querySelector('[data-action="preview"]');
  if (runButton) runButton.disabled = !flowAnalysis.branches.length;
  renderBranches();
}
function downloadJson(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safe = String(name).replace(/[\\/:*?"<>|]+/g, '_');
  anchor.download = /\.json$/i.test(safe) ? safe : safe + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return anchor.download;
}
async function api(path, body) {
  let url = new URL('/api/kb/pipeline/' + path, location.origin);
  if (window.appendCurrentDbParam) url = window.appendCurrentDbParam(url) || url;
  else { const db = new URLSearchParams(location.search).get('db'); if (db) url.searchParams.set('db', db); }
  const response = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
  return data;
}
function message(root, value, error = false) {
  const el = root.querySelector('[data-message]'); el.textContent = value; el.classList.toggle('error', error);
}
async function action(root, fn) {
  if (root.dataset.busy === 'true') return;
  root.dataset.busy = 'true'; root.setAttribute('aria-busy', 'true');
  const buttons = [...root.querySelectorAll('button')].filter(b => !b.disabled);
  buttons.forEach(b => b.disabled = true);
  try { message(root, '处理中…'); await fn(); }
  catch (error) { message(root, error.message || String(error), true); }
  finally { decorate(root); buttons.forEach(b => b.disabled = false); root.dataset.busy = ''; root.removeAttribute('aria-busy'); refreshEditorState(); updateConfirm(); }
}
function invalidate() { result = null; decisions = {}; dirty = true; if (cleanRoot) { cleanRoot.querySelector('[data-results]').innerHTML = ''; refreshEditorState(); updateConfirm(); } }
function htmlTable(columns, rows) {
  return `<div class="pipeline-scroll"><table><thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${esc(text(r[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
async function preview(host, columns, rows) {
  grids.get(host)?.destroy(); grids.delete(host);
  host.innerHTML = '';
  if (!rows.length) { host.textContent = '暂无记录'; return; }
  try {
    const module = await window.kbBusinessGridModuleReady;
    if (!host.isConnected) return;
    if (!module?.BusinessGridController) throw new Error('grid unavailable');
    host.classList.add('pipeline-grid');
    const grid = new module.BusinessGridController(host, {
      columns: columns.map((c, i) => ({ id: 'c' + i, header: [{ text: esc(c) }], minWidth: 140, htmlEnable: false })),
      data: rows.slice(0, 100).map((r, i) => ({ id: 'row-' + i, ...Object.fromEntries(columns.map((c, j) => ['c' + j, text(r[c])])) })),
      height: 'auto', editable: false,
    });
    grids.set(host, grid);
  } catch { host.classList.remove('pipeline-grid'); host.innerHTML = htmlTable(columns, rows.slice(0, 100)); }
}
function destroyGrids(root) { for (const [host, grid] of grids) if (root.contains(host)) { grid.destroy(); grids.delete(host); } }
function shell(panel, tabs) {
  panel.classList.add('pipeline-enabled');
  panel.style.visibility = 'visible';
  const root = document.createElement('section'); root.className = 'pipeline-root';
  root.innerHTML = `<header class="pipeline-head"><nav class="pipeline-tabs">${tabs.map(([id, name], i) => `<button type="button" class="btn ${i ? '' : 'active'}" data-tab="${id}">${name}</button>`).join('')}</nav></header><div data-message role="status" aria-live="polite" class="pipeline-message"></div><div data-body></div>`;
  panel.replaceChildren(root); return root;
}
function entryForm() {
  destroyGrids(entryRoot);
  entryRoot.querySelector('[data-body]').innerHTML = `<div class="pipeline-card pipeline-source"><h3>数据源</h3><div class="pipeline-tabs">${[['mysql','数据库'],['file','文件']].map(([id, name]) => `<button class="btn ${source === id ? 'active' : ''}" data-source="${id}">${name}</button>`).join('')}</div><div data-source-form></div></div><div class="pipeline-card pipeline-staged" data-staged></div>`;
  entryRoot.querySelector('[data-body]').className = 'pipeline-entry-layout';
  const form = entryRoot.querySelector('[data-source-form]');
  if (source === 'file') form.innerHTML = '<div class="pipeline-fields"><label>选择 CSV、Excel 或 JSON 文件<input type="file" data-file accept=".csv,.xlsx,.xls,.json"></label><label>Excel 工作表<select data-sheet hidden></select><span class="muted">CSV 使用 UTF-8；JSON 使用对象数组。最多 10000 行、200 列。</span></label></div><button class="btn" data-action="read-file">读取文件</button>';
  if (source === 'mysql') form.innerHTML = `<div class="pipeline-fields">${[['connectionName','连接名称','人物数据源'],['host','主机','localhost'],['port','端口','3306'],['database','数据库名称',''],['username','用户名',''],['password','密码',''],['table','数据表','people']].map(([id, name, value]) => `<label>${name}<input data-mysql="${id}" value="${value}" type="${id === 'password' ? 'password' : 'text'}" autocomplete="${id === 'password' ? 'new-password' : 'off'}"></label>`).join('')}</div><label>SQL（填写后优先于数据表，仅支持 SELECT）<textarea data-mysql="sql" placeholder="SELECT * FROM people"></textarea></label><p class="muted">连接密码仅用于本次请求，不保存到实体表或流程。</p><label class="pipeline-check"><input type="checkbox" data-demo>使用演示数据（不连接 MySQL）</label><div class="pipeline-actions"><button class="btn" data-action="mysql-test">测试连接</button><button class="btn" data-action="mysql-fields">读取字段</button><button class="btn" data-action="mysql-read">读取并预览</button></div>`;
  renderStaged(); decorate(entryRoot);
}
function renderStaged() {
  const host = entryRoot.querySelector('[data-staged]'); destroyGrids(host);
  if (!staged) { host.innerHTML = '<p class="muted">读取数据后在此预览并选择保留列。保存实体表后，前往数据清洗完成对齐和入库。</p>'; return; }
  host.innerHTML = `<h3>二维实体表预览 · ${staged.rows.length} 条记录</h3><div class="pipeline-fields"><label>表名称<input data-table-name value="${esc(staged.name)}"></label><label>来源标识（同一来源请保持一致）<input data-source-key value="${esc(staged.sourceKey)}"></label></div><div class="pipeline-actions">${staged.columns.map(c => `<label class="pipeline-check"><input type="checkbox" data-column="${esc(c)}" checked>${esc(c)}</label>`).join('')}</div><p class="muted">预览前 100 条；保存全部读取记录及勾选列。</p><div data-table-preview></div><button class="btn primary" data-action="save-table">保存实体表</button>`;
  decorate(host); preview(host.querySelector('[data-table-preview]'), staged.columns, staged.rows);
}
function ontologyImportFromTable(table) {
  return {
    version: 1,
    ontologies: [{
      name: table.name,
      description: `由实体表“${table.name}”生成`,
      properties: table.columns.map(name => ({
        name,
        datatype: 'string',
        description: `实体表“${table.name}”中的字段“${name}”`,
      })),
    }],
  };
}
function downloadOntologyJson(table) {
  const payload = ontologyImportFromTable(table);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${table.name || 'ontology-import'}.ontology.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  message(entryRoot, `已生成“${anchor.download}”，可直接导入本体树。`);
}
let workbook = null;
async function readFile() {
  const file = entryRoot.querySelector('[data-file]').files[0];
  if (!file) throw new Error('请选择文件');
  if (file.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MB');
  let data;
  if (/\.csv$/i.test(file.name)) data = parseCsv(await file.text());
  else if (/\.json$/i.test(file.name)) data = parseJsonTable(await file.text());
  else if (/\.xlsx?$/i.test(file.name)) {
    if (!window.XLSX) throw new Error('Excel 读取组件尚未加载，请刷新重试');
    if (!workbook) workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const sheet = entryRoot.querySelector('[data-sheet]');
    if (!sheet.options.length) sheet.innerHTML = workbook.SheetNames.map(name => `<option>${esc(name)}</option>`).join('');
    sheet.hidden = false;
    data = matrixToTable(window.XLSX.utils.sheet_to_json(workbook.Sheets[sheet.value], { header: 1, defval: null, raw: false }));
  } else throw new Error('仅支持 CSV、Excel 和 JSON');
  if (data.rows.length > 10000 || data.columns.length > 200) throw new Error('原型最多支持 10000 行、200 列');
  staged = { ...data, name: file.name.replace(/\.[^.]+$/, ''), sourceType: 'file', sourceKey: 'file:' + file.name + (workbook ? ':' + entryRoot.querySelector('[data-sheet]').value : '') };
  renderStaged(); message(entryRoot, `已读取 ${data.rows.length} 条，尚未保存知识库。`);
}
async function showTables() {
  entryRoot.querySelector('[data-body]').className='pipeline-list-layout';
  destroyGrids(entryRoot); tables = (await api('tables')).items;
  entryRoot.querySelector('[data-body]').innerHTML = `<div class="pipeline-card"><h3>已保存实体表</h3><div class="pipeline-scroll"><table><thead><tr><th>表名称</th><th>来源</th><th>字段 / 记录</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${tables.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.sourceType)}</td><td>${t.columnCount} / ${t.rowCount}</td><td>${esc(t.createdAt)}</td><td><button class="btn" data-table-view="${t.id}">预览</button> <button class="btn pipeline-icon-btn" data-table-export-ontology="${t.id}" title="导出本体 JSON" aria-label="导出本体 JSON">${icon('download')}</button> <button class="btn" data-table-clean="${t.id}">开始清洗</button></td></tr>`).join('')}</tbody></table></div><div data-saved-preview></div></div>`;
  message(entryRoot, tables.length ? `共 ${tables.length} 张实体表` : '尚未保存实体表，请先新建录入。');
}
function setTab(root, tab) { root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); }
async function loadCatalog() {
  const [t, f] = await Promise.all([api('tables'), api('flows')]); tables = t.items; flows = f.items;
  let url = new URL('/api/kb/ontology/tree', location.origin); url = window.appendCurrentDbParam?.(url) || url;
  const response = await fetch(url); if (!response.ok) throw new Error('本体加载失败');
  const data = await response.json(); const flat = nodes => nodes.flatMap(n => [n, ...flat(n.children || [])]); ontologyTree = data.items || []; ontologies = flat(ontologyTree);
  await loadFlowData();
}
function refreshAnalysis() { flowAnalysis = analyzeFlow(flow); return flowAnalysis; }
function branchTable(branch) { return branch ? tableCache.get(String(branch.input?.config.tableId || '')) || null : null; }
function branchProperties(branch) { return branch ? propertyCache.get(String(branch.ontology?.config.ontologyId || '')) || [] : []; }
function previewBranch() { return branchOfNode(selected) || flowAnalysis.branches[0] || null; }
/** Loads every entity table and ontology property list the current branches reference. */
async function loadFlowData() {
  refreshAnalysis();
  const tableIds = [...new Set(flow.nodes.filter(n => n.type === 'input').map(n => String(n.config.tableId || '')).filter(Boolean))];
  const ontologyIds = [...new Set(flow.nodes.filter(n => n.type === 'ontology').map(n => String(n.config.ontologyId || '')).filter(Boolean))];
  await Promise.all([
    ...tableIds.filter(id => !tableCache.has(id)).map(async id => { try { tableCache.set(id, await api('tables/' + encodeURIComponent(id))); } catch { tableCache.set(id, null); } }),
    ...ontologyIds.filter(id => !propertyCache.has(id)).map(async id => { try { propertyCache.set(id, (await api('properties?ontologyId=' + encodeURIComponent(id))).items); } catch { propertyCache.set(id, []); } }),
  ]);
  // Infer basic fields per 属性对齐 node from the table of the branch it belongs to.
  for (const propertiesNode of flow.nodes.filter(n => n.type === 'properties')) {
    const branch = flowAnalysis.branches.find(item => item.nodeIds.includes(propertiesNode.id));
    const table = branchTable(branch);
    if (table) propertiesNode.config = inferBasicFields(table.columns, propertiesNode.config);
  }
}
function editor() {
  closePipelineTree(); canvasObserver?.disconnect(); destroyGrids(cleanRoot);
  drawflowEditor = null; locked = false;
  const body=cleanRoot.querySelector('[data-body]'); body.className='pipeline-editor-layout';
  body.innerHTML = `<div class="pipeline-toolbar"><label class="pipeline-flow-title"><span class="sr-only">流程名称</span><input data-flow-name aria-label="流程名称" value="${esc(flow.name)}"></label><select data-flow-select aria-label="已有流程">${options(flows,flow.id,'打开已有流程')}</select><span class="pipeline-branch-summary" data-branch-summary></span><span class="pipeline-flow-state" data-flow-state hidden></span><div class="pipeline-actions">${tool('new-flow','新建流程')}${tool('save-flow','保存流程')}<span class="pipeline-divider"></span>${tool('preview','预览运行（前100条）')}${tool('full','正式运行（全量预览）')}${tool('confirm','确认保存知识库','disabled')}</div></div><div class="pipeline-workbench"><aside class="pipeline-palette" aria-label="节点库"><p class="pipeline-palette-head">节点库</p>${NODE_TYPES.map((type,index)=>`<button type="button" class="btn pipeline-palette-node pipeline-type-${type}" draggable="true" data-add-node="${type}" title="拖拽或点击添加：${labels[type]}" aria-label="添加${labels[type]}"><span class="pipeline-palette-index">${index+1}</span><span class="pipeline-node-icon">${icon(type)}</span><span class="pipeline-palette-name">${labels[type]}</span><span class="pipeline-palette-count" hidden></span></button>`).join('')}<p class="pipeline-palette-tip">同一个节点可重复添加，用来分出多条支路。</p></aside><div class="pipeline-canvas-wrap"><div class="pipeline-canvas-tools">${tool('connect-all','按六步顺序串联全部节点')}${tool('disconnect','清空全部连接')}${tool('layout','自动整理节点位置')}${tool('clear-canvas','清空画布')}<span class="pipeline-divider"></span>${tool('export-flow','导出流程 JSON')}${tool('import-flow','导入流程 JSON')}<span class="pipeline-divider"></span>${tool('lock','锁定画布')}<span class="pipeline-divider"></span>${tool('zoom-out','缩小画布')}<button type="button" class="btn pipeline-zoom-reset" data-zoom-reset title="重置为 100%" aria-label="重置缩放"><span data-zoom>100%</span></button>${tool('zoom-in','放大画布')}${tool('fit-canvas','适应画布')}</div><div class="pipeline-canvas-scroll"><div class="pipeline-canvas-space"><div class="pipeline-canvas" data-canvas></div></div></div><p class="pipeline-canvas-empty" data-canvas-empty hidden>从左侧节点库拖入节点开始构建流程：输入 → 本体 → 输出</p><span class="pipeline-canvas-hint">拖动节点移动 · 点击端口连线 · Delete 删除选中 · Ctrl + 滚轮缩放</span><input type="file" accept=".json,application/json" data-import-flow hidden></div><aside class="pipeline-config" data-config></aside></div><section class="pipeline-dock" data-dock=""><nav><button class="btn" data-dock-tab="branches" aria-expanded="false">${icon('link')} 支路</button><button class="btn" data-dock-tab="input" aria-expanded="false">${icon('table')} 输入预览</button><button class="btn" data-dock-tab="results" aria-expanded="false">${icon('list-check')} 运行结果</button><button class="btn pipeline-icon-btn" data-dock-close title="收起预览" aria-label="收起预览">${icon('chevron-down')}</button></nav><div data-branch-list></div><div data-input-preview></div><div data-results></div></section>`;
  renderCanvas(); renderConfig(); renderInput(); renderBranches(); if(result) renderResult(); else showDock(dock);
  refreshEditorState();
  canvasObserver = new ResizeObserver(()=>{ fitCanvas(); for(const grid of grids.values()) grid.resize?.(); });
  canvasObserver.observe(body.querySelector('.pipeline-canvas-scroll')); requestAnimationFrame(fitCanvas);
}
function flowToDrawflow() {
  const data = {};
  for (const node of flow.nodes) {
    data[node.id] = {
      id: node.id,
      name: node.type,
      data: { type: node.type, config: node.config },
      class: `pipeline-node pipeline-node-${node.type}`,
      html: `<div class="pipeline-node-content"><div class="pipeline-node-head"><span class="pipeline-node-icon">${icon(node.type)}</span><strong>${esc(nodeLabel(node, flow.nodes))}</strong><span class="pipeline-node-status" data-ready="${nodeStatus(node)}" title="${nodeIssue(node.id)?.message || (nodeStatus(node) === 'ready' ? '已配置' : '需要配置')}"></span></div><p class="pipeline-node-body"><small>${esc(nodeSummary(node))}</small></p></div>`,
      typenode: false,
      inputs: node.type === 'input' ? {} : { input_1: { connections: [] } },
      outputs: node.type === 'output' ? {} : { output_1: { connections: [] } },
      pos_x: node.x,
      pos_y: node.y,
    };
  }
  for (const edge of flow.edges) {
    const from = data[edge.from], to = data[edge.to];
    if (from?.outputs.output_1 && to?.inputs.input_1) {
      from.outputs.output_1.connections.push({ node: String(edge.to), output: 'input_1' });
      to.inputs.input_1.connections.push({ node: String(edge.from), input: 'output_1' });
    }
  }
  return { drawflow: { Home: { data } } };
}
function syncFlowFromDrawflow() {
  if (!drawflowEditor) return;
  const data = drawflowEditor.drawflow.drawflow.Home.data;
  flow.nodes = Object.values(data).map(node => ({
    id: String(node.id),
    type: node.data.type,
    config: node.data.config,
    x: node.pos_x,
    y: node.pos_y,
  }));
  flow.edges = [];
  for (const node of Object.values(data)) {
    for (const connection of node.outputs?.output_1?.connections || []) {
      flow.edges.push({ from: String(node.id), to: String(connection.node) });
    }
  }
}
function bindDrawflow() {
  const canvas = cleanRoot.querySelector('[data-canvas]');
  canvas.addEventListener('dragover', event => event.preventDefault());
  canvas.addEventListener('drop', event => {
    event.preventDefault();
    const type = event.dataTransfer.getData('text/plain');
    if (!type) return;
    const rect = canvas.getBoundingClientRect();
    addNode(type, (event.clientX - rect.left) / drawflowEditor.zoom, (event.clientY - rect.top) / drawflowEditor.zoom);
  });
  drawflowEditor.on('nodeSelected', id => {
    selected = String(id);
    markSelectedNode();
    renderConfig();
  });
  drawflowEditor.on('nodeUnselected', () => {
    if (!selected) return;
    selected = '';
    markSelectedNode();
    renderConfig();
  });
  drawflowEditor.on('nodeMoved', () => {
    syncFlowFromDrawflow();
    dirty = true;
    refreshEditorState();
  });
  drawflowEditor.on('nodeRemoved', () => {
    syncFlowFromDrawflow();
    selected = '';
    invalidate();
    renderConfig();
    loadFlowData().catch(() => {}).finally(() => renderInput());
  });
  drawflowEditor.on('connectionCreated', connection => {
    const fromId = String(connection.output_id), toId = String(connection.input_id);
    const reject = reason => {
      drawflowEditor.removeSingleConnection(connection.output_id, connection.input_id, connection.output_class, connection.input_class);
      message(cleanRoot, reason, true);
    };
    const from = flow.nodes.find(n => n.id === fromId), to = flow.nodes.find(n => n.id === toId);
    if (!from || !to) return reject('连接引用了不存在的节点');
    if (to.type === 'input') return reject('“实体表输入”是数据源，不能接入上游');
    if (from.type === 'output') return reject('“知识库输出”是最终输出，不能再连接下游');
    // Only newly introduced problems block the link, so a flow can be completed step by step.
    const next = analyzeFlow({ nodes: flow.nodes, edges: [...flow.edges, { from: fromId, to: toId }] });
    if (next.cyclic && !flowAnalysis.cyclic) return reject('该连接会形成循环，请检查上下游');
    const added = next.issues.find(issue => !flowAnalysis.issues.some(old => old.id === issue.id && old.message === issue.message));
    if (added) return reject(added.message);
    syncFlowFromDrawflow();
    invalidate();
    message(cleanRoot, `已连接 ${nodeLabel(from, flow.nodes)} → ${nodeLabel(to, flow.nodes)}`);
    refreshNodeTexts();
  });
  drawflowEditor.on('zoom', () => syncView());
  drawflowEditor.on('translate', () => syncView());
  // Importing a flow resets drawflow's own selection, so keep the panel in sync when the empty canvas is clicked.
  canvas.addEventListener('click', event => {
    if (!selected || event.target.closest('.drawflow-node') || event.target.closest('.drawflow-delete')) return;
    selected = '';
    markSelectedNode();
    renderConfig();
  });
  drawflowEditor.on('connectionRemoved', () => {
    syncFlowFromDrawflow();
    invalidate();
  });
}
function renderCanvas() {
  const canvas=cleanRoot.querySelector('[data-canvas]'); if(!canvas) return;
  refreshAnalysis();
  if (!drawflowEditor) {
    if (!window.Drawflow) throw new Error('Drawflow 组件尚未加载，请刷新重试');
    drawflowEditor = new window.Drawflow(canvas);
    drawflowEditor.reroute = true;
    drawflowEditor.zoom_min = 0.35;
    drawflowEditor.zoom_max = 1.5;
    drawflowEditor.start();
    bindDrawflow();
  } else {
    drawflowEditor.clearModuleSelected();
  }
  drawflowEditor.import(flowToDrawflow());
  for (const node of flow.nodes) {
    const element = cleanRoot.querySelector(`#node-${CSS.escape(node.id)}`);
    element?.setAttribute('data-node', node.id);
    element?.setAttribute('data-type', node.type);
  }
  drawflowEditor.zoom = canvasZoom;
  centerCanvas();
  drawflowEditor.zoom_refresh();
  markSelectedNode();
  markIssues();
  refreshEditorState();
  syncView();
}
function renderConfig() {
  closePipelineTree();
  const host = cleanRoot.querySelector('[data-config]'), node = flow.nodes.find(n => n.id === selected);
  if (!node) { host.innerHTML = '<p>选择节点以配置</p>'; return; }
  const previousBody = host.querySelector('.pipeline-config-body');
  const previousScrollTop = previousBody?.scrollTop || 0;
  let body = '';
  if (node.type === 'input') {
    const table = tableCache.get(String(node.config.tableId || ''));
    const branchCount = flowAnalysis.branches.filter(branch => branch.nodeIds.includes(node.id)).length;
    body = `<label>二维实体表<select data-config-key="tableId">${options(tables, node.config.tableId)}</select></label><p class="muted">${table ? `${esc(table.name)} · ${table.columns.length} 列 · ${table.rowCount} 条` : '请选择录入模块已保存的实体表'}${branchCount > 1 ? `<br>该输入供 ${branchCount} 条支路使用。` : ''}</p>`;
  }
  if (node.type === 'ontology') body = `<label>目标本体<input type="hidden" data-config-key="ontologyId" value="${esc(node.config.ontologyId || '')}"><button type="button" class="pipeline-tree-trigger" data-ontology-tree aria-haspopup="tree" aria-expanded="false" aria-controls="pipelineOntologyPopup"><span>${esc(ontologies.find(o=>o.id===node.config.ontologyId)?.name || '请选择目标本体')}</span>${icon('chevron-down')}</button></label><p class="muted">本体来自当前应用，每条支路对应一个本体。</p>`;
  if (node.type === 'properties') {
    const branch = flowAnalysis.branches.find(item => item.nodeIds.includes(node.id));
    const table = branchTable(branch);
    const propertyList = branchProperties(branch);
    const fields = (table?.columns || []).map(c => ({ id: c, name: c }));
    const shared = flowAnalysis.branches.filter(item => item.nodeIds.includes(node.id));
    const baseColumns = new Set(BASIC_FIELDS.map(f => node.config[f.key]).filter(Boolean));
    body = `${!table ? '<p class="muted">先为上游“实体表输入”选择实体表，再配置字段映射。</p>' : ''}${shared.length > 1 ? `<p class="muted">该节点被 ${shared.length} 条支路共用：${shared.map(item => esc(item.name)).join('、')}。映射需要同时适用于这些支路的目标本体。</p>` : ''}<h3>基础字段对齐</h3><p class="muted">自动识别中英文字段名，可手动调整。名称、别名和描述支持 Wikidata 多语言对象；标签和分类支持多值及分隔符。</p>${BASIC_FIELDS.map(f => `<label>${f.label}${f.required ? ' *' : ''}<select data-config-key="${f.key}">${options(fields.filter(c => c.id === node.config[f.key] || !baseColumns.has(c.id) || (f.key === 'idField' && c.id === node.config.nameField) || (f.key === 'nameField' && c.id === node.config.idField)), node.config[f.key], f.required ? '请选择' : '不导入此基础字段')}</select>${['aliasesField', 'tagsField', 'categoriesField'].includes(f.key) && node.config[f.key] ? listMappingControls(node, f.key) : ''}</label>`).join('')}<label>基础字段语言<select data-config-key="language"><option value="zh" ${node.config.language !== 'en' ? 'selected' : ''}>中文（zh）</option><option value="en" ${node.config.language === 'en' ? 'selected' : ''}>English（en）</option></select></label><h3>字段 → 知识库属性</h3>${fields.filter(f => !baseColumns.has(f.id)).map(f => `<label>${esc(f.name)}<select data-map-field="${esc(f.id)}"><option value="__unmapped__" ${!Object.hasOwn(node.config.mapping || {}, f.id) ? 'selected' : ''}>请选择映射或忽略</option>${options(propertyList, node.config.mapping?.[f.id], '忽略此字段')}</select>${Object.hasOwn(node.config.mapping || {}, f.id) ? listMappingControls(node, f.id) : ''}</label>`).join('')}<p class="muted">基础字段直接写入实体信息，不需要在本体中创建同名属性。其他属性来自目标本体（含继承）。没有该节点时按字段名自动识别基础字段，其余字段忽略。</p>`;
  }
  if (node.type === 'alignment') body = '<p>来源标识和来源 ID 相同 → 已对齐</p><p>名称和本体相同 → 疑似对齐（自动关联）</p><p>没有匹配 → 未对齐（自动创建新实体）</p><p class="muted">运行后在结果明细中查看自动对齐情况。</p>';
  if (node.type === 'fusion') body = `<label>默认冲突策略<select data-config-key="strategy">${[['keep','保留原值'],['replace','使用新值'],['merge','合并为多值']].map(([v,n]) => `<option value="${v}" ${node.config.strategy === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label><p>原值为空时填入新值；相同值自动去重。</p><p>名称冲突保留原名称，新名称加入别名。</p>`;
  if (node.type === 'output') body = '<p>预览运行不修改知识库。</p><p>正式运行先计算全部数据，确认预计结果后再保存到当前应用知识库。</p><p class="muted">失败记录不入库，错误显示在结果明细。</p>';
  host.innerHTML = `<div class="pipeline-config-head pipeline-type-${node.type}"><h3>${icon(node.type)} ${esc(nodeLabel(node, flow.nodes))}</h3>${tool('delete-node','删除节点')}</div><div class="pipeline-config-body">${body}</div>`;
  const nextBody = host.querySelector('.pipeline-config-body');
  if (nextBody) {
    nextBody.scrollTop = previousScrollTop;
    requestAnimationFrame(() => {
      nextBody.scrollTop = previousScrollTop;
      requestAnimationFrame(() => { nextBody.scrollTop = previousScrollTop; });
    });
  }
}
function renderBranches() {
  const host = cleanRoot?.querySelector('[data-branch-list]');
  if (!host) return;
  refreshAnalysis();
  if (!flowAnalysis.branches.length) {
    host.innerHTML = '<p class="muted">还没有“知识库输出”节点。每条支路从“实体表输入”出发，可以经过本体对齐、属性对齐、实体对齐和知识融合，最后到一个知识库输出。</p>';
    return;
  }
  host.innerHTML = flowAnalysis.branches.map(branch => {
    const table = branchTable(branch);
    const ontology = ontologies.find(item => item.id === branch.ontology?.config.ontologyId);
    const steps = branch.nodes.map(node => `<span class="pipeline-branch-step pipeline-type-${node.type}">${esc(nodeLabel(node, flow.nodes))}</span>`).join('<i>→</i>');
    return `<div class="pipeline-branch-card ${branch.ready ? 'is-ready' : 'is-problem'}"><header><strong>${esc(branch.name)}</strong><span>${branch.ready ? '就绪' : '待完善'}</span></header><div class="pipeline-branch-steps">${steps}</div><p class="muted">${esc(table ? `输入表 ${table.name}` : '未选择实体表')} · ${esc(ontology ? `目标本体 ${ontology.name}` : '未选择目标本体')} · 融合策略 ${esc({ keep: '保留原值', replace: '使用新值', merge: '合并为多值' }[branch.strategy] || branch.strategy)}</p>${branch.issues.length ? `<ul class="pipeline-branch-issues">${branch.issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>` : ''}<button class="btn" data-branch-focus="${esc(branch.id)}">定位到该输出节点</button></div>`;
  }).join('');
}
function renderInput() {
  const host = cleanRoot.querySelector('[data-input-preview]'); destroyGrids(host);
  const branch = previewBranch();
  const table = branchTable(branch);
  host.innerHTML = table ? `<h3>输入预览：${esc(table.name)} · ${table.rowCount} 条${branch ? ` · 支路 ${esc(branch.name)}` : ''}</h3><div data-preview-grid></div>` : '<p class="muted">为“实体表输入”节点选择实体表后显示输入预览。</p>';
  if (table) preview(host.querySelector('[data-preview-grid]'), table.columns, table.rows);
}
function nextNodeId(type) {
  const used = new Set(flow.nodes.map(node => node.id));
  if (!used.has(type)) return type;
  for (let index = 2; index <= 6; index += 1) if (!used.has(`${type}-${index}`)) return `${type}-${index}`;
  return '';
}
function addNode(type, x, y) {
  if (!labels[type]) return false;
  const id = nextNodeId(type);
  if (!id) { message(cleanRoot, `“${labels[type]}”最多添加 6 个节点，请先复用或删除已有节点。`); return false; }
  const node = { ...defaultFlow().nodes.find(item => item.type === type), id };
  const dropped = Number.isFinite(x) && Number.isFinite(y);
  if (dropped) { node.x = Math.max(4, x); node.y = Math.max(4, y); }
  else if (flow.nodes.length) { node.x = Math.max(...flow.nodes.map(other => other.x)); node.y = Math.max(...flow.nodes.map(other => other.y)) + NODE_HEIGHT + 56; }
  flow.nodes.push(node); selected = node.id; refreshAnalysis(); invalidate(); renderCanvas(); renderConfig();
  if (!dropped && flow.nodes.length > 1) fitCanvas();
  message(cleanRoot, `已添加“${nodeLabel(node, flow.nodes)}”节点，拖动到合适位置后连接上下游。`);
  return true;
}
function updateConfirm() {
  if (!cleanRoot) return;
  const branches = resultBranches(), busy = cleanRoot.dataset.busy === 'true';
  const pending = branches.filter(branch => branchConfirmable(branch));
  const all = cleanRoot.querySelector('[data-action="confirm"]');
  if (all) {
    const label = pending.length > 1 ? `确认写入全部 ${pending.length} 条支路` : '确认保存知识库';
    all.disabled = !pending.length || busy;
    all.title = pending.length ? label : '暂无可确认的支路';
    all.setAttribute('aria-label', all.title);
  }
  for (const button of cleanRoot.querySelectorAll('[data-branch-confirm]')) {
    const branch = branches.find(item => item.id === button.dataset.branchConfirm);
    button.disabled = !branch || busy || !branchConfirmable(branch);
  }
}
const RESULT_METRICS = { input:'输入记录',aligned:'已对齐实体',suspected:'疑似对齐',unaligned:'未对齐',created:'新增实体',updated:'更新实体',skipped:'跳过记录',attributesAdded:'新增属性',conflicts:'属性冲突',failed:'执行失败',unresolved:'待确认' };
const branchPages = new Map();
/** One entry per knowledge-base output; older runs stored a single flat plan. */
function resultBranches() {
  if (!result) return [];
  const plan = result.result, confirmed = plan.confirmed || [];
  if (Array.isArray(plan.branches) && plan.branches.length) return plan.branches.map(branch => ({ ...branch, confirmed: confirmed.includes(branch.id) }));
  const nodes = plan.flow?.nodes || [], output = nodes.find(node => node.type === 'output');
  const id = output?.id || 'output';
  return [{ id, name: output ? nodeLabel(output, nodes) : '知识库输出', summary: plan.summary || {}, stages: plan.stages || [], rows: plan.rows || [], tableName: '', strategy: '', ontology: null, confirmed: confirmed.includes(id) }];
}
/** Legacy runs stored decisions by row number; qualify them with their single output. */
function normalizeResult(payload) {
  const plan = payload.result || {};
  const branchId = Array.isArray(plan.branches) && plan.branches.length ? '' : ((plan.flow?.nodes || []).find(node => node.type === 'output')?.id || 'output');
  const qualified = {};
  for (const [key, value] of Object.entries(plan.decisions || {})) qualified[branchId && !key.includes(':') ? `${branchId}:${key}` : key] = value;
  plan.decisions = qualified;
  return payload;
}
function branchPaged(branch) {
  const rows = branch.rows || [], page = Math.min(branchPages.get(branch.id) || 0, Math.max(0, Math.ceil(rows.length / 50) - 1));
  return { rows, page, slice: rows.slice(page * 50, (page + 1) * 50) };
}
function branchConfirmable(branch) {
  if (!result || branch.confirmed || result.mode !== 'full' || result.status !== 'pending') return false;
  if ((branch.summary?.unresolved || 0) > 0) return false;
  if (dirty || JSON.stringify(decisions) !== JSON.stringify(result.result.decisions || {})) return false;
  const order = resultBranches(), index = order.findIndex(item => item.id === branch.id);
  return index <= 0 || order.slice(0, index).every(item => item.confirmed);
}
function branchRowsMarkup(branch) {
  const { rows, page, slice } = branchPaged(branch);
  if (!rows.length) return '<p class="muted">该支路没有行级明细（历史运行只保留汇总）。</p>';
  return `<div class="pipeline-scroll"><table><thead><tr>${['行','原始数据','目标本体','属性映射结果','匹配实体 / 对齐状态','决策','融合 / 冲突','错误'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${slice.map(r => {
    const key = `${branch.id}:${r.index}`, decision = decisions[key];
    return `<tr><td>${r.index + 1}</td><td><pre>${esc(JSON.stringify(r.raw,null,2))}</pre></td><td>${esc(r.ontology?.name || '')}</td><td><pre>${esc(JSON.stringify({ 基础字段: r.basic || {}, 属性: r.mapped },null,2))}</pre></td><td>${esc(r.match?.name || '')}<br>${esc(r.match?.id || '')}<br>${esc(r.status)}</td><td>${r.status === '疑似对齐' && result.status !== 'completed' ? `<select data-decision="${esc(key)}"><option value="">请选择处理方式</option><option value="new" ${decision?.action === 'new' ? 'selected' : ''}>创建新实体</option><option value="skip" ${decision?.action === 'skip' ? 'selected' : ''}>跳过</option>${(r.candidates || []).map(c => `<option value="link:${esc(c.id)}" ${decision?.entityId === c.id ? 'selected' : ''}>关联 ${esc(c.name)} (${esc(c.id)})</option>`).join('')}</select>` : esc(r.action)}</td><td>${esc({keep:'保留原值',replace:'使用新值',merge:'合并多值'}[r.strategy])}<details><summary>${(r.conflicts || []).length} 个冲突</summary><pre>${esc(JSON.stringify(r.conflicts,null,2))}</pre></details></td><td>${esc(r.error)}</td></tr>`;
  }).join('')}</tbody></table></div><div class="pipeline-actions"><button class="btn" data-branch-page="${esc(branch.id)}" data-branch-page-step="-1" ${page === 0 ? 'disabled' : ''}>上一页</button><span>${page + 1} / ${Math.max(1, Math.ceil(rows.length / 50))}</span><button class="btn" data-branch-page="${esc(branch.id)}" data-branch-page-step="1" ${(page + 1) * 50 >= rows.length ? 'disabled' : ''}>下一页</button></div>`;
}
function renderResult() {
  const host = cleanRoot.querySelector('[data-results]'); if (!host || !result) return;
  const branches = resultBranches(), multiple = branches.length > 1;
  const title = result.mode === 'preview' ? '预览运行（不写入知识库）' : result.status === 'completed' ? '知识库保存完成' : '全量执行预览（尚未写入）';
  const summary = result.result.summary || {};
  const cards = branches.map(branch => {
    const rows = branch.rows || [];
    const meta = [branch.tableName && `输入表 ${branch.tableName}`, branch.ontology?.name && `目标本体 ${branch.ontology.name}`, branch.strategy && `融合 ${({keep:'保留原值',replace:'使用新值',merge:'合并多值'}[branch.strategy] || branch.strategy)}`].filter(Boolean);
    const state = branch.confirmed ? '已写入知识库' : result.status === 'completed' ? '已写入知识库' : result.mode === 'preview' ? '仅预览' : (branch.summary?.unresolved ? `待确认 ${branch.summary.unresolved} 条` : '待确认写入');
    const confirmable = branchConfirmable(branch);
    return `<section class="pipeline-branch-result ${branch.confirmed ? 'is-done' : ''}"><header><div><strong>${esc(branch.name)}</strong>${meta.length ? `<small>${esc(meta.join(' · '))}</small>` : ''}</div><span class="pipeline-branch-state">${esc(state)}</span><button class="btn" data-branch-confirm="${esc(branch.id)}" ${confirmable ? '' : 'disabled'}>确认写入本条支路</button></header><div class="pipeline-metrics">${Object.entries(RESULT_METRICS).map(([key,name]) => `<div>${name}<strong>${(branch.summary || {})[key] || 0}</strong></div>`).join('')}</div><div class="pipeline-stages">${(branch.stages || []).map(stage => `<span><b>${esc(labels[stage.type] || stage.type)}</b><br>${esc(stage.summary)}</span>`).join('')}</div>${branchRowsMarkup(branch)}</section>`;
  });
  host.innerHTML = `<h3>${title}</h3><div class="pipeline-metrics">${Object.entries(RESULT_METRICS).map(([key,name]) => `<div>${name}<strong>${summary[key] || 0}</strong></div>`).join('')}</div><p class="muted">${multiple ? `共 ${branches.length} 条支路，可以逐条核对并写入；写入顺序与支路顺序一致。` : ''}疑似对齐已自动关联首个候选实体，未对齐已自动创建新实体。可手动调整决策后重新运行。</p><div class="pipeline-branch-results">${cards.join('')}</div>`;
  decorate(host); showDock('results'); updateConfirm();
}
async function confirmBranches(outputIds) {
  if (!result || !outputIds.length) { message(cleanRoot, '暂无可确认的支路。'); return; }
  const branches = resultBranches(), targets = branches.filter(branch => outputIds.includes(branch.id));
  const totals = targets.reduce((sum, branch) => ({ created: sum.created + (branch.summary?.created || 0), updated: sum.updated + (branch.summary?.updated || 0), attributesAdded: sum.attributesAdded + (branch.summary?.attributesAdded || 0), skipped: sum.skipped + (branch.summary?.skipped || 0), failed: sum.failed + (branch.summary?.failed || 0) }), { created: 0, updated: 0, attributesAdded: 0, skipped: 0, failed: 0 });
  const label = targets.length === branches.length ? `全部 ${targets.length} 条支路` : `支路“${targets.map(branch => branch.name).join('、')}”`;
  if (!window.confirm(`确认写入当前知识库？\n${label}\n新增 ${totals.created} 个实体，更新 ${totals.updated} 个实体，新增 ${totals.attributesAdded} 个属性。\n跳过 ${totals.skipped} 条，失败 ${totals.failed} 条不入库。`)) { message(cleanRoot,'已取消保存'); return; }
  result = normalizeResult(await api('confirm', { runId: result.id, confirm: true, outputIds }));
  renderResult();
  message(cleanRoot, result.status === 'completed' ? '知识库保存完成，可在知识管理查看结果。' : '该支路已写入知识库，其余支路确认后完成本次运行。');
}
async function saveFlow() { flow = await api('flows', flow); dirty = false; flows = (await api('flows')).items; refreshEditorState(); }
async function run(mode) {
  await saveFlow();
  result = normalizeResult(await api('run', { flowId: flow.id, mode, decisions })); branchPages.clear(); dirty = false;
  renderResult(); message(cleanRoot, mode === 'preview' ? '预览完成，未修改知识库。' : '全量计算完成。疑似和未对齐实体已自动处理，请检查结果后确认保存。');
}
async function showRuns() {
  closePipelineTree(); canvasObserver?.disconnect(); cleanRoot.querySelector('[data-body]').className='pipeline-list-layout';
  destroyGrids(cleanRoot); const runs = (await api('runs')).items;
  cleanRoot.querySelector('[data-body]').innerHTML = `<div class="pipeline-card"><h3>运行记录</h3><div class="pipeline-scroll"><table><thead><tr><th>时间</th><th>方式</th><th>状态</th><th>输入 / 新增 / 更新 / 失败</th><th>明细</th></tr></thead><tbody>${runs.map(r => `<tr><td>${esc(r.createdAt)}</td><td>${r.mode === 'preview' ? '前100条预览' : '全量运行'}</td><td>${esc({previewed:'已预览',pending:'待确认',completed:'已入库'}[r.status] || r.status)}</td><td>${r.summary.input} / ${r.summary.created} / ${r.summary.updated} / ${r.summary.failed}</td><td><button class="btn" data-run-id="${r.id}">查看结果</button></td></tr>`).join('')}</tbody></table></div></div>`;
  message(cleanRoot, `最近 ${runs.length} 次运行`);
}
function initialize() {
  if (!document.getElementById('entryPanel') || !document.getElementById('cleanPanel')) return;
  entryRoot = shell(document.getElementById('entryPanel'), [['new','新建录入'],['tables','实体表']]);
  cleanRoot = shell(document.getElementById('cleanPanel'), [['flows','清洗流程'],['runs','运行记录']]);
  entryForm(); editor(); decorate(entryRoot); decorate(cleanRoot);
  entryRoot.addEventListener('change', e => { if (e.target.matches('[data-file]')) { workbook = null; const sheet = entryRoot.querySelector('[data-sheet]'); sheet.innerHTML = ''; sheet.hidden = true; } });
  entryRoot.addEventListener('click', e => action(entryRoot, async () => {
    const b = e.target.closest('button'); if (!b) { message(entryRoot,''); return; }
    if (b.dataset.source) { source = b.dataset.source; staged = null; workbook = null; entryForm(); message(entryRoot,''); }
    else if (b.dataset.tab === 'new') { setTab(entryRoot,'new'); entryForm(); message(entryRoot,''); }
    else if (b.dataset.tab === 'tables') { setTab(entryRoot,'tables'); await showTables(); }
    else if (b.dataset.action === 'read-file') await readFile();
    else if (b.dataset.action?.startsWith('mysql-')) {
      const config = Object.fromEntries([...entryRoot.querySelectorAll('[data-mysql]')].map(i => [i.dataset.mysql,i.value]));
      const data = await api('mysql', { ...config, demo: entryRoot.querySelector('[data-demo]').checked, action: b.dataset.action.slice(6) });
      if (b.dataset.action === 'mysql-read') { staged = { ...data, sourceType:'mysql',name:config.connectionName || config.table || '数据库实体表' }; renderStaged(); }
      message(entryRoot, b.dataset.action === 'mysql-fields' ? '字段：' + data.columns.join('、') + (data.demo ? '（演示数据）' : '') : data.message || `已读取 ${data.rows.length} 条记录`);
    } else if (b.dataset.action === 'save-table') {
      const columns = [...entryRoot.querySelectorAll('[data-column]:checked')].map(i => i.dataset.column);
      const saved = await api('tables', { ...staged, columns, name:entryRoot.querySelector('[data-table-name]').value, sourceKey:entryRoot.querySelector('[data-source-key]').value });
      setTab(entryRoot,'tables'); await showTables(); message(entryRoot, `“${saved.name}”已保存为实体表，可开始清洗；知识库未修改。`);
    } else if (b.dataset.tableView) { const t = await api('tables/' + b.dataset.tableView); await preview(entryRoot.querySelector('[data-saved-preview]'),t.columns,t.rows); message(entryRoot,`预览 ${t.name}（前100条）`); }
    else if (b.dataset.tableExportOntology) { const t = await api('tables/' + b.dataset.tableExportOntology); downloadOntologyJson(t); }
    else if (b.dataset.tableClean) { flow = defaultFlow(b.dataset.tableClean); selected = 'input'; invalidate(); window.setViewMode('clean'); await open('clean'); }
  }));
  cleanRoot.addEventListener('dragstart', e => { const b = e.target.closest('[data-add-node]'); if (b) e.dataTransfer.setData('text/plain',b.dataset.addNode); });
  cleanRoot.addEventListener('change', e => action(cleanRoot, async () => {
    const t = e.target, n = flow.nodes.find(n => n.id === selected);
    if (t.matches('[data-import-flow]')) {
      const file = t.files?.[0]; t.value = '';
      if (!file) return;
      const parsed = JSON.parse(await file.text());
      const source = Array.isArray(parsed?.nodes) ? parsed.nodes : null;
      if (!source?.length) throw new Error('流程文件缺少 nodes 数组');
      if (source.some(node => !NODE_TYPES.includes(node?.type))) throw new Error('流程文件包含未知的节点类型');
      const idMap = new Map(), used = new Set(), nodes = source.map(node => {
        const original = String(node.id ?? '');
        let id = original || String(node.type);
        if (used.has(id)) { let suffix = 2; while (used.has(`${node.type}-${suffix}`)) suffix += 1; id = `${node.type}-${suffix}`; }
        used.add(id);
        idMap.set(original || String(node.type), id);
        return { id, type: node.type, x: Number(node.x) || 0, y: Number(node.y) || 0, config: node.config && typeof node.config === 'object' ? node.config : {} };
      });
      const edges = [];
      for (const edge of Array.isArray(parsed.edges) ? parsed.edges : []) {
        const from = idMap.get(String(edge?.from)), to = idMap.get(String(edge?.to));
        if (!from || !to || from === to) continue;
        if (!edges.some(existing => existing.from === from && existing.to === to)) edges.push({ from, to });
      }
      flow = { id: '', name: String(parsed.name || file.name.replace(/\.json$/i, '') || '导入的清洗流程'), nodes, edges };
      selected = nodes[0]?.id || '';
      await loadFlowData(); invalidate(); editor();
      message(cleanRoot, `已导入流程“${flow.name}”（${nodes.length} 个节点 / ${edges.length} 条连接）${flowAnalysis.valid ? '，可以直接运行。' : '，请先在“支路”面板处理提示。'}`);
      return;
    }
    if (t.dataset.decision !== undefined) {
      const value = t.value; if (!value) delete decisions[t.dataset.decision]; else decisions[t.dataset.decision] = value.startsWith('link:') ? { action:'link',entityId:value.slice(5) } : { action:value };
      dirty = true; updateConfirm(); message(cleanRoot,'决策已调整，请重新预览或正式运行。'); return;
    }
    if (t.matches('[data-flow-select]') && t.value) { flow = await api('flows/' + t.value); selected = flow.nodes[0]?.id || ''; invalidate(); await loadFlowData(); editor(); dirty = false; }
    else if (t.matches('[data-flow-name]')) { flow.name = t.value; invalidate(); }
    else if (t.dataset.configKey && n) {
      n.config[t.dataset.configKey] = t.value;
      if (BASIC_FIELDS.some(f => f.key === t.dataset.configKey) && t.value) delete n.config.mapping?.[t.value];
      if (['tableId','ontologyId'].includes(t.dataset.configKey)) {
        if (t.dataset.configKey === 'tableId') tableCache.delete(t.value); else propertyCache.delete(t.value);
        // The mapping of the branch 属性对齐 node belongs to the previous table/ontology.
        const branch = flowAnalysis.branches.find(item => item.nodeIds.includes(n.id));
        if (branch?.properties) branch.properties.config = { ...branch.properties.config, mapping: {} };
        await loadFlowData(); renderInput();
      }
      invalidate(); renderCanvas(); renderConfig();
    } else if (t.dataset.mappingOption && n) {
      n.config.mappingOptions ||= {};
      n.config.mappingOptions[t.dataset.mappingOption] ||= {};
      n.config.mappingOptions[t.dataset.mappingOption][t.dataset.mappingOptionKey] = t.dataset.mappingOptionKey === 'multi' ? t.checked : t.value;
      if (t.dataset.mappingOptionKey === 'multi') {
        const separator = t.closest('.pipeline-mapping-options')?.querySelector('[data-mapping-option-key="separator"]');
        if (separator) separator.hidden = !t.checked;
      }
      invalidate();
    } else if (t.dataset.mapField && n) {
      const configBody = cleanRoot.querySelector('.pipeline-config-body');
      const scrollTop = configBody?.scrollTop || 0;
      n.config.mapping ||= {};
      if (t.value === '__unmapped__') delete n.config.mapping[t.dataset.mapField];
      else n.config.mapping[t.dataset.mapField] = t.value;
      invalidate();
      renderConfig();
      if (configBody) requestAnimationFrame(() => { configBody.scrollTop = scrollTop; });
    }
    message(cleanRoot,'配置已更新，请保存流程或运行预览。');
  }));
  cleanRoot.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if(b.hasAttribute('data-ontology-tree')) { openPipelineTree(b,ontologyTree,cleanRoot.querySelector('[data-config-key="ontologyId"]')); return; }
    if(b.dataset.dockTab) { showDock(dock===b.dataset.dockTab?'':b.dataset.dockTab); return; }
    if(b.hasAttribute('data-dock-close')) { showDock(''); return; }
    if(b.hasAttribute('data-zoom-reset')) { drawflowEditor?.zoom_reset(); syncView(); return; }
    action(cleanRoot, async () => {
      const cmd = b.dataset.action;
      if (cmd === 'fit-canvas') { fitCanvas(); message(cleanRoot,''); return; }
      if (cmd === 'zoom-in') { drawflowEditor?.zoom_in(); syncView(); return; }
      if (cmd === 'zoom-out') { drawflowEditor?.zoom_out(); syncView(); return; }
      if (cmd === 'lock') { locked = !locked; if (drawflowEditor) drawflowEditor.editor_mode = locked ? 'fixed' : 'edit'; refreshEditorState(); message(cleanRoot, locked ? '画布已锁定：节点位置和连线暂不可编辑。' : '画布已解锁，可拖动节点和连线。'); return; }
      if (b.dataset.tab === 'runs') { setTab(cleanRoot,'runs'); await showRuns(); return; }
      if (b.dataset.tab === 'flows') { setTab(cleanRoot,'flows'); await loadCatalog(); editor(); }
      else if (b.dataset.addNode) { addNode(b.dataset.addNode); return; }
      else if (b.dataset.branchFocus) { selected = b.dataset.branchFocus; markSelectedNode(); renderConfig(); renderInput(); showDock('branches'); message(cleanRoot, `已选中 ${nodeLabel(flow.nodes.find(node => node.id === selected), flow.nodes)}`); return; }
      else if (b.dataset.branchPage) { branchPages.set(b.dataset.branchPage, Math.max(0, (branchPages.get(b.dataset.branchPage) || 0) + Number(b.dataset.branchPageStep))); renderResult(); return; }
      else if (b.dataset.branchConfirm) { await confirmBranches([b.dataset.branchConfirm]); return; }
      else if (cmd === 'new-flow') { flow = defaultFlow(); selected = 'input'; branchPages.clear(); invalidate(); editor(); }
      else if (cmd === 'export-flow') { const name = downloadJson(flow.name || 'pipeline-flow', { version: 1, name: flow.name, nodes: flow.nodes.map(({ id, type, x, y, config }) => ({ id, type, x, y, config })), edges: flow.edges.map(({ from, to }) => ({ from, to })) }); message(cleanRoot, `已导出 ${name}（${flow.nodes.length} 个节点 / ${flow.edges.length} 条连接）。`); return; }
      else if (cmd === 'import-flow') { cleanRoot.querySelector('[data-import-flow]').click(); message(cleanRoot,'选择要导入的流程 JSON 文件。'); return; }
      else if (cmd === 'layout') { const branches = refreshAnalysis().branches; if (branches.length > 1) layoutBranches(flow.nodes, branches); else layoutFlow(flow.nodes); invalidate(); renderCanvas(); fitCanvas(); message(cleanRoot, branches.length > 1 ? '已按支路分行整理节点位置。' : '已按六步顺序整理节点位置。'); return; }
      else if (cmd === 'clear-canvas') {
        if (!flow.nodes.length) { message(cleanRoot,'画布已经是空的。'); return; }
        if (!window.confirm('清空画布上的全部节点和连接？')) { message(cleanRoot,'已取消清空画布。'); return; }
        flow.nodes = []; flow.edges = []; selected = '';
        invalidate(); renderCanvas(); renderConfig(); renderInput();
        message(cleanRoot,'画布已清空，可从左侧节点库重新构建流程。'); return;
      }
      else if (cmd === 'save-flow') { flow.name = cleanRoot.querySelector('[data-flow-name]').value; await saveFlow(); message(cleanRoot,'流程已保存'); return; }
      else if (cmd === 'delete-node') { flow.nodes = flow.nodes.filter(n => n.id !== selected); flow.edges = flow.edges.filter(edge => edge.from !== selected && edge.to !== selected); selected = ''; invalidate(); await loadFlowData(); renderCanvas(); renderConfig(); renderInput(); }
      else if (cmd === 'connect-all') {
        const duplicated = NODE_TYPES.find(type => flow.nodes.filter(node => node.type === type).length > 1);
        if (duplicated) throw new Error(`画布上有多个“${labels[duplicated]}”节点，请手动连接，或先删除多余节点。`);
        const ordered = NODE_TYPES.map(type => flow.nodes.find(node => node.type === type)).filter(Boolean);
        if (ordered.length < 2) throw new Error('请先添加需要串联的节点');
        flow.edges = ordered.slice(1).map((node, i) => ({ from: ordered[i].id, to: node.id }));
        invalidate(); renderCanvas();
        message(cleanRoot, `已按六步顺序串联 ${ordered.length} 个节点。`);
      }
      else if (cmd === 'disconnect') { flow.edges = []; invalidate(); renderCanvas(); }
      else if (cmd === 'preview' || cmd === 'full') { await run(cmd); return; }
      else if (cmd === 'confirm') {
        await confirmBranches(resultBranches().filter(branch => branchConfirmable(branch)).map(branch => branch.id));
        return;
      }
      else if (b.dataset.runId) { result = normalizeResult(await api('runs/' + b.dataset.runId)); flow = structuredClone(result.result.flow || flow); decisions = structuredClone(result.result.decisions || {}); branchPages.clear(); dirty = false; await loadFlowData(); selected = flowAnalysis.branches[0]?.id || flow.nodes[0]?.id || ''; setTab(cleanRoot,'flows'); editor(); }
      message(cleanRoot,'');
    });
  });
}
async function open(mode) {
  if (!entryRoot) initialize();
  if (mode === 'entry') { document.getElementById('tbEntryControls')?.style.setProperty('display','none'); }
  if (mode === 'clean') {
    document.getElementById('tbCleanControls')?.style.setProperty('display','none');
    await action(cleanRoot, async () => { await loadCatalog(); setTab(cleanRoot,'flows'); destroyGrids(cleanRoot); editor(); message(cleanRoot,''); });
  }
}
window.openPipeline = mode => { open(mode).catch(error => message(mode === 'clean' ? cleanRoot : entryRoot,error.message,true)); };
initialize();
if (['entry','clean'].includes(window.kbViewMode)) window.openPipeline(window.kbViewMode);
