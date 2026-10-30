import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// public/sw.js, run against a fake Cache Storage and a fake fetch. The worker is plain
// script (it is copied to dist/ as it is, never bundled), so it is loaded as text and
// evaluated with the worker globals passed in.

const ORIGIN = 'https://avatar.ci.computer'
const SW_SOURCE = readFileSync(fileURLToPath(new URL('../../public/sw.js', import.meta.url)), 'utf8')

/** The shape of a fetch Request the worker reads; the real constructor refuses `navigate` and relative URLs. */
interface WorkerRequest {
  url: string
  method: string
  mode: string
  cache?: string
}

interface WorkerEvent {
  waitUntil?: (promise: Promise<unknown>) => void
  request?: WorkerRequest
  respondWith?: (promise: Promise<Response>) => void
}

/** A fetch Request as the worker sees it: relative URLs resolve against the worker's origin. */
class FakeRequest implements WorkerRequest {
  url: string
  method = 'GET'
  mode = 'cors'
  cache: string

  constructor(input: string, init: { cache?: string } = {}) {
    this.url = new URL(input, ORIGIN).href
    this.cache = init.cache ?? 'default'
  }
}

/** A cached response that claims to have been redirected, which a real Response cannot be constructed as. */
interface RedirectedResponse {
  redirected: true
  body: string
  status: number
  statusText: string
  headers: Headers
  clone(): RedirectedResponse
}

type StoredResponse = Response | RedirectedResponse

function redirectedResponse(body: string): RedirectedResponse {
  const response: RedirectedResponse = {
    redirected: true,
    body,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'text/html' }),
    clone: () => response
  }
  return response
}

/** The path a cache entry is keyed by: the tests only ever store one entry per path. */
const keyOf = (input: string | { url: string }) => new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname

interface CacheWrite {
  cache: string
  path: string
  via: 'addAll' | 'put' | 'add'
  mode?: string
}

/**
 * Loads public/sw.js with a Cache Storage and a fetch that are fakes, and returns the
 * listeners it registered. `writes` records every write to any cache, so a test can
 * assert what the worker stored and when.
 */
interface LoadOptions {
  /** What the fake origin serves, by path: a body, or a bare status code for an error answer. */
  network?: Record<string, string | number | undefined>
  /** Every fetch fails, as with no connection. */
  offline?: boolean
}

function loadWorker({ network = {}, offline = false }: LoadOptions = {}) {
  const handlers: Record<string, (event: WorkerEvent) => void> = {}
  const stores = new Map<string, Map<string, StoredResponse>>()
  const writes: CacheWrite[] = []

  const fetchFake = vi.fn(async (request: { url: string }): Promise<Response> => {
    if (offline) throw new TypeError('Failed to fetch')
    const body = network[keyOf(request)]
    if (body === undefined) return new Response('not found', { status: 404 })
    return typeof body === 'number' ? new Response('server said no', { status: body }) : new Response(body, { status: 200 })
  })

  const storeFor = (name: string) => {
    let store = stores.get(name)
    if (!store) stores.set(name, (store = new Map()))
    return store
  }

  const caches = {
    open: async (name: string) => {
      const store = storeFor(name)
      return {
        addAll: async (requests: FakeRequest[]) => {
          for (const request of requests) {
            const response = await fetchFake(request)
            if (!response.ok) throw new TypeError(`addAll: ${request.url} answered ${response.status}`)
            writes.push({ cache: name, path: keyOf(request), via: 'addAll', mode: request.cache })
            store.set(keyOf(request), response)
          }
        },
        put: async (request: { url: string }, response: Response) => {
          writes.push({ cache: name, path: keyOf(request), via: 'put' })
          store.set(keyOf(request), response)
        },
        add: async (request: { url: string }) => {
          writes.push({ cache: name, path: keyOf(request), via: 'add' })
        }
      }
    },
    match: async (input: string | { url: string }) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(input))
        if (hit) return hit.clone()
      }
      return undefined
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name)
  }

  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, handler: (event: WorkerEvent) => void) => {
      handlers[type] = handler
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(() => Promise.resolve()) }
  }

  new Function('self', 'caches', 'fetch', 'Request', SW_SOURCE)(self, caches, fetchFake, FakeRequest)

  /** Dispatch a lifecycle event and wait for everything it handed to waitUntil. */
  const lifecycle = async (type: 'install' | 'activate') => {
    const pending: Promise<unknown>[] = []
    handlers[type]({ waitUntil: (promise) => pending.push(promise) })
    await Promise.all(pending)
  }

  /** Dispatch a fetch; resolves to the response the worker supplied, or null if it left the request alone. */
  const dispatch = async (path: string, { method = 'GET', mode = 'cors', origin = ORIGIN } = {}) => {
    const request: WorkerRequest = { url: new URL(path, origin).href, method, mode }
    const result: { supplied: Promise<Response> | null } = { supplied: null }
    handlers.fetch({
      request,
      respondWith: (promise) => {
        result.supplied = promise
      }
    })
    return result.supplied ? await result.supplied : null
  }

  return { self, stores, writes, fetch: fetchFake, lifecycle, dispatch, storeFor }
}

