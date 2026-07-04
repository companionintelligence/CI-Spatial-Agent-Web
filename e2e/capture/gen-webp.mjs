#!/usr/bin/env node
/**
 * gen-webp.mjs — capture short animated WebP visual tests from the avatar harness.
 *
 * Drives /harness.html (window.__harness) with Playwright, screenshots a sequence of
 * frames while a behavior plays, and encodes them to an animated WebP with img2webp.
 * Produces a catalog of clips (animations, lip-sync/visemes, emotes, blends) across
 * GLB / VRM / HumGen avatars, plus a manifest the gallery reads.
 *
 * Usage:
 *   BASE=http://localhost:5199 node e2e/capture/gen-webp.mjs [--only=name,name]
 *
 * Requires a running web dev server (BASE) and img2webp (libwebp) on PATH.
 */
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const BASE = process.env.BASE || 'http://localhost:5199'
const OUT = join(repoRoot, 'docs', 'visual-tests')
const TMP = join(repoRoot, '.tmp', 'webp-frames')
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
const only = onlyArg ? new Set(onlyArg.split(',')) : null

const FPS = 9
const FRAME_MS = Math.round(1000 / FPS)

// prep runs in the page after the avatar loads; e is the window.__harness alias helper.
const MATRIX = [
  // --- body animations (GLB default: Greg) ---
  { name: 'greg-idle', avatar: 'Greg', shot: 'body', ms: 2600, group: 'animation',
    caption: 'Idle loop (GLB · Greg)', prep: `h.playCategory('idle',{loopCount:1e9})` },
  { name: 'greg-gesture', avatar: 'Greg', shot: 'body', ms: 2800, group: 'animation',
    caption: 'Gesture over idle — native crossfade (GLB · Greg)', prep: `h.playCategory('gesture',{blendTime:400})` },
  { name: 'greg-action', avatar: 'Greg', shot: 'body', ms: 3200, group: 'animation',
    caption: 'Action clip (GLB · Greg)', prep: `h.playCategory('action',{blendTime:400})` },
  { name: 'greg-blend', avatar: 'Greg', shot: 'body', ms: 3400, group: 'blend',
    caption: 'idle → gesture → idle blend (GLB · Greg)',
    prep: `setTimeout(()=>h.playCategory('gesture',{blendTime:800}),600);setTimeout(()=>h.playCategory('idle',{loopCount:1e9,blendTime:900}),2200)` },

  // --- face: lip-sync / visemes ---
  { name: 'greg-lipsync', avatar: 'Greg', shot: 'face', ms: 3200, group: 'viseme',
    caption: 'Lip-sync visemes (GLB · Greg)', prep: `h.speak("Hello, I'm your companion. How can I help you today?")` },
  { name: 'aria-lipsync', avatar: 'Aria', shot: 'face', ms: 3200, group: 'viseme',
    caption: 'Lip-sync visemes (HumGen pipeline · Aria)', prep: `h.speak("Welcome. I was built by the avatar pipeline.")` },
  { name: 'erik-lipsync', avatar: 'Erik', shot: 'face', ms: 3200, group: 'viseme',
    caption: 'Lip-sync visemes (VRM · Erik)', prep: `h.speak("Hi there, nice to meet you.")` },

  // --- face: emotes ---
  { name: 'greg-emote-happy', avatar: 'Greg', shot: 'face', ms: 2600, group: 'emote',
    caption: 'Emote: happy (GLB · Greg)', prep: `h.setEmote('happy')` },
  { name: 'greg-emote-sad', avatar: 'Greg', shot: 'face', ms: 2600, group: 'emote',
    caption: 'Emote: sad (GLB · Greg)', prep: `h.setEmote('sad')` },
  { name: 'greg-emote-angry', avatar: 'Greg', shot: 'face', ms: 2600, group: 'emote',
    caption: 'Emote: angry (GLB · Greg)', prep: `h.setEmote('angry')` },

  // --- VRM body animation (VRMA path) ---
  { name: 'workboy-gesture', avatar: 'Work Boy', shot: 'body', ms: 2800, group: 'animation',
    caption: 'Gesture (VRM · Work Boy, VRMA clips)', prep: `h.playCategory('gesture',{blendTime:400})` }
]

