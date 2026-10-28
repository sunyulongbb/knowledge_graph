type Doc = Record<string, any>;
const decode = (value: any): any => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};
function list(value: any): string[] {
  const parsed = decode(value);
  return (Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed])
    .map(item => typeof item === 'string' ? item.trim() : String(item?.url || item?.src || '').trim());
}
/** Legacy SQLite stores media in columns, data JSON, and attribute values. */
export function knowledgeMedia(node: Doc, attributes: Doc[] = []) {
  const parsed = decode(node.data);
  const data: Doc = parsed && typeof parsed === 'object' ? parsed : {};
  const merge = (field: string, singular: string) => [...new Set([
    ...list(node[field]), ...list(node[singular]), ...list(data[field]), ...list(data[singular]),
  ].filter(Boolean))];
  const images = merge('images', 'image'), videos = merge('videos', 'video');
  const imagePattern = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic)(?:[?#].*)?$|^data:image\/|\/node-images\//i;
  const videoPattern = /\.(mp4|webm|ogg|m4v|mov)(?:[?#].*)?$|^data:video\/|\/node-videos\//i;
  for (const attribute of attributes) {
    const values = list(attribute.value ?? attribute.attribute?.value ?? attribute.value_text);
    for (const value of values.filter(Boolean)) {
      if (imagePattern.test(value) && !images.includes(value)) images.push(value);
      if (videoPattern.test(value) && !videos.includes(value)) videos.push(value);
    }
  }
  // Covers are positional: empty entries and repeated covers must be retained.
  const covers = list(node.covers).length ? list(node.covers) : list(data.covers).length ? list(data.covers) : list(node.cover || data.cover);
  return { images, videos, covers };
}
