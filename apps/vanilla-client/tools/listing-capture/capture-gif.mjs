// Records the first-run reveal (splash -> character wave -> greeting) as a GIF
// using CDP screencast, which yields a frame on each repaint of the live
// three.js loop — far faster than repeated full-page screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, '.capture');
const GF = path.join(OUT, 'gifframes');
fs.rmSync(GF, { recursive: true, force: true });
fs.mkdirSync(GF, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(DIST, p);
  if (!fp.startsWith(DIST) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(4173, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:4173';

chromium.setGraphicsMode = true;
const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--hide-scrollbars', '--force-color-profile=srgb'],
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
  defaultViewport: { width: 960, height: 600, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const client = await page.createCDPSession();

let n = 0;
const frames = [];
client.on('Page.screencastFrame', async ({ data, sessionId }) => {
  frames.push(Buffer.from(data, 'base64'));
  try { await client.send('Page.screencastFrameAck', { sessionId }); } catch {}
});

await client.send('Page.enable');
await client.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
await page.goto(`${BASE}/?gpu=0&detect=0&proactive=0`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 7000)); // splash -> reveal -> wave -> greeting -> idle
await client.send('Page.stopScreencast').catch(() => {});
await browser.close();
await new Promise((r) => server.close(r));

frames.forEach((b, i) => fs.writeFileSync(path.join(GF, `g${String(i).padStart(4, '0')}.jpg`), b));
console.log('screencast frames:', frames.length);

// Concat the JPEGs at a fixed output fps; cap width for a small, shareable GIF.
const gifOut = path.join(OUT, 'ftue.gif');
const palette = path.join(OUT, 'palette.png');
const fps = Math.max(6, Math.min(14, Math.round(frames.length / 7)));
const vf = `scale=720:-1:flags=lanczos`;
let r = spawnSync(ffmpegPath, ['-y', '-framerate', String(fps), '-i', path.join(GF, 'g%04d.jpg'), '-vf', `${vf},palettegen=stats_mode=diff`, palette], { encoding: 'utf8' });
if (r.status !== 0) console.log('palettegen:', r.stderr?.slice(-300));
r = spawnSync(ffmpegPath, ['-y', '-framerate', String(fps), '-i', path.join(GF, 'g%04d.jpg'), '-i', palette, '-lavfi', `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3`, gifOut], { encoding: 'utf8' });
if (r.status !== 0) console.log('paletteuse:', r.stderr?.slice(-300));
console.log('fps', fps, 'GIF', fs.existsSync(gifOut) ? (fs.statSync(gifOut).size / 1024).toFixed(0) + 'KB' : 'MISSING');
console.log('DONE');
