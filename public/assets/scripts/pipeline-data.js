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

export function defaultFlow(tableId = '') {
  const types = ['input', 'ontology', 'properties', 'alignment', 'fusion', 'output'];
  const nodes = types.map((type, i) => ({ id: type, type, x: 36 + (i % 2) * 246, y: 34 + Math.floor(i / 2) * 142, config: type === 'input' ? { tableId } : type === 'properties' ? { mapping: {} } : type === 'fusion' ? { strategy: 'keep' } : {} }));
  return { name: '新建清洗流程', nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })) };
}
