import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const script = readFileSync(
  new URL('../public/assets/scripts/detail-panel.js', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../public/assets/styles/app.css', import.meta.url),
  'utf8',
);

test('detail video list is a single horizontal scroll row', () => {
  expect(styles).toMatch(/\.detail-video-playlist\s*\{[^}]*display:\s*flex;/s);
  expect(styles).toMatch(/\.detail-video-playlist\s*\{[^}]*overflow-x:\s*auto;/s);
  expect(styles).toContain('scroll-snap-type: x proximity;');
  expect(script).toContain('playlistNav.scrollLeft += event.deltaY;');
  expect(styles).toMatch(/\.detail-video-playlist-item\s*\{[^}]*flex:\s*0 0 144px;/s);
  expect(styles).toMatch(/\.detail-video-playlist-thumb\s*\{[^}]*width:\s*100%;/s);
  expect(script).not.toContain('detail-video-playlist-copy');
  expect(script).not.toContain('detail-video-playlist-order');
});

test('detail video deletion removes the video and its cover at the same index', () => {
  expect(script).toContain('const deleteDetailVideoAt = async');
  expect(script).toContain('nextCovers.splice(index, 1);');
  expect(script).toContain('videos: nextVideos');
  expect(script).toContain('covers: nextCovers');
  expect(script).toContain('detail-video-playlist-delete');
});

test('the video list remains available for a single video so it can be deleted', () => {
  expect(script).toContain('if (playlistItems.length) {');
  expect(script).not.toContain('if (playlistItems.length > 1) {');
});
