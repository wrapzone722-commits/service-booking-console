/**
 * Image upload for services, rewards, etc.
 * Saves compressed images to public/uploads/ and returns a relative URL path.
 */
import multer from 'multer';
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', 'public', 'uploads');

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const OUTPUT_MAX_WIDTH = 1200;
const JPEG_QUALITY = 82;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Допустимы только изображения'));
  },
});

export const uploadMiddleware = upload.single('image');

export async function handleImageUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не прикреплён' });
  }

  try {
    const id = uuidv4().replace(/-/g, '').slice(0, 16);
    const pipeline = sharp(req.file.buffer, { failOn: 'truncated' })
      .rotate()
      .resize(OUTPUT_MAX_WIDTH, null, { withoutEnlargement: true, fit: 'inside' });

    const meta = await pipeline.metadata();
    const hasAlpha = meta.hasAlpha && (meta.format === 'png' || meta.format === 'webp');

    let ext, buf, contentType;
    if (hasAlpha) {
      ext = 'webp';
      contentType = 'image/webp';
      buf = await pipeline.webp({ quality: JPEG_QUALITY, effort: 4 }).toBuffer();
    } else {
      ext = 'jpg';
      contentType = 'image/jpeg';
      buf = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    }

    const filename = `${id}.${ext}`;
    await writeFile(join(UPLOADS_DIR, filename), buf);

    const relativePath = `/uploads/${filename}`;

    res.json({ url: relativePath, contentType, size: buf.length });
  } catch (e) {
    console.error('upload:', e.message || e);
    res.status(500).json({ error: 'Не удалось обработать изображение' });
  }
}
