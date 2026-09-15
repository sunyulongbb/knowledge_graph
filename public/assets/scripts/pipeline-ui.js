import { openPipelineTree, closePipelineTree } from './pipeline-tree.js';
import { parseCsv, parseJsonTable, matrixToTable, defaultFlow } from './pipeline-data.js';
import { BASIC_FIELDS, inferBasicFields } from './pipeline-fields.js';

const labels = { input: '实体表输入', ontology: '本体对齐', properties: '属性对齐', alignment: '实体对齐', fusion: '知识融合', output: '知识库输出' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = v => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
const options = (items, selected, label = '请选择') => `<option value="">${label}</option>` + items.map(i => `<option value="${esc(i.id)}" ${i.id === selected ? 'selected' : ''}>${esc(i.name || i.id)}</option>`).join('');
let entryRoot, cleanRoot, source = 'file', staged = null, tables = [], flows = [], ontologies = [], properties = [], activeTable = null;
let flow = defaultFlow(), selected = 'input', result = null, decisions = {}, resultPage = 0, dirty = false;
const grids = new Map();
let ontologyTree = [], canvasZoom = 1, canvasObserver, dock = '', drawflowEditor = null;
const icons = { input:'table', ontology:'sitemap', properties:'list-check', alignment:'link', fusion:'code-merge', output:'database', 'new-flow':'plus', 'save-flow':'floppy-disk', preview:'play', full:'forward', confirm:'database', 'delete-node':'trash-can', 'connect-all':'link', disconnect:'link-slash', 'fit-canvas':'expand', 'zoom-in':'plus', 'zoom-out':'minus', 'read-file':'file-import', 'save-table':'floppy-disk', 'mysql-test':'plug', 'mysql-fields':'list', 'mysql-read':'download', 'result-prev':'chevron-left', 'result-next':'chevron-right' };
const iconPaths = {
  table:'M3 3h18v18H3z M3 9h18 M9 9v12', sitemap:'M9 2h6v5H9z M2 17h6v5H2z M16 17h6v5h-6z M12 7v5 M5 17v-5h14v5',
  'list-check':'m3 6 2 2 3-4 M11 6h10 m-18 9 2 2 3-4 M11 15h10', link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  'code-merge':'M6 5v14 M18 5c0 8-12 4-12 10 M4 3h4v4H4z M16 3h4v4h-4z M4 17h4v4H4z', database:'M3 5c0-4 18-4 18 0s-18 4-18 0v14c0 4 18 4 18 0V5 M3 12c0 4 18 4 18 0',
  plus:'M12 5v14 M5 12h14', minus:'M5 12h14', 'floppy-disk':'M3 3h15l3 3v15H3z M7 3v6h10V3 M7 21v-8h10v8', play:'m7 3 14 9-14 9z', forward:'m3 5 9 7-9 7z m9 0 9 7-9 7z',
  'trash-can':'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7', 'link-slash':'M3 3l18 18 M14 5l1-1a4 4 0 0 1 6 6l-1 1 M10 19l-1 1a4 4 0 0 1-6-6l1-1',
  expand:'M9 3H3v6 M15 3h6v6 M21 15v6h-6 M3 15v6h6', 'file-import':'M14 2H4v7 M4 17v5h16V8l-6-6v6h6 M2 13h10 m-4-4 4 4-4 4', plug:'M8 2v5 M16 2v5 M5 7h14 M7 7v5a5 5 0 0 0 10 0V7 M12 17v5',
  list:'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1', download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  filter:'M3 3h18l-7 8v8l-4 2V11z', 'chevron-left':'m15 5-7 7 7 7', 'chevron-right':'m9 5 7 7-7 7', 'chevron-down':'m5 9 7 7 7-7',
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
function fitCanvas() {
  const viewport=cleanRoot?.querySelector('.pipeline-canvas-scroll'); if (!viewport || !viewport.clientWidth) return;
  const width=Math.max(500,...flow.nodes.map(n=>n.x+210)),height=Math.max(300,...flow.nodes.map(n=>n.y+100));
  canvasZoom=Math.max(.5,Math.min(1,(viewport.clientWidth-24)/width,(viewport.clientHeight-24)/height));
  if (drawflowEditor) {
    drawflowEditor.zoom = canvasZoom;
    centerCanvas();
    drawflowEditor.zoom_refresh();
  }
  cleanRoot.querySelector('[data-zoom]').textContent=Math.round(canvasZoom*100)+'%';
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
  const maxX = Math.max(...nodes.map(node => node.x + 184));
  const maxY = Math.max(...nodes.map(node => node.y + 80));
  drawflowEditor.canvas_x = (viewport.clientWidth - (maxX - minX) * canvasZoom) / 2 - minX * canvasZoom;
  drawflowEditor.canvas_y = (viewport.clientHeight - (maxY - minY) * canvasZoom) / 2 - minY * canvasZoom;
}
function nodeSummary(n) {
  if(n.type==='input') return activeTable?.name || '选择实体表';
  if(n.type==='ontology') return ontologies.find(o=>o.id===n.config.ontologyId)?.name || '选择目标本体';
  if(n.type==='properties') return n.config.nameField ? '名称：'+n.config.nameField : '配置基础字段与属性';
  return {alignment:'来源 ID / 名称匹配',fusion:{keep:'冲突保留原值',replace:'冲突使用新值',merge:'合并为多值'}[n.config.strategy] || '设置融合策略',output:'确认后写入知识库'}[n.type];
}
function listMappingControls(node, key) {
  const option = node.config.mappingOptions?.[key] || {};
  const separator = option.separator ?? ' ';
  const checked = option.multi === true;
  return `<span class="pipeline-mapping-options"><label><input type="checkbox" data-mapping-option="${esc(key)}" data-mapping-option-key="multi" ${checked ? 'checked' : ''}>多值</label><input class="pipeline-mapping-separator" data-mapping-option="${esc(key)}" data-mapping-option-key="separator" value="${esc(separator)}" placeholder="分隔符（默认空格）" aria-label="${esc(key)}分隔符" ${checked ? '' : 'hidden'}></span>`;
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
  finally { decorate(root); buttons.forEach(b => b.disabled = false); root.dataset.busy = ''; root.removeAttribute('aria-busy'); updateConfirm(); }
}
function invalidate() { result = null; decisions = {}; dirty = true; if (cleanRoot) { cleanRoot.querySelector('[data-results]').innerHTML = ''; updateConfirm(); } }
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
async function loadFlowData() {
  const tableId = flow.nodes.find(n => n.type === 'input')?.config.tableId;
  activeTable = tableId ? await api('tables/' + encodeURIComponent(tableId)) : null;
  const ontologyId = flow.nodes.find(n => n.type === 'ontology')?.config.ontologyId;
  properties = ontologyId ? (await api('properties?ontologyId=' + encodeURIComponent(ontologyId))).items : [];
  const props = flow.nodes.find(n => n.type === 'properties');
  if (props && activeTable) props.config = inferBasicFields(activeTable.columns, props.config);
}
function editor() {
  closePipelineTree(); canvasObserver?.disconnect(); destroyGrids(cleanRoot);
  drawflowEditor = null;
  const body=cleanRoot.querySelector('[data-body]'); body.className='pipeline-editor-layout';
  body.innerHTML = `<div class="pipeline-toolbar"><label class="pipeline-flow-title"><span class="sr-only">流程名称</span><input data-flow-name aria-label="流程名称" value="${esc(flow.name)}"></label><select data-flow-select aria-label="已有流程">${options(flows,flow.id,'打开已有流程')}</select><div class="pipeline-actions">${tool('new-flow','新建流程')}${tool('save-flow','保存流程')}<span class="pipeline-divider"></span>${tool('preview','预览运行（前100条）')}${tool('full','正式运行（全量预览）')}${tool('confirm','确认保存知识库','disabled')}</div></div><div class="pipeline-workbench"><aside class="pipeline-palette" aria-label="可用节点">${Object.entries(labels).map(([type,name])=>`<button type="button" class="btn pipeline-palette-node" draggable="true" data-add-node="${type}" title="拖拽或点击添加：${name}" aria-label="添加${name}">${icon(type)}<span>${name.slice(0,2)}</span></button>`).join('')}</aside><div class="pipeline-canvas-wrap"><div class="pipeline-canvas-tools">${tool('connect-all','按流程顺序连接')}${tool('disconnect','清空连接')}<span class="pipeline-divider"></span>${tool('zoom-out','缩小画布')}<span data-zoom></span>${tool('zoom-in','放大画布')}${tool('fit-canvas','适应画布')}</div><div class="pipeline-canvas-scroll"><div class="pipeline-canvas-space"><div class="pipeline-canvas" data-canvas></div></div></div><span class="pipeline-canvas-hint">拖动标题移动 · 点击端口连接</span></div><aside class="pipeline-config" data-config></aside></div><section class="pipeline-dock" data-dock=""><nav><button class="btn" data-dock-tab="input" aria-expanded="false">${icon('table')} 输入预览</button><button class="btn" data-dock-tab="results" aria-expanded="false">${icon('list-check')} 运行结果</button><button class="btn pipeline-icon-btn" data-dock-close title="收起预览" aria-label="收起预览">${icon('chevron-down')}</button></nav><div data-input-preview></div><div data-results></div></section>`;
  renderCanvas(); renderConfig(); renderInput(); if(result) renderResult(); else showDock(dock);
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
      html: `<div class="pipeline-node-content" data-select-node="${esc(node.id)}"><span class="pipeline-node-icon">${icon(node.type)}</span><span><strong>${labels[node.type]}</strong><small>${esc(nodeSummary(node))}</small></span></div>`,
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
    const rect = canvas.getBoundingClientRect();
    addNode(type, (event.clientX - rect.left) / drawflowEditor.zoom, (event.clientY - rect.top) / drawflowEditor.zoom);
  });
  drawflowEditor.on('nodeSelected', id => {
    selected = String(id);
    renderConfig();
  });
  drawflowEditor.on('nodeMoved', () => {
    syncFlowFromDrawflow();
    dirty = true;
  });
  drawflowEditor.on('nodeRemoved', () => {
    syncFlowFromDrawflow();
    selected = '';
    invalidate();
    renderConfig();
  });
  drawflowEditor.on('connectionCreated', connection => {
    const from = flow.nodes.find(n => n.id === String(connection.output_id));
    const to = flow.nodes.find(n => n.id === String(connection.input_id));
    if (!from || !to || Object.keys(labels).indexOf(to.type) !== Object.keys(labels).indexOf(from.type) + 1) {
      drawflowEditor.removeSingleConnection(connection.output_id, connection.input_id, connection.output_class, connection.input_class);
      message(cleanRoot, '仅支持按六步顺序连接相邻节点', true);
      return;
    }
    syncFlowFromDrawflow();
    invalidate();
  });
  drawflowEditor.on('connectionRemoved', () => {
    syncFlowFromDrawflow();
    invalidate();
  });
}
function renderCanvas() {
  const canvas=cleanRoot.querySelector('[data-canvas]'); if(!canvas) return;
  if (!drawflowEditor) {
    if (!window.Drawflow) throw new Error('Drawflow 组件尚未加载，请刷新重试');
    drawflowEditor = new window.Drawflow(canvas);
    drawflowEditor.reroute = true;
    drawflowEditor.zoom_min = 0.5;
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
  cleanRoot.querySelector('[data-zoom]').textContent=Math.round(canvasZoom*100)+'%';
}
function renderConfig() {
  closePipelineTree();
  const host = cleanRoot.querySelector('[data-config]'), node = flow.nodes.find(n => n.id === selected);
  if (!node) { host.innerHTML = '<p>选择节点以配置</p>'; return; }
  const previousBody = host.querySelector('.pipeline-config-body');
  const previousScrollTop = previousBody?.scrollTop || 0;
  let body = '';
  if (node.type === 'input') body = `<label>二维实体表<select data-config-key="tableId">${options(tables, node.config.tableId)}</select></label><p class="muted">${activeTable ? `${esc(activeTable.name)} · ${activeTable.columns.length} 列 · ${activeTable.rowCount} 条` : '请选择录入模块已保存的实体表'}</p>`;
  if (node.type === 'ontology') body = `<label>目标本体<input type="hidden" data-config-key="ontologyId" value="${esc(node.config.ontologyId || '')}"><button type="button" class="pipeline-tree-trigger" data-ontology-tree aria-haspopup="tree" aria-expanded="false" aria-controls="pipelineOntologyPopup"><span>${esc(ontologies.find(o=>o.id===node.config.ontologyId)?.name || '请选择目标本体')}</span>${icon('chevron-down')}</button></label><p class="muted">本体来自当前应用，每张表对应一个本体。</p>`;
  if (node.type === 'properties') {
    const fields = (activeTable?.columns || []).map(c => ({ id: c, name: c }));
    const baseColumns = new Set(BASIC_FIELDS.map(f => node.config[f.key]).filter(Boolean));
    body = `<h3>基础字段对齐</h3><p class="muted">自动识别中英文字段名，可手动调整。名称、别名和描述支持 Wikidata 多语言对象；标签和分类支持多值及分隔符。</p>${BASIC_FIELDS.map(f => `<label>${f.label}${f.required ? ' *' : ''}<select data-config-key="${f.key}">${options(fields.filter(c => c.id === node.config[f.key] || !baseColumns.has(c.id) || (f.key === 'idField' && c.id === node.config.nameField) || (f.key === 'nameField' && c.id === node.config.idField)), node.config[f.key], f.required ? '请选择' : '不导入此基础字段')}</select>${['aliasesField', 'tagsField', 'categoriesField'].includes(f.key) && node.config[f.key] ? listMappingControls(node, f.key) : ''}</label>`).join('')}<label>基础字段语言<select data-config-key="language"><option value="zh" ${node.config.language !== 'en' ? 'selected' : ''}>中文（zh）</option><option value="en" ${node.config.language === 'en' ? 'selected' : ''}>English（en）</option></select></label><h3>字段 → 知识库属性</h3>${fields.filter(f => !baseColumns.has(f.id)).map(f => `<label>${esc(f.name)}<select data-map-field="${esc(f.id)}"><option value="__unmapped__" ${!Object.hasOwn(node.config.mapping || {}, f.id) ? 'selected' : ''}>请选择映射或忽略</option>${options(properties, node.config.mapping?.[f.id], '忽略此字段')}</select>${Object.hasOwn(node.config.mapping || {}, f.id) ? listMappingControls(node, f.id) : ''}</label>`).join('')}<p class="muted">基础字段直接写入实体信息，不需要在本体中创建同名属性。其他属性来自目标本体（含继承）。</p>`;
  }
  if (node.type === 'alignment') body = '<p>来源标识和来源 ID 相同 → 已对齐</p><p>名称和本体相同 → 疑似对齐</p><p>没有匹配 → 未对齐，创建新实体</p><p class="muted">在运行结果中处理疑似记录，再重新运行。</p>';
  if (node.type === 'fusion') body = `<label>默认冲突策略<select data-config-key="strategy">${[['keep','保留原值'],['replace','使用新值'],['merge','合并为多值']].map(([v,n]) => `<option value="${v}" ${node.config.strategy === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label><p>原值为空时填入新值；相同值自动去重。</p><p>名称冲突保留原名称，新名称加入别名。</p>`;
  if (node.type === 'output') body = '<p>预览运行不修改知识库。</p><p>正式运行先计算全部数据，确认预计结果后再保存到当前应用知识库。</p><p class="muted">失败记录不入库，错误显示在结果明细。</p>';
  host.innerHTML = `<header class="pipeline-config-head"><h3>${icon(node.type)} ${labels[node.type]}</h3>${tool('delete-node','删除节点')}</header><div class="pipeline-config-body">${body}</div>`;
  const nextBody = host.querySelector('.pipeline-config-body');
  if (nextBody) {
    nextBody.scrollTop = previousScrollTop;
    requestAnimationFrame(() => {
      nextBody.scrollTop = previousScrollTop;
      requestAnimationFrame(() => { nextBody.scrollTop = previousScrollTop; });
    });
  }
}
function renderInput() {
  const host = cleanRoot.querySelector('[data-input-preview]'); destroyGrids(host);
  host.innerHTML = activeTable ? `<h3>输入预览：${esc(activeTable.name)} · ${activeTable.rowCount} 条</h3><div data-preview-grid></div>` : '<p class="muted">选择实体表后显示输入预览。</p>';
  if (activeTable) preview(host.querySelector('[data-preview-grid]'), activeTable.columns, activeTable.rows);
}
function addNode(type, x = 30, y = 30) {
  if (!labels[type]) return;
  if (flow.nodes.some(n => n.type === type)) { message(cleanRoot, '每种节点只能添加一个，可拖动已有节点。'); return; }
  const n = defaultFlow().nodes.find(n => n.type === type); n.x = Math.max(4, x); n.y = Math.max(4, y); flow.nodes.push(n); selected = n.id; invalidate(); renderCanvas(); renderConfig();
}
function updateConfirm() {
  const button = cleanRoot?.querySelector('[data-action="confirm"]');
  if (button) button.disabled = !result || result.mode !== 'full' || result.status !== 'pending' || result.result.summary.unresolved > 0 || dirty || JSON.stringify(decisions) !== JSON.stringify(result.result.decisions || {}) || cleanRoot.dataset.busy === 'true';
}
function renderResult() {
  const host = cleanRoot.querySelector('[data-results]'); if (!host || !result) return;
  const { summary, rows, stages } = result.result;
  const metrics = { input:'输入记录',aligned:'已对齐实体',suspected:'疑似对齐',unaligned:'未对齐',created:'新增实体',updated:'更新实体',skipped:'跳过记录',attributesAdded:'新增属性',conflicts:'属性冲突',failed:'执行失败',unresolved:'待确认' };
  const slice = rows.slice(resultPage * 50, (resultPage + 1) * 50);
  host.innerHTML = `<h3>${result.mode === 'preview' ? '预览运行（不写入知识库）' : result.status === 'completed' ? '知识库保存完成' : '全量执行预览（尚未写入）'}</h3><div class="pipeline-metrics">${Object.entries(metrics).map(([key,name]) => `<div>${name}<strong>${summary[key] || 0}</strong></div>`).join('')}</div><p class="muted">新增实体包含为实体引用属性生成的尾实体。疑似记录选择后须重新运行；失败记录将跳过。</p><div class="pipeline-stages">${stages.map(s => `<span><b>${labels[s.type]}</b><br>${esc(s.summary)}</span>`).join('')}</div><div class="pipeline-scroll"><table><thead><tr>${['行','原始数据','目标本体','属性映射结果','匹配实体 / 对齐状态','决策','融合 / 冲突','错误'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${slice.map(r => `<tr><td>${r.index + 1}</td><td><pre>${esc(JSON.stringify(r.raw,null,2))}</pre></td><td>${esc(r.ontology.name)}</td><td><pre>${esc(JSON.stringify({ 基础字段: r.basic || {}, 属性: r.mapped },null,2))}</pre></td><td>${esc(r.match?.name || '')}<br>${esc(r.match?.id || '')}<br>${esc(r.status)}</td><td>${r.status === '疑似对齐' && result.status !== 'completed' ? `<select data-decision="${r.index}"><option value="">请选择处理方式</option><option value="new" ${decisions[r.index]?.action === 'new' ? 'selected' : ''}>创建新实体</option><option value="skip" ${decisions[r.index]?.action === 'skip' ? 'selected' : ''}>跳过</option>${r.candidates.map(c => `<option value="link:${esc(c.id)}" ${decisions[r.index]?.entityId === c.id ? 'selected' : ''}>关联 ${esc(c.name)} (${esc(c.id)})</option>`).join('')}</select>` : esc(r.action)}</td><td>${esc({keep:'保留原值',replace:'使用新值',merge:'合并多值'}[r.strategy])}<details><summary>${r.conflicts.length} 个冲突</summary><pre>${esc(JSON.stringify(r.conflicts,null,2))}</pre></details></td><td>${esc(r.error)}</td></tr>`).join('')}</tbody></table></div><div class="pipeline-actions"><button class="btn" data-action="result-prev" ${resultPage === 0 ? 'disabled' : ''}>上一页</button><span>${resultPage + 1} / ${Math.max(1,Math.ceil(rows.length / 50))}</span><button class="btn" data-action="result-next" ${(resultPage + 1) * 50 >= rows.length ? 'disabled' : ''}>下一页</button></div>`;
  decorate(host); showDock('results'); updateConfirm();
}
async function saveFlow() { flow = await api('flows', flow); dirty = false; flows = (await api('flows')).items; }
async function run(mode) {
  await saveFlow();
  result = await api('run', { flowId: flow.id, mode, decisions }); resultPage = 0; dirty = false;
  renderResult(); message(cleanRoot, mode === 'preview' ? '预览完成，未修改知识库。' : '全量计算完成。请检查结果，处理疑似对齐后确认保存。');
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
        const props = flow.nodes.find(n => n.type === 'properties'); if (props) props.config = t.dataset.configKey === 'tableId' ? { mapping:{} } : { ...props.config, mapping:{} };
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
    action(cleanRoot, async () => {
      const cmd = b.dataset.action;
      if (cmd === 'fit-canvas') { fitCanvas(); message(cleanRoot,''); return; }
      if (cmd === 'zoom-in' || cmd === 'zoom-out') { canvasZoom=Math.max(.25,Math.min(1.5,canvasZoom+(cmd==='zoom-in' ? .1 : -.1))); renderCanvas(); message(cleanRoot,''); return; }
      if (b.dataset.tab === 'runs') { setTab(cleanRoot,'runs'); await showRuns(); return; }
      if (b.dataset.tab === 'flows') { setTab(cleanRoot,'flows'); await loadCatalog(); editor(); }
      else if (b.dataset.addNode) addNode(b.dataset.addNode);
      else if (b.dataset.selectNode) { selected = b.dataset.selectNode; renderCanvas(); renderConfig(); }
      else if (cmd === 'new-flow') { flow = defaultFlow(); selected = 'input'; activeTable = null; properties = []; invalidate(); editor(); }
      else if (cmd === 'save-flow') { flow.name = cleanRoot.querySelector('[data-flow-name]').value; await saveFlow(); message(cleanRoot,'流程已保存'); return; }
      else if (cmd === 'delete-node') { flow.nodes = flow.nodes.filter(n => n.id !== selected); flow.edges = flow.edges.filter(edge => edge.from !== selected && edge.to !== selected); selected = ''; invalidate(); renderCanvas(); renderConfig(); }
      else if (cmd === 'connect-all') { const nodes = Object.keys(labels).map(t => flow.nodes.find(n => n.type === t)); if (nodes.some(n => !n)) throw new Error('请先添加全部六种节点'); flow.edges = nodes.slice(1).map((n,i) => ({from:nodes[i].id,to:n.id})); invalidate(); renderCanvas(); }
      else if (cmd === 'disconnect') { flow.edges = []; invalidate(); renderCanvas(); }
      else if (cmd === 'preview' || cmd === 'full') { await run(cmd); return; }
      else if (cmd === 'confirm') {
        const s = result.result.summary;
        if (!window.confirm(`确认写入当前知识库？\n新增 ${s.created} 个实体，更新 ${s.updated} 个实体，新增 ${s.attributesAdded} 个属性。\n跳过 ${s.skipped} 条，失败 ${s.failed} 条不入库。`)) { message(cleanRoot,'已取消保存'); return; }
        result = await api('confirm',{runId:result.id,confirm:true}); renderResult(); message(cleanRoot,'知识库保存完成，可在知识管理查看结果。'); return;
      } else if (cmd === 'result-prev' || cmd === 'result-next') { resultPage += cmd === 'result-prev' ? -1 : 1; renderResult(); }
      else if (b.dataset.runId) { result = await api('runs/' + b.dataset.runId); flow = structuredClone(result.result.flow); decisions = structuredClone(result.result.decisions || {}); selected = flow.nodes[0]?.id || ''; dirty = false; resultPage = 0; await loadFlowData(); setTab(cleanRoot,'flows'); editor(); }
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
