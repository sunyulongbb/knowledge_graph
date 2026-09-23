import type { Database } from 'bun:sqlite';
import { lookup } from 'node:dns/promises';
import { mkdirSync, unlinkSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { normalizeDatatype, normalizeValue, uiDatatype, valueTypeFor } from '../shared/wikidata.ts';
import { parseClassImport } from './class-import.ts';

export class EntityImportError extends Error {}

type LocalizedEntityImport = { input: unknown; files: string[] };

const mediaKinds = {
  image: { folder: 'node-images', maxSize: 20 * 1024 * 1024, mime: /^image\//, extensions: new Set(['jpg','jpeg','png','gif','webp','svg','bmp','ico','avif','heif','heic']) },
  video: { folder: 'node-videos', maxSize: 500 * 1024 * 1024, mime: /^video\//, extensions: new Set(['mp4','webm','ogg','mov','m4v']) },
  pdf: { folder: 'node-pdfs', maxSize: 100 * 1024 * 1024, mime: /^application\/pdf(?:$|;)/, extensions: new Set(['pdf']) },
} as const;

const privateAddress = (address: string) => {
  if (address === '::1' || address === '::' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  if (!isIP(address)) return false;
  const parts = address.split('.').map(Number);
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
};

async function assertPublicMediaUrl(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new EntityImportError(`不支持的资源协议：${url.protocol}`);
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || privateAddress(host)) throw new EntityImportError(`禁止访问本地资源地址：${host}`);
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => privateAddress(item.address))) throw new EntityImportError(`资源地址不能解析到内网：${host}`);
}

const extensionFor = (url: URL, contentType: string, kind: keyof typeof mediaKinds) => {
  const byPath = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  if ((mediaKinds[kind].extensions as ReadonlySet<string>).has(byPath)) return byPath === 'jpeg' ? 'jpg' : byPath;
  const mime = contentType.split(';')[0]?.trim();
  const map: Record<string, string> = { 'image/jpeg':'jpg', 'image/png':'png', 'image/gif':'gif', 'image/webp':'webp', 'image/svg+xml':'svg', 'image/avif':'avif', 'video/mp4':'mp4', 'video/webm':'webm', 'video/ogg':'ogg', 'video/quicktime':'mov', 'application/pdf':'pdf' };
  return map[mime] || '';
};

async function downloadImportMedia(source: string, kind: keyof typeof mediaKinds, _projectId: number | null) {
  let current = new URL(source);
  let response: Response | null = null;
  const timeoutMs = kind === 'video' ? 180_000 : 90_000;
  for (let redirect = 0; redirect <= 5; redirect++) {
    await assertPublicMediaUrl(current);
    response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'KnowledgeGraphEntityImport/1.0', Accept: kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : 'application/pdf' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new EntityImportError(`资源重定向缺少地址：${source}`);
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response || !response.ok) throw new EntityImportError(`资源下载失败：${source}（HTTP ${response?.status || 0}）`);
  const config = mediaKinds[kind];
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const extension = extensionFor(current, contentType, kind);
  const genericBinary = /^(?:application|binary)\/octet-stream(?:$|;)/.test(contentType);
  if (!config.mime.test(contentType) && !(genericBinary && extension)) throw new EntityImportError(`资源类型不匹配：${source}（${contentType || '未知类型'}）`);
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > config.maxSize) throw new EntityImportError(`资源文件过大：${source}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > config.maxSize) throw new EntityImportError(`资源文件为空或超过大小限制：${source}`);
  if (!extension) throw new EntityImportError(`无法识别资源文件类型：${source}`);
  // entity-import.ts lives in src/server. The public static upload root is
  // <project>/uploads, so only move up two levels. Imported JSON media is kept
  // in the shared media directories requested by the application.
  const directory = resolve(import.meta.dir, '..', '..', 'uploads', config.folder);
  mkdirSync(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const file = resolve(directory, filename);
  await Bun.write(file, bytes);
  return { file, url: `/static/uploads/${config.folder}/${filename}` };
}

export function cleanupLocalizedEntityImport(files: string[]) {
  for (const file of files) { try { unlinkSync(file); } catch {} }
}

export async function localizeEntityImportMedia(input: unknown, projectId: number | null): Promise<LocalizedEntityImport> {
  const root = structuredClone(input);
  const files: string[] = [];
  const localizedBySource = new Map<string, string>();
  const localize = async (value: unknown, kind: keyof typeof mediaKinds) => {
    const source = String(value || '').trim();
    if (!/^https?:\/\//i.test(source)) return source;
    const cacheKey = `${kind}:${source}`;
    const cached = localizedBySource.get(cacheKey);
    if (cached) return cached;
    let saved: Awaited<ReturnType<typeof downloadImportMedia>>;
    try {
      saved = await downloadImportMedia(source, kind, projectId);
    } catch (error) {
      const kindLabel = kind === 'image' ? '图片' : kind === 'video' ? '视频' : 'PDF';
      throw new EntityImportError(`${kindLabel}同步失败：${source}：${error instanceof Error ? error.message : String(error)}`);
    }
    files.push(saved.file);
    localizedBySource.set(cacheKey, saved.url);
    return saved.url;
  };
  try {
    for (const document of entityImportDocuments(root)) {
      const entity = object(document.entity, 'entity');
      if (Array.isArray(entity.images)) {
        const images: string[] = [];
        for (const value of entity.images) images.push(await localize(value, 'image'));
        entity.images = images;
      }
      if (Array.isArray(entity.videos)) {
        const videos: string[] = [];
        for (const value of entity.videos) videos.push(await localize(value, 'video'));
        entity.videos = videos;
      }
      if (entity.pdf) entity.pdf = await localize(entity.pdf, 'pdf');
      for (const attribute of Array.isArray(entity.attributes) ? entity.attributes : []) {
        if (normalizeDatatype(attribute?.datatype) !== 'commonsMedia') continue;
        if (Array.isArray(attribute.value)) {
          const values: string[] = [];
          for (const value of attribute.value) values.push(await localize(value, 'image'));
          attribute.value = values;
        } else attribute.value = await localize(attribute.value, 'image');
      }
    }
    return { input: root, files };
  } catch (error) {
    cleanupLocalizedEntityImport(files);
    if (error instanceof EntityImportError) throw error;
    throw new EntityImportError(`文件资源同步失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

type ParsedAttribute = { id: string; name: string; datatype: string; value: unknown; description: string };
type ParsedEntity = {
  id: string; name: string; description: string; aliases: string[]; tags: string[];
  images: string[]; videos: string[]; pdf: string; link: string; visibility: 'public' | 'private';
  ontology: { id: string; name: string; description: string }; attributes: ParsedAttribute[];
  hasCategories: boolean; categories: ReturnType<typeof parseClassImport>;
};

const object = (value: unknown, path: string): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EntityImportError(`${path} 必须是对象`);
  return value as Record<string, any>;
};
const strings = (value: unknown, path: string) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new EntityImportError(`${path} 必须是字符串数组`);
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
};
const normalizeImportedValue = (datatype: string, value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => normalizeImportedValue(datatype, item));
  if (normalizeDatatype(datatype) === 'wikibase-item') {
    if (typeof value === 'string' && value.trim()) return { label_zh: value.trim() };
    if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      if (String(item.id || item.label_zh || item.entity_label_zh || item.label || item.name || '').trim()) return { ...item };
    }
    throw new Error('实体引用必须包含 id、中文标签或名称');
  }
  if (normalizeDatatype(datatype) === 'time' && typeof value === 'string') {
    return normalizeValue(datatype, { date: value });
  }
  return normalizeValue(datatype, value);
};

