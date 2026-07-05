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

// Direct-morph FACE sweeps (mode 'steps') drive the rig one deterministic pose per
// frame — the capture script sets a morph pose, screenshots, then advances — using the
// exact viseme/ARKit morph names on the GLB avatars. This holds each shape clearly
// (no fast setTimeout flash). VRM avatars expose no raw morphs (they use the expression
// manager), so they use the real lip-sync path instead.
const VISEME_STEPS = [
  { viseme_aa: 1 }, { viseme_E: 1 }, { viseme_I: 1 }, { viseme_O: 1 },
  { viseme_U: 1 }, { viseme_PP: 1 }, { viseme_FF: 1 }, { viseme_CH: 1 }
]
const EXPR_STEPS = [
  { mouthSmileLeft: 1, mouthSmileRight: 1, cheekSquintLeft: 0.6, cheekSquintRight: 0.6 },
  { mouthFrownLeft: 1, mouthFrownRight: 1, browInnerUp: 1 },
  { browDownLeft: 1, browDownRight: 1, noseSneerLeft: 0.5, noseSneerRight: 0.5, mouthPressLeft: 0.6, mouthPressRight: 0.6 },
  { jawOpen: 0.5, browOuterUpLeft: 1, browOuterUpRight: 1, browInnerUp: 0.6, eyeWideLeft: 1, eyeWideRight: 1 },
  { eyeBlinkLeft: 1, eyeBlinkRight: 1 }
]
const EXPR2_STEPS = [
  { browInnerUp: 1, eyeWideLeft: 0.85, eyeWideRight: 0.85, jawOpen: 0.35, mouthStretchLeft: 0.6, mouthStretchRight: 0.6 },
  { noseSneerLeft: 1, noseSneerRight: 1, mouthUpperUpLeft: 0.7, mouthUpperUpRight: 0.7, browDownLeft: 0.6, browDownRight: 0.6 },
  { mouthPucker: 1, mouthFunnel: 0.5 },
  { cheekPuff: 1 },
  { jawLeft: 1 }
]

const MATRIX = [
  // ===== FACE — direct morph sweeps (crisp, deterministic, GLB) =====
  { name: 'greg-viseme-sweep', avatar: 'Greg', shot: 'face', group: 'viseme', mode: 'steps', frameMs: 420, steps: VISEME_STEPS,
    caption: 'Viseme mouth-shape sweep — aa·E·I·O·U·PP·FF·CH (GLB · Greg)' },
  { name: 'greg-expression-sweep', avatar: 'Greg', shot: 'face', group: 'emote', mode: 'steps', frameMs: 560, steps: EXPR_STEPS,
    caption: 'Expression sweep — happy·sad·angry·surprise·blink (GLB · Greg)' },
  { name: 'greg-expression-sweep-2', avatar: 'Greg', shot: 'face', group: 'emote', mode: 'steps', frameMs: 560, steps: EXPR2_STEPS,
    caption: 'Expression sweep 2 — fear·disgust·pucker·cheek·jaw (GLB · Greg)' },

  // ===== FACE — real lip-sync path (viseme service; gaze/blink stilled) =====
  { name: 'greg-lipsync', avatar: 'Greg', shot: 'face', ms: 3200, group: 'viseme', mode: 'lipsync',
    caption: 'Lip-sync — real viseme service (GLB · Greg)', prep: `h.speak("Hello, I'm your companion. How can I help you today?")` },
  { name: 'erik-lipsync', avatar: 'Erik', shot: 'face', ms: 3200, group: 'viseme', mode: 'lipsync',
    caption: 'Lip-sync — VRM expression manager (VRM · Erik)', prep: `h.speak("Hi there, nice to meet you.")` },
  { name: 'workboy-lipsync', avatar: 'Work Boy', shot: 'face', ms: 3200, group: 'viseme', mode: 'lipsync',
    caption: 'Lip-sync — VRM expression manager (VRM · Work Boy)', prep: `h.speak("Welcome, let me show you around today.")` },

  // ===== BODY — real animation (idle-settled: no arms-up first frame) =====
  { name: 'greg-idle', avatar: 'Greg', shot: 'body', ms: 2600, group: 'animation', mode: 'body',
    caption: 'Idle loop (GLB · Greg)', prep: `h.playCategory('idle',{loopCount:1e9})` },
  { name: 'greg-gesture', avatar: 'Greg', shot: 'body', ms: 2800, group: 'animation', mode: 'body',
    caption: 'Gesture over idle — native crossfade (GLB · Greg)', prep: `h.playCategory('gesture',{blendTime:400})` },
  { name: 'greg-action', avatar: 'Greg', shot: 'body', ms: 3200, group: 'animation', mode: 'body',
    caption: 'Action clip (GLB · Greg)', prep: `h.playCategory('action',{blendTime:400})` },
  { name: 'greg-blend', avatar: 'Greg', shot: 'body', ms: 3400, group: 'blend', mode: 'body',
    caption: 'idle → gesture → idle blend (GLB · Greg)',
    prep: `setTimeout(()=>h.playCategory('gesture',{blendTime:700}),500);setTimeout(()=>h.playCategory('idle',{loopCount:1e9,blendTime:800}),2200)` },
  { name: 'workboy-gesture', avatar: 'Work Boy', shot: 'body', ms: 2800, group: 'animation', mode: 'body',
    caption: 'Gesture (VRM · Work Boy, VRMA clips)', prep: `h.playCategory('gesture',{blendTime:400})` }
]

