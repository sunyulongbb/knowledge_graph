/** Serve a single byte range so browsers can start and seek without downloading the whole video. */
export function rangedFileResponse(req: Request, file: ReturnType<typeof Bun.file>, sourceHeaders: Headers) {
  const headers = new Headers(sourceHeaders);
  const size = file.size;
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(size));
  if (req.method === 'HEAD') return new Response(null, { headers });
  const range = req.headers.get('range');
  // Ignore unsupported multipart ranges and If-Range without a matching validator.
  if (!range || req.headers.has('if-range') || !/^bytes=\d*-\d*$/.test(range)) return new Response(file, { headers });
  const [first, last] = range.slice(6).split('-');
  let start: number, end: number;
  if (!first) { const suffix = Number(last); start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(first); end = last ? Math.min(Number(last), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    headers.set('Content-Range', `bytes */${size}`); headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(file.slice(start, end + 1), { status: 206, headers });
}
