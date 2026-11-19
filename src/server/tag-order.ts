export function parseTagStorage(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === 'string');
    if (typeof parsed === 'string') value = parsed;
  } catch {}
  return String(value).split(/[\n,，;；、|]+/g).map((tag) => tag.trim()).filter(Boolean);
}

export function sortTags(values: unknown[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const tag = value.trim();
    if (tag && !unique.has(tag.toLowerCase())) unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
