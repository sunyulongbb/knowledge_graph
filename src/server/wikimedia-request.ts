let tail: Promise<unknown> = Promise.resolve();
let nextRequest = 0;
const cache = new Map<string, { until: number; data: any }>();
const pending = new Map<string, Promise<any>>();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Shared per-process pacing and cooldown across Wikimedia imports. */
export async function pacedWikimediaFetch(url: URL | string, init: RequestInit = {}) {
  const work = tail.catch(() => {}).then(async () => {
    const wait = nextRequest - Date.now();
    if (wait > 60000) throw new Error(`Wikimedia 冷却中，请 ${Math.ceil(wait / 1000)} 秒后重试`);
    if (wait > 0) await pause(wait);
    init.signal?.throwIfAborted();
    nextRequest = Date.now() + 1500;
    const response = await fetch(url, init);
    if (response.status === 429 || response.status === 503) {
      const retry = response.headers.get('retry-after');
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? (Date.parse(retry) - Date.now()) / 1000 : 30;
      nextRequest = Math.max(nextRequest, Date.now() + Math.max(30000, Number.isFinite(seconds) ? seconds * 1000 : 30000));
    }
    return response;
  });
  tail = work.then(() => {}, () => {});
  return work;
}

export async function cachedWikimediaJson(url: URL | string, init: RequestInit = {}) {
  const key = String(url);
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return structuredClone(hit.data);
  if (pending.has(key)) return structuredClone(await pending.get(key));
  const work = (async () => {
    const response = await pacedWikimediaFetch(url, init);
    if (!response.ok) {
      const status = response.status;
      await response.body?.cancel();
      throw new Error(`Wikimedia HTTP ${status}${status === 429 ? '：请求限流，已进入冷却，请稍后重试' : ''}`);
    }
    const data = await response.json();
    if (data.error) throw new Error(data.error.info || 'Wikimedia API 返回错误');
    cache.set(key, { until: Date.now() + 3600000, data });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return data;
  })();
  pending.set(key, work);
  try { return structuredClone(await work); } finally { pending.delete(key); }
}
