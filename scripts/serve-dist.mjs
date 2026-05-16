import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleApiRequest } from './api-handler.mjs';

const root = resolve('dist');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const requested = resolve(root, normalize(pathname).replace(/^([/\\])+/, ''));

  if (requested !== root && !requested.startsWith(root + sep)) {
    return null;
  }

  if (existsSync(requested) && statSync(requested).isFile()) {
    return requested;
  }

  return join(root, 'index.html');
}

if (!existsSync(join(root, 'index.html'))) {
  console.error('No dist/index.html found. Run `npm run build` first.');
  process.exit(1);
}

createServer(async (req, res) => {
  if (await handleApiRequest(req, res)) {
    return;
  }

  const file = resolveRequest(req.url || '/');

  if (!file || !existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`Family Financials is running at http://${host}:${port}/`);
});
