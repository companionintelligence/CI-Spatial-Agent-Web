#!/usr/bin/env node
/**
 * pages-poststrip.mjs — remove build-output files larger than Cloudflare Pages' hard
 * per-file limit (25 MiB), but ONLY inside a Cloudflare Pages build (CF_PAGES=1).
 *
 * Why: Pages rejects any single file > 25 MiB at deploy time. One asset —
 * humgen-aria-01.vrm (~38 MB, the HumGen-pipeline VRM) — exceeds it, which made the
 * whole deploy no-op ("deploy —"). It can't be safely recompressed in-repo (the VRM
 * extension stack — VRMC_vrm / MToon / node_constraint — doesn't round-trip through
 * gltf-transform, and the loader registers no Draco/meshopt/KTX2 decoder), so until
 * it's re-exported smaller via VRM-aware tooling we simply omit it from the STATIC
 * Pages demo. Every other deployment (Docker/GHCR → nginx → CI-Hub) keeps it: this
 * script is a no-op unless CF_PAGES is set, so the Docker and local builds are untouched.
 *
 * Usage (as apps/web postbuild): node ../../scripts/pages-poststrip.mjs dist
 */
import { readdirSync, statSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const LIMIT = 25 * 1024 * 1024 // 25 MiB — Cloudflare Pages per-file hard limit

if (!process.env.CF_PAGES) {
  // Not a Cloudflare Pages build — keep every asset (Docker/GHCR/local/CI).
  process.exit(0)
}

const dir = resolve(process.argv[2] || 'dist')
let removed = 0
let bytes = 0

function walk(d) {
  for (const entry of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, entry.name)
    if (entry.isDirectory()) walk(p)
    else {
      const size = statSync(p).size
      if (size > LIMIT) {
        rmSync(p)
        removed++
        bytes += size
        console.warn(
          `[pages-poststrip] removed ${(size / 1048576).toFixed(1)} MiB > 25 MiB limit: ${p.replace(dir + '/', '')}`
        )
      }
    }
  }
}

try {
  walk(dir)
} catch (e) {
  console.error(`[pages-poststrip] could not scan ${dir}: ${e.message}`)
  process.exit(0) // never fail the build over cleanup
}

console.log(
  removed
    ? `[pages-poststrip] stripped ${removed} oversized file(s) (${(bytes / 1048576).toFixed(1)} MiB) from the Pages deploy.`
    : '[pages-poststrip] no oversized files; nothing stripped.'
)
