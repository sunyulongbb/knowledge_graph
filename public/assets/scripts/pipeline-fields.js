// Shared by the native browser UI and Bun cleaning engine.
export const BASIC_FIELDS = [
  { key: 'idField', target: 'id', label: '实体唯一标识字段', required: true, names: ['id', 'source_id', 'qid', 'item', '实体唯一标识', '唯一标识', '实体ID', '来源ID'] },
  { key: 'nameField', target: 'name', label: '名称（label）', required: true, names: ['name', 'label', 'labels', 'label_zh', 'name_zh', 'itemLabel', '名称', '姓名', '实体名称'] },
  { key: 'aliasesField', target: 'aliases', label: '别名（aliases）', names: ['aliases', 'alias', 'aliases_zh', '别名'] },
  { key: 'descriptionField', target: 'description', label: '描述（description）', names: ['description', 'descriptions', 'desc', 'description_zh', 'desc_zh', '描述', '简介', '说明'] },
  { key: 'tagsField', target: 'tags', label: '标签（项目扩展）', names: ['tags', 'tag', 'tag_list', '标签'] },
];

export function inferBasicFields(columns, current = {}) {
  const result = { ...current, mapping: { ...(current.mapping || {}) } };
  const normalize = value => String(value).trim().replace(/[\s_-]/g, '').toLowerCase();
  const used = new Set(BASIC_FIELDS.map(f => result[f.key]).filter(Boolean));
  for (const field of BASIC_FIELDS) {
    // Explicitly unselected fields and saved custom-property mappings remain authoritative.
    if (Object.hasOwn(current, field.key)) continue;
    const candidate = field.names.map(name => columns.find(c => normalize(c) === normalize(name) && !used.has(c) && !Object.hasOwn(result.mapping, c))).find(Boolean);
    result[field.key] = candidate || '';
    if (candidate) used.add(candidate);
  }
  result.language ||= 'zh';
  return result;
}

function localized(value, language) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (Object.hasOwn(value, 'value')) return value.value;
  return value[language] ?? value[language.split('-')[0]] ?? value.zh ?? value.en ?? Object.values(value)[0];
}

export function basicText(value, language = 'zh') {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const selected = localized(value, language);
    if (selected === value || Array.isArray(selected)) throw new Error('名称和描述需要单个文本值');
    return basicText(selected, language);
  }
  return String(value).trim();
}

export function basicList(value, language = 'zh') {
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) value = parsed; } catch {}
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) value = localized(value, language);
  const values = Array.isArray(value) ? value.map(v => basicText(v, language)) : basicText(value, language).split(/[,，;；、|\n]+/);
  return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}
