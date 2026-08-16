#!/usr/bin/env node
/**
 * generate-avatar-video.mjs — Automated visual & video capture suite for 3D avatar animations.
 *
 * Drives the Avatar Harness (/harness.html) via Playwright to record:
 *  1. High-resolution reference stills (PNG) across framing shots (body, upper, face).
 *  2. Smooth animated video clips (WebM / MP4) for idle, communication, gestures, emotes, and lip-sync.
 *  3. Interactive HTML review dashboard (docs/visual-tests/index.html) for visual inspection.
 *
 * Usage:
 *   node scripts/generate-avatar-video.mjs [--port=5178] [--only=Greg,Cara,Yuki] [--format=mp4,webm,png] [--fps=30]
 */

import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

// Command-line arguments parsing
const args = process.argv.slice(2)
const getArg = (prefix, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${prefix}=`))
  return hit ? hit.split('=')[1] : fallback
}

const PORT = Number(process.env.CAPTURE_PORT || getArg('port', '5178'))
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`
const ONLY_AVATARS = getArg('only', null) ? getArg('only', '').split(',').map((s) => s.trim()) : ['Greg', 'Cara', 'Yuki', 'Erik']
const FPS = Number(getArg('fps', '30'))
const OUT_DIR = join(repoRoot, 'docs', 'visual-tests')
const SHOTS_DIR = join(OUT_DIR, 'shots')
const VIDEOS_DIR = join(OUT_DIR, 'videos')

// Ensure target directories exist
mkdirSync(SHOTS_DIR, { recursive: true })
mkdirSync(VIDEOS_DIR, { recursive: true })

const TEST_SCENARIOS = [
  { id: 'idle', label: 'Idle Stance & Breathing', type: 'clip', clip: 'basic-idle', durationMs: 2500, shot: 'body' },
  { id: 'talking', label: 'Conversational Talking', type: 'clip', clip: 'Talking', durationMs: 3000, shot: 'upper' },
  { id: 'waving', label: 'Waving Gesture', type: 'clip', clip: 'Waving', durationMs: 2500, shot: 'upper' },
  { id: 'dance', label: 'Dance Action', type: 'clip', clip: 'dance', durationMs: 3500, shot: 'body' },
  { id: 'emote-happy', label: 'Happy Emotion & Micro-Expression', type: 'emote', emotion: 'happy', durationMs: 2000, shot: 'face' },
  { id: 'emote-surprised', label: 'Surprised Reaction', type: 'emote', emotion: 'surprised', durationMs: 2000, shot: 'face' },
  { id: 'lipsync-speech', label: 'Phonetic Speech & Audio Lip-Sync', type: 'speak', text: 'Hello! I am your spatial companion intelligence. Ready to explore with you.', durationMs: 3500, shot: 'face' }
]

function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  return r.status === 0
}

function convertWebmToMp4(webmPath, mp4Path) {
  if (!hasFfmpeg()) return false
  const args = [
    '-y',
    '-i', webmPath,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '22',
    mp4Path
  ]
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' })
  return r.status === 0
}

/** In-browser canvas recorder via MediaRecorder API */
async function startCanvasRecording(page, fps = 30) {
  return await page.evaluate((fps) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return false

    const stream = canvas.captureStream(fps)
    const chunks = []
    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8'
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm'
    }

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    ;(window).__currentRecorder = recorder
    ;(window).__recordedChunks = chunks
    recorder.start(100)
    return true
  }, fps)
}

async function stopCanvasRecording(page) {
  return await page.evaluate(async () => {
    const recorder = (window).__currentRecorder
    const chunks = (window).__recordedChunks
    if (!recorder || recorder.state === 'inactive') return null

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result).split(',')[1]
          resolve({ base64, mimeType: recorder.mimeType })
        }
        reader.readAsDataURL(blob)
      }
      recorder.stop()
    })
  })
}

async function recordAvatarScenario(page, avatarName, scenario) {
  console.log(`  🎬 [${avatarName}] Running: ${scenario.label} (${scenario.id})`)

  // 1. Switch framing shot
  await page.evaluate((shot) => {
    window.__harness?.setShot(shot)
  }, scenario.shot)
  await page.waitForTimeout(300)

  // 2. Start recording canvas stream
  await startCanvasRecording(page, FPS)

  // 3. Trigger action
  if (scenario.type === 'clip') {
    await page.evaluate((clip) => {
      window.__harness?.playAnimation(clip, { loopCount: 2, blendTime: 300 })
    }, scenario.clip)
  } else if (scenario.type === 'emote') {
    await page.evaluate((emotion) => {
      window.__harness?.setEmote(emotion, 3000)
    }, scenario.emotion)
  } else if (scenario.type === 'speak') {
    await page.evaluate((text) => {
      window.__harness?.speak(text)
    }, scenario.text)
  }

  // 4. Capture reference still midpoint
  await page.waitForTimeout(Math.round(scenario.durationMs / 2))
  const canvasElement = page.locator('canvas').first()
  const stillFileName = `${avatarName.toLowerCase()}-${scenario.id}.png`
  const stillPath = join(SHOTS_DIR, stillFileName)
  await canvasElement.screenshot({ path: stillPath })

  // 5. Complete recording duration
  await page.waitForTimeout(Math.round(scenario.durationMs / 2))
  const recordResult = await stopCanvasRecording(page)

  let videoFileName = null
  let mp4FileName = null

  if (recordResult && recordResult.base64) {
    videoFileName = `${avatarName.toLowerCase()}-${scenario.id}.webm`
    const webmPath = join(VIDEOS_DIR, videoFileName)
    const buffer = Buffer.from(recordResult.base64, 'base64')
    writeFileSync(webmPath, buffer)

    // Convert to MP4 for maximum cross-platform compatibility
    mp4FileName = `${avatarName.toLowerCase()}-${scenario.id}.mp4`
    const mp4Path = join(VIDEOS_DIR, mp4FileName)
    const converted = convertWebmToMp4(webmPath, mp4Path)
    if (!converted) {
      mp4FileName = null
    }
  }

  return {
    scenario,
    stillFile: stillFileName,
    videoFile: mp4FileName || videoFileName,
    webmFile: videoFileName
  }
}

