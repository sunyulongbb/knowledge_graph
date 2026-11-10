export function sortTags(values: unknown[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const tag = value.trim();
    if (tag && !unique.has(tag.toLowerCase())) unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
