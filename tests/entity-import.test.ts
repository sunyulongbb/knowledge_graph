import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { EntityImportError, importEntity, localizeEntityImportMedia, parseEntityImport, parseEntityImports } from '../src/server/entity-import.ts';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE nodes(id TEXT PRIMARY KEY,name TEXT,type TEXT,description TEXT,aliases TEXT,tags TEXT,images TEXT,videos TEXT,pdf TEXT,link TEXT,visibility TEXT,project_id INTEGER,updated_at TEXT);
    CREATE TABLE ontologies(id TEXT PRIMARY KEY,name TEXT,alias TEXT,description TEXT,parent_id TEXT,project_id INTEGER,color TEXT,display_shape TEXT,sort_order INTEGER,status TEXT);
    CREATE TABLE properties(id TEXT PRIMARY KEY,name TEXT,alias TEXT,status TEXT,datatype TEXT,valuetype TEXT,description TEXT,project_id INTEGER);
    CREATE TABLE ontology_properties(ontology_id TEXT,property_id TEXT,PRIMARY KEY(ontology_id,property_id));
    CREATE TABLE attributes(id TEXT PRIMARY KEY,node_id TEXT,key TEXT,value TEXT,datatype TEXT,property_name_snapshot TEXT,statement_json TEXT);
    CREATE TABLE classes(id TEXT PRIMARY KEY,name TEXT,description TEXT,parent_id TEXT,project_id INTEGER,color TEXT,image TEXT,tags TEXT,sort_order INTEGER);
    CREATE TABLE entity_classes(entity_id TEXT,class_id TEXT,PRIMARY KEY(entity_id,class_id));
  `);
  return db;
}

test('single entity import creates and links its ontology, properties and values atomically', () => {
  const db = fixture();
  try {
    const result = importEntity(db, { version: 1, entity: {
      id: 'person-1', name: '张三', description: '工程师', aliases: ['小张'], tags: ['人物'],
      type: { name: '人物' }, attributes: [
        { name: '职业', datatype: 'string', value: '工程师' },
        { name: '年龄', datatype: 'quantity', value: { amount: 30, unit: '1' } },
        { name: '出生日期', datatype: 'time', value: '1990-05-20' },
      ],
    } }, 7);
    expect(result).toMatchObject({ entityId: 'person-1', ontologyCreated: true, propertiesCreated: 3, attributesCreated: 3 });
    expect(db.query('SELECT name,type,project_id FROM nodes').get()).toEqual({ name: '张三', type: result.ontologyId, project_id: 7 });
    expect(db.query('SELECT COUNT(*) AS n FROM ontology_properties').get()).toEqual({ n: 3 });
    expect(db.query('SELECT COUNT(*) AS n FROM attributes').get()).toEqual({ n: 3 });
    const time = db.query("SELECT value FROM attributes WHERE datatype='time'").get() as { value: string };
    expect(JSON.parse(time.value)).toMatchObject({ time: '+1990-05-20T00:00:00Z', precision: 11 });
  } finally { db.close(); }
});

test('entity import reuses same-project ontology and property definitions', () => {
  const db = fixture();
  try {
    db.run("INSERT INTO ontologies VALUES('o1','人物','[]','',NULL,1,NULL,'rectangle',1,'active')");
    db.run("INSERT INTO properties VALUES('p1','职业','[]','active','string','string','',1)");
    const result = importEntity(db, { version: 1, entity: { name: '李四', type: '人物', attributes: [{ name: '职业', value: '教师' }] } }, 1);
    expect(result).toMatchObject({ ontologyId: 'o1', ontologyCreated: false, propertiesCreated: 0 });
    expect(db.query('SELECT ontology_id,property_id FROM ontology_properties').get()).toEqual({ ontology_id: 'o1', property_id: 'p1' });
  } finally { db.close(); }
});

test('the same external IDs import into different applications with isolated remapped references', () => {
  const db = fixture();
  try {
    const document = { version: 1, entity: {
      id: 'HEGSETH-CHINA-NEWS-001', name: '同一来源数据',
      type: { id: 'ontology/news', name: '新闻' },
      attributes: [{ id: 'property/related', name: '关联目标', datatype: 'wikibase-item', value: { id: 'HEGSETH-CHINA-NEWS-001', label_zh: '同一来源数据' } }],
    } };
    const first = importEntity(db, structuredClone(document), 1) as any;
    const second = importEntity(db, structuredClone(document), 2) as any;
    expect(first.entityId).toBe('HEGSETH-CHINA-NEWS-001');
    expect(second.entityId).toStartWith('HEGSETH-CHINA-NEWS-001--copy-');
    expect(db.query('SELECT COUNT(*) AS count FROM nodes').get()).toEqual({ count: 2 });
    const secondAttribute = db.query('SELECT value FROM attributes WHERE node_id=?').get(second.entityId) as any;
    expect(JSON.parse(secondAttribute.value).id).toBe(second.entityId);
    expect((db.query('SELECT type FROM nodes WHERE id=?').get(second.entityId) as any).type).not.toBe((db.query('SELECT type FROM nodes WHERE id=?').get(first.entityId) as any).type);
  } finally { db.close(); }
});

test('entity import upgrades and reactivates reused schema definitions', () => {
  const db = fixture();
  try {
    db.run("INSERT INTO ontologies VALUES('o1','人物','[]','',NULL,1,NULL,'rectangle',1,'deprecated')");
    db.run("INSERT INTO properties VALUES('P31','性质','[]','deprecated','string','string','',1)");
    const result = importEntity(db, { version: 1, entity: {
      name: '真实类型', type: '人物', attributes: [
        { id: 'P31', name: '性质', datatype: 'wikibase-item', value: { id: 'Q5' } },
      ],
    } }, 1);
    expect(result.attributesCreated).toBe(1);
    expect(db.query("SELECT datatype,valuetype,status FROM properties WHERE id='P31'").get()).toEqual({ datatype: 'wikibase-item', valuetype: 'wikibase-entityid', status: 'active' });
    expect(db.query("SELECT status FROM ontologies WHERE id='o1'").get()).toEqual({ status: 'active' });
    expect(JSON.parse((db.query("SELECT value FROM attributes WHERE key='P31'").get() as any).value)).toMatchObject({ id: 'Q5', 'entity-type': 'item' });
  } finally { db.close(); }
});

test('entity import rejects malformed and empty batch documents before writing', () => {
  expect(() => parseEntityImport({ version: 1, entities: [] })).toThrow(EntityImportError);
  expect(() => parseEntityImport({ version: 1, entity: { name: '无类型' } })).toThrow('entity.type');
  expect(() => parseEntityImports([])).toThrow('导入数组不能为空');
});

test('batch entity import matches existing and incoming targets by Chinese label', () => {
  const db = fixture();
  try {
    db.run("INSERT INTO ontologies VALUES('person','人物','[]','',NULL,1,NULL,'rectangle',1,'active')");
    db.run("INSERT INTO nodes VALUES('existing-1','北京市','person','', '[\"北京\"]','[]','[]','[]','','','public',1,NULL)");
    const result = importEntity(db, [
      { version: 1, entity: { id: 'person-1', name: '张三', type: '人物', attributes: [
        { name: '出生地', datatype: 'wikibase-item', value: { label_zh: '北京' } },
        { name: '同事', datatype: 'wikibase-item', value: '李四' },
        { name: '同事编号', datatype: 'wikibase-item', value: { id: 'person-2' } },
      ] } },
      { version: 1, entity: { id: 'person-2', name: '李四', type: '人物', attributes: [] } },
    ], 1) as any;
    expect(result).toMatchObject({ batch: true, total: 2, created: 2, updated: 0, referencedEntitiesCreated: 0, referencedEntitiesMatched: 3 });
    expect(result.entityIds).toEqual(['person-1', 'person-2']);
    const values = (db.query("SELECT value FROM attributes WHERE node_id='person-1' ORDER BY key").all() as any[]).map((row) => JSON.parse(row.value));
    expect(values.map((value) => value.id).sort()).toEqual(['existing-1', 'person-2', 'person-2']);
    expect(db.query("SELECT COUNT(*) AS count FROM nodes WHERE type='ontology/wikibase-item'").get()).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('batch entity import validates every entity before opening writes', () => {
  const db = fixture();
  try {
    expect(() => importEntity(db, [
      { version: 1, entity: { id: 'valid', name: '有效实体', type: '人物', attributes: [] } },
      { version: 1, entity: { id: 'invalid', name: '', type: '人物', attributes: [] } },
    ], 1)).toThrow('第 2 个实体');
    expect(db.query('SELECT COUNT(*) AS count FROM nodes').get()).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('batch media localization accepts arrays and keeps local resources', async () => {
  const input = [
    { name: '甲', type: '人物', images: ['/static/uploads/node-images/a.jpg'] },
    { version: 1, entity: { name: '乙', type: '人物', videos: ['/static/uploads/node-videos/b.mp4'] } },
  ];
  const localized = await localizeEntityImportMedia(input, 1);
  expect(localized.files).toEqual([]);
  expect(localized.input).toEqual(input);
});

test('downloadable placeholder template covers hierarchy, media and supported attribute shapes', () => {
  const db = fixture();
  try {
    const example = JSON.parse(readFileSync('public/examples/entity-import.json', 'utf8'));
    const parsed = parseEntityImport(example);
    expect(parsed.id).toBe('ENTITY_ID_PLACEHOLDER');
    expect(parsed.name).toBe('实体名称示例');
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images.every((url) => url.startsWith('https://example.com/images/'))).toBe(true);
    expect(parsed.videos[0]).toEndWith('.mp4');
    expect(parsed.pdf).toEndWith('.pdf');
    expect(parsed.attributes).toHaveLength(10);
    expect(parsed.attributes.find((item) => item.id === 'ATTRIBUTE_ID_TIME')?.value).toMatchObject({ time: '+2000-01-01T00:00:00Z', precision: 11 });
    expect(parsed.attributes.find((item) => item.id === 'ATTRIBUTE_ID_ITEM_SINGLE')?.value).toMatchObject({ id: 'RELATED_ENTITY_ID_PLACEHOLDER', label_zh: '关联实体中文名称示例' });
    expect(parsed.attributes.find((item) => item.id === 'ATTRIBUTE_ID_ITEM_MULTIPLE')?.value).toHaveLength(2);
    expect(parsed.attributes.find((item) => item.id === 'ATTRIBUTE_ID_MONOLINGUAL_TEXT')?.value).toEqual({ text: 'Example text', language: 'en' });
    const result = importEntity(db, example, 1);
    expect(result.entityId).toBe('ENTITY_ID_PLACEHOLDER');
    expect(result.entityCreated).toBe(true);
    expect(result.attributesCreated).toBe(10);
    expect(result.referencedEntitiesCreated).toBe(3);
    expect(result).toMatchObject({ categoriesCreated: 3, categoriesLinked: 3 });
    expect(db.query('SELECT pdf FROM nodes WHERE id=?').get(result.entityId)).toEqual({ pdf: parsed.pdf });
    expect(db.query("SELECT name FROM nodes WHERE id='RELATED_ENTITY_ID_PLACEHOLDER'").get()).toEqual({ name: '关联实体中文名称示例' });
    const linked = JSON.parse((db.query("SELECT value FROM attributes WHERE key='ATTRIBUTE_ID_ITEM_SINGLE'").get() as any).value);
    expect(linked).toMatchObject({ id: 'RELATED_ENTITY_ID_PLACEHOLDER', label_zh: '关联实体中文名称示例', 'entity-type': 'item' });
    expect(db.query("SELECT COUNT(*) AS count FROM entity_classes WHERE entity_id='ENTITY_ID_PLACEHOLDER'").get()).toEqual({ count: 3 });
    expect(db.query("SELECT parent_id FROM classes WHERE name='三级分类名称示例'").get()).toMatchObject({ parent_id: expect.any(String) });
    expect(JSON.parse((db.query("SELECT tags FROM nodes WHERE id='ENTITY_ID_PLACEHOLDER'").get() as any).tags)).toContain('三级分类标签示例一');

    example.entity.description = '更新后的真实人物资料';
    const updated = importEntity(db, example, 1);
    expect(updated).toMatchObject({ entityId: 'ENTITY_ID_PLACEHOLDER', entityCreated: false, entityUpdated: true, attributesCreated: 0, attributesUpdated: 10, categoriesCreated: 0, categoriesUpdated: 3, categoriesLinked: 3 });
    expect(db.query("SELECT description FROM nodes WHERE id='ENTITY_ID_PLACEHOLDER'").get()).toEqual({ description: '更新后的真实人物资料' });
    expect(db.query("SELECT COUNT(*) AS count FROM attributes WHERE node_id='ENTITY_ID_PLACEHOLDER'").get()).toEqual({ count: 10 });
  } finally { db.close(); }
});

test('entity import keeps existing local media URLs and ordinary web links unchanged', async () => {
  const input = { version: 1, entity: {
    name: '本地媒体', type: '人物',
    images: ['/static/uploads/1/node-images/a.jpg'],
    videos: ['/static/uploads/1/node-videos/a.webm'],
    pdf: '/static/uploads/1/node-pdfs/a.pdf',
    link: 'https://example.com/profile',
    attributes: [
      { name: '肖像', datatype: 'commonsMedia', value: '/static/uploads/1/node-images/b.jpg' },
      { name: '官网', datatype: 'url', value: 'https://example.com' },
    ],
  } };
  const localized = await localizeEntityImportMedia(input, 1);
  expect(localized.files).toEqual([]);
  expect(localized.input).toEqual(input);
});

test('entity import media uses the project shared uploads directories', () => {
  const source = readFileSync('src/server/entity-import.ts', 'utf8');
  expect(source).toContain("resolve(import.meta.dir, '..', '..', 'uploads', config.folder)");
  expect(source).toContain('`/static/uploads/${config.folder}/${filename}`');
  expect(source).not.toContain("'uploads', appFolder, config.folder");
});
