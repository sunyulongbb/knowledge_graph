import { expect, test } from 'bun:test';
import { parseTagStorage, sortTags } from '../src/server/tag-order.ts';

test('server merges tag sources and sorts Chinese names before returning them', () => {
  expect(sortTags(['香蕉', '苹果', '香蕉', ' 阿尔法 ', '', null])).toEqual(['阿尔法', '苹果', '香蕉']);
});

test('sorting deduplicates names without changing their display case', () => {
  expect(sortTags(['Beta', 'alpha', 'beta', ' alpha '])).toEqual(['alpha', 'Beta']);
});

test('tag storage parser supports JSON arrays and legacy delimited values', () => {
  expect(parseTagStorage('["研究","科学"]')).toEqual(['研究', '科学']);
  expect(parseTagStorage('研究, 科学\n技术')).toEqual(['研究', '科学', '技术']);
});
