import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareEntityImageValues } from '../src/server/entity-media-images.ts';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1cAAAAASUVORK5CYII=';
test('captured covers are persisted as image files without shifting video slots; retry reuses the file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-media-'));
  try {
    const input = { covers: ['', png, '/existing.jpg'], videos: ['/a.mp4', '/b.mp4', '/c.mp4'], appendCovers: true };
    const prepared = await prepareEntityImageValues(input, 7, root);
    expect(prepared.covers[0]).toBe('');
    expect(prepared.covers[1]).toMatch(/^\/static\/uploads\/7\/node-images\/[a-f0-9]{64}\.png$/);
    expect(prepared.covers[2]).toBe('/existing.jpg');
    expect(prepared.videos).toEqual(input.videos);
    expect(prepared.appendCovers).toBe(true);
    expect(prepared.covers).toEqual((await prepareEntityImageValues(input, 7, root)).covers);
    const file = join(root, prepared.covers[1]!.replace('/static/uploads/', ''));
    expect(await readFile(file)).toEqual(Buffer.from(png.split(',')[1]!, 'base64'));
    expect(input.covers[1]).toBe(png);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('the management table preserves a complete Base64 cover and handles empty image lists', () => {
  const source = readFileSync(new URL('../public/assets/scripts/entity-manage-table.js', import.meta.url), 'utf8');
  const start = source.indexOf('  const imageOf =');
  const end = source.indexOf('  const imageCell =', start);
  const imageOf = new Function(source.slice(start, end) + '\nreturn imageOf;')();
  expect(imageOf({ cover: png })).toBe(png);
  expect(imageOf({ images: [], covers: ['', png] })).toBe(png);
  expect(imageOf({ covers: JSON.stringify([png]) })).toBe(png);
});


test('reloading the knowledge editor uses the video cover as a display fallback without adding it to image drafts', () => {
  const source = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = source.indexOf('    function resolveNodeImages(node) {');
  const end = source.indexOf('    function resolveNodePrimaryImage', start);
  const resolveNodeImages = new Function(source.slice(start, end) + '\nreturn resolveNodeImages;')();
  expect(resolveNodeImages({ images: ['', png], image: '' })[0]).toBe(png);
  expect(source).toContain('const nodeImagePreviewUrl = nodeImages[0] || "";');
  expect(source).toContain('window.kbPendingEntityImages = nodeImages;');
  expect(source).toContain('const imageUrl = nodeImagePreviewUrl || nodeVideoCoverPreviewUrl;');
});
