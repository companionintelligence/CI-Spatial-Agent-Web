#!/usr/bin/env node
/**
 * pack-assets.mjs — package the shared avatar media into an app's public dir.
 *
 * Single source of truth: /assets/{avatars,animations} at the repo root. Each app
 * (apps/web, apps/vision-pro) keeps NO committed copy — its public/assets/{avatars,
 * animations} are gitignored and regenerated here on `predev` / `prebuild`, so the
 * marketplace container build (`pnpm --filter @ci-avatar/web build`) always ships the
 * full, current avatar set with zero duplication or drift across apps.
 *
 * It is also the packaging GATE: every avatar referenced by AvatarOptions.ts must
 * resolve to a real file under /assets/avatars, or the build fails here (before Vite)
 * rather than shipping an image whose catalog 404s at runtime.
 *
 * Usage:
 *   node scripts/pack-assets.mjs [web] [vision-pro] ...   # default: all apps
 */
import { existsSync, rmSync, cpSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const canonical = join(repoRoot, 'assets')

// Media subtrees that live in the shared source and get packed into each app.
const MEDIA = ['avatars', 'animations']
// URL-path prefix -> canonical subdir (AvatarOptions paths are absolute URLs).
const URL_PREFIX = '/assets/'

// App public dirs. Accept app names on argv; default to every app with a public/.
const APP_DIRS = { web: 'apps/web', 'vision-pro': 'apps/vision-pro' }
const requested = process.argv.slice(2)
const apps = (requested.length ? requested : Object.keys(APP_DIRS)).map((name) => {
  const rel = APP_DIRS[name] ?? `apps/${name}`
  return { name, publicAssets: join(repoRoot, rel, 'public', 'assets') }
})

function fail(msg) {
  console.error(`\n[pack-assets] ERROR: ${msg}\n`)
  process.exit(1)
}

// --- 0. sanity: canonical source exists ---
for (const m of MEDIA) {
  if (!existsSync(join(canonical, m))) fail(`missing canonical source: assets/${m}/`)
}

// --- 1. GATE: every AvatarOptions.ts avatar must exist in the canonical source ---
const avatarOptionsPath = join(
  repoRoot,
  'packages/core/src/components/scene/avatar/AvatarOptions.ts'
)
const src = readFileSync(avatarOptionsPath, 'utf8')
// Pull every '/assets/avatars/...' string literal (single or double quoted).
const referenced = [...src.matchAll(/['"](\/assets\/avatars\/[^'"]+)['"]/g)].map((m) => m[1])
const uniqueRefs = [...new Set(referenced)]

const missing = uniqueRefs.filter((url) => !existsSync(join(canonical, url.slice(URL_PREFIX.length))))
if (missing.length) {
  fail(
    `AvatarOptions references ${missing.length} avatar(s) with no file under assets/avatars:\n` +
      missing.map((u) => `    - ${u}`).join('\n') +
      `\n  Add the file to assets/avatars/ or remove the AvatarOptions entry.`
  )
}

// --- 2. orphan report (present in source but never referenced) — warn only ---
function listFiles(dir, base = dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(p, base))
    else out.push('/assets/avatars/' + relative(base, p).split('\\').join('/'))
  }
  return out
}
const onDisk = listFiles(join(canonical, 'avatars'))
const orphans = onDisk.filter((u) => !uniqueRefs.includes(u))
if (orphans.length) {
  console.warn(
    `[pack-assets] note: ${orphans.length} avatar file(s) in assets/avatars not referenced by ` +
      `AvatarOptions (shipped but unselectable): ${orphans.map((o) => o.split('/').pop()).join(', ')}`
  )
}

// --- 3. sync canonical -> each app public (clean replace, no drift) ---
let bytes = 0
const sizeOf = (dir) =>
  listFilesRaw(dir).reduce((n, f) => n + statSync(f).size, 0)
function listFilesRaw(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...listFilesRaw(p))
    else out.push(p)
  }
  return out
}

const perApp = MEDIA.reduce((n, m) => n + sizeOf(join(canonical, m)), 0)
for (const app of apps) {
  for (const m of MEDIA) {
    const from = join(canonical, m)
    const to = join(app.publicAssets, m)
    rmSync(to, { recursive: true, force: true })
    cpSync(from, to, { recursive: true })
  }
}
bytes = perApp

const mb = (bytes / 1024 / 1024).toFixed(0)
console.log(
  `[pack-assets] packed ${uniqueRefs.length} catalog avatars (+ animations) into ` +
    `${apps.map((a) => a.name).join(', ')} — ${mb} MB/app, single source: assets/`
)
