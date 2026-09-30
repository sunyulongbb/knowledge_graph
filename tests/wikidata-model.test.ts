import { expect, test } from 'bun:test';
import { datatypeValueTypes, normalizeDatatype, valueTypeFor, uiDatatype, normalizeValue, normalizeStatement, parseTimeValue } from '../src/shared/wikidata.ts';

test('all documented datatype mappings and semantic UI controls', () => {
  expect(Object.keys(datatypeValueTypes)).toHaveLength(17);
  for (const dt of ['wikibase-item', 'wikibase-property', 'wikibase-lexeme', 'wikibase-form', 'wikibase-sense']) expect(valueTypeFor(dt)).toBe('wikibase-entityid');
  for (const dt of ['string', 'external-id', 'url', 'commonsMedia', 'math', 'musical-notation', 'geo-shape', 'tabular-data']) expect(valueTypeFor(dt)).toBe('string');
  expect(uiDatatype('url', 'string')).toBe('url');
  expect(uiDatatype('commonsMedia', 'string')).toBe('commonsMedia');
  expect(valueTypeFor('globe-coordinate')).toBe('globecoordinate');
  expect(normalizeDatatype('wikibase-entityid')).toBe('wikibase-item');
  expect(normalizeDatatype('string', 'wikibase-item')).toBe('wikibase-item');
  expect(normalizeDatatype('string', 'wikibase-entityid')).toBe('wikibase-item');
});

test('time text normalizes with year/month/day/minute/second precision', () => {
  expect(parseTimeValue('2026').precision).toBe(9);
  expect(parseTimeValue('2026年9月').precision).toBe(10);
  for (const text of ['2026-9-7', '2026/9/7', '2026.9.7', '2026年9月7日', '20260907']) {
    expect(parseTimeValue(text)).toMatchObject({ time: '+2026-09-07T00:00:00Z', precision: 11 });
  }
  expect(parseTimeValue('2026/9/7 14:30').precision).toBe(13);
  expect(parseTimeValue('2026年9月7日14时30分15秒')).toMatchObject({ time: '+2026-09-07T14:30:15Z', precision: 14 });
  expect(parseTimeValue('2026-09-07T14:30:15+08:00').timezone).toBe(480);
  expect(parseTimeValue('2026-09-07T14:30:15.123Z').time).toBe('+2026-09-07T14:30:15.123Z');
  for (const text of ['', '2026-02-29', '2026-04-31', '2026-09-07 24:00', '2026-09-07 12:61']) expect(() => parseTimeValue(text)).toThrow();
  expect(parseTimeValue('2024-02-29').precision).toBe(11);
});

test('compound values retain precision, bounds, calendar, globe and language', () => {
  const time = { time: '+2001-12-31T00:00:00Z', precision: 11, timezone: 120, before: 1, after: 2, calendarmodel: 'custom-calendar' };
  expect(normalizeValue('time', time)).toEqual(time);
  expect(normalizeValue('time', { date: '2026-09-07' }).time).toBe('+2026-09-07T00:00:00Z');
  const quantity = { amount: '+1.880000000000000001', unit: 'http://www.wikidata.org/entity/Q11573', upperBound: '+1.89', lowerBound: '+1.87' };
  expect(normalizeValue('quantity', quantity)).toEqual(quantity);
  expect(() => normalizeValue('quantity', { amount: '12oops' })).toThrow();
  const coordinate = { latitude: 5, longitude: 10, altitude: null, precision: 0.01, globe: 'other-planet' };
  expect(normalizeValue('globe-coordinate', coordinate)).toEqual(coordinate);
  expect(() => normalizeValue('globe-coordinate', { latitude: 91, longitude: 0 })).toThrow();
  expect(normalizeValue('monolingualtext', { text: '示例', language: 'zh' })).toEqual({ text: '示例', language: 'zh' });
  expect(() => normalizeValue('monolingualtext', { text: '示例' })).toThrow();
});

test('entity ID works without numeric-id, including forms and senses', () => {
  expect(normalizeValue('wikibase-form', { id: 'L1-F2' })).toEqual({ id: 'L1-F2', 'entity-type': 'form' });
  expect(normalizeValue('wikibase-sense', { id: 'L1-S2' })).toEqual({ id: 'L1-S2', 'entity-type': 'sense' });
  expect(() => normalizeValue('wikibase-item', { 'numeric-id': 30 })).toThrow();
});

test('statement metadata and special snaks round trip without fabricated values', () => {
  const previous = { rank: 'preferred', qualifiers: { P1: [{ snaktype: 'novalue' }] }, references: [{ snaks: {} }] };
  const statement = normalizeStatement({ property: 'P27', datatype: 'wikibase-item', value: { id: 'Q30' } }, previous);
  expect(statement.datavalue.type).toBe('wikibase-entityid');
  expect(statement.qualifiers).toEqual(previous.qualifiers);
  expect(statement.references).toEqual(previous.references);
  expect(statement.rank).toBe('preferred');
  for (const snaktype of ['somevalue', 'novalue']) expect(normalizeStatement({ datatype: 'time', snaktype }, previous).datavalue).toBeUndefined();
  expect(() => normalizeStatement({ datatype: 'url', datavalue: { type: 'url', value: 'https://example.org' } })).toThrow();
  expect(normalizeStatement({ datatype: 'external-id', value: '00123' }).datavalue.value).toBe('00123');
});
