#!/usr/bin/env node
/**
 * gen-webp.mjs — capture animated WebP visual tests across avatars, rigs, faces, eyes,
 * and blends via the harness (window.__harness). Uses isolated single-clip playback
 * (captureClip) so there's no crossfade/loop-seam glitch, trims the first frames, and
 * organizes output into sub-pages via gallery-md.mjs.
 *
 * Usage: BASE=http://localhost:5199 node e2e/capture/gen-webp.mjs [--only=page,page]
 *   pages: animations | faces | eyes | blends
 */
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { writeGalleryReadme } from './gallery-md.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const BASE = process.env.BASE || 'http://127.0.0.1:5178'
const OUT = join(repoRoot, 'docs', 'visual-tests')
const TMP = join(repoRoot, '.tmp', 'webp-frames')
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
const only = onlyArg ? new Set(onlyArg.split(',')) : null

const FPS = 10
const FRAME_MS = Math.round(1000 / FPS)
const TRIM = 2 // discard the first N frames (settle past the t=0 pose)
const VP = { body: { width: 400, height: 640 }, face: { width: 420, height: 420 } }

// Avatars under test — male + female, GLB + VRM.
const GREG = { name: 'Greg', sex: 'M', rig: 'GLB' } // default male GLB
const CARA = { name: 'Cara', sex: 'F', rig: 'GLB' } // female GLB
const BRAD = { name: 'Brad', sex: 'M', rig: 'GLB' } // male GLB
const ERIK = { name: 'Erik', sex: 'M', rig: 'VRM' } // male VRM
const YUKI = { name: 'Yuki', sex: 'F', rig: 'VRM' } // female VRM (expressive face)
const KENJI = { name: 'Kenji', sex: 'M', rig: 'VRM' } // male VRM (expressive face)

// Full GLB catalog (Greg = reference); a representative subset for the other avatars.
// `idle-stable` (the sub-perceptible default idle) and `walking` (root motion walks the
// avatar out of the fixed frame) are intentionally excluded from the fixed-camera gallery.
const GLB_FULL = {
  idle: ['basic-idle'],
  communication: ['Talking', 'Talking-1', 'Talking-2', 'Telling-A-Secret'],
  gesture: ['Waving', 'Arm-Gesture', 'Head-Gesture', 'Happy-Hand-Gesture', 'Hands-Forward-Gesture',
    'Whatever-Gesture', 'Clapping', 'Pointing-Forward', 'Salute', 'Shoulder-Rubbing', 'Agreeing'],
  expression: ['Surprised', 'Reacting', 'Thinking', 'Looking', 'Looking-1', 'Looking-Behind',
    'Shaking-It-Off', 'Cocky-Head-Turn'],
  action: ['dance', 'dance-action', 'bow', 'throw', 'Praying', 'Spin-In-Place', 'Crazy-Gesture']
}
const GLB_SUBSET = {
  idle: ['basic-idle'],
  communication: ['Talking'],
  gesture: ['Waving', 'Clapping', 'Pointing-Forward', 'Agreeing'],
  expression: ['Thinking', 'Surprised'],
  action: ['dance', 'bow']
}
// Female GLB avatars: feminine (F_, female-actor mocap) idle/talking/dance + shared gestures.
const GLB_FEM_SUBSET = {
  feminine: ['F_Standing_Idle_001', 'F_Standing_Idle_Variations_002', 'F_Talking_Variations_001',
    'F_Talking_Variations_002', 'F_Dances_001', 'F_Dances_005', 'F_Dances_006'],
  gesture: ['Waving', 'Clapping', 'Pointing-Forward', 'Agreeing'],
  expression: ['Thinking', 'Surprised'],
  action: ['bow']
}
const VRMA = { vrma: ['idle_loop', 'surprise_greet', 'pose', 'victory_sign', 'finger_gun', 'dance_move'] }
// Emotions with distinct VRM expression presets (happy/angry/sad/surprised/relaxed via mapEmotionToVRM).
const GLB_EMOS = ['happy', 'sad', 'angry', 'fear', 'love']
const VRM_EMOS = ['happy', 'sad', 'angry', 'fear', 'sleep']

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function encodeWebp(frames, outFile) {
  const args = ['-loop', '0', '-lossy', '-q', '52', '-m', '6', '-d', String(FRAME_MS), ...frames, '-o', outFile]
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
  await page.waitForTimeout(700)
  await page.waitForFunction(
    () => {
      const diagnostics = window.__harness?.debugActions?.()
      const current = String(diagnostics?.current ?? '').toLowerCase()
      return Boolean(diagnostics && !diagnostics.transitioning && diagnostics.queue === 0 && current.includes('idle'))
    },
    null,
    { timeout: 15000, polling: 100 }
  )
  return { ctx, page }
}

