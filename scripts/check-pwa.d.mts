// Types for scripts/check-pwa.mjs, which is plain JavaScript so that `vite build` (apps/web/vite.config.ts) and `node` can both run it.

export const CACHE_PREFIX: string

/** Whether this is the text of the kill switch (docs/service-worker-kill-switch.js) rather than of the real worker. */
export function isKillSwitch(source: string): boolean

/** What the service worker names: its cache, the offline page and the files it precaches. */
export function serviceWorkerFiles(source: string): { cache: string | null; offline: string | null; precache: string[] }

/** Where a URL the worker precaches lives in public/ (or the build output). */
export function publicFileFor(url: string): string

/** The 12 hex digits that end the worker's cache name, over the files `urls` name inside `dir`. */
export function precacheFingerprint(dir: string, urls: string[]): string

/** The cache name those precached files call for, or null when there is nothing (or not everything) to hash. */
export function expectedCache(dir: string, precache: string[]): string | null

/** The worker's source in `publicDir`: the problems, empty when there are none. */
export function checkWorkerSource(publicDir: string): string[]

/** The text of the build's JavaScript, without sw.js. */
export function bundleText(dist: string): string

/** The worker in the build output `dist`, given the bundle's text: the problems, empty when there are none. */
export function checkWorkerBuild(dist: string, js: string): string[]

/** Throws one Error listing every problem. Without a `dist` (or one with no index.html) only the source is checked. */
export function assertPwa(options: { publicDir: string; dist?: string | null }): void
