import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import {
  assertPwa,
  bundleText,
  checkWorkerBuild,
  checkWorkerSource,
  isKillSwitch,
  precacheFingerprint
} from '../../../../scripts/check-pwa.mjs'

// scripts/check-pwa.mjs, which `vite build` runs on the worker and the files it precaches
// (apps/web/vite.config.ts), against small folders written here so that each case changes one thing.
// It is the same code that names the cache in pwa.node.test.ts, so the build and the tests cannot disagree.

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const KILL_SWITCH = readFileSync(join(ROOT, 'docs/service-worker-kill-switch.js'), 'utf8')

const URLS = ['/offline/', '/offline/offline.css', '/offline/mark.svg']
const FILES: Record<string, string> = {
  'offline/index.html': '<h1>offline</h1>\n',
  'offline/offline.css': 'body{}\n',
  'offline/mark.svg': '<svg/>\n'
}
/** A worker of the shape public/sw.js has. */
const worker = (cache: string, precache = "[OFFLINE_URL, '/offline/offline.css', '/offline/mark.svg']") =>
  `const CACHE = '${cache}'\nconst OFFLINE_URL = '/offline/'\nconst PRECACHE = ${precache}\n`
/** The text of a bundle that registers the worker, and of one that does not. */
const REGISTERS = 'navigator.serviceWorker.register("/sw.js",{scope:"/"})'
const DOES_NOT = 'console.log("no worker")'

let dirs: string[] = []
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

