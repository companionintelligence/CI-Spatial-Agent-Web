/**
 * check-pwa.mjs — the installable app's service worker, checked whenever the app is built.
 *
 * `vite build` runs this (apps/web/vite.config.ts, on closeBundle), so it covers every way the
 * web app is built: `pnpm --filter @ci-avatar/web build`, the Cloudflare Pages build, and the
 * container image's `deno task --cwd apps/web build`. That last one does not run pnpm's
 * pre/post build hooks, which is why this lives in a Vite plugin and not in an npm script.
 *
 * What it requires of apps/web/public/sw.js and of the build output:
 *
 *   - sw.js is there, and every file it precaches exists and lives under /offline/. A cached
 *     answer is never revalidated, so the worker may hold only files the app itself never
 *     requests (the offline page, its stylesheet and its mark).
 *   - Its cache name is `ci-avatar-offline-` plus the fingerprint of those files. A browser
 *     fetches the precached files again only when sw.js itself changes, so a file edited
 *     without the name following it would never reach a returning visitor.
 *   - In the build output: sw.js, the precached files, and a cache name that matches the BUILT
 *     files; and the JavaScript bundle registers '/sw.js' (the page cannot: it has no inline script).
 *
 * The kill switch (docs/service-worker-kill-switch.js) is how the worker is retired. When
 * apps/web/public/sw.js starts with its marker line none of that is required of it: it has
 * no offline page, no precache list and no cache name, and the bundle no longer registers it.
 *
 * Usage: node scripts/check-pwa.mjs [public dir] [dist dir]
 *        (defaults: apps/web/public and apps/web/dist)
 * There is no shebang on purpose: Vite bundles this file into the config it loads, and puts its own
 * code on the first line.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const read = (path) => readFileSync(path, 'utf8')

/** The prefix of every cache name public/sw.js uses: on activation it deletes the older caches that start with it. */
export const CACHE_PREFIX = 'ci-avatar-offline-'

/**
 * public/sw.js can be the kill switch (docs/service-worker-kill-switch.js), which is how the
 * worker is retired, and then it starts with this line.
 */
const KILL_SWITCH_MARKER = /^\/\/ avatar:service-worker-kill-switch\b/

/** Whether this is the text of the kill switch rather than of the real worker. */
export const isKillSwitch = (source) => KILL_SWITCH_MARKER.test(source)

/** What the service worker names: its cache, the offline page and the files it precaches. */
export function serviceWorkerFiles(source) {
  const cache = /const CACHE = '([^']+)'/.exec(source)?.[1] ?? null
  const offline = /const OFFLINE_URL = '([^']+)'/.exec(source)?.[1] ?? null
  const listed = /const PRECACHE = \[([^\]]*)\]/.exec(source)?.[1]
  // Each entry is a quoted path, or OFFLINE_URL by name.
  const precache = (listed ?? '')
    .split(',')
    .map((item) => item.trim())
    .map((item) => (item === 'OFFLINE_URL' ? offline : /^'([^']+)'$/.exec(item)?.[1]))
    .filter(Boolean)
  return { cache, offline, precache }
}

/** Where a URL the worker precaches lives in public/ (or the build output): a path that ends in / is that folder's index.html. */
export const publicFileFor = (url) => (url.endsWith('/') ? `${url.slice(1)}index.html` : url.slice(1))

/**
 * The 12 hex digits that end the worker's cache name: a sha256 over each precached URL and the
 * bytes of its file, in PRECACHE order (URL, NUL, bytes, NUL), with every carriage return (0x0D)
 * removed so that a CRLF checkout hashes like an LF one. `dir` is the folder the URLs resolve
 * in: public/, or the build output.
 */
export function precacheFingerprint(dir, urls) {
  const hash = createHash('sha256')
  for (const url of urls) {
    const bytes = readFileSync(join(dir, publicFileFor(url))).filter((byte) => byte !== 0x0d)
    hash.update(url).update('\0').update(bytes).update('\0')
  }
  return hash.digest('hex').slice(0, 12)
}

/** The cache name those precached files call for, or null when there is nothing (or not everything) to hash. */
export function expectedCache(dir, precache) {
  if (precache.length === 0 || !precache.every((url) => existsSync(join(dir, publicFileFor(url))))) return null
  return `${CACHE_PREFIX}${precacheFingerprint(dir, precache)}`
}

