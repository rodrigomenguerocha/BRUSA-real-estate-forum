// Lightweight single-password session for the admin area.
// The password is checked server-side; the cookie holds an HMAC, never the
// password itself. This is intentionally simple (one shared secret, no user
// accounts) — appropriate for a low-stakes event admin, not bank-grade.
import crypto from 'node:crypto';

const COOKIE = 'brus_admin';
const MAX_AGE = 60 * 60 * 12; // 12h

// Fallback keeps local/dev working even before the env var is set; in
// production you should set ADMIN_PASSWORD so the value isn't in the repo.
function password() {
  return process.env.ADMIN_PASSWORD || 'churrasco';
}
function secret() {
  return process.env.SESSION_SECRET || password() || 'brus-dev-secret';
}

function timingEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function makeToken() {
  return crypto.createHmac('sha256', secret()).update('brus-admin-session-v1').digest('hex');
}

export function checkPassword(pw) {
  return !!pw && timingEqual(pw, password());
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function isAuthed(req) {
  const token = parseCookies(req)[COOKIE];
  return !!token && timingEqual(token, makeToken());
}

export function sessionCookie() {
  return `${COOKIE}=${makeToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
