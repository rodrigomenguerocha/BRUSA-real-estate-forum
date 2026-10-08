// Gera os PDFs do fórum a partir dos templates em pdf/.
//
// A fonte NYU Perstare e os logos dos co-organizadores vêm do index.html,
// para os templates não guardarem uma segunda cópia deles. O PDF sai pelo
// Chrome instalado na máquina (headless, via DevTools Protocol).
//
//   npm run pdf                          → todos os PDFs
//   npm run pdf -- brochure              → só a brochure
//   npm run pdf -- partnerships          → só o deck de patrocínio
//   npm run pdf -- brochure --preview    → também salva um PNG por página em pdf/preview/<nome>/

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'pdf');
const PORT = 9334;

// viewport = tamanho de uma página a 96 dpi, para o preview bater com o PDF.
const TARGETS = {
  brochure: {
    src: 'brochure.html',
    out: 'BRUSA-Real-Estate-Forum-2026.pdf',
    viewport: { width: 794, height: 1123 },        // A4 retrato
  },
  partnerships: {
    src: 'partnerships.html',
    out: 'BRUSA-Partnership-Deck-2026.pdf',
    viewport: { width: 1280, height: 720 },        // 16:9
  },
};

const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview');
const names = args.filter(a => !a.startsWith('--'));
for (const n of names) {
  if (!TARGETS[n]) throw new Error(`PDF desconhecido: ${n}. Opções: ${Object.keys(TARGETS).join(', ')}`);
}
const selected = names.length ? names : Object.keys(TARGETS);

const CHROME = process.env.CHROME_PATH || {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}[process.platform];

const site = await readFile(path.join(ROOT, 'index.html'), 'utf8');
const fonts = site.match(/@font-face\s*{[\s\S]*?}/g);
const coLogos = [...site.matchAll(/class="cover-co-logo-link">(<svg[\s\S]*?<\/svg>)<\/a>/g)].map(m => m[1]);
if (!fonts || coLogos.length < 2) {
  throw new Error('Não achei a fonte ou os logos dos co-organizadores no index.html.');
}

const tmp = await mkdtemp(path.join(os.tmpdir(), 'forum-pdf-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(tmp, 'profile')}`,
  '--allow-file-access-from-files',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }
    catch { await sleep(200); }
  }
  if (!targets) throw new Error(`Chrome não respondeu. Caminho usado: ${CHROME}`);

  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (!pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  await send('Page.enable');

  for (const name of selected) {
    const t = TARGETS[name];

    let html = await readFile(path.join(DIR, t.src), 'utf8');
    html = html
      .replace('/* @fonts */', fonts.join('\n'))
      .replaceAll('<!-- @logo-rci -->', coLogos[0])
      .replaceAll('<!-- @logo-nyu -->', coLogos[1])
      .replace('<head>', `<head>\n<base href="${pathToFileURL(DIR + path.sep).href}">`);
    const built = path.join(tmp, `${name}.html`);
    await writeFile(built, html);

    await send('Emulation.setDeviceMetricsOverride', { ...t.viewport, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(built).href });

    // Espera fontes, imagens e o QR code.
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      await sleep(200);
      ready = await evaluate('window.__pdfReady === true');
    }
    if (!ready) throw new Error(`${name}: a página não terminou de carregar (fontes, imagens ou QR code).`);

    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    const out = path.join(DIR, t.out);
    await writeFile(out, Buffer.from(pdf.data, 'base64'));
    const pages = await evaluate('document.querySelectorAll(".page").length');
    console.log(`PDF: ${path.relative(ROOT, out)} (${pages} páginas)`);

    if (PREVIEW) {
      const dir = path.join(DIR, 'preview', name);
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      const boxes = await evaluate('[...document.querySelectorAll(".page")].map(p => { const r = p.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; })');
      for (const [i, b] of boxes.entries()) {
        const shot = await send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 },
        });
        await writeFile(path.join(dir, `page-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
      }
      console.log(`Preview: ${path.relative(ROOT, dir)}/`);
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await rm(tmp, { recursive: true, force: true }).catch(() => {});
}
