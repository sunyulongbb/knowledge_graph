import { test, expect } from 'bun:test';
import { fetchImportMedia } from '../src/server/import-media-fetch.ts';
test('media 429 retries after cooldown and reports waiting', async () => {
  const original = globalThis.fetch; let calls = 0; const logs: string[] = [];
  globalThis.fetch = (async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '0' } }) : new Response('video')) as typeof fetch;
  try {
    const result = await fetchImportMedia(new URL('https://example.org/video.webm'), {}, message => logs.push(message));
    expect(result.status).toBe(200); expect(calls).toBe(2); expect(logs).toHaveLength(1);
  } finally { globalThis.fetch = original; }
});
test('long server cooldown is not retried early', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }); }) as typeof fetch;
  try { expect((await fetchImportMedia(new URL('https://example.org/v'), {})).status).toBe(429); expect(calls).toBe(1); }
  finally { globalThis.fetch = original; }
});