/** A folder (public/, or a build output) holding the offline files and a worker that names its cache correctly. */
function folder() {
  const dir = mkdtempSync(join(tmpdir(), 'avatar-pwa-check-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'offline'))
  for (const [file, text] of Object.entries(FILES)) writeFileSync(join(dir, file), text)
  writeFileSync(join(dir, 'sw.js'), worker(`ci-avatar-offline-${precacheFingerprint(dir, URLS)}`))
  return dir
}

describe('checkWorkerSource: apps/web/public', () => {
  it('passes a worker that names its cache after the files it precaches', () => {
    expect(checkWorkerSource(folder())).toEqual([])
  })

  it('a build with no worker', () => {
    const dir = folder()
    rmSync(join(dir, 'sw.js'))
    expect(checkWorkerSource(dir).join('\n')).toContain('apps/web/public/sw.js is missing')
  })

  it('a worker that precaches a file that is not there', () => {
    const dir = folder()
    rmSync(join(dir, 'offline/mark.svg'))
    expect(checkWorkerSource(dir).join('\n')).toContain('precaches /offline/mark.svg, which is not in apps/web/public/')
  })

  // The avatars, the config and the bundles are the app's own files. A cached answer is never revalidated,
  // so a worker that held one of them would keep serving it after a deploy replaced it.
  it('a worker that answers for a file the app itself requests', () => {
    const dir = folder()
    mkdirSync(join(dir, 'icons'))
    writeFileSync(join(dir, 'icons/icon-192.png'), 'png')
    writeFileSync(join(dir, 'sw.js'), worker('ci-avatar-offline-000000000000', "[OFFLINE_URL, '/offline/offline.css', '/icons/icon-192.png']"))
    expect(checkWorkerSource(dir).join('\n')).toContain('precaches /icons/icon-192.png; the worker may answer only for files under /offline/')
  })

  it('a worker whose offline page is not in its precache list', () => {
    const dir = folder()
    writeFileSync(join(dir, 'sw.js'), worker('ci-avatar-offline-000000000000', "['/offline/offline.css', '/offline/mark.svg']"))
    expect(checkWorkerSource(dir).join('\n')).toContain('PRECACHE does not include /offline/')
  })

  it('a worker with no cache name', () => {
    const dir = folder()
    writeFileSync(join(dir, 'sw.js'), worker('x').replace(/const CACHE = '[^']+'\n/, ''))
    expect(checkWorkerSource(dir).join('\n')).toContain('apps/web/public/sw.js: no CACHE name')
  })

  // A browser fetches the precached files again only when sw.js changes, so the cache name carries a
  // fingerprint of them. The build is what has to notice an edited file, not whoever runs the tests.
  it('a precached file edited without the cache name following it, which names the cache to use', () => {
    const dir = folder()
    appendFileSync(join(dir, 'offline/offline.css'), '/* edited */\n')
    const problems = checkWorkerSource(dir)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^apps\/web\/public\/sw\.js: CACHE is ci-avatar-offline-[0-9a-f]{12}, but the precached files hash to ci-avatar-offline-[0-9a-f]{12}: set CACHE to /)
    expect(problems[0]).toContain(`set CACHE to 'ci-avatar-offline-${precacheFingerprint(dir, URLS)}'`)
  })

  it('a precached file saved with CRLF line endings, which still names the same cache', () => {
    const dir = folder()
    for (const file of Object.keys(FILES)) writeFileSync(join(dir, file), FILES[file].replace(/\n/g, '\r\n'))
    expect(checkWorkerSource(dir)).toEqual([])
  })

  // docs/DEPLOYMENT.md's retirement is: the kill switch replaces public/sw.js, and the registration goes.
  // The build must accept that, or the fix for a bad worker could not be deployed.
  it('the kill switch as the worker, which has no offline page, precache list or cache name', () => {
    const dir = folder()
    writeFileSync(join(dir, 'sw.js'), KILL_SWITCH)
    rmSync(join(dir, 'offline'), { recursive: true })
    expect(checkWorkerSource(dir)).toEqual([])
  })

  it('the files in this repository', () => {
    expect(checkWorkerSource(join(ROOT, 'apps/web/public'))).toEqual([])
  })
})

describe('checkWorkerBuild: the worker in the build output', () => {
  it('passes a worker that was built with its files, under the name they call for, and that the bundle registers', () => {
    expect(checkWorkerBuild(folder(), REGISTERS)).toEqual([])
  })

  it('a bundle that no longer registers the worker', () => {
    expect(checkWorkerBuild(folder(), DOES_NOT).join('\n')).toContain('the JS bundle does not register /sw.js')
  })

  it('a build with no worker at all', () => {
    const dist = folder()
    rmSync(join(dist, 'sw.js'))
    expect(checkWorkerBuild(dist, REGISTERS)).toEqual(['apps/web/dist/sw.js is missing (it belongs in apps/web/public/)'])
  })

  it('a precached file that was not built', () => {
    const dist = folder()
    rmSync(join(dist, 'offline/offline.css'))
    expect(checkWorkerBuild(dist, REGISTERS).join('\n')).toContain('apps/web/dist/sw.js precaches /offline/offline.css, which was not built')
  })

  it('a built file that is not the one the cache name was made for, which names the cache to use', () => {
    const dist = folder()
    appendFileSync(join(dist, 'offline/offline.css'), '/* edited */\n')
    const problems = checkWorkerBuild(dist, REGISTERS).join('\n')

    expect(problems).toMatch(/apps\/web\/dist\/sw\.js: CACHE is ci-avatar-offline-[0-9a-f]{12}, but the built files hash to ci-avatar-offline-[0-9a-f]{12}/)
    expect(problems).toContain(`set CACHE to 'ci-avatar-offline-${precacheFingerprint(dist, URLS)}' in apps/web/public/sw.js`)
  })

  it('the kill switch, which has no offline page, precache list or registration to look for', () => {
    const dist = mkdtempSync(join(tmpdir(), 'avatar-pwa-check-'))
    dirs.push(dist)
    writeFileSync(join(dist, 'sw.js'), KILL_SWITCH)
    expect(checkWorkerBuild(dist, DOES_NOT)).toEqual([])
  })

  // The worker's own comments name its URL, so they would satisfy the registration check if they counted.
  it('looks for the registration in the bundle, not in sw.js', () => {
    const dist = folder()
    mkdirSync(join(dist, 'assets'))
    writeFileSync(join(dist, 'assets/main.js'), DOES_NOT)
    writeFileSync(join(dist, 'sw.js'), `${readFileSync(join(dist, 'sw.js'), 'utf8')}// registered as "/sw.js"\n`)

    expect(bundleText(dist)).toBe(DOES_NOT)
    expect(checkWorkerBuild(dist, bundleText(dist)).join('\n')).toContain('the JS bundle does not register /sw.js')

    writeFileSync(join(dist, 'assets/main.js'), REGISTERS)
    expect(checkWorkerBuild(dist, bundleText(dist))).toEqual([])
  })
})

describe('assertPwa: what the Vite build runs', () => {
  /** A public/ and a build output that agree, the output with the page and the bundle `vite build` writes. */
  function site(js = REGISTERS) {
    const publicDir = folder()
    const dist = folder()
    writeFileSync(join(dist, 'index.html'), '<div id="root"></div>')
    mkdirSync(join(dist, 'assets'))
    writeFileSync(join(dist, 'assets/main.js'), js)
    return { publicDir, dist }
  }

  it('passes when the source and the build output agree', () => {
    expect(() => assertPwa(site())).not.toThrow()
  })

  it('throws one error that lists every problem, in the source and in the build output', () => {
    const { publicDir, dist } = site(DOES_NOT)
    appendFileSync(join(publicDir, 'offline/offline.css'), '/* edited */\n')

    expect(() => assertPwa({ publicDir, dist })).toThrow(
      /^PWA check failed \(scripts\/check-pwa\.mjs\):\n {2}- apps\/web\/public\/sw\.js: CACHE is .*\n {2}- the JS bundle does not register \/sw\.js/
    )
  })

  it('checks only the source when there is no build output yet', () => {
    const { publicDir } = site(DOES_NOT)
    const empty = mkdtempSync(join(tmpdir(), 'avatar-pwa-empty-'))
    dirs.push(empty)

    expect(() => assertPwa({ publicDir })).not.toThrow()
    expect(() => assertPwa({ publicDir, dist: empty })).not.toThrow()
  })
})

describe("precacheFingerprint, the end of the worker's cache name", () => {
  const urls = ['/offline/', '/offline/a.css']

  /** Two small files at the paths `urls` resolves to. */
  const files = (index: string, css: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'avatar-fingerprint-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'offline'))
    writeFileSync(join(dir, 'offline/index.html'), index)
    writeFileSync(join(dir, 'offline/a.css'), css)
    return dir
  }

  // docs/DEPLOYMENT.md gives the same thing as a shell recipe, so a known answer from `shasum` pins it:
  //   { printf '/offline/\0'; printf '<h1>offline</h1>\n'; printf '\0'
  //     printf '/offline/a.css\0'; printf 'body{}\n'; printf '\0'; } | shasum -a 256 | cut -c1-12
  it('is the first 12 hex of a sha256 over each URL and its file, each followed by a NUL', () => {
    expect(precacheFingerprint(files('<h1>offline</h1>\n', 'body{}\n'), urls)).toBe('13f6a746b44b')
  })

  it('ignores carriage returns, so a CRLF checkout of the files names the same cache', () => {
    expect(precacheFingerprint(files('<h1>offline</h1>\r\n', 'body{}\r\n'), urls)).toBe('13f6a746b44b')
  })

  it('moves with a file, with the order of the list and with a URL', () => {
    expect(precacheFingerprint(files('<h1>offline!</h1>\n', 'body{}\n'), urls)).not.toBe('13f6a746b44b')
    expect(precacheFingerprint(files('<h1>offline</h1>\n', 'body{}\n'), [...urls].reverse())).not.toBe('13f6a746b44b')
    expect(precacheFingerprint(files('<h1>offline</h1>\n', 'body{}\n'), urls.slice(0, 1))).not.toBe('13f6a746b44b')
  })
})

describe('isKillSwitch', () => {
  it('is true of the kill switch and false of a worker', () => {
    expect(isKillSwitch(KILL_SWITCH)).toBe(true)
    expect(isKillSwitch(worker('ci-avatar-offline-000000000000'))).toBe(false)
    expect(isKillSwitch(`/* a comment first */\n${KILL_SWITCH}`)).toBe(false)
  })
})