const SITE: Record<string, string> = {
  '/offline/': '<h1>Avatar Companion is offline</h1>',
  '/offline/offline.css': 'body{}',
  '/offline/mark.svg': '<svg/>',
  '/': '<div id="root"></div>',
  '/config.json': '{"llm":{"proxy_url":"https://proxy.example.com"}}',
  '/assets/avatars/humgen-aria-01.vrm': 'vrm-bytes'
}

const PRECACHED = ['/offline/', '/offline/offline.css', '/offline/mark.svg']

describe('public/sw.js: lifecycle', () => {
  it('precaches the offline page, its stylesheet and the mark, straight from the network, and takes over at once', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')

    expect(worker.writes.map((w) => w.path)).toEqual(PRECACHED)
    expect(worker.writes.every((w) => w.mode === 'reload')).toBe(true)
    expect(worker.self.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('fails the install, rather than half-installing, when a precached file cannot be fetched', async () => {
    const worker = loadWorker({ network: { ...SITE, '/offline/offline.css': undefined } })

    await expect(worker.lifecycle('install')).rejects.toThrow(/offline\.css/)
  })

  it('on activation deletes its own older caches, leaves every other cache alone, and claims open pages', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')
    worker.storeFor('ci-avatar-offline-v0')
    worker.storeFor('some-other-apps-cache')

    await worker.lifecycle('activate')

    expect([...worker.stores.keys()].sort()).toEqual(['ci-avatar-offline-v1', 'some-other-apps-cache'])
    expect(worker.self.clients.claim).toHaveBeenCalledTimes(1)
  })
})

describe('public/sw.js: page loads', () => {
  it('is network first: an online page load is the network answer, and is not stored', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')
    const before = worker.writes.length

    const response = await worker.dispatch('/', { mode: 'navigate' })

    expect(await response?.text()).toBe(SITE['/'])
    expect(worker.writes).toHaveLength(before)
  })

  it('shows a server error as the server sent it, not as the offline page', async () => {
    const worker = loadWorker({ network: { ...SITE, '/broken': 503 } })
    await worker.lifecycle('install')

    const response = await worker.dispatch('/broken', { mode: 'navigate' })

    expect(response?.status).toBe(503)
  })

  it('answers a page load with no network with the offline page', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')
    worker.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    for (const path of ['/', '/?utm_source=x', '/somewhere/deep']) {
      const response = await worker.dispatch(path, { mode: 'navigate' })
      expect(response?.status).toBe(200)
      expect(await response?.text()).toBe(SITE['/offline/'])
    }
  })

  it('falls back to the browser error page, not an exception, if the offline page was evicted', async () => {
    const worker = loadWorker({ offline: true })

    const response = await worker.dispatch('/', { mode: 'navigate' })

    expect(response?.type).toBe('error')
  })

  it('never hands a navigation a redirected response, which the browser refuses', async () => {
    const worker = loadWorker({ offline: true })
    worker.storeFor('ci-avatar-offline-v1').set('/offline/', redirectedResponse('offline page'))

    const response = await worker.dispatch('/', { mode: 'navigate' })

    expect(response?.redirected).toBe(false)
    expect(await response?.text()).toBe('offline page')
  })
})

