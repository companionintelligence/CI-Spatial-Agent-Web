import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { isKillSwitch, precacheFingerprint, publicFileFor, serviceWorkerFiles } from '../../../../scripts/check-pwa.mjs'

// What makes avatar.ci.computer installable, checked against the files that ship: the web
// manifest, the head that points at it, the icons it names, the worker's precache list and
// the response headers. Chrome offers to install an app only when all of that holds, and says
// nothing when it does not, so an edit that quietly breaks it would otherwise go unnoticed.

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const WEB_PUBLIC = join(ROOT, 'apps/web/public')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

interface Manifest {
  id?: string
  name?: string
  short_name?: string
  start_url?: string
  scope?: string
  display?: string
  orientation?: string
  theme_color?: string
  background_color?: string
  icons?: { src: string; sizes: string; type: string; purpose?: string }[]
}

const manifest = JSON.parse(read('apps/web/public/manifest.webmanifest')) as Manifest
// Comments out first: the head carries prose that mentions tags.
const indexHtml = read('apps/web/index.html').replace(/<!--[\s\S]*?-->/g, '')
const swSource = read('apps/web/public/sw.js')
// With the kill switch as public/sw.js the worker has been retired on purpose (docs/DEPLOYMENT.md:
// "To retire it"), and what only the real worker has, an offline page it precaches, a cache name,
// a registration in main.tsx, is no longer required.
const RETIRED = isKillSwitch(swSource)

const tags = (html: string, name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0])
const attr = (tag: string | undefined, name: string) =>
  tag ? (new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1] ?? null) : null
const linkHref = (html: string, rel: string) =>
  attr(
    tags(html, 'link').find((t) => attr(t, 'rel') === rel),
    'href'
  )
