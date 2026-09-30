import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
test('image preview synchronization is callable outside upload setup block when entering entity edit', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('      window.syncEditorImagePreviewFromPending =');
  const end = html.indexOf('      function setPendingEntityImagePreview', start);
  const elements: Record<string, any> = {
    entityDisplayImage: { src: '', style: {} },
    entityDisplayImageWrap: { style: {}, classList: { remove() {}, add() {} } },
    entityDisplayImageDeleteBtn: { style: {} },
  };
  const window: any = { kbPendingEntityImages: ['/a.jpg'] };
  new Function('window', 'document', `{ ${html.slice(start, end)} } window.syncEditorImagePreviewFromPending();`)(window, { getElementById: (id: string) => elements[id] });
  expect(elements.entityDisplayImage.src).toBe('/a.jpg');
  window.kbPendingEntityImages = []; window.syncEditorImagePreviewFromPending();
  expect(elements.entityDisplayImage.style.display).toBe('none');
  const edit = html.slice(html.indexOf('    function setFormToEdit('));
  expect(edit).toContain('window.syncEditorImagePreviewFromPending();');
});

test('entity header image helper is available before graph initialization for reset and edit', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('    function updateEntityHeaderImage(imageUrl) {');
  const end = html.indexOf('    function resetFormToAdd()', start);
  expect(start).toBeGreaterThan(0);
  expect(html.match(/function updateEntityHeaderImage\(/g)).toHaveLength(1);
  const classes = new Set<string>();
  const elements: Record<string, any> = {
    entityDisplayImage: { src: '', style: {} },
    entityDisplayImageWrap: { hidden: true, style: {}, classList: { remove: (key: string) => classes.delete(key), add: (key: string) => classes.add(key) } },
    entityDisplayImageDeleteBtn: { style: {} },
  };
  const window: any = {};
  // Call before declaration, as startup/reset can precede graph initialization.
  new Function('window', 'document', `updateEntityHeaderImage('/preview.jpg'); ${html.slice(start, end)}`)(window, { getElementById: (id: string) => elements[id] });
  expect(elements.entityDisplayImage.src).toBe('/preview.jpg');
  expect(elements.entityDisplayImageWrap.hidden).toBe(false);
  elements.entityDisplayImage.onerror();
  expect(elements.entityDisplayImage.style.display).toBe('none');
  window.updateEntityHeaderImage('');
  expect(elements.entityDisplayImage.src).toBe('');
  expect(elements.entityDisplayImageDeleteBtn.style.display).toBe('none');
  expect(classes.has('empty')).toBe(true);
  window.updateEntityHeaderImage('/next.jpg');
  expect(elements.entityDisplayImage.style.display).toBe('');
  expect(classes.has('empty')).toBe(false);
});

test('all entity images are restored, including serialized arrays and media objects', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const source = html.slice(html.indexOf('    function resolveNodeImages('), html.indexOf('    function clearEntityListSelection('));
  const resolve = new Function(`${source}; return resolveNodeImages;`)();
  expect(resolve({ images: '["/a.jpg","/b.jpg"]', image: '/a.jpg', _attr_images: [{ url: 'https://cdn.test/asset/123' }] })).toEqual(['/a.jpg', '/b.jpg', 'https://cdn.test/asset/123']);
  expect(resolve({ images: ['/a.jpg', '/b.jpg', '/c.jpg'] })).toHaveLength(3);
  expect(resolve(null)).toEqual([]);
});

test('deleting one restored image saves remaining images, deleting all sends an empty replacement', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const source = html.slice(html.indexOf('      function setPendingEntityImagePreview('), html.indexOf('      function mergeNodeImages('));
  const window: any = { kbPendingEntityImages: ['/a.jpg', '/b.jpg', '/c.jpg'], kbReplaceEntityImagesOnSave: false, syncEditorImagePreviewFromPending() {} };
  const update = new Function('window', 'getPendingEntityImages', `${source}; return setPendingEntityImagePreview;`)(window, () => [...window.kbPendingEntityImages]);
  const bodyStart = html.indexOf('...(window.kbReplaceEntityImagesOnSave');
  const bodyEnd = html.indexOf('          ...(posterData', bodyStart);
  const payload = () => new Function('window', 'pendingHeaderImages', 'isEdit', `return {${html.slice(bodyStart, bodyEnd)}}`)(window, window.kbPendingEntityImages, true);
  update('', { removeIndex: 1 });
  expect(payload()).toEqual({ images: ['/a.jpg', '/c.jpg'] });
  update('/new.jpg', { append: true });
  expect(payload()).toEqual({ images: ['/a.jpg', '/c.jpg', '/new.jpg'] });
  update('', { removeIndex: 0 }); update('', { removeIndex: 0 }); update('', { removeIndex: 0 });
  expect(payload()).toEqual({ images: [] });
  expect(window.kbPendingEntityImageDataUrl).toBe('');
});

test('late refresh of the same entity preserves image deletions; switching entity loads its images', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const edit = html.slice(html.indexOf('    function setFormToEdit(node)'));
  const guard = edit.slice(edit.indexOf('      const sameImageDraft'), edit.indexOf('\n', edit.indexOf('      const sameImageDraft')));
  const start = edit.indexOf('      const nodeImages =');
  const end = edit.indexOf('      if (typeof window.syncEditorImagePreviewFromPending', start);
  const apply = new Function('window', 'fId', 'node', 'resolveNodeImages', guard + edit.slice(start, end));
  const window: any = { kbEditorImagesDirty: true, kbPendingEntityImages: [], kbReplaceEntityImagesOnSave: true };
  apply(window, { value: 'entity/one' }, { id: 'one', images: ['/deleted.jpg'] }, (node: any) => node.images);
  expect(window.kbPendingEntityImages).toEqual([]);
  expect(window.kbReplaceEntityImagesOnSave).toBe(true);
  apply(window, { value: 'one' }, { id: 'two', images: ['/other.jpg'] }, (node: any) => node.images);
  expect(window.kbPendingEntityImages).toEqual(['/other.jpg']);
  expect(window.kbEditorImagesDirty).toBe(false);
  expect(window.kbReplaceEntityImagesOnSave).toBe(false);
});

test('editor excludes video covers and thumbnails even when entity has no images', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const source = html.slice(html.indexOf('    function resolveNodeImages('), html.indexOf('    function clearEntityListSelection('));
  const resolve = new Function(`${source}; return resolveNodeImages;`)();
  const videoFields = { videos: [{ url: '/movie.mp4', cover: '/poster.jpg' }], covers: ['/poster.jpg'], cover: '/poster.jpg', thumbnail: '/thumb.jpg', thumb: '/thumb.jpg', data: JSON.stringify({ covers: ['/nested.jpg'], poster: '/poster.jpg' }) };
  expect(resolve(videoFields)).toEqual([]);
  expect(resolve({ ...videoFields, images: ['/photo.jpg', '/second.jpg'] })).toEqual(['/photo.jpg', '/second.jpg']);
  expect(resolve({ data: { images: ['/photo.jpg'], covers: ['/poster.jpg'] } })).toEqual(['/photo.jpg']);
  // An image explicitly stored in images remains editable even if also used as a video cover.
  expect(resolve({ images: ['/shared.jpg'], covers: ['/shared.jpg'] })).toEqual(['/shared.jpg']);
});
