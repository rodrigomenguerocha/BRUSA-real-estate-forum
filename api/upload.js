// Auth-gated image upload. Accepts { filename, dataUrl } (base64 data URL),
// stores it in Blob, returns the public URL to reference as a photo/logo.
import { put } from '@vercel/blob';
import { isAuthed } from '../lib/auth.js';

const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let body;
  try {
    body = req.body;
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad_json' }); }
  }

  const { filename, dataUrl } = body || {};
  if (!dataUrl) return res.status(400).json({ error: 'missing_dataUrl' });

  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return res.status(400).json({ error: 'bad_dataurl' });

  const contentType = m[1];
  const ext = ALLOWED[contentType];
  if (!ext) return res.status(415).json({ error: 'unsupported_type', message: contentType });

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) {
    return res.status(413).json({ error: 'too_large', message: 'Max 2.5 MB' });
  }

  const safe = String(filename || 'img')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'img';

  try {
    const blob = await put(`uploads/${safe}.${ext}`, buf, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: 'upload_failed', message: String((err && err.message) || err) });
  }
}
