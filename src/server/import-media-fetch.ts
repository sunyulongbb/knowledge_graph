import { pacedWikimediaFetch } from './wikimedia-request.ts';
export async function fetchImportMedia(url: URL, init: RequestInit, report?: (message: string) => void) {
  for (let attempt = 0; ; attempt++) {
    const response = await pacedWikimediaFetch(url, init);
    if (response.status !== 429 || attempt >= 2) return response;
    const header = response.headers.get('retry-after');
    const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.max(0, (Date.parse(header) - Date.now()) / 1000) : NaN;
    const delay = Number.isFinite(seconds) ? Math.max(1000, seconds * 1000) : 5000 * (attempt + 1);
    // Do not ignore long server cooldowns or keep the import open indefinitely.
    if (delay > 60000) return response;
    await response.body?.cancel();
    report?.(`Wikimedia 请求受限，等待 ${Math.ceil(delay / 1000)} 秒后重试（${attempt + 1}/2）`);
    await new Promise<void>((resolve, reject) => {
      const signal = init.signal;
      if (signal?.aborted) { reject(signal.reason); return; }
      const abort = () => { clearTimeout(timer); reject(signal?.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}
