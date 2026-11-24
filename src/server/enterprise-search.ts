import { createHash } from 'node:crypto';
import { knowledgeMedia } from '../shared/knowledge-media.ts';
import { ElasticsearchClient, elasticsearchEntityIndexName } from './arangodb.ts';
import type { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';

type Doc = Record<string, any>;
export const ENTITY_SEARCH_SCHEMA = 2;
export async function ensureEntitySearchMapping(client: ElasticsearchClient, index: string) {
  // Each Wikidata language adds label/description/alias mapping fields.
  // Keep the limit bounded, but large enough for multilingual dump imports.
  const { body: settings } = await client.send(`/${encodeURIComponent(index)}/_settings?flat_settings=true`);
  const existing = Number(settings?.[index]?.settings?.['index.mapping.total_fields.limit'] || 1000);
  if (existing < 20000) await client.send(`/${encodeURIComponent(index)}/_settings`, {
    method:'PUT', body:JSON.stringify({ 'index.mapping.total_fields.limit':20000 }),
  });
  await client.send(`/${encodeURIComponent(index)}/_mapping`, { method: 'PUT', body: JSON.stringify({ properties: {
    has_images: { type: 'boolean' }, has_media: { type: 'boolean' },
    search_attributes: { type: 'nested', properties: {
      property_id: { type: 'keyword' }, value_text: { type: 'wildcard' },
    } },
  } }) });
}
/** Search-only projection; authoritative knowledge and values remain in ArangoDB. */
export function entitySearchProjection(document: Doc) {
  const { _id, _rev, _key, interactions, _search_attributes = [], ...fields } = document;
  const attributes: Doc[] = _search_attributes;
  const fingerprint = createHash('sha256').update(JSON.stringify([_rev, attributes])).digest('hex');
  const { images, videos, covers } = knowledgeMedia(fields, attributes);
  return { ...fields, images, videos, covers, _arango_rev: _rev, _search_revision: fingerprint, _search_schema: ENTITY_SEARCH_SCHEMA,
    has_images: images.length > 0, has_media: images.length > 0 || videos.length > 0,
    search_attributes: attributes.map(attr => ({ property_id: attr.property_id, value_text: attr.value_text })),
  };
}
export type EnterpriseSearchOptions = {
  esOnly?:boolean; ids?:string[];
  tag?: string | null; q?: string | null; limit: number; offset: number; order?: string | null;
  classIds?: string[] | null; type?: string | null; emptyType?: boolean;
  hasTags?: boolean; hasCategory?: boolean; hasImage?: boolean; hasMedia?: boolean; propertyId?: string | null; propertyValue?: string | null;
  definedClasses?: string[] | null; definedTypes?: string[] | null; excludeTypes?: string[];
  matchMode?: string | null; searchScope?: string | null; excludeQuery?: string | null;
  updatedFrom?: string | null; updatedTo?: string | null;
  includeTypes?: string[] | null;
  dateField?: 'updated' | 'created'; publicationMonths?: boolean; publicationMonth?: string | null;
  publicationYear?: string | null;
};
export function buildEnterpriseSearchQuery(options: EnterpriseSearchOptions, readableKeys: string[]) {
  if (!readableKeys.length || options.classIds?.length === 0 || options.definedClasses?.length === 0 || options.definedTypes?.length === 0) return { match_none: {} };
  const filter: Doc[] = [{ ids: { values: readableKeys } }];
  if (options.classIds) filter.push({ terms: { class_ids: options.classIds } });
  if (options.definedClasses) filter.push({ terms: { class_ids: options.definedClasses } });
  if (options.definedTypes) filter.push({ terms: { type: options.definedTypes } });
  if (options.type) filter.push({ term: { type: options.type } });
  if (options.includeTypes) filter.push({ terms: { type: options.includeTypes } });
  if (options.emptyType) filter.push({ bool: { should: [{ bool: { must_not: [{ exists: { field: 'type' } }] } }, { term: { type: '' } }], minimum_should_match: 1 } });
  if (options.hasTags !== undefined) filter.push(options.hasTags ? {exists:{field:'tags'}} : {bool:{must_not:[{exists:{field:'tags'}}]}});
  if (options.hasCategory !== undefined) filter.push(options.hasCategory ? {exists:{field:'class_ids'}} : {bool:{must_not:[{exists:{field:'class_ids'}}]}});
  if (options.hasImage) filter.push({ term: { has_images: true } });
  if (options.hasMedia) filter.push({ term: { has_media: true } });
  if (options.publicationMonth) filter.push({range:{publication_date:{gte:`${options.publicationMonth}-01`,lt:`${options.publicationMonth}-01||+1M`,time_zone:'Asia/Shanghai'}}});
  else if (options.publicationYear) filter.push({range:{publication_date:{gte:`${options.publicationYear}-01-01`,lt:`${options.publicationYear}-01-01||+1y`,time_zone:'Asia/Shanghai'}}});
  if (options.updatedFrom || options.updatedTo) filter.push({ range: { updated_at_sort: {
    ...(options.updatedFrom ? { gte: `${options.updatedFrom}T00:00:00.000Z` } : {}),
    ...(options.updatedTo ? { lte: `${options.updatedTo}T23:59:59.999Z` } : {}),
  } } });
  if (options.propertyId || options.propertyValue?.trim()) {
    const attributes: Doc[] = [];
    if (options.propertyId) attributes.push({ term: { 'search_attributes.property_id': options.propertyId } });
    if (options.propertyValue?.trim()) {
      const escaped = options.propertyValue.trim().replace(/[\\*?]/g, '\\$&');
      attributes.push({ wildcard: { 'search_attributes.value_text': { value: `*${escaped}*`, case_insensitive: true } } });
    }
    filter.push({ nested: { path: 'search_attributes', query: { bool: { filter: attributes } }, score_mode: 'none' } });
  }
  const bool: Doc = { filter };
  if (options.excludeTypes?.length) bool.must_not = [{ terms: { type: options.excludeTypes } }];
  const fields = options.searchScope === 'name' ? ['labels.*.value^4', 'aliases.*.value^3', 'sqlite_id']
    : ['labels.*.value^4', 'descriptions.*.value', 'aliases.*.value^3', 'type', 'sqlite_id'];
  if (options.q?.trim()) {
    const query = options.q.trim(), mode = options.matchMode || 'fuzzy';
    if (mode === 'phrase') bool.must = [{ multi_match: { query, fields, type: 'phrase' } }];
    else if (mode === 'all' || mode === 'any') bool.must = [{ multi_match: { query, fields, type: 'best_fields', operator: mode === 'all' ? 'and' : 'or' } }];
    else bool.must = [{ bool: { minimum_should_match: 1, should: [
      { multi_match: { query, fields, type: 'phrase', boost: 4 } },
      { multi_match: { query, fields, type: 'best_fields', operator: 'and', fuzziness: 'AUTO', prefix_length: 1, max_expansions: 30 } },
      { multi_match: { query, fields: ['labels.*.value^3', 'aliases.*.value^2'], type: 'bool_prefix', operator: 'and', boost: 0.6 } },
    ] } }];
  }
  if (options.excludeQuery?.trim()) {
    bool.must_not ||= [];
    bool.must_not.push({ multi_match: { query: options.excludeQuery.trim(), fields, type: 'best_fields', operator: 'or' } });
  }
  return { bool };
}
export class EnterpriseKnowledgeSearch {
  constructor(readonly store: EnterpriseKnowledgeStore, readonly client: ElasticsearchClient,
    readonly interactionCounts: () => Record<string, number> = () => ({}),
    readonly viewCounts: (database: string) => Record<string, number> = () => ({})) {}
  async search(database: string, user: KnowledgeUser | null, options: EnterpriseSearchOptions) {
    // Current ACL/identity and requested engagement totals are read from ArangoDB. Text search,
    // content, filters, paging and counts are exclusively served by Elasticsearch.
    // This also excludes deleted entities and blocks stale public ES copies after revocation.
    const access = options.esOnly ? [] : await this.store.searchAccess(database, user, options.order === 'popular');
    const popularityCounts = options.order === 'popular' ? this.viewCounts(database) : {};
    const permissions = new Map(access.map(row => [row.key, row]));
    if (!options.esOnly && !permissions.size) return { nodes: [] as Doc[], total: 0, months: [] };
    const query = buildEnterpriseSearchQuery(options, options.esOnly ? ['__es_only__'] : [...permissions.keys()]);
    if(options.esOnly && query.bool){
      query.bool.filter.shift();
      query.bool.filter.push({term:{recommendation_readable:true}});
      if(options.ids)query.bool.filter.push({terms:{sqlite_id:options.ids}});
    }
    const ascending = options.order?.endsWith('_asc');
    const field = options.order?.startsWith('created') ? 'created_at_sort' : 'updated_at_sort';
    const relevance = Boolean(options.q?.trim()) && (!options.order || ['relevance', 'hot'].includes(options.order));
    const richness = options.order === 'richness';
    // Runtime fields use the existing ES source, so already indexed knowledge is
    // ranked immediately without waiting for an index rebuild or background sync.
    let runtimeMappings:Doc | undefined = options.order === 'popular' ? {
      home_popularity: { type: 'long', script: { source: `
        def id = params._source.sqlite_id;
        emit(id != null && params.counts.containsKey(id) ? (long)params.counts[id] : 0L);`,
        params: { counts: popularityCounts } } },
    } : richness && !options.esOnly ? {
      home_media: { type: 'long', script: { source: `
        def s = params._source;
        boolean media = s.has_media == true;
        for (def key : ['images', 'videos', 'pdf']) {
          def value = s[key];
          if (value instanceof List) { for (def item : value) { if (item != null && item.toString().trim().length() > 0) media = true; } }
          else if (value != null && !['', '[]', 'null'].contains(value.toString().trim())) media = true;
        }
        emit(media ? 1L : 0L);` } },
      home_richness: { type: 'long', script: { source: `
        def s = params._source;
        def tags = s.tags;
        def unique = new HashSet();
        if (tags instanceof String) {
          def text = tags.trim();
          if (text.startsWith('[') && text.endsWith(']')) tags = text.substring(1, text.length() - 1).splitOnToken(',');
          else tags = [];
        }
        if (tags != null) for (def tag : tags) {
          if (tag == null) continue;
          def text = tag.toString().trim();
          if (text.startsWith('"') && text.endsWith('"') && text.length() >= 2) text = text.substring(1, text.length() - 1).trim();
          if (text.length() > 0) unique.add(text);
        }
        def id = s.sqlite_id;
        long interactions = id != null && params.counts.containsKey(id) ? (long)params.counts[id] : 0L;
        emit(unique.size() * 5L + interactions);`, params: { counts: this.interactionCounts() } } },
    } : undefined;
    if(options.esOnly) runtimeMappings={...runtimeMappings,recommendation_readable:{type:'boolean',script:{
      source:`def s=params._source; boolean member=s.project_id!=null && params.projects.contains(s.project_id);
        boolean own=params.uid>0 && s.owner_user_id!=null && s.owner_user_id==params.uid;
        boolean maintained=params.uid>0 && s.maintainer_ids!=null && s.maintainer_ids.contains(params.uid);
        emit(params.full || member || (params.admin && s.owner_user_id==null) || s.visibility==null || s.visibility=='public' || own || maintained);`,
      params:{full:Boolean(user?.fullAccess),admin:user?.role==='admin',uid:user?.id || -1,projects:[...(user?.ownedProjectIds||[]),...(user?.memberProjectIds||[])]},
    }}};
    const sort = options.esOnly && richness ? [{has_media:{order:'desc',unmapped_type:'boolean'}},{updated_at_sort:{order:'desc',unmapped_type:'keyword'}},{sqlite_id:'asc'}] : options.order === 'popular' ? [{ home_popularity: 'desc' }, { updated_at_sort: { order: 'desc', unmapped_type: 'keyword' } }, { sqlite_id: 'asc' }] : richness ? [{ home_media: 'desc' }, { home_richness: 'desc' }, { updated_at_sort: { order: 'desc', unmapped_type: 'keyword' } }, { sqlite_id: 'asc' }] : options.order === 'id' ? [{ sqlite_id: 'asc' }] : relevance
      ? [{ _score: 'desc' }, { sqlite_id: 'asc' }]
      : [{ [field]: { order: ascending ? 'asc' : 'desc', unmapped_type: 'keyword' } }, { sqlite_id: 'asc' }];
    const index = encodeURIComponent(elasticsearchEntityIndexName(database));
    const read = async (body: Doc, path = `/${index}/_search`) => {
      // Existing indexes deliberately store sort timestamps as keyword. Do not
      // run date math or date_histogram against that mapping.
      const publicationRuntime = options.publicationMonths || options.publicationMonth || options.publicationYear ? {
        publication_date: {type:'date',script:{source:`
          if (doc.containsKey('${options.dateField === 'updated' ? 'updated_at_sort' : 'created_at_sort'}') && doc['${options.dateField === 'updated' ? 'updated_at_sort' : 'created_at_sort'}'].size() > 0) {
            def value = doc['${options.dateField === 'updated' ? 'updated_at_sort' : 'created_at_sort'}'].value.toString();
            try { emit(java.time.Instant.parse(value).toEpochMilli()); }
            catch (Exception e) { }
          }`}}
      } : {};
      const highlight = options.q?.trim() ? { pre_tags: ['\uE000'], post_tags: ['\uE001'], require_field_match: true,
        fields: { 'labels.*.value': { number_of_fragments: 0 }, 'aliases.*.value': { number_of_fragments: 1, fragment_size: 100 },
          ...(options.searchScope === 'name' ? {} : { 'descriptions.*.value': { number_of_fragments: 2, fragment_size: 160 } }) } } : undefined;
      const { body: result } = await this.client.send(path, { method: 'POST', body: JSON.stringify({ query, sort, ...(options.esOnly ? {_source:{excludes:['data','search_attributes','_search_attributes','interactions','claims','sitelinks']}} : {}), ...((runtimeMappings || options.publicationMonths || options.publicationMonth || options.publicationYear) ? { runtime_mappings: {...runtimeMappings,...publicationRuntime} } : {}), track_total_hits: true, ...(highlight ? { highlight } : {}), ...body }) });
      if (result?.timed_out || result?._shards?.failed) throw new Error('Elasticsearch returned incomplete knowledge search results');
      return result;
    };
    if (options.publicationMonths) {
      const result = await read({size:0,aggs:{months:{date_histogram:{field:'publication_date',calendar_interval:'month',time_zone:'Asia/Shanghai',format:'yyyy-MM',min_doc_count:1,order:{_key:'desc'}}}}});
      return {nodes:[] as Doc[],total:Number(result.hits?.total?.value||0),months:(result.aggregations?.months?.buckets||[]).map((bucket:Doc)=>({month:bucket.key_as_string,count:bucket.doc_count}))};
    }
    let result: Doc;
    if (options.offset + options.limit <= 10_000) {
      result = await read({ from: options.offset, size: options.limit });
    } else {
      const { body } = await this.client.send(`/${index}/_pit?keep_alive=1m`, { method: 'POST' });
      let pitId = body?.id;
      if (!pitId) throw new Error('Elasticsearch could not open knowledge pagination');
      try {
        let remaining = options.offset, searchAfter: unknown[] | undefined;
        while (true) {
          const skipping = remaining > 0;
          result = await read({ size: skipping ? Math.min(1000, remaining) : options.limit,
            pit: { id: pitId, keep_alive: '1m' }, ...(searchAfter ? { search_after: searchAfter } : {}) }, '/_search');
          pitId = result.pit_id || pitId;
          const hits: Doc[] = result.hits?.hits || [];
          if (!skipping) break;
          if (!hits.length) { result.hits.hits = []; break; }
          remaining -= hits.length;
          searchAfter = hits[hits.length - 1]!.sort;
          if (!searchAfter) throw new Error('Elasticsearch did not return knowledge pagination values');
        }
      } finally {
        await this.client.send('/_pit', { method: 'DELETE', body: JSON.stringify({ id: pitId }) }).catch(() => {});
      }
    }
    const nodes: Doc[] = [];
    for (const hit of result!.hits?.hits || []) {
      const permission = permissions.get(hit._id);
      if ((permission || options.esOnly) && hit._source) {
        const highlights: Doc = { name: [], description: [], aliases: [] };
        for (const [field, fragments] of Object.entries(hit.highlight || {})) {
          const key = field.startsWith('labels.') ? 'name' : field.startsWith('descriptions.') ? 'description' : field.startsWith('aliases.') ? 'aliases' : '';
          if (key && Array.isArray(fragments)) highlights[key].push(...fragments.filter(value => typeof value === 'string'));
        }
        nodes.push({ ...hit._source, ...(options.order==='popular'&&permission?.engagement?{engagement:permission?.engagement}:{}), searchHighlights: highlights, _current_permissions: { can_edit: permission?.can_edit, can_manage: permission?.can_manage } });
      }
    }
    return { total: Number(result!.hits?.total?.value ?? result!.hits?.total ?? 0), nodes };
  }
}
