/** Normalize legacy image fields without modifying the stored entity reference. */
export function entityThumbnail(...sources: unknown[]): string {
  for (const source of sources) {
    if (Array.isArray(source)) {
      const image = entityThumbnail(...source);
      if (image) return image;
    } else if (source && typeof source === 'object') {
      const value = source as Record<string, unknown>;
      const image = entityThumbnail(value.url, value.src, value.href, value.value);
      if (image) return image;
    } else if (typeof source === 'string' && source.trim()) {
      const value = source.trim();
      try {
        const parsed = JSON.parse(value);
        if (parsed !== value) {
          const image = entityThumbnail(parsed);
          if (image) return image;
          continue;
        }
      } catch {}
      if (/^(https?:\/\/|\/(?!\/)|data:image\/(?:png|jpeg|gif|webp|avif);base64,)/i.test(value)) return value;
      if (/^\/\//.test(value)) return `https:${value}`;
      if (/^file:\//i.test(value)) continue;
      if (!/^[a-z][a-z\d+.-]*:/i.test(value.replace(/^File:/i, '')) && /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(value)) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(value.replace(/^File:/i, '').replace(/\s+/g, '_'))}?width=80`;
      }
    }
  }
  return '';
}