function generateGalleryHtml(resultsByAvatar) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CI Spatial Companion — Avatar Animation & Video Matrix</title>
  <style>
    :root {
      --bg: #070e12;
      --card-bg: rgba(14, 26, 32, 0.85);
      --border: rgba(255, 255, 255, 0.12);
      --accent: #2dd4bf;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 32px 24px;
      line-height: 1.5;
    }
    header {
      max-width: 1300px;
      margin: 0 auto 32px auto;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
    }
    h1 { font-size: 26px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
    h1 span { color: var(--accent); font-size: 14px; background: rgba(45, 212, 191, 0.12); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--accent); }
    p.sub { color: var(--text-muted); font-size: 14px; margin-top: 6px; }
    .avatar-section {
      max-width: 1300px;
      margin: 0 auto 48px auto;
    }
    .avatar-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      font-size: 12px;
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 4px;
      color: var(--text-muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .media-container {
      width: 100%;
      height: 280px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    video, img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .card-body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }
    .card-meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <header>
    <h1>Spatial Companion Avatar Video Matrix <span>Automated Media Suite</span></h1>
    <p class="sub">High-resolution frame captures and video clips across body animations, multi-band FFT audio lip-sync, ARKit blendshapes, and facial dynamics.</p>
  </header>

  ${Object.entries(resultsByAvatar)
    .map(
      ([avatar, items]) => `
    <section class="avatar-section">
      <div class="avatar-title">
        ${avatar}
        <span class="badge">${items.length} Scenarios Captured</span>
      </div>
      <div class="grid">
        ${items
          .map(
            (item) => `
          <div class="card">
            <div class="media-container">
              ${
                item.videoFile
                  ? `<video src="videos/${item.videoFile}" controls autoplay loop muted playsinline poster="shots/${item.stillFile}"></video>`
                  : `<img src="shots/${item.stillFile}" alt="${item.scenario.label}" />`
              }
            </div>
            <div class="card-body">
              <div class="card-title">${item.scenario.label}</div>
              <div class="card-meta">
                <span>Shot: ${item.scenario.shot}</span>
                <span>Duration: ${item.scenario.durationMs}ms</span>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>
  `
    )
    .join('')}
</body>
</html>`

  writeFileSync(join(OUT_DIR, 'index.html'), html, 'utf8')
  console.log(`\n✨ HTML Gallery written to: file://${join(OUT_DIR, 'index.html')}`)
}

async function run() {
  console.log(`=======================================================`)
  console.log(`🚀 Starting Avatar Animation Visual & Video Generator`)
  console.log(`   Base URL: ${BASE_URL}`)
  console.log(`   Avatars: ${ONLY_AVATARS.join(', ')}`)
  console.log(`   Output: ${OUT_DIR}`)
  console.log(`=======================================================\n`)

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

  const resultsByAvatar = {}

  try {
    for (const avatar of ONLY_AVATARS) {
      console.log(`\n👤 Loading Avatar: ${avatar}`)
      const context = await browser.newContext({
        viewport: { width: 720, height: 720 },
        deviceScaleFactor: 1
      })
      const page = await context.newPage()

      page.on('pageerror', (err) => console.warn(`   ⚠️ Page error on ${avatar}: ${err.message}`))

      const url = `${BASE_URL}/harness.html?avatar=${encodeURIComponent(avatar)}&shot=body&bg=dark`
      await page.goto(url, { waitUntil: 'load' })

      // Wait for harness and avatar rig initialization
      await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 30000 })
      await page.waitForFunction(() => window.__avatarLoaded === true, null, { timeout: 45000 })
      await page.waitForTimeout(2000)

      const avatarResults = []
      for (const scenario of TEST_SCENARIOS) {
        const res = await recordAvatarScenario(page, avatar, scenario)
        avatarResults.push(res)
      }

      resultsByAvatar[avatar] = avatarResults
      await context.close()
    }

    generateGalleryHtml(resultsByAvatar)
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error('❌ Error executing avatar media generator:', err)
  process.exit(1)
})
