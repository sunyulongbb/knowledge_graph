import { test, expect } from 'bun:test';
import { wikipediaBodyMarkdown } from '../src/server/wikipedia-import.ts';
test('Wikipedia conversion retains body headings and links without images or page furniture', () => {
  const markdown = wikipediaBodyMarkdown('<div class="mw-parser-output"><table class="infobox"><tr><td>信息框</td></tr></table><div class="hatnote">提示</div><p>正文 <b>重点</b><img src="https://example.org/a.jpg"></p><figure><img src="b.jpg"><figcaption>图片说明</figcaption></figure><h2>经历<span class="mw-editsection">编辑</span></h2><p><a href="/wiki/Example">条目</a></p><div class="navbox">导航</div><sup class="reference">[1]</sup></div>');
  expect(markdown).toContain('正文 **重点**'); expect(markdown).toContain('## 经历');
  expect(markdown).toContain('[条目](https://zh.wikipedia.org/wiki/Example)');
  for(const text of ['信息框','图片说明','编辑','导航','[1]','![','a.jpg','b.jpg']) expect(markdown).not.toContain(text);
});