const VIEWPORTS = { body: { width: 400, height: 640 }, upper: { width: 480, height: 540 }, face: { width: 420, height: 420 } }
const DPR = 1

function encodeWebp(frames, outFile, frameMs = FRAME_MS) {
  // -lossy is required: img2webp defaults to LOSSLESS, which balloons 3D renders.
  const args = ['-loop', '0', '-lossy', '-q', '52', '-m', '6', '-d', String(frameMs), ...frames, '-o', outFile]
  const r = spawnSync('img2webp', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`img2webp failed: ${r.stderr || r.stdout}`)
}

/** Deterministic FACE capture: one held morph pose per frame (no setTimeout flash). */
async function captureSteps(page, spec, frameDir) {
  await page.evaluate(() => window.__harness.setServices({ visemes: false, emotes: false }))
  await page.waitForTimeout(120)
  const frames = []
  for (let i = 0; i < spec.steps.length; i++) {
    await page.evaluate((pose) => {
      window.__harness.clearMorphs()
      window.__harness.setMorph(pose)
    }, spec.steps[i])
    await page.waitForTimeout(160) // let the pose render
    const f = join(frameDir, `f_${String(i).padStart(3, '0')}.png`)
    await page.screenshot({ path: f })
    frames.push(f)
  }
  await page.evaluate(() => window.__harness.clearMorphs())
  return frames
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

  const mode = spec.mode || 'body'

  // Settle to a clean idle rest first, so the first frame has arms DOWN / head FORWARD
  // (the startup greet raises the arms — capturing too early caught that pose).
  await page.evaluate(() => window.__harness.playCategory('idle', { loopCount: 1e9, blendTime: 250 }))
  await page.waitForTimeout(mode === 'steps' ? 1800 : 1400)

  const frameDir = join(TMP, spec.name)
  rmSync(frameDir, { recursive: true, force: true })
  mkdirSync(frameDir, { recursive: true })
  const outFile = join(OUT, `${spec.name}.webp`)

  if (mode === 'steps') {
    // Deterministic pose-per-frame face capture (idle kept so the head stays framed).
    const frames = await captureSteps(page, spec, frameDir)
    encodeWebp(frames, outFile, spec.frameMs || FRAME_MS)
    rmSync(frameDir, { recursive: true, force: true })
    await ctx.close()
    return outFile
  }

  if (mode === 'lipsync') {
    // Real viseme path, but stop emotes so gaze/blink don't turn the head off the mouth.
    await page.evaluate(() => window.__harness.setServices({ emotes: false }))
  }
  await page.waitForTimeout(150)

  if (spec.prep) {
    await page.evaluate((code) => {
      const h = window.__harness
      // eslint-disable-next-line no-eval
      eval(code)
    }, spec.prep)
  }

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
