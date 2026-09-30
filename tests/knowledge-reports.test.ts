import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { buildKnowledgeReport, normalizeReportKeywords } from '../src/server/knowledge-reports.ts';

function fixture() {
  const db = new Database(':memory:');
  db.run('CREATE TABLE nodes(id TEXT PRIMARY KEY, project_id INTEGER, name TEXT, aliases TEXT, tags TEXT, description TEXT, wiki_md TEXT, link TEXT, type TEXT, images TEXT, data TEXT)');
  db.run('CREATE TABLE ontologies(id TEXT PRIMARY KEY, project_id INTEGER, name TEXT, description TEXT)');
  db.run('CREATE TABLE attributes(id TEXT PRIMARY KEY, node_id TEXT, key TEXT, value TEXT, datatype TEXT, property_name_snapshot TEXT)');
  db.run("INSERT INTO ontologies VALUES ('ontology/default-item', 1, '实体条目', '由实体导入中的 wikibase-item 属性值自动创建')");
  db.run("INSERT INTO nodes VALUES ('Q1', 1, '美国对华贸易政策', '[]', '[\"贸易\",\"关税\"]', '介绍关税与供应链政策。', '', 'https://example.test/q1', 'ontology/policy', '[\"https://example.test/q1.jpg\"]', '{}')");
  db.run("INSERT INTO nodes VALUES ('Q2', 1, '半导体出口管制', '[]', '[\"芯片\"]', '先进芯片出口管制措施。', '', '', 'ontology/policy', '[]', '{}')");
  db.run("INSERT INTO nodes VALUES ('Q3', 1, '政策制定机构', '[]', '[]', '负责相关政策协调。', '', '', 'ontology/agency', '[]', '{}')");
  db.run("INSERT INTO nodes VALUES ('Q4', 2, '其他应用贸易资料', '[]', '[\"贸易\"]', '不应跨应用出现。', '', '', 'ontology/policy', '[]', '{}')");
  db.run("INSERT INTO nodes VALUES ('Q5', 1, '贸易属性值辅助实体', '[]', '[\"贸易\"]', '不应进入报告。', '', '', 'ontology/default-item', '[]', '{}')");
  db.run("INSERT INTO attributes VALUES ('A1', 'Q1', 'P1', '[{\"id\":\"Q3\"}]', 'wikibase-entityid', '主管机构')");
  return db;
}

test('knowledge report ranks direct matches, expands one relation hop, and stays project scoped', () => {
  const report = buildKnowledgeReport(fixture(), 1, '美国对华政策', ['贸易', '芯片']);
  expect(report.keywords).toEqual(['贸易', '芯片']);
  expect(report.sections[0].title).toBe('美国对华贸易政策');
  expect(report.sections.some((section) => section.title === '贸易')).toBe(false);
  expect(report.sections.some((section) => section.title === '芯片')).toBe(false);
  expect(report.sections[0].items.some((item) => item.id === 'Q1' && !item.related)).toBe(true);
  expect(report.sections[0].items.find((item) => item.id === 'Q1')?.image).toBe('https://example.test/q1.jpg');
  expect(report.sections[0].items.some((item) => item.id === 'Q3' && item.related && item.relation === '主管机构')).toBe(true);
  expect(report.sections.flatMap((section) => section.items).some((item) => item.id === 'Q4')).toBe(false);
  expect(report.sections.flatMap((section) => section.items).some((item) => item.id === 'Q5')).toBe(false);
  expect(report.summary).not.toMatch(/节点|边|子图|实体数量|关系数量/);
  expect(report.sources.map((item) => item.id)).toContain('Q1');
});

test('report keywords normalize separators, duplicates, and empty values', () => {
  expect(normalizeReportKeywords('贸易，芯片,贸易； 合作')).toEqual(['贸易', '芯片', '合作']);
});
