(function () {
  const escapeText = text => String(text || '').replace(/([\\`*_[\]<>])/g, '\\$1');
  const safeUrl = (value, base, image = false) => {
    if (!value) return '';
    try {
      const url = new URL(value.trim(), base);
      if (['http:', 'https:'].includes(url.protocol) || (image && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(url.href))) return url.href.replaceAll('<', '%3C').replaceAll('>', '%3E');
    } catch {}
    return '';
  };
  function fromNode(node, base) {
    if (node.nodeType === 3) return escapeText(node.nodeValue.replace(/\s+/g, ' '));
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return '';
    const tag = (node.nodeName || '').toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'input', 'button', 'noscript', 'svg'].includes(tag)) return '';
    const content = () => Array.from(node.childNodes || []).map(child => fromNode(child, base)).join('');
    if (tag === 'img') {
      const src = safeUrl(node.getAttribute('data-orig-file') || node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || node.getAttribute('src') || node.getAttribute('srcset')?.split(',')[0]?.trim().split(/\s+/)[0], base, true);
      return src ? `\n\n![${escapeText(node.getAttribute('alt'))}](<${src}>)\n\n` : '';
    }
    if (tag === 'br') return '  \n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'pre') return '\n\n```\n' + (node.textContent || '').replace(/```/g, '` ` `') + '\n```\n\n';
    if (tag === 'code') return '`' + (node.textContent || '').replace(/`/g, '\\`') + '`';
    const text = content();
    if (tag === 'a') {
      const url = safeUrl(node.getAttribute('href'), base);
      if (text.includes('![')) return text;
      return url && text.trim() ? `[${text.trim()}](<${url}>)` : text;
    }
    if (['b', 'strong'].includes(tag)) return text.trim() ? `**${text.trim()}**` : '';
    if (['i', 'em'].includes(tag)) return text.trim() ? `*${text.trim()}*` : '';
    if (/^h[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + text.trim() + '\n\n';
    if (tag === 'li') return '\n- ' + text.trim().replace(/\n/g, '\n  ');
    if (tag === 'blockquote') return '\n\n' + text.trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    if (['p', 'div', 'section', 'article', 'figure', 'figcaption', 'ul', 'ol', 'table', 'tr'].includes(tag)) return '\n\n' + text.trim() + '\n\n';
    if (['td', 'th'].includes(tag)) return text + ' | ';
    return text;
  }
  window.kbClipboardMarkdown = {
    fromNode,
    fromHtml(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const source = html.match(/SourceURL:\s*(https?:\/\/[^\r\n<]+)/i)?.[1];
      const base = source || doc.querySelector('base[href]')?.getAttribute('href') || location.href;
      return fromNode(doc.body, base).replace(/\n[ \t]+\n/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim();
    },
  };
})();