/** A string literal as a bundle writes it: in single, double or backtick quotes. */
const quoted = (s) => new RegExp(`["'\`]${s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["'\`]`)

/**
 * The worker's source: it is there, it precaches only real files under /offline/, and its cache
 * name is the fingerprint of them. Returns the problems, empty when there are none.
 */
export function checkWorkerSource(publicDir) {
  const swPath = join(publicDir, 'sw.js')
  if (!existsSync(swPath)) return ['apps/web/public/sw.js is missing (src/main.tsx registers it through src/lib/registerServiceWorker.ts)']
  const source = read(swPath)
  if (isKillSwitch(source)) return []

  const problems = []
  const { cache, offline, precache } = serviceWorkerFiles(source)
  if (!offline) problems.push('apps/web/public/sw.js: no OFFLINE_URL')
  else if (!precache.includes(offline)) {
    problems.push(`apps/web/public/sw.js: PRECACHE does not include ${offline}, so the offline page would not be there offline`)
  }
  for (const url of precache) {
    if (!existsSync(join(publicDir, publicFileFor(url)))) problems.push(`apps/web/public/sw.js: precaches ${url}, which is not in apps/web/public/`)
    if (!url.startsWith('/offline/')) {
      problems.push(`apps/web/public/sw.js: precaches ${url}; the worker may answer only for files under /offline/, which the app never requests`)
    }
  }

  const expected = expectedCache(publicDir, precache)
  if (!cache) problems.push('apps/web/public/sw.js: no CACHE name')
  else if (expected && cache !== expected) {
    problems.push(
      `apps/web/public/sw.js: CACHE is ${cache}, but the precached files hash to ${expected}: set CACHE to '${expected}' (a browser fetches them again only when sw.js changes)`
    )
  }
  return problems
}

/** The text of the build's JavaScript, without sw.js: its own comments could satisfy the registration check. */
export function bundleText(dist) {
  const worker = join(dist, 'sw.js')
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.js') && path !== worker) files.push(path)
    }
  }
  walk(dist)
  return files.map(read).join('\n')
}

/**
 * The worker in the build output: it is there, everything it precaches was built, its cache name
 * matches the built files, and the bundle registers it. `js` is the bundle's text without sw.js
 * (see bundleText). The kill switch needs none of this.
 */
export function checkWorkerBuild(dist, js) {
  const d = (...parts) => join(dist, ...parts)
  if (!existsSync(d('sw.js'))) return ['apps/web/dist/sw.js is missing (it belongs in apps/web/public/)']
  const source = read(d('sw.js'))
  if (isKillSwitch(source)) return []

  const problems = []
  const { cache, precache } = serviceWorkerFiles(source)
  for (const url of precache) {
    if (!existsSync(d(publicFileFor(url)))) problems.push(`apps/web/dist/sw.js precaches ${url}, which was not built`)
  }
  const expected = expectedCache(dist, precache)
  if (cache && expected && cache !== expected) {
    problems.push(`apps/web/dist/sw.js: CACHE is ${cache}, but the built files hash to ${expected}: set CACHE to '${expected}' in apps/web/public/sw.js`)
  }
  if (!quoted('/sw.js').test(js)) problems.push('the JS bundle does not register /sw.js (src/lib/registerServiceWorker.ts, called from src/main.tsx)')
  return problems
}

/** Throws one Error listing every problem; used by the Vite build. `dist` is optional: without one only the source is checked. */
export function assertPwa({ publicDir, dist = null }) {
  const problems = [...checkWorkerSource(publicDir)]
  if (dist && existsSync(join(dist, 'index.html'))) problems.push(...checkWorkerBuild(dist, bundleText(dist)))
  if (problems.length) {
    throw new Error(`PWA check failed (scripts/check-pwa.mjs):\n  - ${problems.join('\n  - ')}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const publicDir = resolve(process.argv[2] ?? join(root, 'apps/web/public'))
  const dist = resolve(process.argv[3] ?? join(root, 'apps/web/dist'))
  try {
    assertPwa({ publicDir, dist })
    console.log(`OK: the service worker, its cache name and its registration agree${existsSync(join(dist, 'index.html')) ? ' (source and build output)' : ' (source only; no build output at ' + dist + ')'}.`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