const metaContent = (html: string, name: string) =>
  attr(
    tags(html, 'meta').find((t) => attr(t, 'name') === name),
    'content'
  )

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string) {
  const bytes = readFileSync(file)
  if (bytes.length < 24 || bytes.toString('latin1', 1, 4) !== 'PNG') return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

const purposes = (icon: { purpose?: string }) => (icon.purpose ?? 'any').split(/\s+/)

describe('the web manifest', () => {
  it('opens the app in its own window, at the site root, under a stable id', () => {
    expect(manifest.display).toBe('standalone')
    expect(manifest.id).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.start_url?.startsWith(manifest.scope ?? '/')).toBe(true)
  })

  it('names the app, with a short label that is not the name said twice', () => {
    expect(manifest.name).toBe('Avatar Companion')
    expect(manifest.short_name).toBe('Avatar')
    expect(manifest.short_name).not.toBe(manifest.name)
  })

  it('does not lock the orientation: tablets, headsets and desktop windows rotate and resize', () => {
    expect(manifest.orientation).toBeUndefined()
  })

  it('takes both colours from the canon dark background, the token the page itself paints with', () => {
    const tokens = read('packages/core/src/styles/globals.css')
    const teal950 = /--teal-950:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1]

    expect(teal950).toBe('#041620')
    expect(manifest.theme_color).toBe(teal950)
    expect(manifest.background_color).toBe(teal950)
    expect(manifest.theme_color).toBe(metaContent(indexHtml, 'theme-color'))
    expect(read('apps/web/public/offline/offline.css')).toContain(`background: ${teal950}`)
  })

  it('declares 192 and 512 icons for "any" and a 512 maskable one, each the size its file really is', () => {
    const icons = manifest.icons ?? []
    for (const size of [192, 512]) {
      expect(icons.some((i) => i.sizes === `${size}x${size}` && purposes(i).includes('any'))).toBe(true)
    }
    expect(icons.some((i) => i.sizes === '512x512' && purposes(i).includes('maskable'))).toBe(true)

    for (const icon of icons) {
      const file = join(WEB_PUBLIC, icon.src.replace(/^\//, ''))
      expect(existsSync(file), `${icon.src} is not in apps/web/public`).toBe(true)
      expect(icon.type).toBe('image/png')
      expect(pngSize(file), icon.src).toEqual({ width: Number(icon.sizes.split('x')[0]), height: Number(icon.sizes.split('x')[1]) })
    }
  })
})

describe('the page head', () => {
  it('links the manifest', () => {
    expect(linkHref(indexHtml, 'manifest')).toBe('/manifest.webmanifest')
    expect(existsSync(join(WEB_PUBLIC, 'manifest.webmanifest'))).toBe(true)
  })

  it('has a 180x180 apple-touch-icon that is a real PNG in public/', () => {
    const href = linkHref(indexHtml, 'apple-touch-icon')

    expect(href).toBeTruthy()
    expect(pngSize(join(WEB_PUBLIC, (href ?? '').replace(/^\//, '')))).toEqual({ width: 180, height: 180 })
  })

  it('labels the home-screen icon with the short name, since iOS would otherwise use the long <title>', () => {
    expect(metaContent(indexHtml, 'apple-mobile-web-app-title')).toBe(manifest.short_name)
    expect(metaContent(indexHtml, 'mobile-web-app-capable')).toBe('yes')
    expect(metaContent(indexHtml, 'apple-mobile-web-app-capable')).toBe('yes')
  })

  it('keeps the viewport zoomable (installed apps are used by people who need to zoom, too)', () => {
    expect(metaContent(indexHtml, 'viewport')).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/)
  })
})

describe.skipIf(RETIRED)('the service worker files', () => {
  const { offline, precache } = serviceWorkerFiles(swSource)
  const cacheName = /const CACHE = '([^']+)'/.exec(swSource)?.[1] ?? null
  // The activate handler deletes the older caches by this prefix; the name must be built from the same one.
  const cachePrefix = /key\.startsWith\('([^']+)'\)/.exec(swSource)?.[1] ?? null

  it('precaches the offline page, and every file it names is in public/', () => {
    expect(offline).toBe('/offline/')
    expect(precache).toContain(offline)
    for (const url of precache) {
      expect(existsSync(join(WEB_PUBLIC, publicFileFor(url))), `${url} is not in apps/web/public`).toBe(true)
    }
  })

  it('caches nothing of the app: the precache list is the offline page and the two files it needs', () => {
    expect(precache).toEqual(['/offline/', '/offline/offline.css', '/offline/mark.svg'])
  })

  // A browser fetches the precache again only when sw.js itself changes, and the offline page is not
  // fingerprinted in its URL. Naming the cache after the files makes "edited a precached file, forgot
  // sw.js" a failing test instead of a page that never reaches returning visitors.
  it('names its cache after the files it precaches, so an edit that leaves sw.js alone fails here', () => {
    expect(cachePrefix).toBe('ci-avatar-offline-')
    expect(cacheName).toMatch(/^ci-avatar-offline-[0-9a-f]{12}$/)

    const expected = `${cachePrefix}${precacheFingerprint(WEB_PUBLIC, precache)}`
    expect(cacheName, `a precached file changed: set CACHE in apps/web/public/sw.js to '${expected}'`).toBe(expected)
  })

  // The bytes are hashed with every CR removed: git on Windows (core.autocrlf=true) and editors that save
  // CRLF would otherwise ask for a different name than the one committed, and the failure above would
  // print a value that is wrong on the machine that has to paste it.
  it('gives a CRLF copy of the precached files the same name as the LF files, and still changes it when a file changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'avatar-precache-'))
    try {
      for (const url of precache) {
        const source = readFileSync(join(WEB_PUBLIC, publicFileFor(url)), 'utf8')
        const target = join(root, publicFileFor(url))
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, source.replace(/\r?\n/g, '\r\n'))
      }
      expect(readFileSync(join(root, 'offline/index.html'), 'utf8')).toContain('\r\n')

      // Compared with the name the files in the repo ask for, not with the committed one: when CACHE is
      // stale only the test above fails, and it is the one that prints the name to paste.
      const lf = `${cachePrefix}${precacheFingerprint(WEB_PUBLIC, precache)}`
      expect(`${cachePrefix}${precacheFingerprint(root, precache)}`).toBe(lf)

      appendFileSync(join(root, 'offline/offline.css'), '/* edited */\r\n')
      expect(`${cachePrefix}${precacheFingerprint(root, precache)}`).not.toBe(lf)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('has an offline page whose source needs nothing outside the precache list and carries no script of its own', () => {
    const page = read('apps/web/public/offline/index.html')
    const urls = [...page.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1])

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(precache, `the offline page loads ${url}, which is not precached`).toContain(url)
    expect(page).not.toMatch(/<script\b/i)
    expect(metaContent(page, 'robots')).toBe('noindex')
  })
})

describe('the registration', () => {
  it('is never a script in the page, and is a bare call in src/main.tsx until the worker is retired', () => {
    expect(indexHtml).not.toMatch(/serviceWorker/)
    // Retiring the worker deletes the call and its import (docs/DEPLOYMENT.md), and leaving them in is harmless.
    if (RETIRED) return

    const main = read('apps/web/src/main.tsx')
    expect(main).toContain("import { registerServiceWorker } from './lib/registerServiceWorker'")
    expect(main).toMatch(/^registerServiceWorker\(\)$/m)
  })
})

// The check in scripts/check-pwa.mjs runs inside `vite build`. These pin the text that has it reach every
// way the app is built; the container image and the Pages build are the two a test here cannot run.
describe('the build check', () => {
  const viteConfig = read('apps/web/vite.config.ts')

  it('runs inside vite build, which every build path goes through', () => {
    expect(viteConfig).toContain("from '../../scripts/check-pwa.mjs'")
    expect(viteConfig).toMatch(/apply: 'build'/)
    expect(viteConfig).toMatch(/closeBundle\(\) \{[^}]*assertPwa\(/)
    // Storybook builds through this config too, and its output is a component gallery with no worker in it.
    expect(viteConfig).toContain("plugin.name.startsWith('storybook:')")

    const deno = JSON.parse(read('apps/web/deno.json')) as { tasks: Record<string, string> }
    expect(deno.tasks.build, 'the container build (deno task --cwd apps/web build) must run vite build').toContain('npm:vite build')
    const pnpm = JSON.parse(read('apps/web/package.json')) as { scripts: Record<string, string> }
    expect(pnpm.scripts.build).toContain('vite build')
  })

  it('has the container build copy scripts/ into its build context before it builds', () => {
    const dockerfile = read('Dockerfile')
    const copy = dockerfile.indexOf('\nCOPY . .\n')
    const build = dockerfile.indexOf('deno task --cwd apps/web build')
    expect(copy).toBeGreaterThan(-1)
    expect(build).toBeGreaterThan(copy)

    const ignored = read('.dockerignore')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
    expect(ignored.filter((line) => /^\/?(scripts|\*\*\/scripts|\*\.mjs|\*\*\/\*\.mjs)(\/.*)?$/.test(line))).toEqual([])
  })
})

describe('response headers', () => {
  const headers = read('apps/web/public/_headers')

  it('keeps the worker script out of shared caches', () => {
    expect(headers).toMatch(/^\/sw\.js\s*\n\s+Cache-Control:\s*no-cache\b/m)
    expect(read('nginx/default.conf')).toMatch(/location = \/sw\.js \{[^}]*Cache-Control "no-cache"/)
  })

  it('still never caches the runtime config that points the static deploy at its backend', () => {
    expect(headers).toMatch(/^\/config\.json\s*\n\s+Cache-Control:\s*no-store\b/m)
  })

  // Pages serves .webmanifest as application/manifest+json on its own. Stock nginx's mime.types has no
  // entry for the extension, so the container needs the type spelled out; default_type only applies to an
  // extension the table does not know, and a `types {}` block would replace the whole inherited table.
  it('has the container serve the manifest as application/manifest+json, without replacing the types table', () => {
    const nginx = read('nginx/default.conf')

    expect(nginx).toMatch(/location = \/manifest\.webmanifest \{[^}]*default_type application\/manifest\+json;/)
    expect(nginx).not.toMatch(/^\s*types\s*\{/m)
  })
})

describe('the Vision Pro manifest', () => {
  it('has the short name "Avatar", not the doubled "Avatar Avatar"', () => {
    const visionPro = JSON.parse(read('apps/vision-pro/public/manifest.json')) as Manifest

    expect(visionPro.name).toBe('Avatar Companion')
    expect(visionPro.short_name).toBe('Avatar')
  })
})
