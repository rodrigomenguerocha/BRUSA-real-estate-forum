// Single source of truth for panels + speakers, persisted as one JSON blob.
// Reads are cache-busted so admin edits show up immediately for visitors.
import { put, list } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BLOB_KEY = 'forum-data.json';

// Bundled seed (the data extracted from the original static markup).
// `new URL(..., import.meta.url)` is traced by Vercel so the file ships with
// the function; we also try the project root (process.cwd()) as a fallback in
// case the bundle layout differs. vercel.json additionally pins it via
// `includeFiles`.
async function readSeed() {
  const candidates = [
    new URL('../forum-data.json', import.meta.url),
    path.join(process.cwd(), 'forum-data.json'),
  ];
  let lastErr;
  for (const c of candidates) {
    try {
      return JSON.parse(await readFile(c, 'utf8'));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function findBlobUrl() {
  const { blobs } = await list({ prefix: BLOB_KEY, limit: 100 });
  const hit = blobs.find((b) => b.pathname === BLOB_KEY);
  return hit ? hit.url : null;
}

export async function getData() {
  try {
    const url = await findBlobUrl();
    if (url) {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (err) {
    // fall through to seed on any read error
    console.error('getData: blob read failed, using seed —', err && err.message);
  }
  // No blob yet (first run): seed it so the next read is authoritative.
  const seed = await readSeed();
  try {
    await saveData(seed);
  } catch (err) {
    console.error('getData: seed persist failed —', err && err.message);
  }
  return seed;
}

export async function saveData(data) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await put(BLOB_KEY, JSON.stringify(payload, null, 2), {
    access: 'public',
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60, // SDK minimum; we cache-bust reads anyway
  });
  return payload;
}
