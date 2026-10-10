// Gera as artes de divulgação a partir da capa do index.html.
//
// Saem três composições: a prévia do link (WhatsApp, LinkedIn), a capa do
// evento no Luma e o backdrop 16:9 do telão. Logos, textos e parceiros vêm da
// própria capa, então entrou parceiro no site, é só rodar de novo. O fundo é o
// render de Manhattan já usado nos PDFs (pdf/assets/), com o mesmo banho roxo
// da capa; assim a arte não depende do Mapbox estar acessível.
//
//   npm run share              → todas as artes
//   npm run share -- luma      → só uma (og, luma ou backdrop)

import { spawn } from 'node:child_process';
import { writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9335;

// Esconde o que é do site (idioma, CTAs, demais seções) e deixa a capa ocupar
// a tela inteira, com logos e textos um pouco mais acesos que no site.
const COMMON = `
  .lang-toggle, .scroll-indicator, .cover-ctas, .cover-dots-glow { display: none !important; }
  body > *:not(#slide-cover):not(.cover-wrapper):not(script):not(style) { display: none !important; }
  .cover-wrapper > *:not(#slide-cover) { display: none !important; }
  .slide-cover {
    position: relative !important; padding: 0 !important; margin: 0 !important;
    width: 100vw !important; height: 100vh !important; min-height: 0 !important;
    display: flex !important; flex-direction: column !important;
    justify-content: center !important; align-items: center !important;
  }
  .cover-content { transform: none !important; opacity: 1 !important; }
  .cover-manhattan { background: var(--share-bg) center / cover no-repeat; opacity: 1 !important; transition: none !important; }
  .cover-manhattan canvas, .cover-manhattan .mapboxgl-canvas-container { display: none !important; }
  .cover-co-logo-link { opacity: .95 !important; height: auto !important; }
  .partner-logos .rope { background: rgba(255,255,255,.35) !important; }
  .cover-supporter { opacity: .8 !important; }
  .cover-label, .cover-supporters .cover-label { color: rgba(255,255,255,.6) !important; }
  .cover-desc { color: rgba(255,255,255,.6) !important; }
  .cover-meta { color: rgba(255,255,255,.85) !important; }
  .cover-partners { margin: 0 auto !important; }
  .cover-supporters { margin-top: 0 !important; }
  .partner-logos { min-height: 0 !important; }
  .cover-supporters .partner-logos { flex-wrap: nowrap !important; }
`;

// Medidas em px CSS. scale multiplica na saída (2 = arquivo no dobro).
const FORMATS = {
  og: {
    viewport: { width: 1200, height: 630 },
    bg: 'pdf/assets/cover-manhattan-wide.jpg',
    outputs: [{ file: 'img/og-share-1200x630.jpg', scale: 1, format: 'jpeg', quality: 88, maxKB: 300 }],
    css: `
      .cover-label { font-size: 10px !important; letter-spacing: .2em !important; }
      .partner-group { gap: 12px !important; }
      .cover-partners .partner-logos { gap: 30px !important; }
      .cover-co-logo-link svg { height: 40px !important; width: auto !important; }
      .partner-logos .rope { height: 28px !important; }
      .cover-partners { margin-bottom: 26px !important; }
      .cover-wm { font-size: 122px !important; margin-bottom: 2px !important; }
      .cover-desc { font-size: 15px !important; margin-bottom: 18px !important; }
      .cover-subtitle { font-size: 12px !important; margin-bottom: 0 !important; }
      .cover-meta { font-size: 15px !important; margin-top: 14px !important; }
      .cover-supporters { margin-top: 44px !important; }
      .cover-supporters-groups { flex-direction: row !important; align-items: flex-start !important; gap: 70px !important; }
      .cover-supporters .partner-group { gap: 14px !important; }
      .cover-supporters .partner-logos { gap: 30px !important; }
      .cover-supporter-logo--ospa { height: 34px !important; }
      .cover-supporter-logo--bb { height: 33px !important; }
      .cover-supporter-logo--piquet { height: 31px !important; }
      .cover-supporter-logo--jhsf { height: 21px !important; }
      .cover-supporter-logo[src*="chamber"] { height: 38px !important; }
      .cover-supporter-logo--lareal { height: 21px !important; }
    `,
  },
  luma: {
    viewport: { width: 1080, height: 1080 },
    bg: 'pdf/assets/cover-manhattan.jpg',
    outputs: [
      { file: 'artes/luma-1080x1080.jpg', scale: 1, format: 'jpeg', quality: 92 },
      { file: 'artes/luma-2160x2160.png', scale: 2, format: 'png' },
    ],
    css: `
      .cover-label { font-size: 13px !important; letter-spacing: .22em !important; }
      .partner-group { gap: 18px !important; }
      .cover-partners .partner-logos { gap: 46px !important; }
      .cover-co-logo-link svg { height: 54px !important; width: auto !important; }
      .partner-logos .rope { height: 44px !important; }
      .cover-partners { margin-bottom: 150px !important; }
      .cover-wm { font-size: 172px !important; margin-bottom: 6px !important; }
      .cover-desc { font-size: 22px !important; margin-bottom: 36px !important; }
      .cover-subtitle { font-size: 15px !important; margin-bottom: 4px !important; }
      .cover-meta { font-size: 19px !important; margin-top: 16px !important; }
      .cover-supporters { margin-top: 150px !important; }
      .cover-supporters-groups { gap: 40px !important; }
      .cover-supporters .partner-group { gap: 20px !important; }
      .cover-supporters .partner-logos { gap: 46px !important; }
      .cover-supporter-logo--ospa { height: 54px !important; }
      .cover-supporter-logo--bb { height: 52px !important; }
      .cover-supporter-logo--piquet { height: 49px !important; }
      .cover-supporter-logo--jhsf { height: 33px !important; }
      .cover-supporter-logo[src*="chamber"] { height: 60px !important; }
      .cover-supporter-logo--lareal { height: 33px !important; }
    `,
  },
  backdrop: {
    viewport: { width: 1920, height: 1080 },
    bg: 'pdf/assets/cover-manhattan-wide.jpg',
    outputs: [{ file: 'artes/backdrop-3840x2160.png', scale: 2, format: 'png' }],
    css: `
      .cover-label { font-size: 15px !important; letter-spacing: .22em !important; }
      .partner-group { gap: 20px !important; }
      .cover-partners .partner-logos { gap: 56px !important; }
      .cover-co-logo-link svg { height: 66px !important; width: auto !important; }
      .partner-logos .rope { height: 52px !important; }
      .cover-partners { margin-bottom: 64px !important; }
      .cover-wm { font-size: 220px !important; margin-bottom: 4px !important; }
      .cover-desc { font-size: 27px !important; margin-bottom: 34px !important; }
      .cover-subtitle { font-size: 20px !important; margin-bottom: 2px !important; }
      .cover-meta { font-size: 25px !important; margin-top: 22px !important; }
      .cover-supporters { margin-top: 86px !important; }
      .cover-supporters-groups { flex-direction: row !important; align-items: flex-start !important; gap: 120px !important; }
      .cover-supporters .partner-group { gap: 22px !important; }
      .cover-supporters .partner-logos { gap: 52px !important; }
      .cover-supporter-logo--ospa { height: 58px !important; }
      .cover-supporter-logo--bb { height: 56px !important; }
      .cover-supporter-logo--piquet { height: 53px !important; }
      .cover-supporter-logo--jhsf { height: 35px !important; }
      .cover-supporter-logo[src*="chamber"] { height: 64px !important; }
      .cover-supporter-logo--lareal { height: 35px !important; }
    `,
  },
};

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
for (const n of names) {
  if (!FORMATS[n]) throw new Error(`Arte desconhecida: ${n}. Opções: ${Object.keys(FORMATS).join(', ')}`);
}
const selected = names.length ? names : Object.keys(FORMATS);

const CHROME = process.env.CHROME_PATH || {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}[process.platform];

const tmp = await mkdtemp(path.join(os.tmpdir(), 'forum-share-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(tmp, 'profile')}`,
  '--allow-file-access-from-files',
  '--hide-scrollbars',
  // Como root (container, CI), o Chrome não sobe com sandbox.
  ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
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
  // Sem animação de entrada: a capa já aparece no estado final.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  for (const name of selected) {
    const f = FORMATS[name];
    for (const out of f.outputs) {
      await send('Emulation.setDeviceMetricsOverride', { ...f.viewport, deviceScaleFactor: out.scale, mobile: false });
      await send('Page.navigate', { url: pathToFileURL(path.join(ROOT, 'index.html')).href });

      let loaded = false;
      for (let i = 0; i < 100 && !loaded; i++) {
        await sleep(200);
        loaded = await evaluate('document.readyState === "complete"');
      }
      if (!loaded) throw new Error(`${name}: o index.html não terminou de carregar.`);

      const css = `:root { --share-bg: url('${f.bg}'); }\n${COMMON}\n${f.css}`;
      const ok = await evaluate(`(async () => {
        const s = document.createElement('style');
        s.textContent = ${JSON.stringify(css)};
        document.head.appendChild(s);
        await document.fonts.ready;
        const bg = await new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = ${JSON.stringify(f.bg)}; });
        const logos = await Promise.all([...document.querySelectorAll('#slide-cover img')].map(i => i.decode().then(() => true, () => false)));
        return bg && logos.every(Boolean);
      })()`);
      if (!ok) throw new Error(`${name}: o fundo ou algum logo da capa não carregou.`);
      await sleep(500);

      // A capa precisa caber inteira na arte.
      const box = await evaluate('(() => { const r = document.querySelector(".cover-content").getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })()');
      if (box.top < 0 || box.bottom > f.viewport.height) {
        throw new Error(`${name}: o conteúdo passa da borda (${Math.round(box.top)}–${Math.round(box.bottom)} em ${f.viewport.height}px).`);
      }

      const shot = await send('Page.captureScreenshot', {
        format: out.format,
        ...(out.quality ? { quality: out.quality } : {}),
        clip: { x: 0, y: 0, ...f.viewport, scale: 1 },
      });
      const file = path.join(ROOT, out.file);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(shot.data, 'base64'));
      const kb = Math.round((await stat(file)).size / 1024);
      const px = `${f.viewport.width * out.scale}x${f.viewport.height * out.scale}`;
      console.log(`Arte: ${out.file} (${px}, ${kb} KB)`);
      if (out.maxKB && kb > out.maxKB) throw new Error(`${out.file} passou de ${out.maxKB} KB; o WhatsApp não mostra a prévia.`);
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await rm(tmp, { recursive: true, force: true }).catch(() => {});
}
