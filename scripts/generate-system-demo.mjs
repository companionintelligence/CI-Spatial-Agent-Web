#!/usr/bin/env node
/**
 * Capture a short, truthful demo of the canonical web companion.
 *
 * The demo runs the real app in deterministic script mode, keeps the activation
 * gate visible, sends two real UI turns, opens Connection truth in Settings, and
 * records both the browser viewport and key stills. It is intentionally silent:
 * the script provider and avatar embodiment are the subject, not a claim that a
 * live CI-Server memory or TTS backend is connected.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5199 node scripts/generate-system-demo.mjs
 */

import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5199'
const OUTPUT_DIR = join(repoRoot, 'docs', 'demo')
const STILLS_DIR = join(OUTPUT_DIR, 'stills')
const TEMP_DIR = join(repoRoot, '.tmp', 'system-demo')
const VIDEO_WEBM = join(OUTPUT_DIR, 'ci-spatial-companion-system-demo.webm')
const VIDEO_MP4 = join(OUTPUT_DIR, 'ci-spatial-companion-system-demo.mp4')
const MANIFEST = join(OUTPUT_DIR, 'manifest.json')

const stills = [
  ['01-onboarding-unverified', 'Fresh onboarding with an unverified session'],
  ['02-demo-ready', 'Explicit deterministic demo mode after skipping voice setup'],
  ['03-first-answer', 'First scripted companion response in the Chat Log'],
  ['04-connection-truth', 'Connection truth surface in Settings'],
  ['05-second-answer', 'Second turn after returning to the companion surface']
]

function runFfmpeg(input, output) {
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-i', input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output],
    { encoding: 'utf8' }
  )
  if (result.status !== 0) {
    throw new Error(`ffmpeg conversion failed: ${result.stderr || result.stdout}`)
  }
}

async function waitForAssistant(page, before, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  const assistants = page.getByText('Assistant', { exact: true })
  while (Date.now() < deadline) {
    if ((await assistants.count()) > before) return
    await page.waitForTimeout(100)
  }
  throw new Error('Timed out waiting for a visible assistant response')
}

async function captureStill(page, slug) {
  const path = join(STILLS_DIR, `${slug}.png`)
  await page.screenshot({ path })
  return path
}

async function sendTurn(page, message) {
  const before = await page.getByText('Assistant', { exact: true }).count()
  const input = page.locator('textarea.chat-input').first()
  await input.fill(message)
  await input.press('Enter')
  await waitForAssistant(page, before)
  await page.waitForTimeout(1800)
}

async function main() {
  rmSync(TEMP_DIR, { recursive: true, force: true })
  mkdirSync(STILLS_DIR, { recursive: true })
  mkdirSync(TEMP_DIR, { recursive: true })

  const errors = []
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-gpu-rasterization',
      '--enable-webgl',
      '--allow-insecure-localhost',
      '--autoplay-policy=no-user-gesture-required'
    ]
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: TEMP_DIR, size: { width: 1280, height: 720 } }
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  try {
    await page.addInitScript(() => {
      localStorage.removeItem('ci_avatar_onboarded')
      localStorage.removeItem('ci_avatar_llm_overrides')
      window.__APP_CONFIG__ = { llm: { llm_provider: 'script' } }
    })
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('canvas', { timeout: 45000 })
    await page.getByText('Start your companion', { exact: true }).waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForTimeout(2200)
    await captureStill(page, '01-onboarding-unverified')

    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await page.waitForTimeout(1200)
    await captureStill(page, '02-demo-ready')

    await sendTurn(page, 'Hello, what can you do?')
    await captureStill(page, '03-first-answer')

    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByText('Connection truth', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(1200)
    await captureStill(page, '04-connection-truth')

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.waitForTimeout(800)
    await sendTurn(page, 'Show me how this demo keeps the session honest.')
    await captureStill(page, '05-second-answer')
  } finally {
    const video = page.video()
    await context.close()
    const rawVideo = video ? await video.path() : null
    if (rawVideo) {
      renameSync(rawVideo, VIDEO_WEBM)
      runFfmpeg(VIDEO_WEBM, VIDEO_MP4)
    }
    await browser.close()
  }

  const manifest = {
    generatedWith: 'scripts/generate-system-demo.mjs',
    baseUrl: BASE_URL,
    mode: 'script / demo-only',
    audio: 'silent capture; no live TTS claim',
    video: {
      webm: VIDEO_WEBM.replace(`${repoRoot}/`, ''),
      mp4: VIDEO_MP4.replace(`${repoRoot}/`, '')
    },
    stills: stills.map(([slug, description]) => ({
      file: `docs/demo/stills/${slug}.png`,
      description
    })),
    pageErrors: errors
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  // Make the result easy to verify from a shell without requiring a media player.
  const mp4Bytes = readFileSync(VIDEO_MP4).length
  console.log(JSON.stringify({ ...manifest, mp4Bytes }, null, 2))
  if (errors.length) {
    throw new Error(`Canonical demo recorded ${errors.length} page/console errors; see ${MANIFEST}`)
  }
}

main().catch((error) => {
  console.error('System demo capture failed:', error)
  process.exit(1)
})
