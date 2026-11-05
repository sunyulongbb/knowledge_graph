import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const window: any = {};
new Function('window', readFileSync('public/assets/scripts/wiki-clipboard.js', 'utf8'))(window);
const text = (value: string) => ({ nodeType: 3, nodeValue: value });
const el = (tag: string, children: any[] = [], attrs: Record<string, string> = {}) => ({ nodeType: 1, nodeName: tag, childNodes: children, getAttribute: (key: string) => attrs[key] || null });

test('web article conversion preserves paragraphs, emphasis, images and captions in order', () => {
  const root = el('body', [el('h2', [text('Article')]), el('p', [text('Before '), el('strong', [text('bold')])]),
    el('figure', [el('a', [el('img', [], { src: 'data:image/gif;base64,placeholder', 'data-orig-file': 'https://site.example/picture.jpg', alt: 'Painting' })], { href: 'https://site.example/picture.jpg' }), el('figcaption', [text('Caption')])]), el('p', [text('After')])]);
  const md = window.kbClipboardMarkdown.fromNode(root, 'https://site.example/article');
  expect(md).toContain('## Article'); expect(md).toContain('**bold**');
  expect(md).toContain('![Painting](<https://site.example/picture.jpg>)');
  expect(md.indexOf('Before')).toBeLessThan(md.indexOf('![Painting]'));
  expect(md.indexOf('![Painting]')).toBeLessThan(md.indexOf('Caption'));
  expect(md.indexOf('Caption')).toBeLessThan(md.indexOf('After'));
});

test('web paste strips active HTML and unsafe URLs while retaining ordinary text and relative images', () => {
  const root = el('body', [el('script', [text('alert(1)')]), el('a', [text('Link')], { href: 'javascript:alert(1)' }), el('img', [], { src: 'javascript:bad' }), el('img', [], { src: '/image.png', onerror: 'alert(1)' }), text('<unsafe>')]);
  const md = window.kbClipboardMarkdown.fromNode(root, 'https://site.example/article');
  expect(md).not.toContain('javascript:'); expect(md).not.toContain('alert(1)');
  expect(md).toContain('![](<https://site.example/image.png>)'); expect(md).toContain('\\<unsafe\\>');
});
