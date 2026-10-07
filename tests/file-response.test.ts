import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rangedFileResponse } from '../src/server/file-response.ts';
test('videos serve exact partial bytes, suffixes, HEAD and invalid ranges', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-range-')); const path = join(dir, 'video.mp4'); writeFileSync(path, '0123456789');
  const response = (range?: string, method = 'GET') => rangedFileResponse(new Request('http://local/video.mp4', {method,headers:range ? {Range:range}: {}}), Bun.file(path), new Headers({'Content-Type':'video/mp4','Cache-Control':'private, no-store'}));
  try {
    for (const [range, expected, header] of [['bytes=2-4','234','bytes 2-4/10'],['bytes=7-','789','bytes 7-9/10'],['bytes=-3','789','bytes 7-9/10'],['bytes=8-100','89','bytes 8-9/10']]) {
      const r = response(range); expect(r.status).toBe(206); expect(r.headers.get('Content-Range')).toBe(header); expect(await r.text()).toBe(expected);
      expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    }
    expect(response('bytes=10-').status).toBe(416); expect(response('bytes=-0').status).toBe(416);
    const head = response(undefined,'HEAD'); expect(head.headers.get('Content-Length')).toBe('10'); expect(await head.text()).toBe('');
    expect(await response().text()).toBe('0123456789');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
