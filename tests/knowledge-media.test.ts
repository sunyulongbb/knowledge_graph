import { expect, test } from 'bun:test';
import { knowledgeMedia } from '../src/shared/knowledge-media.ts';
import { entitySearchProjection, ENTITY_SEARCH_SCHEMA } from '../src/server/enterprise-search.ts';
import { arangoNodeResponse } from '../src/server/enterprise-knowledge.ts';

test('legacy data JSON and attributes populate media in Enterprise search and responses', () => {
  const node = { id: 'a', images: '[]', videos: '[]',
    data: JSON.stringify({ images: ['/old.jpg'], videos: ['/old.mp4'], covers: ['', '/cover.jpg', '/cover.jpg'] }),
    _search_attributes: [{ value_text: '[{"url":"/attribute.png"}]' }, { value_text: '/attribute.webm' }] };
  const projection = entitySearchProjection(node);
  expect(projection.images).toEqual(['/old.jpg', '/attribute.png']);
  expect(projection.videos).toEqual(['/old.mp4', '/attribute.webm']);
  expect(projection.has_images).toBe(true);
  expect(projection.has_media).toBe(true);
  expect(projection._search_schema).toBe(ENTITY_SEARCH_SCHEMA);
  const response = arangoNodeResponse(projection, null);
  expect(response.images).toEqual(projection.images);
  expect(response.covers).toEqual(['', '/cover.jpg', '/cover.jpg']);
  expect(response.video).toBe('/old.mp4');
});

test('plain media URLs, objects, duplicates and malformed legacy JSON are handled', () => {
  expect(knowledgeMedia({ images: '/a.png', videos: [{ src: '/v.mp4' }], data: '{broken' },
    [{ value: '["/a.png","/b.png"]' }])).toEqual({ images: ['/a.png', '/b.png'], videos: ['/v.mp4'], covers: [] });
});
