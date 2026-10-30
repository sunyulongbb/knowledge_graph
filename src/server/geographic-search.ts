import { canUseArangoKnowledge, knowledgeReadAccess, KnowledgeStoreError } from './enterprise-knowledge.ts';
import type { EnterpriseKnowledgeStore } from './enterprise-knowledge.ts';
import type { KnowledgeUser } from './knowledge-access.ts';
import { ArangoKnowledgeSearch } from './arango-knowledge-search.ts';
import { attributeEarthPoint } from '../shared/geography.ts';

export function geographicBounds(params: URLSearchParams) {
  const values = ['west', 'south', 'east', 'north'].map(name => params.has(name) ? Number(params.get(name)) : NaN);
  const [west, south, east, north] = values as [number, number, number, number];
  if (!values.every(Number.isFinite) || Math.abs(west) > 180 || Math.abs(east) > 180 || south < -90 || north > 90 || south >= north || west === east) {
    throw new KnowledgeStoreError('无效的地图经纬度范围');
  }
  const width = east > west ? east - west : east - west + 360;
  let longitude = west + width / 2; if (longitude > 180) longitude -= 360;
  return { west, south, east, north, wraps: west > east, center: [longitude, (south + north) / 2],
    radius: width >= 180 ? 20_040_000 : Math.min(20_040_000, 6_371_000 * Math.PI / 180 * ((north - south) / 2 + width / 2) + 10) };
}

export class GeographicKnowledgeSearch {
  private ready = new Map<string, Promise<void>>();
  private text: ArangoKnowledgeSearch;
  constructor(readonly store: EnterpriseKnowledgeStore) { this.text = new ArangoKnowledgeSearch(store); }
  async prepare(database: string) {
    if (!this.ready.has(database)) {
      const promise = (async () => {
        await this.store.ensure(database);
        let after = '';
        while (true) {
          const batch = await this.store.query(database, `FOR location IN link
            FILTER location.geo == null AND location._key > @after
              AND (location.mainsnak.datatype IN ['globe-coordinate', 'globecoordinate'] OR location.datatype IN ['globe-coordinate', 'globecoordinate']
                OR location.attribute.datatype IN ['globe-coordinate', 'globecoordinate'])
            SORT location._key ASC LIMIT 500
            RETURN { key: location._key, datatype: NOT_NULL(location.mainsnak.datatype, location.datatype, location.attribute.datatype, ''),
              value: NOT_NULL(location.mainsnak.datavalue.value, location.value, location.attribute.value) }`, { after });
          if (!batch.length) break;
          const updates = batch.flatMap(row => {
            const geo = attributeEarthPoint(row.value, row.datatype);
            return geo ? [{ _key: row.key, geo }] : [];
          });
          if (updates.length) {
            const { body } = await this.store.client.database(database, '/_api/document/link', { method: 'PATCH', body: JSON.stringify(updates) });
            if (!Array.isArray(body) || body.some(row => row.error)) throw new Error('坐标索引字段补齐失败');
          }
          after = batch[batch.length - 1]!.key;
          if (batch.length < 500) break;
        }
        await this.store.client.database(database, '/_api/index?collection=link', { method: 'POST', body: JSON.stringify({ name: 'knowledge_location_geo', type: 'geo', fields: ['geo'], geoJson: true }) });
      })();
      this.ready.set(database, promise); promise.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async search(database: string, params: URLSearchParams, user: KnowledgeUser | null, classIds: string[] | null, excluded: string[]) {
    const bounds = geographicBounds(params);
    await this.prepare(database);
    const q = (params.get('q') || '').trim();
    if (q) await this.text.prepare(database);
    const access = knowledgeReadAccess(user);
    const query = `${q ? "LET textMatches = (FOR hit IN knowledge_search SEARCH PHRASE(hit.search_text, @q, 'text_zh') OR PHRASE(hit.search_text, @q, 'text_en') OR hit.sqlite_id == @q RETURN hit._id)" : ''}
      FOR location IN link
        FILTER GEO_IN_RANGE(@center, location.geo, 0, @radius)
          AND location.mainsnak.datatype IN ['globe-coordinate', 'globecoordinate']
          AND location.geo.coordinates[1] >= @south AND location.geo.coordinates[1] <= @north
          AND (@wraps ? (location.geo.coordinates[0] >= @west OR location.geo.coordinates[0] <= @east) : (location.geo.coordinates[0] >= @west AND location.geo.coordinates[0] <= @east))
        LET doc = DOCUMENT(location._from)
        FILTER doc != null AND ${access.filter} ${q ? 'AND doc._id IN textMatches' : ''}
          AND (@type == null OR doc.type == @type) AND (!@emptyType OR doc.type == null OR doc.type == '')
          AND doc.type NOT IN @excluded
          AND (@classes == null OR LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), @classes)) > 0)
          AND ((@property == '' AND @value == '') OR LENGTH(FOR edge IN link FILTER edge._from == doc._id
            AND (@property == '' OR edge.property_id == @property) AND (@value == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @value)) LIMIT 1 RETURN 1) > 0)
        COLLECT entityId = doc.sqlite_id, longitude = location.geo.coordinates[0], latitude = location.geo.coordinates[1]
          INTO matches = { node: doc, property: location.property_name }
        LIMIT 1001 RETURN { node: FIRST(matches).node, coordinates: [longitude, latitude], property: FIRST(matches).property }`;
    const rows = await this.store.query(database, query, { ...access.bindVars, ...bounds, ...(q ? { q } : {}), classes: classIds,
      type: params.get('type') || null, emptyType: params.has('type') && params.get('type') === '', excluded,
      property: params.get('property_id') || '', value: (params.get('property_value') || '').toLowerCase() });
    return { items: rows.slice(0, 1000).filter(row => canUseArangoKnowledge(row.node, user)), truncated: rows.length > 1000, limit: 1000 };
  }
}
