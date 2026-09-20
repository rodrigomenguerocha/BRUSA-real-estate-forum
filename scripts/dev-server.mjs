// Servidor estático de desenvolvimento.
//
// Serve os arquivos do projeto e responde /api/data com o forum-data.json
// local. É isso que diferencia ele de um `python -m http.server`: sem a
// rota /api/data, a página não hidrata painéis nem speakers, e você só vê
// o markup estático de fallback.
//
//   npm run dev        → http://localhost:4321
//   npm run dev 5000   → outra porta
//
// Para rodar as funções serverless de verdade (login, save, upload),
// use `npm run dev:local`, que sobe o `vercel dev`.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }

  // Stand-in para a função serverless: devolve o seed local, que é o mesmo
  // que /api/data serve em produção quando o Blob ainda não foi gravado.
  if (pathname === '/api/data') {
    try {
      const buf = await readFile(path.join(ROOT, 'forum-data.json'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(buf);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'seed_unreadable', message: String(err && err.message) }));
    }
    return;
  }

  // As demais rotas /api pedem estado que só o `vercel dev` tem.
  if (pathname.startsWith('/api/')) {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_implemented', message: 'Use `npm run dev:local` para as funções de /api.' }));
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  if (!path.extname(pathname)) pathname += '.html'; // espelha o cleanUrls da Vercel

  // Mantém tudo dentro da pasta do projeto.
  const file = path.join(ROOT, pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} ocupada. Derrube o outro servidor ou rode: npm run dev ${PORT + 1}`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  BR/USA Real Estate Forum`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  /api/data servindo forum-data.json\n`);
});
