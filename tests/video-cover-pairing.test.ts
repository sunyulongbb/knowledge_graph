import { expect, test } from 'bun:test';
import { appendVideoCoverPairs } from '../src/server/video-cover-pairing.ts';

test('pads missing historical cover slots before appending a new pair', () => {
  expect(
    appendVideoCoverPairs(
      ['video-1', 'video-2'],
      ['cover-1'],
      ['video-3'],
      ['cover-3'],
    ),
  ).toEqual({
    videos: ['video-1', 'video-2', 'video-3'],
    covers: ['cover-1', '', 'cover-3'],
  });
});

test('keeps identical covers because they belong to different video slots', () => {
  expect(
    appendVideoCoverPairs([], [], ['video-1', 'video-2'], ['same', 'same']),
  ).toEqual({
    videos: ['video-1', 'video-2'],
    covers: ['same', 'same'],
  });
});

test('updates the matching cover when the video already exists', () => {
  expect(
    appendVideoCoverPairs(
      ['video-1', 'video-2'],
      ['old-1', 'old-2'],
      ['video-2'],
      ['new-2'],
    ),
  ).toEqual({
    videos: ['video-1', 'video-2'],
    covers: ['old-1', 'new-2'],
  });
});
