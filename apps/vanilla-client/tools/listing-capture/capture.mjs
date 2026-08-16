// FTUE capture driver — serves dist/, drives the app under headless
// SwiftShader Chromium, saves stills + a GIF of the first-run experience.
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
const FRAMES = path.join(OUT, 'frames');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(DIST, p);
  if (!fp.startsWith(DIST) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const PORT = 4173;
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
console.log('serving dist at', BASE);

chromium.setGraphicsMode = true; // swiftshader WebGL

async function launch(viewport) {
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
    ],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: viewport,
  });
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE, ['camera', 'microphone']);
  return browser;
}

const URL = `${BASE}/?gpu=0&detect=0&proactive=0`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });

// ---------- desktop: capture GIF frames during the cold-boot reveal ----------
{
  const browser = await launch({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Record frames across the reveal (~6s): splash -> fade -> wave -> greeting.
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < 6000) {
    await page.screenshot({ path: path.join(FRAMES, `f${String(i).padStart(3, '0')}.png`) });
    i++;
    await new Promise((r) => setTimeout(r, 140));
  }
  console.log('captured', i, 'frames');

  // Make sure the greeting actually arrived.
  try {
    await page.waitForSelector('#chat-log .msg.assistant', { timeout: 30000 });
    console.log('greeting present');
  } catch {
    const status = await page.$eval('#splash-status', (e) => e.textContent).catch(() => '(no splash status)');
    console.log('GREETING TIMEOUT. splash status:', status);
    console.log(logs.slice(-25).join('\n'));
  }

  // Hero still (character + HUD + greeting).
  await shot(page, 'desktop-01-hero.png');

  // Settings drawer.
  await page.click('#btn-settings').catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, 'desktop-02-settings.png');
  await page.click('#btn-settings').catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  // "Come here" walk action.
  await page.click('#btn-come').catch(() => {});
  await new Promise((r) => setTimeout(r, 700));
  await shot(page, 'desktop-03-comehere.png');

  // Camera viewfinder (fake device).
  await page.click('#btn-camera').catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  await shot(page, 'desktop-04-viewfinder.png');

  // Typed input affordance.
  await page.click('#chat-input').catch(() => {});
  await page.type('#chat-input', 'What do you see over there?', { delay: 25 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, 'desktop-05-typing.png');

  console.log('backend label / boot log tail:');
  console.log(logs.filter((l) => /Engine|Boot|backend/i.test(l)).slice(-6).join('\n'));
  await browser.close();
}

// ---------- mobile hero ----------
{
  const browser = await launch({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('#chat-log .msg.assistant', { timeout: 30000 }); } catch {}
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'mobile-01-hero.png');
  await browser.close();
}

await new Promise((r) => server.close(r));

// ---------- encode GIF from frames ----------
const gifOut = path.join(OUT, 'ftue.gif');
const palette = path.join(OUT, 'palette.png');
const vf = 'fps=10,scale=640:-1:flags=lanczos';
let r = spawnSync(ffmpegPath, ['-y', '-i', path.join(FRAMES, 'f%03d.png'), '-vf', `${vf},palettegen=stats_mode=diff`, palette], { encoding: 'utf8' });
if (r.status !== 0) console.log('palettegen err:', r.stderr?.slice(-400));
r = spawnSync(ffmpegPath, ['-y', '-i', path.join(FRAMES, 'f%03d.png'), '-i', palette, '-lavfi', `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3`, gifOut], { encoding: 'utf8' });
if (r.status !== 0) console.log('paletteuse err:', r.stderr?.slice(-400));

const sz = fs.existsSync(gifOut) ? (fs.statSync(gifOut).size / 1024).toFixed(0) + 'KB' : 'MISSING';
console.log('GIF:', gifOut, sz);
console.log('DONE');
