export function matrixToTable(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new Error('文件需要表头和至少一行数据');
  const columns = matrix[0].map(value => String(value ?? '').trim());
  if (!columns.length || columns.some(c => !c || ['__proto__', 'constructor', 'prototype'].includes(c)) || new Set(columns).size !== columns.length) throw new Error('表头不能为空或重复');
  const rows = matrix.slice(1).filter(row => row.some(v => v !== '' && v !== null && v !== undefined)).map(row => {
    if (row.length > columns.length) throw new Error('数据行列数超过表头，请检查文件');
    return Object.fromEntries(columns.map((c, i) => [c, row[i] ?? null]));
  });
  if (!rows.length) throw new Error('没有可读取的记录');
  return { columns, rows };
}

export function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const matrix = []; let row = [], cell = '', quoted = false, closed = false;
  const pushCell = () => { row.push(cell); cell = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('CSV 引号格式错误');
      quoted = true;
    } else if (c === ',') pushCell();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      pushCell(); matrix.push(row); row = [];
    } else {
      if (closed) throw new Error('CSV 引号后只能是逗号或换行');
      cell += c;
    }
  }
  if (quoted) throw new Error('CSV 引号未闭合');
  if (cell || row.length || closed) { pushCell(); matrix.push(row); }
  return matrixToTable(matrix);
}

export function parseJsonTable(text) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows) || !rows.length || rows.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error('JSON 格式应为对象数组，例如 [{"id":"1","name":"张三"}]');
  const columns = [...new Set(rows.flatMap(Object.keys))];
  if (columns.some(c => ['__proto__', 'constructor', 'prototype'].includes(c))) throw new Error('字段名无效');
  return { columns, rows: rows.map(r => Object.fromEntries(columns.map(c => [c, r[c] ?? null]))) };
}

export const NODE_TYPES = ['input', 'ontology', 'properties', 'alignment', 'fusion', 'output'];

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 88;
const LAYOUT_ORIGIN_X = 36;
const LAYOUT_ORIGIN_Y = 34;
const LAYOUT_COLUMNS = 2;

// Two columns following the six-step order; used by the default flow and by 自动整理 on the canvas.
export function layoutFlow(nodes) {
  const ordered = [...NODE_TYPES.map(type => nodes.find(node => node.type === type)), ...nodes.filter(node => !NODE_TYPES.includes(node.type))].filter(Boolean);
  ordered.forEach((node, index) => {
    node.x = LAYOUT_ORIGIN_X + (index % LAYOUT_COLUMNS) * (NODE_WIDTH + 40);
    node.y = LAYOUT_ORIGIN_Y + Math.floor(index / LAYOUT_COLUMNS) * (NODE_HEIGHT + 52);
  });
  return nodes;
}

// One row per branch keeps fan-out readable when the canvas is tidied up.
export function layoutBranches(nodes, branches) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const placed = new Set();
  for (const [row, branch] of branches.entries()) {
    branch.nodeIds.forEach((id, column) => {
      const node = byId.get(id);
      if (!node || placed.has(id)) return;
      placed.add(id);
      node.x = LAYOUT_ORIGIN_X + column * (NODE_WIDTH + 44);
      node.y = LAYOUT_ORIGIN_Y + row * (NODE_HEIGHT + 56);
    });
  }
  let extra = 0;
  for (const node of nodes) {
    if (placed.has(node.id)) continue;
    node.x = LAYOUT_ORIGIN_X + (extra % 3) * (NODE_WIDTH + 44);
    node.y = LAYOUT_ORIGIN_Y + (branches.length + Math.floor(extra / 3)) * (NODE_HEIGHT + 56);
    extra += 1;
  }
  return nodes;
}

export function defaultFlow(tableId = '') {
  const nodes = NODE_TYPES.map(type => ({ id: type, type, x: 0, y: 0, config: type === 'input' ? { tableId } : type === 'properties' ? { mapping: {} } : type === 'fusion' ? { strategy: 'keep' } : {} }));
  layoutFlow(nodes);
  return { name: '新建清洗流程', nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })) };
}
