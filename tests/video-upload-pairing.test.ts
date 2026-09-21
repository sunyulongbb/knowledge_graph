import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const uploadBlock = source.slice(
  source.indexOf('    async function saveVideoToCurrentNode'),
  source.indexOf('    async function savePdfToCurrentNode'),
);

test('overlapping video uploads keep each video paired with its own poster and node', () => {
  expect(uploadBlock).toContain('const videoPoster = await captureVideoPoster(file);');
  expect(uploadBlock).toContain('const videoUrl = uploadResp.url;');
  expect(uploadBlock).toContain('saveVideoToCurrentNode(videoUrl, videoPoster, targetNodeId)');
  expect(uploadBlock).not.toContain('saveVideoToCurrentNode(uploadedVideoUrl, uploadedVideoPoster)');
});

test('overlapping append requests are serialized to avoid lost media pairs', () => {
  expect(uploadBlock).toContain('const saveTask = videoSaveQueue.then');
  expect(uploadBlock).toContain('videoSaveQueue = saveTask.catch(() => null);');
});
