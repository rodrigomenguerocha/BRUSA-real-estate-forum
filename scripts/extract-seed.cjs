/* One-time-ish extractor: parse index.html's carousel cards + schedule panels
   into forum-data.json (the seed for the admin-editable data store).
   Re-runnable; safe to delete after the data lives in the Blob store. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* --- helpers --------------------------------------------------------- */
function langPair(fragment) {
  // returns { en, pt } from a fragment that may contain
  // <span data-lang="en">..</span><span data-lang="pt">..</span>
  // or plain text (used for both).
  if (fragment == null) return { en: '', pt: '' };
  const en = fragment.match(/data-lang="en">([\s\S]*?)<\/span>/);
  const pt = fragment.match(/data-lang="pt">([\s\S]*?)<\/span>/);
  if (en || pt) {
    return {
      en: clean(en ? en[1] : ''),
      pt: clean(pt ? pt[1] : (en ? en[1] : '')),
    };
  }
  const txt = clean(fragment);
  return { en: txt, pt: txt };
}
function clean(s) {
  return decodeEntities((s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&times;/g, '×');
}
function attr(block, re) {
  const m = block.match(re);
  return m ? m[1] : '';
}
function divContent(block, cls) {
  // grab inner HTML of <div class="cls"> ... </div> (non-greedy, single level ok here)
  const re = new RegExp('<div class="' + cls + '">([\\s\\S]*?)</div>');
  const m = block.match(re);
  return m ? m[1] : null;
}

/* --- slice the carousel --------------------------------------------- */
const carStart = html.indexOf('<div class="speakers-track">');
const carEnd = html.indexOf('<!-- ===== 04 NY WEEK', carStart);
let carousel = html.slice(carStart, carEnd);

// Pull commented-out cards first (these become inactive speakers), then
// strip comments so the live cards parse cleanly.
const commentedCards = [];
carousel = carousel.replace(/<!--([\s\S]*?)-->/g, (_, inner) => {
  const cards = inner.match(/<div class="speaker-card">[\s\S]*?<div class="speaker-panel">[\s\S]*?<\/div>\s*<\/div>/g) || [];
  cards.forEach((c) => commentedCards.push(c));
  return '';
});

function parseCard(block, active) {
  const badge = attr(block, /speaker-badge\s+(confirmed|proposed|tbd)/);
  const flag = (attr(block, /flag-(us|br)\.svg/) || 'us');
  const initials = clean(attr(block, /speaker-initials">([^<]*)<\/span>/));
  const photo = attr(block, /class="speaker-photo">[\s\S]*?<img[^>]*src="([^"]*)"/);
  const name = langPair(divContent(block, 'speaker-name'));
  const company = langPair(divContent(block, 'speaker-company'));
  const cargo = langPair(divContent(block, 'speaker-cargo'));
  const logo = attr(block, /class="speaker-logo"[^>]*src="([^"]*)"/);
  const panel = langPair(divContent(block, 'speaker-panel'));
  const idBase = (name.en && !/\(?tbd\)?|confirmar/i.test(name.en))
    ? name.en
    : (company.en || initials || photo);
  return {
    id: slug(idBase),
    active,
    badge: badge || 'tbd',
    flag,
    initials,
    photo: photo || '',
    name,
    company,
    cargo,
    logo: logo || '',
    panelLabel: panel,
  };
}

function slug(s) {
  return clean(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

const liveCards = carousel.match(/<div class="speaker-card">[\s\S]*?<div class="speaker-panel">[\s\S]*?<\/div>\s*<\/div>/g) || [];
const speakers = [];
const seen = {};
function pushSpeaker(s) {
  let id = s.id; let n = 2;
  while (seen[id]) { id = s.id + '-' + n++; }
  seen[id] = true; s.id = id; speakers.push(s);
}
liveCards.forEach((c) => pushSpeaker(parseCard(c, true)));
commentedCards.forEach((c) => pushSpeaker(parseCard(c, false)));

/* --- slice the schedule --------------------------------------------- */
const schStart = html.indexOf('<div class="schedule-list">');
const schEnd = html.indexOf('<!-- /zoom-schedule-scroll', schStart);
const schedule = html.slice(schStart, schEnd);

const items = schedule.match(/<div class="schedule-item[\s\S]*?(?=<div class="schedule-item|$)/g) || [];
const panels = [];
items.forEach((item) => {
  const slot = attr(item, /data-sched="(\d+)"/);
  const isPanel = /tag-panel/.test(item);
  if (!isPanel) return;
  const tag = langPair((item.match(/<div class="schedule-tag[^"]*">([\s\S]*?)<\/div>/) || [])[1]);
  const time = clean((item.match(/<div class="schedule-time">([\s\S]*?)<\/div>/) || [])[1]);
  const labels = item.match(/<div class="schedule-label" data-lang="(en|pt)">([\s\S]*?)<\/div>/g) || [];
  const title = { en: '', pt: '' };
  labels.forEach((l) => {
    const lm = l.match(/data-lang="(en|pt)">([\s\S]*?)<\/div>/);
    if (lm) title[lm[1]] = clean(lm[2]);
  });
  const desc = langPair((item.match(/<div class="schedule-description">([\s\S]*?)<\/div>/) || [])[1]);

  // speaker rows — split the .schedule-speakers block on the row delimiter
  const blockStart = item.indexOf('<div class="schedule-speakers">');
  const block = blockStart >= 0 ? item.slice(blockStart) : '';
  const rows = block.split('<div class="schedule-speaker">').slice(1);
  const panelSpeakers = rows.map((r) => {
    const photo = attr(r, /<img[^>]*src="([^"]*)"/);
    const nameSpans = r.match(/<span class="speaker-name"[^>]*>([\s\S]*?)<\/span>/g) || [];
    const name = spanLangPair(nameSpans, 'speaker-name');
    const roleSpans = r.match(/<span class="speaker-role"[^>]*>([\s\S]*?)<\/span>/g) || [];
    const role = spanLangPair(roleSpans, 'speaker-role');
    const tbd = /\(TBD\)|\(a confirmar\)/.test(r);
    return { photo: photo || '', name, role, tbd };
  });

  panels.push({ id: 'panel-' + slot, slot: Number(slot), tag, time, title, desc, speakers: panelSpeakers });
});

function spanLangPair(spans, cls) {
  // spans: array of <span class="cls" [data-lang]>text</span>
  let en = '', pt = '', plain = '';
  spans.forEach((s) => {
    const lang = (s.match(/data-lang="(en|pt)"/) || [])[1];
    const txt = clean(s.replace(/<[^>]+>/g, ''));
    if (lang === 'en') en = txt;
    else if (lang === 'pt') pt = txt;
    else plain = txt;
  });
  if (!en && !pt) return { en: plain, pt: plain };
  return { en: en || plain, pt: pt || en || plain };
}

/* --- write ----------------------------------------------------------- */
const out = {
  version: 1,
  updatedAt: null,
  panels,
  speakers,
};
fs.writeFileSync(path.join(ROOT, 'forum-data.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Speakers:', speakers.length, '(active', speakers.filter(s => s.active).length + ')');
console.log('Panels:', panels.length);
console.log('Panel slots:', panels.map(p => p.slot).join(', '));
console.log('Sample speaker ids:', speakers.slice(0, 6).map(s => s.id).join(', '));
