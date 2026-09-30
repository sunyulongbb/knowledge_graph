import { expect, test } from 'bun:test';
import { entityThumbnail } from '../src/server/entity-thumbnail.ts';

test('resolves stored image arrays and legacy media values', () => {
  expect(entityThumbnail('["", "/uploads/portrait.png"]')).toBe('/uploads/portrait.png');
  expect(entityThumbnail(null, { value: [{ url: 'https://example.org/a.jpg' }] })).toBe('https://example.org/a.jpg');
  expect(entityThumbnail('File:Example image.jpg')).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Example_image.jpg?width=80');
  expect(entityThumbnail('//example.org/image.png')).toBe('https://example.org/image.png');
});

test('missing and unsafe images fall back without obscuring a later valid image', () => {
  expect(entityThumbnail(undefined, [], '{}', 'null')).toBe('');
  expect(entityThumbnail('javascript:alert(1)', 'data:text/html;base64,AAAA', 'file:///a.png')).toBe('');
  expect(entityThumbnail('javascript:bad.png', '/uploads/valid.png')).toBe('/uploads/valid.png');
});
