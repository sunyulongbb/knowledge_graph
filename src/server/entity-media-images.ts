import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
  'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/heif': 'heif',
};
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const ENTITY_UPLOADS_ROOT = resolve(import.meta.dir, '..', '..', 'uploads');

/** Preserve video/cover slots while storing browser-captured frames as real files. */
export async function prepareEntityImageValues<T extends Record<string, any>>(input: T, projectId: number, uploadsRoot = ENTITY_UPLOADS_ROOT): Promise<T> {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new TypeError('无效的应用 ID');
  const result = { ...input };
  for (const field of ['images', 'covers']) {
    if (input[field] === undefined) continue;
    if (!Array.isArray(input[field]) || input[field].some((value: unknown) => typeof value !== 'string')) throw new TypeError(`${field} 必须是字符串数组`);
    const prepared: string[] = [];
    for (const raw of input[field]) {
      const value = raw.trim();
      if (!value.startsWith('data:image/')) { prepared.push(value); continue; }
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
      const extension = match && EXTENSIONS[match[1]!.toLowerCase()];
      if (!match || !extension) throw new TypeError('无效或不支持的图片数据');
      const encoded = match[2]!.replace(/[\r\n]/g, '');
      if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw new RangeError('图片大小超过限制：20MB');
      const buffer = Buffer.from(encoded, 'base64');
      if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new TypeError('无效的图片编码');
      if (buffer.length > MAX_IMAGE_BYTES) throw new RangeError('图片大小超过限制：20MB');
      const filename = `${createHash('sha256').update(buffer).digest('hex')}.${extension}`;
      const directory = resolve(uploadsRoot, String(projectId), 'node-images');
      await mkdir(directory, { recursive: true });
      // Content-addressed names make retries idempotent and cannot overwrite another image.
      await writeFile(resolve(directory, filename), buffer, { flag: 'wx' }).catch((error: any) => { if (error.code !== 'EEXIST') throw error; });
      prepared.push(`/static/uploads/${projectId}/node-images/${filename}`);
    }
    (result as Record<string, any>)[field] = prepared;
  }
  return result;
}
