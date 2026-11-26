import { test, expect } from 'bun:test';
import { cachedWikimediaJson, pacedWikimediaFetch } from '../src/server/wikimedia-request.ts';
test('JSON requests deduplicate and cache without sharing mutable data', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ value: 1 }); }) as typeof fetch;
  try {
    const [a,b] = await Promise.all([cachedWikimediaJson('https://example.org/cache'),cachedWikimediaJson('https://example.org/cache')]);
    a.value = 2; expect(b.value).toBe(1);
    expect((await cachedWikimediaJson('https://example.org/cache')).value).toBe(1); expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});
test('long Retry-After blocks subsequent requests without contacting upstream', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }); }) as typeof fetch;
  try {
    expect((await pacedWikimediaFetch('https://example.org/limit')).status).toBe(429);
    await expect(pacedWikimediaFetch('https://example.org/next')).rejects.toThrow('冷却'); expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});
