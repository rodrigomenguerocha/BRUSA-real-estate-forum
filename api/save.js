// Auth-gated write. Replaces the whole document (panels + speakers).
import { isAuthed } from '../lib/auth.js';
import { saveData } from '../lib/store.js';

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
  if (!body || !Array.isArray(body.panels) || !Array.isArray(body.speakers)) {
    return res.status(400).json({ error: 'bad_shape', message: 'Expected { panels: [], speakers: [] }' });
  }

  try {
    const saved = await saveData({
      version: body.version || 1,
      panels: body.panels,
      speakers: body.speakers,
    });
    return res.status(200).json({ ok: true, updatedAt: saved.updatedAt });
  } catch (err) {
    return res.status(500).json({ error: 'save_failed', message: String((err && err.message) || err) });
  }
}
