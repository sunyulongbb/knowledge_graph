import { test, expect } from 'bun:test';
import { applyWikidataSchema } from '../src/server/wikidata-schema.ts';
const schema = () => ({ ontologies: [], classes: [], properties: [], ontology_properties: [] });
const entity = (id: string, properties: Record<string, string[]>) => ({ id, name: id, attributes: Object.entries(properties).map(([id, ids]) => ({ id, value: ids.map(id => ({ id })) })) });
test('P31 membership is separate from P279 inheritance and metaclass membership', () => {
  const s: any = schema();
  applyWikidataSchema(s, entity('Q1', { P31: ['Q10'], P279: ['Q2', 'Q3'], P361: ['Q4'], P171: ['Q5'] }), 7);
  const own = s.ontologies.find((r: any) => r.wikidata_id === 'Q1');
  expect(own.parent_ids).toEqual(['ontology/Q2', 'ontology/Q3']);
  expect(own.instance_of).toEqual(['ontology/Q10']);
  expect(s.ontologies.some((r: any) => r.wikidata_id === 'Q4')).toBe(false);
  const taxon = s.classes.find((r: any) => r.wikidata_id === 'Q1');
  expect(taxon.P171_parents).toEqual(['wikidata-class/Q5']);
});
test('repeat imports are idempotent and cycle does not become tree parent', () => {
  const s: any = schema();
  applyWikidataSchema(s, entity('Q1', { P279: ['Q2'] }), 7);
  applyWikidataSchema(s, entity('Q1', { P279: ['Q2'] }), 7);
  expect(s.ontologies).toHaveLength(2);
  applyWikidataSchema(s, entity('Q2', { P279: ['Q1'] }), 7);
  expect(s.ontologies.find((r: any) => r.wikidata_id === 'Q2').parent_id).toBeNull();
});

test('related entities extend ontology with Chinese names without categories', () => {
  const s: any = schema();
  applyWikidataSchema(s, { id: 'Q1', name: '目标', attributes: [{ id: 'P31', value: [{ id: 'Q5', label_zh: '人类' }] }, { id: 'P279', value: [{ id: 'Q2', label_zh: '生物' }] }] }, 7, false);
  expect(s.classes).toHaveLength(0);
  expect(s.ontologies.find((r: any) => r.wikidata_id === 'Q5').name).toBe('人类');
  expect(s.ontologies.find((r: any) => r.wikidata_id === 'Q2').name).toBe('生物');
});
