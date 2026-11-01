// Screenshot der Kassenansicht im Testmodus (für Design-Kontrolle)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = 'public';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => (e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }), r.end(d))));
}).listen(5055);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
await p.goto('http://127.0.0.1:5055/?lokal');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForSelector('.drink img');
await p.waitForTimeout(800);
for (const n of ['Spezli', 'Spezli', 'Coca-Cola', 'Hugo 3dl', 'Shotbrettli']) await p.locator('.drink', { hasText: n }).first().click();
await p.screenshot({ path: process.argv[2] || 'test/shots/logos.png' });
await b.close(); srv.close();