/**
 * Capture frames → animated WebP. Two modes:
 *  - free-run (default): sample at ~FPS for `ms`, letting the live scene animate.
 *  - driven (opts.onFrame + opts.frameCount): call onFrame(i) to set a deliberate pose
 *    per frame, then grab exactly that many — one pose per encoded frame (no page-timer
 *    front-loading, no duplicate-frame merge collapsing the motion).
 */
async function grab(page, name, ms, { trim = TRIM, onFrame = null, frameCount = null } = {}) {
  const dir = join(TMP, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const frames = []
  const count = frameCount ?? Math.round(ms / FRAME_MS) + trim
  for (let i = 0; i < count; i++) {
    if (onFrame) await onFrame(i)
    const t0 = Date.now()
    const f = join(dir, `f_${String(i).padStart(3, '0')}.png`)
    await page.screenshot({ path: f })
    if (i >= trim) frames.push(f) // discard the first `trim` frames (t=0 settle)
    if (!onFrame) {
      const el = Date.now() - t0
      if (el < FRAME_MS) await page.waitForTimeout(FRAME_MS - el)
    }
  }
  const out = join(OUT, `${name}.webp`)
  encodeWebp(frames, out)
  rmSync(dir, { recursive: true, force: true })
  return { out, sizeKb: existsSync(out) ? Math.round(statSync(out).size / 1024) : 0 }
}

function record(results, o) {
  results.push(o)
  console.log(o.ok ? `ok (${o.sizeKb} KB)` : `FAIL — ${o.error}`)
}

// ---- Body animations: isolated single-clip playback, no seam ----
async function captureBody(browser, av, catalog, results) {
  const { ctx, page } = await loadAvatar(browser, av.name, 'body')
  for (const [group, clips] of Object.entries(catalog)) {
    for (const clip of clips) {
      const name = `${slug(av.name)}-${slug(clip)}`
      process.stdout.write(`▶ ${name} … `)
      try {
        const dur = await page.evaluate((c) => window.__harness.captureClip(c), clip)
        if (!dur) throw new Error('no loaded action')
        await page.waitForTimeout(350) // move past the t=0 pose
        const windowMs = Math.min(Math.max(dur - 500, 700), 2600)
        const { sizeKb } = await grab(page, name, windowMs)
        record(results, { name, file: `${name}.webp`, page: 'animations', avatar: av.name, sex: av.sex, rig: av.rig, group, clip, ok: true, sizeKb, caption: `${clip} — ${av.name} (${av.sex}·${av.rig})` })
      } catch (e) {
        record(results, { name, file: `${name}.webp`, page: 'animations', avatar: av.name, group, clip, ok: false, error: String(e.message) })
      }
    }
  }
  await ctx.close()
}

// ---- Faces: lip-sync + emotes over a stable idle. GLB rigs use ARKit morphs; VRM rigs
// use the expressionManager (only VRMs with real expression binds — e.g. Yuki, Kenji — show
// clearly; Erik-style imports with empty binds stay in the body page only). ----
async function captureFaces(browser, av, results, emos = GLB_EMOS) {
  const specs = [
    { suffix: 'lipsync', group: 'lipsync', prep: `window.__harness.speak("Hello, I'm your companion. How can I help you today?")`, ms: 3000, cap: 'Lip-sync' },
    ...emos.map((e) => ({ suffix: `emote-${e}`, group: 'emote', prep: `window.__harness.setEmote('${e}')`, ms: 2400, cap: `Emote: ${e}` }))
  ]
  const { ctx, page } = await loadAvatar(browser, av.name, 'face')
  for (const s of specs) {
    const name = `${slug(av.name)}-${s.suffix}`
    process.stdout.write(`▶ ${name} … `)
    try {
      await page.evaluate(() => window.__harness.captureClip('basic-idle') || window.__harness.captureClip('F_Standing_Idle_001') || window.__harness.captureClip('idle_loop'))
      await page.waitForTimeout(400)
      await page.evaluate((code) => new Function(code)(), s.prep)
      const { sizeKb } = await grab(page, name, s.ms, { trim: 0 })
      record(results, { name, file: `${name}.webp`, page: 'faces', avatar: av.name, sex: av.sex, rig: av.rig, group: s.group, ok: true, sizeKb, caption: `${s.cap} — ${av.name} (${av.sex}·${av.rig})` })
    } catch (e) {
      record(results, { name, file: `${name}.webp`, page: 'faces', avatar: av.name, group: s.group, ok: false, error: String(e.message) })
    }
  }
  await ctx.close()
}

// ---- Eyes: deterministic gaze + blink over a still idle (ARKit eye morphs, services off
// so the auto blink/gaze loop can't overwrite the scripted poses). ----
async function captureEyes(browser, av, results) {
  const name = `${slug(av.name)}-eyes`
  process.stdout.write(`▶ ${name} … `)
  try {
    const { ctx, page } = await loadAvatar(browser, av.name, 'face')
    await page.evaluate(() => window.__harness.captureClip('basic-idle') || window.__harness.captureClip('F_Standing_Idle_001') || window.__harness.captureClip('idle_loop'))
    // Disable ALL services including dynamics so our direct setMorph calls
    // are not overwritten by the AvatarDynamicsEngine each frame.
    await page.evaluate(() => window.__harness.setServices({ emotes: false, visemes: false, dynamics: false }))
    await page.waitForTimeout(400)
    // One deliberate eye pose per encoded frame (2-frame holds; 3-frame smooth blinks).
    const C = {}
    const L = { eyeLookOutLeft: 1, eyeLookInRight: 1 }
    const R = { eyeLookInLeft: 1, eyeLookOutRight: 1 }
    const U = { eyeLookUpLeft: 1, eyeLookUpRight: 1 }
    const D = { eyeLookDownLeft: 1, eyeLookDownRight: 1 }
    const W = { eyeWideLeft: 1, eyeWideRight: 1 }
    const B = { eyeBlinkLeft: 1, eyeBlinkRight: 1 }
    const H = { eyeBlinkLeft: 0.5, eyeBlinkRight: 0.5 }
    const seq = [C, C, L, L, L, H, B, H, R, R, R, U, U, H, B, H, D, D, W, W, H, B, H, C, C, C]
    const { sizeKb } = await grab(page, name, 0, {
      trim: 0,
      frameCount: seq.length,
      onFrame: async (i) =>
        page.evaluate((m) => {
          const h = window.__harness
          h.clearMorphs()
          if (Object.keys(m).length) h.setMorph(m)
        }, seq[i])
    })
    record(results, { name, file: `${name}.webp`, page: 'eyes', avatar: av.name, sex: av.sex, rig: av.rig, group: 'eyes', ok: true, sizeKb, caption: `Eye movement — gaze L/R/up/down + blink (${av.name})` })
    await ctx.close()
  } catch (e) {
    record(results, { name, file: `${name}.webp`, page: 'eyes', avatar: av.name, group: 'eyes', ok: false, error: String(e.message) })
  }
}

// ---- Blends: crossfade combinations driven through the real mixer ----
async function captureBlends(browser, results) {
  const combos = [
    { name: 'blend-idle-wave-idle', clips: `h.playCategory('idle',{loopCount:1e9,blendTime:150});setTimeout(()=>h.playAnimation('Waving',{loopCount:1,blendTime:700}),600);setTimeout(()=>h.playCategory('idle',{loopCount:1e9,blendTime:800}),2400)`, ms: 4000, cap: 'idle → wave → idle' },
    { name: 'blend-gesture-to-action', clips: `h.playAnimation('Clapping',{loopCount:1,blendTime:300});setTimeout(()=>h.playAnimation('bow',{loopCount:1,blendTime:600}),1400)`, ms: 3600, cap: 'clap → bow (gesture→action)' },
    { name: 'blend-idle-think-talk', clips: `h.playAnimation('Thinking',{loopCount:1,blendTime:400});setTimeout(()=>h.playAnimation('Talking',{loopCount:1,blendTime:500}),1600)`, ms: 3600, cap: 'think → talk' },
    { name: 'blend-dance-to-idle', clips: `h.playAnimation('dance',{loopCount:1,blendTime:400});setTimeout(()=>h.playCategory('idle',{loopCount:1e9,blendTime:900}),1800)`, ms: 3600, cap: 'dance → idle' }
  ]
  const femCombos = [
    { name: 'blend-fem-idle-dance-idle', clips: `h.playAnimation('F_Standing_Idle_001',{loopCount:1e9,blendTime:150});setTimeout(()=>h.playAnimation('F_Dances_001',{loopCount:1,blendTime:600}),600);setTimeout(()=>h.playAnimation('F_Standing_Idle_001',{loopCount:1e9,blendTime:800}),2600)`, ms: 4200, cap: 'feminine idle → dance → idle' }
  ]
  for (const [avatar, list] of [['Greg', combos], ['Cara', femCombos]]) {
    const { ctx, page } = await loadAvatar(browser, avatar, 'body')
    const pre = slug(avatar)
    for (const c of list) {
      process.stdout.write(`▶ ${pre}-${c.name} … `)
      try {
        await page.evaluate((code) => { const h = window.__harness; new Function('h', code)(h) }, c.clips)
        // Give the mixer time to fully settle past the t=0 bind pose before capturing.
        await page.waitForTimeout(600)
        const { sizeKb } = await grab(page, `${pre}-${c.name}`, c.ms, { trim: 1 })
        record(results, { name: `${pre}-${c.name}`, file: `${pre}-${c.name}.webp`, page: 'blends', avatar, group: 'blend', ok: true, sizeKb, caption: `${c.cap} (${avatar})` })
      } catch (e) {
        record(results, { name: `${pre}-${c.name}`, file: `${pre}-${c.name}.webp`, page: 'blends', ok: false, error: String(e.message) })
      }
    }
    await ctx.close()
  }
}

/**
 * Run a capture stage in its own Chromium instance. Long runs (~100 headless-WebGL
 * captures) can crash a shared browser process partway through — a fresh browser per
 * stage bounds the blast radius, and a crashed stage doesn't take the rest down.
 */
async function stage(label, fn, results) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-gpu-rasterization',
      '--enable-webgl',
      '--allow-insecure-localhost'
    ]
  })
  try {
    await fn(browser)
  } catch (e) {
    console.error(`\n[stage ${label}] crashed: ${e.message}`)
    results.push({ name: `stage-${label}`, page: label, ok: false, error: `stage crashed: ${e.message}` })
  } finally {
    await browser.close().catch(() => {})
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  const results = []
  const want = (p) => !only || only.has(p)

  if (want('animations')) {
    await stage('animations', async (b) => {
      await captureBody(b, GREG, GLB_FULL, results) // full reference catalog (male GLB)
      await captureBody(b, CARA, GLB_FEM_SUBSET, results) // female GLB (feminine motion set)
      await captureBody(b, BRAD, GLB_SUBSET, results) // male GLB
    }, results)
    await stage('animations-vrm', async (b) => {
      await captureBody(b, ERIK, VRMA, results) // male VRM (VRMA)
      await captureBody(b, YUKI, VRMA, results) // female VRM (VRMA)
    }, results)
  }
  if (want('faces')) {
    // Browser-per-avatar: face capture stacks many contexts; keep each isolated.
    await stage('faces-greg', (b) => captureFaces(b, GREG, results, GLB_EMOS), results)
    await stage('faces-cara', (b) => captureFaces(b, CARA, results, GLB_EMOS), results)
    await stage('faces-yuki', (b) => captureFaces(b, YUKI, results, VRM_EMOS), results)
    await stage('faces-kenji', (b) => captureFaces(b, KENJI, results, VRM_EMOS), results)
  }
  if (want('eyes')) {
    await stage('eyes', async (b) => {
      await captureEyes(b, GREG, results)
      await captureEyes(b, CARA, results)
    }, results)
  }
  if (want('blends')) await stage('blends', (b) => captureBlends(b, results), results)

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ generatedWith: 'gen-webp.mjs', fps: FPS, clips: results }, null, 2))
  writeGalleryReadme(OUT)
  const ok = results.filter((r) => r.ok).length
  const kb = results.filter((r) => r.ok).reduce((n, r) => n + r.sizeKb, 0)
  console.log(`\n${ok}/${results.length} clips — ${(kb / 1024).toFixed(1)} MB → docs/visual-tests/ (sub-pages generated)`)
  if (ok < results.length) process.exitCode = 1
}

main()
