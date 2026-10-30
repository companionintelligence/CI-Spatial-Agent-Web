import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import { CACHE_PREFIX, isKillSwitch } from '../../../../scripts/check-pwa.mjs'

// docs/service-worker-kill-switch.js is how the worker is retired (docs/DEPLOYMENT.md: "To retire it"). It
// is copied over public/sw.js on the day it is needed, so it is run here every time, not only then.

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const KILL_SWITCH_SOURCE = readFileSync(join(ROOT, 'docs/service-worker-kill-switch.js'), 'utf8')
const SW_SOURCE = readFileSync(join(ROOT, 'apps/web/public/sw.js'), 'utf8')
// With the kill switch as public/sw.js the worker has been retired on purpose.
const RETIRED = isKillSwitch(SW_SOURCE)

type Handler = (event?: { waitUntil: (promise: Promise<unknown>) => void }) => void

function loadKillSwitch(cacheNames: string[]) {
  const handlers: Record<string, Handler> = {}
  const deleted: string[] = []
  const self = {
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler
    },
    skipWaiting: vi.fn(),
    registration: { unregister: vi.fn(() => Promise.resolve(true)) }
  }
  const caches = {
    keys: async () => cacheNames,
    delete: async (name: string) => {
      deleted.push(name)
      return true
    }
  }
  new Function('self', 'caches', KILL_SWITCH_SOURCE)(self, caches)
  return { handlers, deleted, self }
}

describe('docs/service-worker-kill-switch.js', () => {
  it('takes over at once, deletes the offline caches and only those, then unregisters itself', async () => {
    // Fixed names, not the real worker's: when the kill switch IS public/sw.js there is no CACHE to read.
    const offline = ['ci-avatar-offline-aaaaaaaaaaaa', 'ci-avatar-offline-111111111111', 'ci-avatar-offline-v1']
    const { handlers, deleted, self } = loadKillSwitch([...offline, 'some-other-apps-cache', 'webllm/model'])

    handlers.install()
    expect(self.skipWaiting).toHaveBeenCalledTimes(1)

    const pending: Promise<unknown>[] = []
    handlers.activate({ waitUntil: (promise) => pending.push(promise) })
    await Promise.all(pending)

    expect(deleted.sort()).toEqual([...offline].sort())
    expect(self.registration.unregister).toHaveBeenCalledTimes(1)
  })

  it('has no fetch handler, so pages load straight from the network while it is installed', () => {
    const { handlers } = loadKillSwitch([])
    expect(Object.keys(handlers).sort()).toEqual(['activate', 'install'])
  })

  // scripts/check-pwa.mjs and the tests next to this one stop requiring the real worker's offline page,
  // precache list, cache fingerprint and registration when public/sw.js starts with this line.
  it('starts with the line that tells the build and the tests it is the kill switch', () => {
    expect(isKillSwitch(KILL_SWITCH_SOURCE)).toBe(true)
    expect(KILL_SWITCH_SOURCE.split('\n')[0]).toBe('// avatar:service-worker-kill-switch')
  })

  it('deletes by the prefix the worker names its caches with', () => {
    expect(/key\.startsWith\('([^']+)'\)/.exec(KILL_SWITCH_SOURCE)?.[1]).toBe(CACHE_PREFIX)
  })

  it.skipIf(RETIRED)('is not mistaken for the worker, nor the worker for it', () => {
    expect(isKillSwitch(SW_SOURCE)).toBe(false)
    expect(KILL_SWITCH_SOURCE).not.toContain('const CACHE =')
  })
})
