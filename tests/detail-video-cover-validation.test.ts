import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../public/assets/scripts/detail-panel.js', import.meta.url),
  'utf8',
);
const block = source.slice(
  source.indexOf('          const captureDetailVideoCover'),
  source.indexOf('          if (playlistItems.length > 1)'),
);

test('detail video playback refreshes the cover at the matching playlist index', () => {
  expect(source).toContain('const normalizeDetailCoverSlots = (value) =>');
  expect(block).toContain('nextCovers[item.index] = coverData;');
  expect(block).toContain('covers: nextCovers');
  expect(block).toContain('videoEl.addEventListener("play"');
  expect(block).toContain('updateDetailVideoCover(item, videoEl)');
});

test('detail cover validation waits for the native video behind the player', () => {
  expect(block).toContain('playerEl.querySelector?.("video")');
  expect(block).toContain('nativeVideo?.readyState >= 2');
  expect(block).toContain('item.coverValidationStarted');
});
