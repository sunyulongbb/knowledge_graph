import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/detail-panel.js', 'utf8');
function setup(fetch: Function, rich = false) {
  let handler: Function;
  const host = { dataset: {} as any, addEventListener: (_: string, fn: Function) => { handler = fn; } };
  const input = { value: 'before after', selectionStart: 7, selectionEnd: 7,
    setRangeText(text: string, start: number, end: number) { this.value = this.value.slice(0, start) + text + this.value.slice(end); }, dispatchEvent() {} };
  const hints = { textContent: '', setAttribute() {} };
  const doc = { getValue: () => input.value, replaceSelection: (text: string) => input.setRangeText(text, 7, 7), posFromIndex: (n: number) => n,
    replaceRange: (text: string, start: number, end: number) => input.setRangeText(text, start, end) };
  const window = rich ? { easyMDE: { codemirror: { getDoc: () => doc } } } : {};
  const document = { getElementById: (id: string) => ({ wikiEditInline: host, wikiMdInline: input, wikiHintsInline: hints } as any)[id] };
  const block = source.slice(source.indexOf('  function bindWikiImagePaste()'), source.indexOf('  function toggleWikiModeInline'));
  new Function('window', 'document', 'fetch', 'location', block + '; bindWikiImagePaste();')(window, document, fetch, { origin: 'http://local', search: '?db=app' });
  return { input, host, hints, paste: (files: File[]) => handler!({ target: rich ? { closest: () => true } : input,
    clipboardData: { items: files.map(file => ({ type: file.type, getAsFile: () => file })) }, preventDefault() {}, stopImmediatePropagation() {} }) };
}
for (const rich of [false, true]) test(`image paste uploads to current project and inserts at selection (rich=${rich})`, async () => {
  const calls: any[] = [];
  const r = setup(async (url: URL, init: any) => { calls.push({ url, file: init.body.get('file') }); return Response.json({ url: '/static/uploads/image.png' }); }, rich);
  await r.paste([new File(['image'], 'image.png', { type: 'image/png' })]);
  expect(calls[0].url.searchParams.get('db')).toBe('app');
  expect(r.input.value).toContain('before ![');
  expect(r.input.value).toContain('](</static/uploads/image.png>)after');
  expect(r.input.value).not.toContain('wiki-image-');
  expect(r.host.dataset.imageUploads).toBe('0');
});
test('failed paste removes pending markers and preserves the surrounding content', async () => {
  const r = setup(async () => Response.json({ error: 'Upload failed' }, { status: 500 }));
  await r.paste([new File(['image'], 'image.png', { type: 'image/png' })]);
  expect(r.input.value).toBe('before after'); expect(r.hints.textContent).toBe('Upload failed'); expect(r.host.dataset.imageUploads).toBe('0');
});