function entityImportDocuments(input: unknown): Record<string, any>[] {
  if (Array.isArray(input)) {
    if (!input.length) throw new EntityImportError('导入数组不能为空');
    return input.map((item, index) => {
      const row = object(item, `文件[${index}]`);
      return row.entity ? row : { version: 1, entity: row };
    });
  }
  const root = object(input, '文件');
  if (Array.isArray(root.entities)) {
    if (!root.entities.length) throw new EntityImportError('entities 不能为空');
    return root.entities.map((entity: unknown, index: number) => ({ version: root.version, entity: object(entity, `entities[${index}]`) }));
  }
  return [root];
}

export function parseEntityImport(input: unknown): ParsedEntity {
  const root = object(input, '文件');
  if (root.version !== 1) throw new EntityImportError('version 必须为 1');
  const entity = object(root.entity, 'entity');
  const allowed = new Set(['id','name','description','aliases','tags','categories','images','videos','pdf','link','visibility','type','attributes']);
  for (const key of Object.keys(entity)) if (!allowed.has(key)) throw new EntityImportError(`entity 包含不支持的字段：${key}`);
  if (typeof entity.name !== 'string' || !entity.name.trim()) throw new EntityImportError('entity.name 必须是非空字符串');
  const type = typeof entity.type === 'string' ? { name: entity.type } : object(entity.type, 'entity.type');
  if (!String(type.id || type.name || '').trim()) throw new EntityImportError('entity.type 必须提供 id 或 name');
  if (entity.attributes !== undefined && !Array.isArray(entity.attributes)) throw new EntityImportError('entity.attributes 必须是数组');
  const hasCategories = Object.prototype.hasOwnProperty.call(entity, 'categories');
  let categories: ReturnType<typeof parseClassImport> = [];
  if (hasCategories) {
    if (!Array.isArray(entity.categories)) throw new EntityImportError('entity.categories 必须是数组');
    if (entity.categories.length) {
      try { categories = parseClassImport({ version: 1, classes: entity.categories }); }
      catch (error) { throw new EntityImportError(`entity.categories：${error instanceof Error ? error.message : '格式无效'}`); }
    }
  }
  const attributes = (entity.attributes || []).map((raw: unknown, index: number) => {
    const row = object(raw, `entity.attributes[${index}]`);
    const name = String(row.name || '').trim(), id = String(row.id || '').trim();
    if (!name && !id) throw new EntityImportError(`entity.attributes[${index}] 必须提供 id 或 name`);
    if (!Object.prototype.hasOwnProperty.call(row, 'value')) throw new EntityImportError(`entity.attributes[${index}].value 不能为空`);
    const datatype = normalizeDatatype(row.datatype || 'string');
    let value: unknown;
    try { value = normalizeImportedValue(datatype, row.value); } catch (error) {
      throw new EntityImportError(`entity.attributes[${index}].value：${error instanceof Error ? error.message : '格式无效'}`);
    }
    return { id, name: name || id, datatype, value, description: String(row.description || '').trim() };
  });
  return {
    id: String(entity.id || '').replace(/^entity\//, '').trim(), name: entity.name.trim(),
    description: String(entity.description || ''), aliases: strings(entity.aliases, 'entity.aliases'),
    tags: strings(entity.tags, 'entity.tags'), images: strings(entity.images, 'entity.images'),
    videos: strings(entity.videos, 'entity.videos'), pdf: String(entity.pdf || '').trim(), link: String(entity.link || '').trim(),
    visibility: entity.visibility === 'private' ? 'private' : 'public',
    ontology: { id: String(type.id || '').trim(), name: String(type.name || type.id || '').trim(), description: String(type.description || '').trim() },
    attributes, hasCategories, categories,
  };
}

export function parseEntityImports(input: unknown): ParsedEntity[] {
  const documents = entityImportDocuments(input);
  return documents.map((document, index) => {
    try { return parseEntityImport(document); }
    catch (error) {
      if (documents.length === 1) throw error;
      throw new EntityImportError(`第 ${index + 1} 个实体：${error instanceof Error ? error.message : '格式无效'}`);
    }
  });
}

export function importEntity(db: Database, input: unknown, projectId: number | null) {
  const entities = parseEntityImports(input);
  return db.transaction(() => {
    const usedIds = new Set<string>();
    const requestedIds = new Set<string>();
    const originalIds = new Map<ParsedEntity, string>();
    for (const entity of entities) {
      if (!entity.id) entity.id = String((db.query("SELECT COALESCE(MAX(CAST(id AS INTEGER)),0)+1 AS next FROM nodes WHERE id GLOB '[0-9]*'").get() as any).next + usedIds.size);
      const requestedId = entity.id;
      if (requestedIds.has(requestedId)) throw new EntityImportError(`批量文件包含重复实体 ID：${requestedId}`);
      requestedIds.add(requestedId);
      originalIds.set(entity, requestedId);
      const occupied = db.query('SELECT project_id FROM nodes WHERE id=? LIMIT 1').get(requestedId) as any;
      if (occupied && (occupied.project_id ?? null) !== projectId) {
        entity.id = `${requestedId}--copy-${crypto.randomUUID().slice(0, 8)}`;
      }
      if (usedIds.has(entity.id)) throw new EntityImportError(`批量文件包含重复实体 ID：${entity.id}`);
      usedIds.add(entity.id);
    }
    const incomingNames = new Map<string, ParsedEntity[]>();
    for (const entity of entities) {
      for (const label of new Set([originalIds.get(entity), entity.id, entity.name, ...entity.aliases])) {
        if (!label) continue;
        const key = label.trim().toLocaleLowerCase();
        if (key) incomingNames.set(key, [...(incomingNames.get(key) || []), entity]);
      }
    }
    const results = entities.map((entity) => importParsedEntity(db, entity, projectId, incomingNames));
    if (results.length === 1) return results[0];
    const totals = results.reduce((sum, result) => {
      for (const key of ['propertiesCreated','attributesCreated','attributesUpdated','referencedEntitiesCreated','referencedEntitiesMatched','categoriesCreated','categoriesUpdated','categoriesLinked'] as const) sum[key] += Number(result[key] || 0);
      return sum;
    }, { propertiesCreated: 0, attributesCreated: 0, attributesUpdated: 0, referencedEntitiesCreated: 0, referencedEntitiesMatched: 0, categoriesCreated: 0, categoriesUpdated: 0, categoriesLinked: 0 });
    return { batch: true, total: results.length, created: results.filter((item) => item.entityCreated).length, updated: results.filter((item) => item.entityUpdated).length, entityId: results[0]!.entityId, entityIds: results.map((item) => item.entityId), entities: results, ...totals };
  })();
}

function importParsedEntity(db: Database, entity: ParsedEntity, projectId: number | null, incomingNames: Map<string, ParsedEntity[]>) {
    let ontology = entity.ontology.id ? db.query('SELECT id,name,status FROM ontologies WHERE id=? AND project_id IS ?').get(entity.ontology.id, projectId) as any : null;
    if (!ontology) ontology = db.query('SELECT id,name,status FROM ontologies WHERE lower(name)=lower(?) AND project_id IS ? LIMIT 1').get(entity.ontology.name, projectId) as any;
    let ontologyCreated = false;
    if (!ontology) {
      const preferredId = entity.ontology.id || `ontology/${crypto.randomUUID()}`;
      const id = db.query('SELECT 1 FROM ontologies WHERE id=? LIMIT 1').get(preferredId)
        ? `ontology/${crypto.randomUUID()}`
        : preferredId;
      const order = db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ontologies WHERE parent_id IS NULL AND project_id IS ?').get(projectId) as any;
      db.run('INSERT INTO ontologies(id,name,alias,description,parent_id,project_id,display_shape,sort_order,status) VALUES(?,?,?,?,NULL,?,\'rectangle\',?,\'active\')', [id, entity.ontology.name, JSON.stringify([entity.ontology.name]), entity.ontology.description, projectId, order.next]);
      ontology = { id, name: entity.ontology.name }; ontologyCreated = true;
    } else if (ontology.status !== 'active') {
      db.run("UPDATE ontologies SET status='active' WHERE id=?", [ontology.id]);
    }
    let categoriesCreated = 0;
    let categoriesUpdated = 0;
    const categoryIds: string[] = [];
    const categoryTags: string[] = [];
    const syncCategory = (category: ParsedEntity['categories'][number], parentId: string | null) => {
      const siblings = db.query('SELECT id,name,tags FROM classes WHERE parent_id IS ? AND project_id IS ?').all(parentId, projectId) as any[];
      let row = siblings.find((item) => String(item.name || '').trim().toLowerCase() === category.name.toLowerCase());
      let effectiveTags = category.tags;
      if (row) {
        const fields = ['description', 'color', 'image', 'tags'].filter((field) => category.provided.includes(field));
        if (fields.length) {
          const values = fields.map((field) => field === 'tags' ? JSON.stringify(category.tags) : (category as any)[field]);
          db.run(`UPDATE classes SET ${fields.map((field) => `${field}=?`).join(',')} WHERE id=?`, [...values, row.id]);
        }
        if (!category.provided.includes('tags')) {
          try { effectiveTags = JSON.parse(row.tags || '[]'); } catch { effectiveTags = []; }
        }
        categoriesUpdated++;
      } else {
        const id = `class/${crypto.randomUUID()}`;
        const order = db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM classes WHERE parent_id IS ? AND project_id IS ?').get(parentId, projectId) as any;
        db.run('INSERT INTO classes(id,name,description,parent_id,project_id,color,image,tags,sort_order) VALUES(?,?,?,?,?,?,?,?,?)', [id, category.name, category.description, parentId, projectId, category.color, category.image, JSON.stringify(category.tags), order.next]);
        row = { id, name: category.name };
        categoriesCreated++;
      }
      categoryIds.push(row.id);
      categoryTags.push(...effectiveTags);
      for (const child of category.children) syncCategory(child, row.id);
    };
    for (const category of entity.categories) syncCategory(category, null);
    const mergedTags = [...new Map([...entity.tags, ...categoryTags].map((tag) => [tag.toLowerCase(), tag])).values()];
    const nodeId = entity.id;
    const existingNode = db.query('SELECT id,project_id FROM nodes WHERE id=? LIMIT 1').get(nodeId) as any;
    const entityCreated = !existingNode;
    if (existingNode) {
      db.run('UPDATE nodes SET name=?,type=?,description=?,aliases=?,tags=?,images=?,videos=?,pdf=?,link=?,visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [entity.name, ontology.id, entity.description, JSON.stringify(entity.aliases), JSON.stringify(mergedTags), JSON.stringify(entity.images), JSON.stringify(entity.videos), entity.pdf, entity.link, entity.visibility, nodeId]);
    } else {
      db.run('INSERT INTO nodes(id,name,type,description,aliases,tags,images,videos,pdf,link,visibility,project_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [nodeId, entity.name, ontology.id, entity.description, JSON.stringify(entity.aliases), JSON.stringify(mergedTags), JSON.stringify(entity.images), JSON.stringify(entity.videos), entity.pdf, entity.link, entity.visibility, projectId]);
    }
    if (entity.hasCategories) {
      db.run('DELETE FROM entity_classes WHERE entity_id=?', [nodeId]);
      for (const categoryId of categoryIds) db.run('INSERT OR IGNORE INTO entity_classes(entity_id,class_id) VALUES(?,?)', [nodeId, categoryId]);
    }
    let propertiesCreated = 0;
    let attributesCreated = 0;
    let attributesUpdated = 0;
    let referencedEntitiesCreated = 0;
    let referencedEntitiesMatched = 0;
    let referenceOntology: { id: string; name: string } | null = null;
    const ensureReferenceOntology = () => {
      if (referenceOntology) return referenceOntology;
      referenceOntology = db.query('SELECT id,name,status FROM ontologies WHERE lower(name)=lower(?) AND project_id IS ? LIMIT 1').get('实体条目', projectId) as any;
      if (!referenceOntology) {
        const preferredId = 'ontology/wikibase-item';
        const idInUse = db.query('SELECT 1 FROM ontologies WHERE id=? LIMIT 1').get(preferredId);
        const id = idInUse ? `ontology/${crypto.randomUUID()}` : preferredId;
        const order = db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ontologies WHERE parent_id IS NULL AND project_id IS ?').get(projectId) as any;
        db.run('INSERT INTO ontologies(id,name,alias,description,parent_id,project_id,display_shape,sort_order,status) VALUES(?,?,?,?,NULL,?,\'rectangle\',?,\'active\')', [id, '实体条目', JSON.stringify(['实体条目', 'Wikibase Item']), '由实体导入中的 wikibase-item 属性值自动创建', projectId, order.next]);
        referenceOntology = { id, name: '实体条目' };
      } else if ((referenceOntology as any).status !== 'active') {
        db.run("UPDATE ontologies SET status='active' WHERE id=?", [referenceOntology.id]);
      }
      return referenceOntology;
    };
    const existingNodes = () => db.query('SELECT id,name,aliases FROM nodes WHERE project_id IS ?').all(projectId) as any[];
    const labelsOf = (item: Record<string, any>) => [item.label_zh, item.entity_label_zh, item.label, item.name].map((label) => String(label || '').trim()).filter(Boolean);
    const resolveReferencedEntities = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(resolveReferencedEntities);
      if (!value || typeof value !== 'object') return value;
      const item = value as Record<string, any>;
      let id = String(item.id || '').replace(/^entity\//, '').trim();
      const labels = labelsOf(item);
      let matched = id ? db.query('SELECT id,name FROM nodes WHERE id=? AND project_id IS ? LIMIT 1').get(id, projectId) as any : null;
      if (!matched && id) {
        const candidates = incomingNames.get(id.toLocaleLowerCase()) || [];
        if (candidates.length === 1) matched = { id: candidates[0]!.id, name: candidates[0]!.name };
      }
      if (!matched && labels.length) {
        const wanted = new Set(labels.map((label) => label.toLocaleLowerCase()));
        matched = existingNodes().find((node) => {
          let aliases: string[] = [];
          try { aliases = JSON.parse(node.aliases || '[]'); } catch {}
          return [node.name, ...aliases].some((label) => wanted.has(String(label || '').trim().toLocaleLowerCase()));
        });
      }
      if (!matched && labels.length) {
        const candidates = new Map<string, ParsedEntity>();
        for (const label of labels) for (const candidate of incomingNames.get(label.toLocaleLowerCase()) || []) candidates.set(candidate.id, candidate);
        if (candidates.size === 1) {
          const candidate = [...candidates.values()][0]!;
          matched = { id: candidate.id, name: candidate.name };
        }
      }
      if (matched) {
        referencedEntitiesMatched++;
        return { ...item, id: matched.id, label_zh: item.label_zh || matched.name, 'entity-type': 'item' };
      }
      if (!id) id = `reference-${crypto.randomUUID()}`;
      const globallyExisting = db.query('SELECT project_id FROM nodes WHERE id=? LIMIT 1').get(id) as any;
      if (globallyExisting && (globallyExisting.project_id ?? null) !== projectId) id = `${id}--copy-${crypto.randomUUID().slice(0, 8)}`;
      const label = labels[0] || id;
      if (!incomingNames.get(label.toLocaleLowerCase())?.some((candidate) => candidate.id === id)) {
        const refOntology = ensureReferenceOntology();
        db.run('INSERT INTO nodes(id,name,type,description,aliases,tags,images,videos,pdf,link,visibility,project_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [id, label, refOntology.id, `由实体属性引用自动创建（${id}）`, '[]', '[]', '[]', '[]', '', `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`, 'public', projectId]);
        referencedEntitiesCreated++;
      }
      return { ...item, id, label_zh: item.label_zh || label, 'entity-type': 'item' };
    };
    for (const attribute of entity.attributes) {
      let property = attribute.id ? db.query('SELECT id,name,datatype,valuetype,status FROM properties WHERE id=? AND project_id IS ?').get(attribute.id, projectId) as any : null;
      if (!property) property = db.query('SELECT id,name,datatype,valuetype,status FROM properties WHERE lower(name)=lower(?) AND project_id IS ? LIMIT 1').get(attribute.name, projectId) as any;
      if (!property) {
        const preferredId = attribute.id || `property/${crypto.randomUUID()}`;
        const id = db.query('SELECT 1 FROM properties WHERE id=? LIMIT 1').get(preferredId)
          ? `property/${crypto.randomUUID()}`
          : preferredId;
        db.run("INSERT INTO properties(id,name,alias,status,datatype,valuetype,description,project_id) VALUES(?,?,?,'active',?,?,?,?)", [id, attribute.name, JSON.stringify([attribute.name]), attribute.datatype, valueTypeFor(attribute.datatype), attribute.description, projectId]);
        property = { id, name: attribute.name, datatype: attribute.datatype, valuetype: valueTypeFor(attribute.datatype) }; propertiesCreated++;
      } else {
        const existingDatatype = normalizeDatatype(property.datatype, property.valuetype);
        if (existingDatatype !== attribute.datatype || property.status !== 'active') {
          // Imported JSON is also a schema declaration. An older property may
          // have been created with the default string type before its real
          // Wikidata datatype was known. Keep the reused property, but align
          // its schema before validating and inserting the imported value.
          db.run("UPDATE properties SET datatype=?, valuetype=?, status='active' WHERE id=?", [attribute.datatype, valueTypeFor(attribute.datatype), property.id]);
          property = { ...property, datatype: attribute.datatype, valuetype: valueTypeFor(attribute.datatype) };
        }
      }
      db.run('INSERT OR IGNORE INTO ontology_properties(ontology_id,property_id) VALUES(?,?)', [ontology.id, property.id]);
      const datatype = normalizeDatatype(property.datatype || attribute.datatype, property.valuetype);
      if (datatype === 'wikibase-item') attribute.value = resolveReferencedEntities(attribute.value);
      let value: unknown;
      try {
        value = normalizeValue(datatype, attribute.value);
      } catch (error) {
        throw new EntityImportError(`属性“${attribute.name}”的值无效：${error instanceof Error ? error.message : '格式无效'}`);
      }
      const existingAttributeCount = Number((db.query('SELECT COUNT(*) AS count FROM attributes WHERE node_id=? AND key=?').get(nodeId, property.id) as any)?.count || 0);
      if (existingAttributeCount) {
        db.run('DELETE FROM attributes WHERE node_id=? AND key=?', [nodeId, property.id]);
        attributesUpdated++;
      } else attributesCreated++;
      db.run('INSERT INTO attributes(id,node_id,key,value,datatype,property_name_snapshot,statement_json) VALUES(?,?,?,?,?,?,?)', [`attr/${crypto.randomUUID()}`, nodeId, property.id, typeof value === 'object' ? JSON.stringify(value) : String(value), uiDatatype(datatype), property.name, JSON.stringify({ property: property.id, datatype, snaktype: 'value', value })]);
    }
    return { entityId: nodeId, entityCreated, entityUpdated: !entityCreated, ontologyId: ontology.id, ontologyCreated, propertiesCreated, attributesCreated, attributesUpdated, referencedEntitiesCreated, referencedEntitiesMatched, categoriesCreated, categoriesUpdated, categoriesLinked: categoryIds.length };
}
