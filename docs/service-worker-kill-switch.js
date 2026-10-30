// avatar:service-worker-kill-switch
//
// Avatar Companion's service worker kill switch.
//
// To retire the worker from every browser that installed it:
//
//   1. copy this file over apps/web/public/sw.js;
//   2. delete the registerServiceWorker() call, and its import, from apps/web/src/main.tsx;
//   3. deploy, and leave it in place for a few weeks.
//
// Nothing else has to change. The first line above is how scripts/check-pwa.mjs (so every
// `vite build`: pnpm, the Cloudflare Pages build and the container image's
// `deno task --cwd apps/web build`) and the unit tests recognise this file: with it as
// apps/web/public/sw.js they stop requiring what it has none of on purpose (the offline
// page, a precache list, a cache fingerprint, a registration in the bundle). The unit tests
// still check the manifest, the head tags and the `Cache-Control: no-cache` rule for
// /sw.js, which this file needs as much as the worker did.
//
// Reverting the commit that added the worker is NOT enough. With /sw.js gone, a browser's
// update check gets a 404, the update fails, and the old worker stays installed and keeps
// answering page loads. A worker only goes away when the browser finds a new /sw.js that
// removes it, and browsers look for one when a page loads, so the file has
// to stay up until every returning visitor has been seen.
//
// This worker has no fetch handler, so while it is installed every request goes straight
// to the network. On activation it deletes every cache whose name starts with
// ci-avatar-offline- and unregisters itself. src/lib/killSwitch.node.test.ts runs this file.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('ci-avatar-offline-')).map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
  )
})
