import { cachedWikimediaJson } from './wikimedia-request.ts';
// @ts-ignore turndown exposes a CommonJS constructor without bundled types.
import TurndownService from 'turndown';
import { importProxyOptions } from './import-proxy.ts';

export async function fetchWikipediaMarkdown(id: string): Promise<string | null> {
  if (!/^Q[1-9][0-9]*$/.test(id)) throw new Error('无效的 Wikidata ID');
  const json = async (url: URL | string) => {
    return await cachedWikimediaJson(url, { ...importProxyOptions(), signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'KnowledgeGraphImport/1.0', Accept: 'application/json' } });
  };
  const data = await json(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`);
  const sites = data.entities?.[id]?.sitelinks;
  const site = sites?.zhwiki ? 'zh' : sites?.enwiki ? 'en' : null;
  if (!site) return null;
  const title = sites[`${site}wiki`].title;
  const api = new URL(`https://${site}.wikipedia.org/w/api.php`);
  for (const [key, value] of Object.entries({ action: 'parse', page: title, prop: 'text|revid', redirects: '1', format: 'json', formatversion: '2' })) api.searchParams.set(key, value);
  const page = await json(api);
  if (!page.parse?.text) throw new Error(page.error?.info || '百科正文为空');
  const source = `https://${site}.wikipedia.org/w/index.php?oldid=${page.parse.revid}`;
  return `> 来源：[Wikipedia](${source}) · [作者及修订历史](https://${site}.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=history) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)` + '\n\n' + wikipediaBodyMarkdown(page.parse.text, site);
}

export function wikipediaBodyMarkdown(html: string, site = 'zh'): string {
  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  converter.remove(['script', 'style', 'img', 'picture', 'figure', 'figcaption', 'video', 'audio', 'iframe', 'svg', 'noscript']);
  converter.addRule('noMedia', { filter: ['img', 'picture', 'figure', 'figcaption', 'video', 'audio', 'iframe', 'svg'], replacement: () => '' });
  converter.addRule('bodyOnly', {
    filter(node: any) {
      const classes = String(node.getAttribute?.('class') || '').split(/\s+/);
      const excluded = /^(?:infobox|navbox|vertical-navbox|sidebar|toc|thumb|gallery|mw-editsection|mw-empty-elt|hatnote|metadata|ambox|tmbox|ombox|mbox-small|sistersitebox|sisterproject|noprint|mw-references-wrap|reflist|reference|catlinks|portalbox|authority-control)$/;
      return classes.some((name: string) => excluded.test(name)) || ['toc', 'catlinks'].includes(node.id);
    },
    replacement: () => '',
  });
  converter.addRule('absoluteLinks', {
    filter: 'a',
    replacement(content: string, node: any) {
      const href = node.getAttribute('href');
      if (!href) return content;
      const target = new URL(href, `https://${site}.wikipedia.org`);
      return ['https:', 'http:'].includes(target.protocol) ? `[${content}](${target.href})` : content;
    },
  });
  return converter.turndown(html);
}
