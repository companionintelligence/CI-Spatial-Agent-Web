// Avatar Companion's service worker.
//
// It does two things and nothing else:
//
//   1. It gives the browser the fetch handler some of them still look for before
//      they offer to install the app (public/manifest.webmanifest has the rest).
//   2. When a page load cannot reach the network at all (offline, or the host
//      is down), it answers with /offline/ instead of the browser's error page.
//
// What it deliberately does NOT do, because each of these has stranded visitors on
// a stale build somewhere else, and because this app is too big to cache:
//
//   - It never caches the app. First paint alone is ~2.2 MB of script and style, the
//     local-LLM chunk is another ~5 MB, the avatars, animations and props under /assets/
//     are ~240 MB, and the app is no use without them or without the backend /config.json
//     points at. HTML, scripts, styles, models and /config.json all go to the network
//     exactly as they would without a worker, so a deploy is live on the next load and
//     the HTTP cache rules in public/_headers (and nginx/default.conf) stay the only
//     cache policy.
//   - It never writes to the cache after install. The only cache entries are the
//     three files below, fetched once, so no URL a visitor opens (a deep link, a
//     query string), no model and no chat or TTS response is ever stored.
//   - It never touches a request it does not name: other origins (the self-hosted
//     proxy config.json points at lives on its own), non-GET requests and every
//     same-origin path that is not one of the files below are left to the browser.
//     There is no list of API or media paths to forget to extend.
//
// Retiring it: ship a sw.js that calls self.registration.unregister() and
// delete the registration in src/lib/registerServiceWorker.ts. Until then an old copy
// of this file is harmless: it serves a static page and nothing else.
//
// Served from the site root so its scope is the whole origin.
//
// CACHE is named after the files in PRECACHE: the first 12 hex digits of a sha256 over
// each URL, a NUL, the file's bytes with every CR (0x0D) removed, and a NUL, in list
// order. A browser fetches the precache again only when this file's bytes change, so an
// edit to the offline page that left this name alone would leave every returning visitor
// on the old page. The test in src/lib/pwa.node.test.ts recomputes the fingerprint from
// the files in apps/web/public and fails with the name to paste here. The CRs are left
// out so a CRLF checkout (git on Windows, an editor that saves CRLF) asks for the same name.

const CACHE = 'ci-avatar-offline-9431baaa533c'
const OFFLINE_URL = '/offline/'
const PRECACHE = [OFFLINE_URL, '/offline/offline.css', '/offline/mark.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `reload`: take the files from the network, not from the HTTP cache.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
  )
  // Nothing about the app is cached, so there is no build for the new worker to
  // disagree with: it can take over at once.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('ci-avatar-offline-') && key !== CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// A navigation answered with a redirected response fails ("a redirected response was
// used for a request whose redirect mode is not 'follow'"). /offline/ is the canonical
// URL on every host this ships to, but a host that redirects it would otherwise break
// the one page this worker exists to serve.
const unredirected = (response) =>
  response.redirected
    ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
    : response

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Network first, and the network's answer is final: a 404 or a 500 from a server
    // that did answer is shown as it is. Only a failed request gets the offline page.
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL)
        return offline ? unredirected(offline) : Response.error()
      })
    )
    return
  }

  // The offline page's own stylesheet and mark, which must load with no network.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)))
  }
})
