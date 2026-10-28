/* A small static server that serves a build the way GitHub Pages does, for the smoke test and release trials:
   the folder at /ManagerStory/ (the base), files with Cache-Control: max-age=600 (Pages lets a browser keep a file
   ~10 minutes), index.html for a folder, 404 otherwise. The folder can be changed while it runs (setRoot), to
   publish a new release under an open browser.
   node tests/smoke/pages-server.mjs [folder=dist] [port=4173] */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
export const BASE = '/ManagerStory/';

export function pagesServer(folder, { port = 4173, log = null } = {}) {
  let root = resolve(folder);
  const requests = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    requests.push(url.pathname + url.search);
    log?.(url.pathname + url.search);
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404); res.end('not found'); return; }
    let file = normalize(join(root, decodeURIComponent(url.pathname.slice(BASE.length))));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('404');
    }
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${server.address().port}${BASE}`,
    setRoot: folder => { root = resolve(folder); },
    requests,
    close: () => new Promise(done => server.close(done)),
  })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await pagesServer(process.argv[2] || 'dist', { port: Number(process.argv[3] || 4173) });
  console.log(`serving ${process.argv[2] || 'dist'} at ${s.url}`);
}
