/**
 * Сжатие изображений для превью (меньше трафика и памяти на клиентах).
 * Разрешены только URL с хостами из списка (тот же сервер или IMAGE_PREVIEW_HOSTS).
 */
import sharp from 'sharp';

const MAX_FETCH_BYTES = 18 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

export function getAllowedImageHosts(req) {
  const set = new Set();
  const fromEnv = process.env.IMAGE_PREVIEW_HOSTS;
  if (fromEnv) {
    for (const h of fromEnv.split(',')) {
      const t = h.trim().toLowerCase();
      if (t) set.add(t);
    }
  }
  const hostHeader = req.get('host');
  if (hostHeader) {
    set.add(hostHeader.split(':')[0].toLowerCase());
  }
  const publicUrl = process.env.PUBLIC_ORIGIN || process.env.API_PUBLIC_URL;
  if (publicUrl) {
    try {
      set.add(new URL(publicUrl).hostname.toLowerCase());
    } catch (_) { /* ignore */ }
  }
  return set;
}

export function isImageSrcAllowed(srcUrl, allowedHosts) {
  try {
    const u = new URL(srcUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return allowedHosts.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * @param {string} srcUrl
 * @param {number} maxWidth clamped 80–1600
 * @param {number} quality jpeg 55–92
 */
export async function fetchAndCompressPreview(srcUrl, maxWidth, quality) {
  const w = Math.min(1600, Math.max(80, Math.floor(maxWidth) || 480));
  const q = Math.min(92, Math.max(55, Math.floor(quality) || 78));

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let buf;
  try {
    const res = await fetch(srcUrl, {
      signal: controller.signal,
      headers: { Accept: 'image/*' },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = res.headers.get('content-length');
    if (len && parseInt(len, 10) > MAX_FETCH_BYTES) {
      throw new Error('file too large');
    }
    const ab = await res.arrayBuffer();
    buf = Buffer.from(ab);
    if (buf.length > MAX_FETCH_BYTES) throw new Error('file too large');
  } catch (e) {
    clearTimeout(t);
    throw e;
  }

  const pipeline = sharp(buf, { failOn: 'truncated' })
    .rotate()
    .resize(w, null, { withoutEnlargement: true, fit: 'inside' });

  const meta = await pipeline.metadata();
  const fmt = (meta.format || '').toLowerCase();
  if (fmt === 'png' && meta.hasAlpha) {
    const out = await pipeline.webp({ quality: q, effort: 4 }).toBuffer();
    return { body: out, contentType: 'image/webp' };
  }
  const out = await pipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  return { body: out, contentType: 'image/jpeg' };
}
