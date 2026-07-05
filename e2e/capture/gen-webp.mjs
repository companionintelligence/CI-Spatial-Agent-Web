#!/usr/bin/env node
/**
 * gen-webp.mjs — capture animated WebP visual tests spanning the full animation mixer.
 *
 * Drives /harness.html (window.__harness) with Playwright, plays each clip in the
 * catalog, screenshots a sequence of frames, and encodes them to an animated WebP with
 * img2webp. Reuses one page per (avatar, shot) so the whole GLB catalog captures fast.
 * Output: docs/visual-tests/*.webp + manifest.json (the gallery in index.html reads it).
 *
 * Usage:
 *   BASE=http://localhost:5199 node e2e/capture/gen-webp.mjs [--only=greg-body,faces]
 *   groups: greg-body | vrm-body | faces | blends
 */
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { writeGalleryReadme } from './gallery-md.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const BASE = process.env.BASE || 'http://localhost:5199'
const OUT = join(repoRoot, 'docs', 'visual-tests')
const TMP = join(repoRoot, '.tmp', 'webp-frames')
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
const only = onlyArg ? new Set(onlyArg.split(',')) : null

const FPS = 9
const FRAME_MS = Math.round(1000 / FPS)
const VP = { body: { width: 400, height: 640 }, face: { width: 420, height: 420 } }

// The full GLB animation catalog, by category (33 clips that ride the RPM skeleton).
const GLB_CATALOG = {
  idle: ['idle-stable', 'basic-idle', 'standing-idle-watch'],
  communication: ['Talking', 'Talking-1', 'Talking-2', 'Telling-A-Secret'],
  gesture: ['Waving', 'Arm-Gesture', 'Head-Gesture', 'Happy-Hand-Gesture', 'Hands-Forward-Gesture',
    'Whatever-Gesture', 'Clapping', 'Pointing-Forward', 'Salute', 'Shoulder-Rubbing', 'Agreeing'],
  expression: ['Surprised', 'Reacting', 'Thinking', 'Looking', 'Looking-1', 'Looking-Behind',
    'Shaking-It-Off', 'Cocky-Head-Turn'],
  action: ['dance', 'dance-action', 'bow', 'throw', 'Praying', 'Spin-In-Place', 'Crazy-Gesture'],
  movement: ['walking']
}
// VRMA clips (VRM avatars, retargeted via the humanoid map).
const VRMA_CATALOG = ['idle_loop', 'victory_sign', 'surprise_greet', 'pose', 'finger_gun', 'dance_move']

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function encodeWebp(frames, outFile) {
  const args = ['-loop', '0', '-lossy', '-q', '50', '-m', '6', '-d', String(FRAME_MS), ...frames, '-o', outFile]
  const r = spawnSync('img2webp', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`img2webp failed: ${r.stderr || r.stdout}`)
}

async function loadAvatar(browser, avatar, shot) {
  const ctx = await browser.newContext({ viewport: VP[shot], deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.warn(`   [page error] ${avatar}: ${e.message}`))
  await page.goto(`${BASE}/harness.html?avatar=${encodeURIComponent(avatar)}&shot=${shot}&bg=dark`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 20000 })
  await page.waitForFunction(() => window.__avatarLoaded === true, null, { timeout: 25000 })
  await page.waitForTimeout(2600) // let the startup greet settle to idle
  return { ctx, page }
}

