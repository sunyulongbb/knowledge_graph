import { test, expect } from 'bun:test';
import { fetchWikidataEntity } from '../src/server/wikidata-import.ts';

test('Wikidata retries a reset and returns entity data', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    if (++calls === 1) throw new Error('ECONNRESET');
    return Response.json({ results: { bindings: [{ itemLabel: { value: '测试' }, property: { value: 'http://www.wikidata.org/entity/P18' }, value: { value: 'https://example.org/test.jpg' } }] } });
  }) as typeof fetch;
  try {
    const result = await fetchWikidataEntity('q305177');
    expect(calls).toBe(2);
    expect(result.entity.id).toBe('Q305177');
    expect(result.entity.images).toEqual(['https://example.org/test.jpg']);
  } finally { globalThis.fetch = original; }
});

test('Wikidata permanent HTTP failures identify upstream without retry', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('', { status: 400 }); }) as typeof fetch;
  try {
    await expect(fetchWikidataEntity('Q42')).rejects.toThrow('Wikidata 查询失败：HTTP 400');
    expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});

test('Wikidata entity references become grouped relation values', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ results: { bindings: ['Q1', 'Q2'].map(id => ({ itemLabel: { value: 'Source' }, property: { value: 'http://www.wikidata.org/entity/P31' }, propertyLabel: { value: '实例' }, value: { type: 'uri', value: `http://www.wikidata.org/entity/${id}` } })) } })) as typeof fetch;
  try {
    const result = await fetchWikidataEntity('Q42');
    expect(result.entity.attributes).toEqual([{ id: 'P31', name: '实例 (P31)', datatype: 'wikibase-item', value: [{ id: 'Q1' }, { id: 'Q2' }] }]);
  } finally { globalThis.fetch = original; }
});

test('direct targets deduplicate and exclude self references', async () => {
  const { directWikidataTargets } = await import('../src/server/wikidata-import.ts');
  expect(directWikidataTargets({ entity: { id: 'Q42', attributes: [{ datatype: 'wikibase-item', value: [{ id: 'Q1' }, { id: 'Q1' }, { id: 'Q42' }, { id: 'Q2' }] }, { datatype: 'string', value: ['Q3'] }] } } as any)).toEqual(['Q1', 'Q2']);
});

test('entity query excludes ExternalId properties for root and related imports', async () => {
  const original = globalThis.fetch;
  let query = '';
  globalThis.fetch = (async (url: any) => {
    query = new URL(String(url)).searchParams.get('query') || '';
    return Response.json({ results: { bindings: [{ itemLabel: { value: '测试' }, property: { value: 'http://www.wikidata.org/entity/P31' }, value: { type: 'uri', value: 'http://www.wikidata.org/entity/Q5' } }] } });
  }) as typeof fetch;
  try {
    await fetchWikidataEntity('Q42');
    expect(query).toContain('FILTER NOT EXISTS { ?property wikibase:propertyType wikibase:ExternalId }');
  } finally { globalThis.fetch = original; }
});
