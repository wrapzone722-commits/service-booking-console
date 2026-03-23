import {
  getAllowedImageHosts,
  isImageSrcAllowed,
  fetchAndCompressPreview,
} from '../services/imagePreview.js';

function parsePreviewQuery(req) {
  const src = req.query.src || req.query.url;
  if (!src || typeof src !== 'string') {
    return { error: 'Укажите параметр src (URL изображения)' };
  }
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch (_) { /* use raw */ }
  const w = parseInt(String(req.query.w || '480'), 10);
  const q = parseInt(String(req.query.q || '78'), 10);
  return { src: decoded, w, q };
}

export async function serveImagePreview(req, res) {
  const parsed = parsePreviewQuery(req);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const allowed = getAllowedImageHosts(req);
  if (!isImageSrcAllowed(parsed.src, allowed)) {
    return res.status(403).json({
      error:
        'Хост изображения не разрешён. Добавьте домен в IMAGE_PREVIEW_HOSTS или храните картинки на том же хосте, что и API.',
    });
  }
  try {
    const { body, contentType } = await fetchAndCompressPreview(
      parsed.src,
      parsed.w,
      parsed.q
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    res.send(body);
  } catch (e) {
    console.error('image/preview:', e.message || e);
    res.status(502).json({ error: 'Не удалось получить или обработать изображение' });
  }
}
