import type { EnterpriseKnowledgeSearch } from '../enterprise-search.ts';
import type { EnterpriseSqliteBackup } from '../enterprise-sqlite-backup.ts';
import { prepareEntityImageValues } from '../entity-media-images.ts';
import { marked } from 'marked';
import { enterpriseKnowledgeEnabled } from '../knowledge-mode.ts';
import {
  EnterpriseKnowledgeStore, ArangoElasticsearchSync, KnowledgeStoreError,
  arangoNodeResponse, arangoAttributeResponse, canUseArangoKnowledge, cleanKnowledgeId,
} from '../enterprise-knowledge.ts';
import type { KnowledgeUser } from '../knowledge-access.ts';
import { relationAttributeResponse } from '../relation-order.ts';
import { importEnterpriseEntities } from '../enterprise-entity-import.ts';
import { hiddenKnowledgeTypes } from '../ontology-filter.ts';
import { EntityImportError, parseEntityImports, localizeEntityImportMedia, cleanupLocalizedEntityImport } from '../entity-import.ts';

type Doc = Record<string, any>;
type Dependencies = {
  store: EnterpriseKnowledgeStore;
  sync?: ArangoElasticsearchSync;
  backup?: EnterpriseSqliteBackup;
  search?: EnterpriseKnowledgeSearch;
  getUser: (req: Request) => KnowledgeUser | null;
  getProject: (identifier: string) => Doc | null;
  canCreate: (user: KnowledgeUser, project: Doc) => boolean;
  listProjects?: () => Doc[];
  serveMedia?: (req: Request, path: string) => Promise<Response | null>;
  getSchema?: (project: Doc) => { classes: Doc[]; ontologies: Doc[]; properties: Doc[]; ontology_properties?: Doc[] };
};
const integer = (value: string | null, fallback: number, max: number) => {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number >= 0 ? Math.min(number, max) : fallback;
};
const schemaReadPaths = new Set(['/api/kb/ontologies', '/api/kb/ontology/tree', '/api/kb/properties', '/api/kb/ontology/property']);
export const enterpriseMediaPath = (path: string) => /^\/static\/uploads\/(?:.*\/)?(node-images|node-videos|node-pdfs)\//i.test(path.replace(/\/{2,}/g, '/'));
export function enterpriseKnowledgePath(path: string) {
  return enterpriseMediaPath(path) || /^\/api\/kb\/(?:node(?:s)?(?:\/|$)|node-types$|entity(?:_|\/)|attributes(?:\/|$)|relations(?:\/|$)|graph$|edge$|stats$|classes$|gallery_|knowledge-|entry(?:\/|$)|shorts_|fetch$|clean\/)/.test(path)
    || path.startsWith('/api/wiki/') || path.startsWith('/api/knowledge/') || path.startsWith('/api/sparql/import');
}
export function createEnterpriseKnowledgeHandler(deps: Dependencies) {
  return async (req: Request, url: URL, method: string): Promise<Response | null> => {
    if (!enterpriseKnowledgeEnabled() || (!enterpriseKnowledgePath(url.pathname) && !(method === 'GET' && schemaReadPaths.has(url.pathname)))) return null;
    try {
      if (enterpriseMediaPath(url.pathname)) {
        const projects = url.searchParams.has('db') ? [deps.getProject(url.searchParams.get('db')!)].filter(Boolean) : deps.listProjects?.() || [deps.getProject('default')].filter(Boolean);
        const user = deps.getUser(req);
        let backendError: unknown;
        for (const project of projects) {
          let readable = false;
          try { readable = await deps.store.mediaReadable(project!.name, url.pathname, user); }
          catch (error: any) {
            // SQLite may still list applications not migrated to ArangoDB.
            // A missing database must not block media belonging to another app.
            if (error?.status !== 404 || error?.body?.errorNum !== 1228) backendError = error;
            continue;
          }
          if (readable) return await deps.serveMedia?.(req, url.pathname) || new Response('Not Found', { status: 404 });
        }
        if (backendError) throw backendError;
        return new Response('Not Found', { status: 404 });
      }
      if (url.pathname === '/api/kb/classes' && method === 'POST') return null;
      const project = deps.getProject(url.searchParams.get('db') || 'default');
      if (!project) throw new KnowledgeStoreError('应用不存在', 404);
      const database = project.name;
      const user = deps.getUser(req);
      const path = url.pathname;
      const store = deps.store;
      const loggedIn = () => {
        if (!user || user.id <= 0) throw new KnowledgeStoreError('请先登录', 401);
        return user;
      };
      const synchronizeWrite = async () => {
        if (!deps.sync) return 'disabled';
        try { await deps.sync.afterWrite(database); return 'synced'; }
        catch (error) { console.error('Knowledge saved to ArangoDB; Elasticsearch synchronization will retry:', error); return 'pending'; }
      };
      if (path === '/api/kb/entity/import' && method === 'POST') {
        const current = loggedIn();
        if (!deps.canCreate(current, project)) throw new KnowledgeStoreError('仅应用成员可以导入实体', 403);
        if (!deps.sync) throw new KnowledgeStoreError('未配置 Elasticsearch 同步，无法导入实体', 503);
        let input: unknown;
        try { input = await req.json(); }
        catch { throw new KnowledgeStoreError('无效的 JSON 请求'); }
        parseEntityImports(input);
        const localized = await localizeEntityImportMedia(input, Number(project.id));
        let result: Doc;
        try { result = await importEnterpriseEntities(store, database, Number(project.id), localized.input, current, () => deps.getSchema?.(project)); }
        catch (error) { cleanupLocalizedEntityImport(localized.files); throw error; }
        const sync = await synchronizeWrite();
        return Response.json({ ok: true, ...result, filesLocalized: localized.files.length, sync,
          ...(sync === 'pending' ? { warning: '实体已保存到 ArangoDB，Elasticsearch 同步暂未完成，后台将自动重试' } : {}) }, { status: sync === 'pending' ? 202 : 200 });
      }
      const importedSchema = await store.importSchema?.(database);
      const schema = importedSchema || deps.getSchema?.(project);
      if (method === 'GET' && schemaReadPaths.has(path)) {
        const parse = (value: any) => { try { return typeof value === 'string' ? JSON.parse(value) : value || []; } catch { return []; } };
        const status = url.searchParams.get('status') || 'active';
        const q = (url.searchParams.get('q') || '').trim().toLocaleLowerCase();
        const filter = (rows: Doc[]) => rows.filter(row => (status === 'all' || (row.status || 'active') === status)
          && (!q || [row.name, ...parse(row.alias)].some(value => String(value || '').toLocaleLowerCase().includes(q))));
        if (path === '/api/kb/properties') return Response.json(filter(schema?.properties || []).map(row => ({ ...row, alias: parse(row.alias), label: row.name })));
        if (path === '/api/kb/ontology/property') {
          const ontologyId = url.searchParams.get('ontology_id');
          if (!ontologyId) throw new KnowledgeStoreError('缺少 ontology_id');
          const ontologyIds = new Set([ontologyId]);
          if (url.searchParams.get('include_inherited') === '1') {
            let current = schema?.ontologies.find(row => row.id === ontologyId);
            while (current?.parent_id && !ontologyIds.has(current.parent_id)) {
              ontologyIds.add(current.parent_id);
              current = schema?.ontologies.find(row => row.id === current!.parent_id);
            }
          }
          const links = (schema?.ontology_properties || []).filter(row => ontologyIds.has(row.ontology_id));
          return Response.json({ items: (schema?.properties || []).filter(row => links.some(link => link.property_id === row.id)).map(row => {
            const isLocal = links.some(link => link.property_id === row.id && link.ontology_id === ontologyId);
            return { ...row, label: row.name, is_local: isLocal, inherited: !isLocal, types: parse(row.types) };
          }) });
        }
        const rows: Doc[] = filter(schema?.ontologies || []).map(row => ({ ...row, alias: parse(row.alias) }));
        if (path === '/api/kb/ontologies') return Response.json(rows);
        const flat = rows.filter(row => row.name !== '实体条目' && !row.alias.includes('Wikibase Item'));
        const tree = (parent: string | null, ancestors = new Set<string>()): Doc[] => flat.filter(row => (row.parent_id || null) === parent && !ancestors.has(row.id))
          .map(row => ({ ...row, label: row.name, children: tree(row.id, new Set([...ancestors, row.id])) }));
        return Response.json({ items: tree(null), flat });
      }
      const resultNode = (node: Doc) => {
        const result = arangoNodeResponse(node, user);
        if (!schema) return result;
        const classes = schema.classes.filter(cls => result.categoryIds.includes(cls.id));
        const ontology = schema.ontologies.find(type => type.id === node.type || type.name === node.type);
        return { ...result, classes, categoryLabels: classes.map(cls => cls.name),
          classLabel: classes[0]?.name || result.classLabel, color: ontology?.color || classes[0]?.color || null,
          ontology: ontology || null, typeLabel: ontology?.name || result.typeLabel };
      };
      const graphNode = (node: Doc) => {
        // Cytoscape clients interpret a top-level `data` field as an element
        // wrapper. Business JSON has already been flattened by resultNode.
        const { data, ...fields } = resultNode(node);
        return fields;
      };
      await store.ensure(database);
      let body: Doc = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try { body = await req.json(); }
        catch { throw new KnowledgeStoreError('无效的 JSON 请求'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new KnowledgeStoreError('请求必须是 JSON 对象');
      }
      const id = cleanKnowledgeId(url.searchParams.get('id') || url.searchParams.get('entityId') || url.searchParams.get('entity_id') || body.id || body.entityId || body.entity_id);
      if (path === '/api/kb/entity_search' && method === 'GET') {
        if (!deps.search) throw new KnowledgeStoreError('未配置 Elasticsearch 知识检索', 503);
        const classId = url.searchParams.get('class_id');
        let classIds: string[] | null = classId ? [classId] : null;
        if (classId && schema) {
          const descendants = new Set([classId]);
          let added = true;
          while (added) {
            added = false;
            for (const cls of schema.classes) if (descendants.has(cls.parent_id) && !descendants.has(cls.id)) { descendants.add(cls.id); added = true; }
          }
          classIds = [...descendants];
        }
        let page;
        try { page = await deps.search.search(database, user, {
          q: url.searchParams.get('q'), limit: integer(url.searchParams.get('limit'), 20, 500),
          offset: integer(url.searchParams.get('offset'), 0, 1_000_000),
          classIds, type: url.searchParams.get('type'), order: url.searchParams.get('order'),
          emptyType: url.searchParams.has('type') && url.searchParams.get('type') === '',
          hasImage: ['1', 'true'].includes(url.searchParams.get('has_image') || ''),
          hasMedia: ['1', 'true'].includes(url.searchParams.get('has_media') || ''),
          propertyId: url.searchParams.get('property_id'), propertyValue: url.searchParams.get('property_value'),
          definedClasses: ['1', 'true'].includes(url.searchParams.get('defined_class_only') || '') && schema ? schema.classes.map(cls => cls.id) : null,
          definedTypes: ['1', 'true'].includes(url.searchParams.get('defined_type_only') || '') && schema ? schema.ontologies.map(type => type.id) : null,
          excludeTypes: ['1', 'true'].includes(url.searchParams.get('hide_entity') || '')
            ? hiddenKnowledgeTypes(schema?.ontologies) : [],
        }); } catch (error) {
          console.error('Elasticsearch knowledge search failed:', error);
          throw new KnowledgeStoreError('Elasticsearch 知识检索暂时不可用，请检查同步器状态', 503);
        }
        return Response.json({ nodes: page.nodes.map(resultNode), total: page.total, searchBackend: 'elasticsearch' }, { headers: { 'X-Knowledge-Search': 'elasticsearch' } });
      }
      if (path === '/api/kb/classes' && method === 'GET') {
        const summary = await store.summary(database, user);
        const counts = new Map(summary.categories.map((row: Doc) => [row.id, row.count]));
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const parse = (value: any) => { try { return typeof value === 'string' ? JSON.parse(value) : value || []; } catch { return []; } };
        return Response.json((schema?.classes || []).filter(cls => String(cls.name || '').toLowerCase().includes(q)).map(cls => ({
          ...cls, label: cls.name, parent: cls.parent_id, instance_count: counts.get(cls.id) || 0,
          tags: parse(cls.tags), analyses: parse(cls.analyses),
        })));
      }
      if (path === '/api/kb/entity/class') {
        if (method === 'GET') {
          const node = await store.require(database, id, user);
          return Response.json({ items: schema?.classes.filter(cls => (node.class_ids || []).includes(cls.id)).map(cls => ({ ...cls, label: cls.name })) || [] });
        }
        if (method === 'POST' || method === 'DELETE') {
          const classId = String(body.class_id || url.searchParams.get('class_id') || '').trim();
          if (method === 'POST' && !classId) throw new KnowledgeStoreError('缺少分类');
          if (classId && schema && !schema.classes.some(cls => cls.id === classId)) throw new KnowledgeStoreError('分类不属于当前应用');
          await store.classify(database, id, classId, method === 'DELETE', loggedIn());
          return Response.json({ ok: true, sync: await synchronizeWrite() });
        }
      }
      if (path === '/api/kb/node-types' && method === 'GET') {
        return Response.json((await store.summary(database, user)).types);
      }
      if (path === '/api/kb/stats' && method === 'GET') {
        const summary = await store.summary(database, user);
        return Response.json({ counts: { entity: summary.entities, link: summary.attributes,
          instance: schema?.classes.length || 0, property: schema?.properties.length || 0 } });
      }
      if (path === '/api/kb/node/random' && method === 'GET') {
        const page = await store.list(database, user, { limit: 1, offset: 0, order: 'random' });
        return Response.json({ node: page.nodes[0] ? resultNode(page.nodes[0]) : null });
      }
      if (path === '/api/kb/graph' && method === 'GET') {
        const page = await store.list(database, user, { limit: 500, offset: 0, classId: url.searchParams.get('class_id') });
        const handles = page.nodes.map((node: Doc) => node._id);
        const edges = await store.query(database, 'FOR e IN link FILTER e._from IN @handles AND e._to IN @handles AND e._from != e._to RETURN e', { handles });
        return Response.json({ nodes: page.nodes.map(graphNode), edges: edges.map(e => ({
          id: `${e.sqlite_id}:${e.target_id}`, source: e.source_id, target: e.target_id, type: e.property_id, label: e.property_name || e.property_id,
        })), total: page.total, truncated: page.total > page.nodes.length });
      }
      if (path === '/api/kb/nodes' && method === 'POST') {
        const current = loggedIn();
        if (!deps.canCreate(current, project)) throw new KnowledgeStoreError('需要应用成员权限才能创建知识', 403);
        const prepared = await prepareEntityImageValues(body, Number(project.id));
        const node = await store.create(database, Number(project.id), prepared, current);
        return Response.json({ ok: true, node: resultNode(node), sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/nodes/update' && method === 'POST') {
        if (!id) throw new KnowledgeStoreError('缺少知识 ID');
        const current = loggedIn();
        await store.require(database, id, current, 'edit');
        const prepared = await prepareEntityImageValues(body, Number(project.id));
        const node = await store.update(database, id, prepared, current);
        return Response.json({ ok: true, node: resultNode(node), sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/nodes' && method === 'DELETE') {
        if (!id) throw new KnowledgeStoreError('缺少知识 ID');
        await store.remove(database, id, loggedIn());
        return Response.json({ ok: true, success: true, sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/node' && method === 'GET') {
        if (!id) throw new KnowledgeStoreError('缺少知识 ID');
        const node = await store.require(database, id, user);
        node._search_attributes = await store.attributes(database, id);
        const rows = await store.relations(database, id, user);
        const neighbors = new Map<string, Doc>();
        const incomingRelations: Doc[] = [];
        for (const row of rows) {
          const sourceId = cleanKnowledgeId(row.source.sqlite_id || row.source.id);
          const targetId = cleanKnowledgeId(row.target.sqlite_id || row.target.id);
          const edge = { id: `${row.edge.sqlite_id}:${targetId}`, source: sourceId, target: targetId,
            type: row.edge.property_id, label: row.edge.property_name || row.edge.property_id, isAttribute: true };
          if (sourceId !== id) neighbors.set(sourceId, { node: resultNode(row.source), edge });
          if (targetId !== id) neighbors.set(targetId, { node: resultNode(row.target), edge });
          if (targetId === id) incomingRelations.push({ source: resultNode(row.source),
            propertyId: row.edge.property_id, propertyName: row.edge.property_name || row.edge.property_id || '关联' });
        }
        if (incomingRelations.length) {
          const handles = [...new Set(rows.filter(row => cleanKnowledgeId(row.target.sqlite_id || row.target.id) === id).map(row => row.source._id))].filter(Boolean);
          const secondLevel = handles.length ? await store.query(database, `FOR edge IN link
            FILTER edge._to IN @handles AND edge._from != edge._to
            LET source = DOCUMENT(edge._from) LET target = DOCUMENT(edge._to)
            FILTER source != null AND target != null RETURN { edge, source, target }`, { handles }) : [];
          const children = new Map<string, Doc[]>();
          for (const row of secondLevel) {
            const sourceId = cleanKnowledgeId(row.source.sqlite_id || row.source.id);
            if (sourceId === id || !canUseArangoKnowledge(row.source, user) || !canUseArangoKnowledge(row.target, user)) continue;
            const targetId = cleanKnowledgeId(row.target.sqlite_id || row.target.id);
            const group = children.get(targetId) || [];
            group.push({ source: resultNode(row.source), propertyId: row.edge.property_id,
              propertyName: row.edge.property_name || row.edge.property_id || '关联' });
            children.set(targetId, group);
          }
          for (const relation of incomingRelations) {
            const group = children.get(relation.source.id);
            if (group?.length) relation.secondLevel = group;
          }
        }
        return Response.json({ node: resultNode(node), neighbors: [...neighbors.values()], incomingRelations });
      }
      if (path === '/api/kb/node/attributes' && method === 'GET') {
        const node = await store.require(database, id, user);
        const attrs = (await store.attributes(database, id)).map(arangoAttributeResponse);
        return Response.json(relationAttributeResponse(attrs, node.relation_order));
      }
      if (['/api/kb/node/relations', '/api/kb/node/graph'].includes(path) && method === 'GET') {
        const center = await store.require(database, id, user);
        const rows = await store.relations(database, id, user, url.searchParams.get('direction') || 'both');
        const nodes = new Map<string, Doc>([[id, graphNode(center)]]);
        const edges = rows.map(({ edge, source, target }) => {
          const sourceId = cleanKnowledgeId(source.sqlite_id || source.id), targetId = cleanKnowledgeId(target.sqlite_id || target.id);
          nodes.set(sourceId, graphNode(source)); nodes.set(targetId, graphNode(target));
          return { id: `${edge.sqlite_id}:${targetId}`, source: sourceId, target: targetId, type: edge.property_id, label: edge.property_name || edge.property_id, isAttribute: true };
        });
        return Response.json(path.endsWith('/graph') ? { nodes: [...nodes.values()], edges } : { items: edges });
      }
      if (path === '/api/kb/attributes/save' && method === 'POST') {
        const definition = schema?.properties.find(prop => prop.id === (body.property || body.prop));
        if (definition?.status === 'deprecated') throw new KnowledgeStoreError('不能编辑已废弃的属性');
        const attr = await store.saveAttribute(database, { ...body,
          datatype: body.datatype || definition?.datatype,
          property_name_snapshot: definition?.name || body.property_name_snapshot,
        }, loggedIn());
        return Response.json({ ...arangoAttributeResponse(attr), sync: await synchronizeWrite() });
      }
      if (path.startsWith('/api/kb/attributes/') && method === 'DELETE') {
        await store.removeAttribute(database, decodeURIComponent(path.slice('/api/kb/attributes/'.length)), loggedIn());
        return Response.json({ success: true, sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/relations/create' && method === 'POST') {
        const current = loggedIn();
        const source = cleanKnowledgeId(body.source), target = cleanKnowledgeId(body.target);
        if (!source || !target) throw new KnowledgeStoreError('缺少关系起点或终点');
        await store.require(database, target, user);
        const attr = await store.saveAttribute(database, {
          node_id: source, property: body.type || 'related', datatype: 'wikibase-item',
          property_name_snapshot: body.label || body.type || 'related', value: { id: target },
        }, current);
        return Response.json({ id: `${attr.id}:${target}`, source, target, type: attr.key, label: attr.property_name_snapshot, isAttribute: true, sync: await synchronizeWrite() });
      }
      if (path.startsWith('/api/kb/relations/') && method === 'DELETE') {
        await store.removeRelation(database, decodeURIComponent(path.slice('/api/kb/relations/'.length)), loggedIn());
        return Response.json({ success: true, sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/node/relation-order' && method === 'POST') {
        const order = await store.reorder(database, id, body, loggedIn());
        return Response.json({ success: true, relation_order: order, sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/knowledge-access' && method === 'GET') {
        const node = await store.require(database, id, user);
        return Response.json({ id, visibility: node.visibility || 'public', owner: node.owner_user_id ? { id: node.owner_user_id, username: node.creator_username } : null,
          creatorUsername: node.creator_username, maintainers: (node.maintainer_ids || []).map((id: number) => ({ id })),
          requests: canUseArangoKnowledge(node, user, 'manage') ? Object.values(node.maintenance_requests || {}).filter((request: any) => request.status === 'pending') : [],
          ownRequest: user ? node.maintenance_requests?.[String(user.id)] || null : null,
          canManage: canUseArangoKnowledge(node, user, 'manage'), canEdit: canUseArangoKnowledge(node, user, 'edit'), canRequest: Boolean(user?.id && !canUseArangoKnowledge(node, user, 'edit')) });
      }
      if (['/api/kb/knowledge-maintenance/request', '/api/kb/knowledge-maintenance/review', '/api/kb/knowledge-maintenance/remove'].includes(path) && method === 'POST') {
        await store.maintenance(database, id, path.split('/').pop()!, body, loggedIn());
        return Response.json({ ok: true, sync: await synchronizeWrite() });
      }
      if (path === '/api/kb/knowledge-sync/status' && method === 'GET') {
        if (user?.role !== 'admin') throw new KnowledgeStoreError('需要管理员权限', 403);
        return Response.json({ backend: 'arangodb', sqliteBackup: deps.backup?.status(database) || null, elasticsearchConfigured: Boolean(deps.sync), ...(deps.sync?.status(database) || { source: 'entity', mode: 'disabled' }) });
      }
      if (path === '/api/kb/knowledge-sync/reindex' && method === 'POST') {
        if (loggedIn().role !== 'admin') throw new KnowledgeStoreError('需要管理员权限', 403);
        if (!deps.sync) throw new KnowledgeStoreError('未配置 Elasticsearch', 503);
        return Response.json({ ok: true, synced: await deps.sync.flush(database) });
      }
      if (path === '/api/wiki/page' && method === 'GET') {
        const node = await store.require(database, id, user);
        const md = String(node.wiki_md || '');
        return Response.json({ page: { md, html: md ? await marked.parse(md) : '' } });
      }
      if (path === '/api/wiki/page/save' && method === 'POST') {
        await store.update(database, id, { wiki_md: body.md ?? body.content ?? '' }, loggedIn());
        return Response.json({ ok: true, sync: await synchronizeWrite() });
      }
      // Never fall through to a legacy SQLite knowledge endpoint in Enterprise.
      return Response.json({ error: '此知识接口尚未迁移到 ArangoDB', code: 'ENTERPRISE_ROUTE_UNAVAILABLE', path }, { status: 501 });
    } catch (error: any) {
      if (error?.status === 404 && error?.body?.errorNum === 1228) {
        return Response.json({
          error: '当前应用尚未初始化 ArangoDB 知识库，请由系统管理员在「应用设置 → 知识同步」导入 SQLite 知识数据',
          code: 'KNOWLEDGE_DATABASE_NOT_INITIALIZED',
          database: deps.getProject(url.searchParams.get('db') || 'default')?.name,
        }, { status: 409 });
      }
      if (error instanceof KnowledgeStoreError || error instanceof EntityImportError || error instanceof TypeError || error instanceof RangeError) {
        return Response.json({ error: error.message }, { status: error instanceof KnowledgeStoreError ? error.status : 400 });
      }
      console.error('Enterprise knowledge request failed:', error);
      return Response.json({ error: 'ArangoDB 知识服务暂时不可用', code: 'KNOWLEDGE_BACKEND_UNAVAILABLE' }, { status: 503 });
    }
  };
}