const VIEWPORTS = { body: { width: 400, height: 640 }, upper: { width: 480, height: 540 }, face: { width: 420, height: 420 } }
const DPR = 1

function encodeWebp(frames, outFile) {
  // -lossy is required: img2webp defaults to LOSSLESS, which balloons 3D renders.
  const args = ['-loop', '0', '-lossy', '-q', '52', '-m', '6', '-d', String(FRAME_MS), ...frames, '-o', outFile]
  const r = spawnSync('img2webp', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`img2webp failed: ${r.stderr || r.stdout}`)
}

async function captureOne(browser, spec) {
  const vp = VIEWPORTS[spec.shot] || VIEWPORTS.body
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: DPR })
  const page = await ctx.newPage()
  const url = `${BASE}/harness.html?avatar=${encodeURIComponent(spec.avatar)}&shot=${spec.shot}&bg=dark`
  page.on('pageerror', (e) => console.warn(`   [page error] ${spec.name}: ${e.message}`))
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 20000 })
  await page.waitForFunction(() => window.__avatarLoaded === true, null, { timeout: 25000 })
  await page.waitForTimeout(1200) // let the startup greet settle toward idle

  // Face shots frame the head tightly, so any body motion (the startup greet) throws
  // the face out of frame. Still the body to idle first, then run the face behavior.
  if (spec.shot === 'face') {
    await page.evaluate(() => window.__harness.playCategory('idle', { loopCount: 1e9, blendTime: 150 }))
    await page.waitForTimeout(500)
  }

  if (spec.prep) {
    await page.evaluate((code) => {
      const h = window.__harness
      // eslint-disable-next-line no-eval
      eval(code)
    }, spec.prep)
  }

  const frameDir = join(TMP, spec.name)
  rmSync(frameDir, { recursive: true, force: true })
  mkdirSync(frameDir, { recursive: true })
  const frames = []
  const count = Math.round(spec.ms / FRAME_MS)
  for (let i = 0; i < count; i++) {
    const t0 = Date.now()
    const f = join(frameDir, `f_${String(i).padStart(3, '0')}.png`)
    await page.screenshot({ path: f })
    frames.push(f)
    const elapsed = Date.now() - t0
    if (elapsed < FRAME_MS) await page.waitForTimeout(FRAME_MS - elapsed)
  }

  const outFile = join(OUT, `${spec.name}.webp`)
  encodeWebp(frames, outFile)
  rmSync(frameDir, { recursive: true, force: true })
  await ctx.close()
  return outFile
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  const specs = MATRIX.filter((s) => !only || only.has(s.name))
  const browser = await chromium.launch()
  const results = []
  for (const spec of specs) {
    process.stdout.write(`▶ ${spec.name} (${spec.avatar}/${spec.shot}) … `)
    try {
      const out = await captureOne(browser, spec)
      const sizeKb = existsSync(out) ? Math.round((await import('node:fs')).statSync(out).size / 1024) : 0
      console.log(`ok (${sizeKb} KB)`)
      results.push({ ...spec, file: `${spec.name}.webp`, ok: true, sizeKb })
    } catch (e) {
      console.log(`FAIL — ${e.message}`)
      results.push({ ...spec, file: `${spec.name}.webp`, ok: false, error: String(e.message) })
    }
  }
  await browser.close()

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ generatedWith: 'gen-webp.mjs', fps: FPS, clips: results }, null, 2))
  const ok = results.filter((r) => r.ok).length
  console.log(`\n${ok}/${results.length} clips captured → docs/visual-tests/`)
  if (ok < results.length) process.exitCode = 1
}

main()
