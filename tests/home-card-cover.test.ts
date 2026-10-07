import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/application-pages.js','utf8');
const helpers = source.slice(source.indexOf('  function imageCandidates('),source.indexOf('  let homeDetailDrawer'));
const card = source.slice(source.indexOf('  function homeKnowledgeCard('),source.indexOf('  function applicationBanner('));
const render = new Function('escape', helpers + card + '; return homeKnowledgeCard;')((value:any)=>String(value??'').replace(/"/g,'&quot;'));
test('home cards prefer images and video covers, using metadata only when no image exists', () => {
  const image = render({id:'a',images:'["/photo.jpg"]',covers:['/poster.jpg'],videos:['/video.mp4']});
  expect(image).toContain('src="/photo.jpg"');expect(image).not.toContain('<video');
  const cover = render({id:'b',covers:'[{"url":"/poster.jpg"}]',videos:['/video.mp4']});
  expect(cover).toContain('src="/poster.jpg"');expect(cover).not.toContain('<video');
  const fallback = render({id:'c',videos:['/video.mp4']});
  expect(fallback).toContain('preload="metadata"');expect(fallback).not.toContain('preload="none"');
});
