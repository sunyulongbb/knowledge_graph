import { cachedWikimediaJson } from './wikimedia-request.ts';
import { importProxyOptions } from './import-proxy.ts';
import { EntityImportError } from './entity-import.ts';

export async function fetchWikidataEntity(raw: unknown, mediaOnly = false) {
  const id = String(raw || '').trim().toUpperCase();
  if (!/^Q[1-9][0-9]*$/.test(id)) throw new EntityImportError('请输入有效的 Wikidata ID，例如 Q42');
  // Bound the entity statements before resolving labels; label only the
  // entity and properties, rather than every linked value in the graph.
  const query = `SELECT ?itemLabel ?itemDescription ?property ?propertyLabel ?value ?valueLabel WHERE {
    { SELECT ?item ?property ?value WHERE {
      VALUES ?item { wd:${id} }
      ${mediaOnly
        ? 'VALUES (?predicate ?property) { (wdt:P18 wd:P18) (wdt:P10 wd:P10) } ?item ?predicate ?value .'
        : '?item ?predicate ?value . ?property wikibase:directClaim ?predicate . FILTER(?property NOT IN (wd:P18, wd:P10)) FILTER NOT EXISTS { ?property wikibase:propertyType wikibase:ExternalId }'}
    } LIMIT 2000 }
    OPTIONAL { FILTER(?property IN (wd:P31, wd:P279, wd:P171)) BIND(?value AS ?typeEntity) }
    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "zh,en".
      ?item rdfs:label ?itemLabel; schema:description ?itemDescription.
      ?property rdfs:label ?propertyLabel.
      ?typeEntity rdfs:label ?valueLabel.
    }
  }`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  let data: any;
  try {
    data = await cachedWikimediaJson(url, { ...importProxyOptions(), headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'KnowledgeGraphImport/1.0' }, signal: AbortSignal.timeout(60000) });
  } catch (error) { throw new EntityImportError(`Wikidata 查询失败：${error instanceof Error ? error.message : error}`); }
  const rows = data.results?.bindings || [];
  if (!rows.length && mediaOnly) return { version: 1, entity: { id, name: id, description: '', type: 'Wikidata 实体', link: '', images: [], videos: [], attributes: [] } };
  if (!rows.length) throw new EntityImportError('未找到实体数据');
  // Resolve names for every entity-valued statement, in bounded API batches.
  const typeIds = [...new Set<string>(rows.map((row: any) => row.value.value.match(/\/(Q[1-9][0-9]*)$/)?.[1]).filter(Boolean))];
  if (typeIds.length) {
    const labels: Record<string, any> = {};
    for (let offset = 0; offset < typeIds.length; offset += 50) {
    const labelsUrl = new URL('https://www.wikidata.org/w/api.php');
    for (const [key, value] of Object.entries({ action: 'wbgetentities', ids: typeIds.slice(offset, offset + 50).join('|'), props: 'labels', languages: 'zh|zh-hans|zh-hant|en', format: 'json' })) labelsUrl.searchParams.set(key, value);
    try {
      Object.assign(labels, (await cachedWikimediaJson(labelsUrl, { ...importProxyOptions(), signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'KnowledgeGraphImport/1.0' } })).entities || {});
    } catch { /* Label enrichment is optional; retain SPARQL labels during cooldown. */ }
    }
    for (const row of rows) {
      const target = row.value.value.match(/\/(Q[1-9][0-9]*)$/)?.[1];
      const names = labels[target]?.labels;
      const label = names?.zh?.value || names?.['zh-hans']?.value || names?.['zh-hant']?.value || names?.en?.value;
      if (label) row.valueLabel = { value: label };
    }
  }
  const images: string[] = [], videos: string[] = [], attributes: any[] = [];
  for (const row of rows) {
    const property = row.property.value.split('/').pop();
    const value = row.value.value;
    const mediaUrl = value.replace(/^http:\/\/(commons\.wikimedia\.org|upload\.wikimedia\.org)\//, 'https://$1/');
    if (property === 'P18') images.push(mediaUrl);
    if (property === 'P10') videos.push(mediaUrl);
    const targetId = row.value.type === 'uri' ? value.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9][0-9]*)$/)?.[1] : undefined;
    const datatype = targetId ? 'wikibase-item' : 'string';
    const mappedValue = targetId ? { id: targetId, ...(row.valueLabel?.value ? { label_zh: row.valueLabel.value } : {}) } : value;
    const existing = attributes.find(attribute => attribute.id === property);
    if (existing) existing.value.push(mappedValue);
    else attributes.push({ id: property, name: `${row.propertyLabel?.value || property} (${property})`, datatype, value: [mappedValue] });
  }
  return { version: 1, entity: { id, name: rows[0].itemLabel?.value || id, description: rows[0].itemDescription?.value || '', type: 'Wikidata 实体', link: `https://www.wikidata.org/wiki/${id}`, images, videos, attributes } };
}

/** Snapshot only direct references: newly fetched targets are never enqueued. */
export function directWikidataTargets(knowledge: Awaited<ReturnType<typeof fetchWikidataEntity>>) {
  const ids = new Set<string>();
  for (const attribute of knowledge.entity.attributes) {
    if (attribute.datatype !== 'wikibase-item') continue;
    for (const value of attribute.value) {
      if (value && typeof value === 'object' && /^Q[1-9][0-9]*$/.test(value.id) && value.id !== knowledge.entity.id) ids.add(value.id);
    }
  }
  return [...ids];
}
