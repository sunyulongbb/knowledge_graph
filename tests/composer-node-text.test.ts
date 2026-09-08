import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('    function parseComposerNodeText(');
const end = html.indexOf("    if (fName) {", start);
const source = html.slice(start, end);
const parse = new Function(`${source}; return parseComposerNodeText;`)();

test('blank lines separate the title from all description paragraphs', () => {
  expect(parse('知识图谱\nKnowledge Graph\n \t\n第一段描述\n继续描述\n\n第二段描述')).toEqual({
    name: '知识图谱 Knowledge Graph',
    description: '第一段描述\n继续描述\n\n第二段描述',
    aliases: [],
  });
  expect(parse('只有标题')).toEqual({ name: '只有标题', description: '', aliases: [] });
  expect(parse(' \n\n ')).toEqual({ name: '', description: '', aliases: [] });
});

test('extracts and deduplicates aliases from title parentheses only', () => {
  expect(parse('知识图谱（Knowledge Graph、KG）(KG; 知识网络)\r\n\r\n描述（保留括号）')).toEqual({
    name: '知识图谱', description: '描述（保留括号）', aliases: ['Knowledge Graph', 'KG', '知识网络'],
  });
  expect(parse('标题（尚未输入完成')).toEqual({ name: '标题（尚未输入完成', description: '', aliases: [] });
});

test('normalizes pasted whitespace and preserves description line breaks', () => {
  expect(parse('\u200B标题\u00A0（别名，另一别名；第三别名）\r\n \r\n\r\n描述\r下一行')).toEqual({
    name: '标题', description: '描述\n下一行', aliases: ['别名', '另一别名', '第三别名'],
  });
});

test('tag-only paragraphs do not become descriptions; literal hashes remain', () => {
  expect(parse('标题\n\n#科学 #知识')).toEqual({ name: '标题', description: '', aliases: [] });
  expect(parse('标题\n\n第一段 #科学\n\n#知识\n\n第二段')).toEqual({ name: '标题', description: '第一段\n\n第二段', aliases: [] });
  expect(parse('标题\n\nC# 和 https://example.org/#section\n# Markdown 标题').description).toBe('C# 和 https://example.org/#section\n# Markdown 标题');
});

test('editing a saved entity retains tags independently from its description', () => {
  const fields = { entityDisplayName: { innerText: '' }, fName: { value: '标题' }, fDesc: { value: '描述' }, fAliases: { value: '' }, fTags: { value: '科学, 知识' } };
  const extractStart = html.indexOf('    function extractComposerList(');
  const { refresh, sync } = new Function('fields', `
    const { entityDisplayName, fName, fDesc, fAliases, fTags } = fields;
    const document = { activeElement: null };
    const updateEntityDisplayName = (el, text) => { el.innerText = text; };
    const parseComposerMentionTokens = () => [];
    ${html.slice(extractStart, start)}
    ${source}
    return {refresh: refreshComposerFromHiddenFields, sync: syncComposerToHiddenFields};
  `)(fields);
  refresh(); sync();
  expect(fields.fDesc.value).toBe('描述');
  expect(fields.fTags.value).toBe('科学, 知识');
  fields.fName.value = '新标题';
  refresh(); sync();
  expect(fields.fName.value).toBe('新标题');
  expect(fields.fDesc.value).toBe('描述');
  expect(fields.fTags.value).toBe('科学, 知识');
});

test('composer input updates saved fields and clears removed aliases', () => {
  const fields = { entityDisplayName: { innerText: '标题（别名）\n\n描述 #标签' }, fName: { value: '' }, fDesc: { value: '' }, fAliases: { value: '' }, fTags: { value: '' } };
  const sync = new Function('fields', `const { entityDisplayName, fName, fDesc, fAliases, fTags } = fields;
    const extractComposerList = () => ['标签'];
    const parseComposerMentionTokens = () => [];
    ${source}; return syncComposerToHiddenFields;`)(fields);
  sync();
  expect(fields.fName.value).toBe('标题');
  expect(fields.fDesc.value).toBe('描述');
  expect(fields.fAliases.value).toBe('别名');
  expect(fields.fTags.value).toBe('标签');
  fields.entityDisplayName.innerText = '新标题';
  sync();
  expect(fields.fName.value).toBe('新标题');
  expect(fields.fDesc.value).toBe('');
  expect(fields.fAliases.value).toBe('');
});

test('saved nodes restore title, aliases and description for another save', () => {
  const fillStart = html.indexOf('          const composerTitle =');
  const fillEnd = html.indexOf('          updateEntityDisplayName(eName, composerText);', fillStart);
  const format = new Function('nameVal', 'descVal', 'fAliases', `const fTags = {value: ''}; ${source}; ${html.slice(fillStart, fillEnd)}; return composerText;`);
  expect(parse(format('知识图谱', '描述\n\n更多描述', { value: 'Knowledge Graph, KG' }))).toEqual({
    name: '知识图谱', description: '描述\n\n更多描述', aliases: ['Knowledge Graph', 'KG'],
  });
});

test('independent title and description edits survive save without copying between fields', () => {
  const fields = { entityDisplayName: { innerText: '' }, fName: { value: '原标题' }, fDesc: { value: '独立描述' }, fAliases: { value: '别名' }, fTags: { value: '' } };
  const { refresh, sync } = new Function('fields', `
    const { entityDisplayName, fName, fDesc, fAliases, fTags } = fields;
    const document = { activeElement: null };
    const updateEntityDisplayName = (el, text) => { el.innerText = text; };
    const extractComposerList = () => [];
    const parseComposerMentionTokens = () => [];
    ${source};
    return { refresh: refreshComposerFromHiddenFields, sync: syncComposerToHiddenFields };
  `)(fields);
  fields.fName.value = '新标题';
  refresh();
  sync();
  expect(fields.fName.value).toBe('新标题');
  expect(fields.fDesc.value).toBe('独立描述');
  expect(fields.fAliases.value).toBe('别名');
  fields.fDesc.value = '新描述\n\n描述第二段';
  refresh();
  sync();
  expect(fields.fName.value).toBe('新标题');
  expect(fields.fDesc.value).toBe('新描述\n\n描述第二段');
  fields.fDesc.value = '';
  refresh();
  sync();
  expect(fields.fName.value).toBe('新标题');
  expect(fields.fDesc.value).toBe('');
});