describe('public/sw.js: everything else is left to the browser', () => {
  it('serves the files the offline page needs from the cache, and from the network if they are not there', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')
    worker.fetch.mockClear()

    for (const path of ['/offline/offline.css', '/offline/mark.svg']) {
      const response = await worker.dispatch(path)
      expect(await response?.text()).toBe(SITE[path])
    }
    expect(worker.fetch).not.toHaveBeenCalled()

    worker.stores.clear()
    const response = await worker.dispatch('/offline/offline.css')
    expect(await response?.text()).toBe(SITE['/offline/offline.css'])
    expect(worker.fetch).toHaveBeenCalledTimes(1)
  })

  // The app's weight is in these: the hashed bundles and the packed media share /assets/, and
  // config.json is what points the static deploy at its backend.
  it.each([
    ['the app entry chunk', '/assets/index-CLFXD8p2.js'],
    ['a vendor chunk', '/assets/vendor-three-6JpbBHCS.js'],
    ['an avatar model', '/assets/avatars/humgen-aria-01.vrm'],
    ['an animation clip', '/assets/animations/Waving.glb'],
    ['a VRM animation', '/assets/animations/idle.vrma'],
    ['a scene prop', '/assets/props/chair.glb'],
    ['the directed-responses data', '/assets/directed-responses.json'],
    ['the runtime config that points at the backend', '/config.json'],
    ['the proxy chat route (container)', '/api/chat'],
    ['the proxy speech route (container)', '/api/tts?voice=aria'],
    ['the web manifest', '/manifest.webmanifest'],
    ['an app icon', '/icons/icon-192.png']
  ])('does not intercept %s', async (_label, path) => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')

    expect(await worker.dispatch(path)).toBeNull()
  })

  it('does not intercept the self-hosted proxy the static deploy talks to (another origin), or anything that is not a GET', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')

    expect(await worker.dispatch('/api/chat', { origin: 'https://proxy.example-tunnel.trycloudflare.com' })).toBeNull()
    expect(await worker.dispatch('/offline/', { origin: 'https://example.com', mode: 'navigate' })).toBeNull()
    expect(await worker.dispatch('/', { method: 'POST', mode: 'navigate' })).toBeNull()
    expect(await worker.dispatch('/api/chat', { method: 'POST' })).toBeNull()
    expect(await worker.dispatch('/offline/offline.css', { method: 'POST' })).toBeNull()
  })

  it('writes to a cache only while installing, whatever the page loads afterwards', async () => {
    const worker = loadWorker({ network: SITE })
    await worker.lifecycle('install')
    await worker.lifecycle('activate')
    const afterInstall = worker.writes.length

    const navigations = ['/', '/?token=abc123&memory=https://memory.example.com', '/#/chat']
    for (const path of navigations) await worker.dispatch(path, { mode: 'navigate' })
    for (const path of ['/assets/index-CLFXD8p2.js', '/assets/avatars/humgen-aria-01.vrm', '/config.json', '/api/chat']) {
      await worker.dispatch(path)
    }
    await worker.dispatch('/offline/offline.css')

    expect(worker.writes).toHaveLength(afterInstall)
    expect(worker.writes.every((w) => w.via === 'addAll')).toBe(true)
    // ...and what the install stored is exactly the offline page, nothing of the app.
    expect([...(worker.stores.get('ci-avatar-offline-v1')?.keys() ?? [])]).toEqual(PRECACHED)
  })
})
