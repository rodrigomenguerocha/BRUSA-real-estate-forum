// Public read endpoint — the site fetches this on load to render the
// carousel and schedule panels. No auth; always fresh.
import { getData } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const data = await getData();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'read_failed', message: String((err && err.message) || err) });
  }
}
