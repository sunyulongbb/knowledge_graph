/** Per-import proxy keeps internal database traffic on its existing route. */
export function importProxyOptions(): { proxy?: string } {
  const configured = process.env.WIKIDATA_PROXY_URL?.trim();
  if (!configured) return {};
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error('WIKIDATA_PROXY_URL 必须是有效的 HTTP/HTTPS 代理地址'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('WIKIDATA_PROXY_URL 仅支持 HTTP/HTTPS 代理');
  return { proxy: url.href };
}
