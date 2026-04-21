#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const portArgIndex = args.findIndex((arg) => arg === '--port');
const portValue = portArgIndex >= 0 ? args[portArgIndex + 1] : process.env.PORT;
const port = Number(portValue || 4173);
const defaultEntry = '/Examples/index.html';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function resolvePathname(pathname) {
  const clean = pathname === '/' ? defaultEntry : pathname;
  const candidate = resolve(root, `.${normalize(clean)}`);
  if (!candidate.startsWith(root)) return null;
  if (!existsSync(candidate)) return null;
  if (statSync(candidate).isDirectory()) {
    const indexPath = join(candidate, 'index.html');
    if (!existsSync(indexPath)) return null;
    return indexPath;
  }
  return candidate;
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const filePath = resolvePathname(requestUrl.pathname);
  if (!filePath) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const contentType = contentTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  const base = `http://127.0.0.1:${port}`;
  console.log(`Ity examples server running at ${base}`);
  console.log(`Examples index: ${base}/Examples/`);
  console.log(`Operations Workbench: ${base}/Examples/OperationsWorkbench/`);
});