async function grab(page, name, ms) {
  const dir = join(TMP, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const frames = []
  const count = Math.round(ms / FRAME_MS)
  for (let i = 0; i < count; i++) {
    const t0 = Date.now()
    const f = join(dir, `f_${String(i).padStart(3, '0')}.png`)
    await page.screenshot({ path: f })
    frames.push(f)
    const el = Date.now() - t0
    if (el < FRAME_MS) await page.waitForTimeout(FRAME_MS - el)
  }
  const out = join(OUT, `${name}.webp`)
  encodeWebp(frames, out)
  rmSync(dir, { recursive: true, force: true })
  return { out, sizeKb: existsSync(out) ? Math.round(statSync(out).size / 1024) : 0 }
}

async function captureAnimCatalog(browser, avatar, catalog, prefix, results) {
  const { ctx, page } = await loadAvatar(browser, avatar, 'body')
  for (const [group, clips] of Object.entries(catalog)) {
    for (const clip of clips) {
      const name = `${prefix}-${slug(clip)}`
      process.stdout.write(`▶ ${name} … `)
      try {
        await page.evaluate((c) => window.__harness.playAnimation(c, { loopCount: 1e9, blendTime: 350 }), clip)
        await page.waitForTimeout(600) // establish the clip
        const { sizeKb } = await grab(page, name, group === 'action' ? 3200 : 2600)
        console.log(`ok (${sizeKb} KB)`)
        results.push({ name, file: `${name}.webp`, avatar, clip, group, ok: true, sizeKb, caption: `${clip} (${group})` })
      } catch (e) {
        console.log(`FAIL — ${e.message}`)
        results.push({ name, file: `${name}.webp`, avatar, clip, group, ok: false, error: String(e.message) })
      }
    }
  }
  await ctx.close()
}

async function captureFaces(browser, results) {
  const emotes = ['happy', 'sad', 'angry', 'fear', 'love', 'neutral']
  const specs = [
    { avatar: 'Greg', name: 'greg-lipsync', group: 'viseme', prepStr: `window.__harness.speak("Hello, I'm your companion. How can I help you today?")`, ms: 3200, caption: 'Lip-sync visemes (GLB · Greg)' },
    { avatar: 'Erik', name: 'erik-lipsync', group: 'viseme', prepStr: `window.__harness.speak('Hi there, nice to meet you.')`, ms: 3200, caption: 'Lip-sync visemes (VRM · Erik)' },
    ...emotes.map((emo) => ({
      avatar: 'Greg', name: `greg-emote-${emo}`, group: 'emote',
      prepStr: `window.__harness.setEmote('${emo}')`, ms: 2600, caption: `Emote: ${emo} (GLB · Greg)`
    }))
  ]
  for (const s of specs) {
    process.stdout.write(`▶ ${s.name} … `)
    try {
      const { ctx, page } = await loadAvatar(browser, s.avatar, 'face')
      await page.evaluate(() => window.__harness.playCategory('idle', { loopCount: 1e9, blendTime: 150 }))
      await page.waitForTimeout(500)
      await page.evaluate((code) => { new Function(code)() }, s.prepStr)
      const { sizeKb } = await grab(page, s.name, s.ms)
      console.log(`ok (${sizeKb} KB)`)
      results.push({ name: s.name, file: `${s.name}.webp`, avatar: s.avatar, group: s.group, caption: s.caption, ok: true, sizeKb })
      await ctx.close()
    } catch (e) {
      console.log(`FAIL — ${e.message}`)
      results.push({ name: s.name, file: `${s.name}.webp`, avatar: s.avatar, group: s.group, ok: false, error: String(e.message) })
    }
  }
}

async function captureBlends(browser, results) {
  const { ctx, page } = await loadAvatar(browser, 'Greg', 'body')
  const name = 'greg-blend'
  process.stdout.write(`▶ ${name} … `)
  try {
    await page.evaluate(() => {
      window.__harness.playCategory('idle', { loopCount: 1e9, blendTime: 150 })
      setTimeout(() => window.__harness.playAnimation('Waving', { loopCount: 1, blendTime: 800 }), 700)
      setTimeout(() => window.__harness.playCategory('idle', { loopCount: 1e9, blendTime: 900 }), 2600)
    })
    const { sizeKb } = await grab(page, name, 4000)
    console.log(`ok (${sizeKb} KB)`)
    results.push({ name, file: `${name}.webp`, group: 'blend', avatar: 'Greg', ok: true, sizeKb, caption: 'idle → wave → idle crossfade (GLB · Greg)' })
  } catch (e) {
    console.log(`FAIL — ${e.message}`)
    results.push({ name, file: `${name}.webp`, group: 'blend', ok: false, error: String(e.message) })
  }
  await ctx.close()
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  if (!only || only.has('greg-body')) await captureAnimCatalog(browser, 'Greg', GLB_CATALOG, 'greg', results)
  if (!only || only.has('vrm-body')) await captureAnimCatalog(browser, 'Erik', { vrma: VRMA_CATALOG }, 'erik', results)
  if (!only || only.has('faces')) await captureFaces(browser, results)
  if (!only || only.has('blends')) await captureBlends(browser, results)
  await browser.close()

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ generatedWith: 'gen-webp.mjs', fps: FPS, clips: results }, null, 2))
  writeGalleryReadme(OUT) // keep the Markdown gallery (docs/visual-tests/README.md) in sync
  const ok = results.filter((r) => r.ok).length
  const kb = results.filter((r) => r.ok).reduce((n, r) => n + r.sizeKb, 0)
  console.log(`\n${ok}/${results.length} clips captured — ${(kb / 1024).toFixed(1)} MB → docs/visual-tests/`)
  if (ok < results.length) process.exitCode = 1
}

main()
