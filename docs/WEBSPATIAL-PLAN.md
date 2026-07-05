# WebSpatial Support Plan — CI Embodied Companion

> Strategy anchor: the ByteDance pitch ("Personal Agents in 2025 / Private Embodied
> Companions"). WebSpatial is the lever to ship the **single WebXR avatar build** to
> **all major spatial platforms in 2026** — visionOS, Android XR, Meta Horizon OS, and
> **Pico/TikTok** — "elevating the experience for more platforms with our limited
> resources." One codebase, many surfaces; private on-prem agent backend for enterprise.

## Where we are

`apps/vision-pro` is already ahead on WebSpatial tooling — it has the full toolchain
wired that the reference monorepo (`ci-time-machine`) has *not* yet built:

| | this repo `apps/vision-pro` | `ci-time-machine/apps/vision-pro` |
|---|---|---|
| `@webspatial/react-sdk` + `vite-plugin` + `builder` | ✅ wired (`vite.config.ts`) | ❌ placeholder shell |
| `dev:avp` / `build:avp` / `publish:avp` | ✅ | ❌ |
| App Store publishing doc | ✅ `APP_STORE_PUBLISHING.md` | ❌ |
| Surface/preset abstraction | ✅ **added here** (`packages/core/src/platform`) | ✅ `packages/engine` (the pattern we borrowed) |
| Shares avatar + services from one core lib | ✅ `@ci-avatar/core` | partial (stubs) |
| 24-avatar catalog flows into the build | ✅ via `scripts/pack-assets.mjs vision-pro` | n/a |

So the new avatar work (24-avatar catalog, HumGen **Aria**, animation library) **already
reaches the WebSpatial build for free** — `pack-assets.mjs` gates + syncs `assets/` into
`apps/vision-pro/public` on every `predev:avp`/`prebuild`, and `apps/vision-pro/src/App.tsx`
renders the same `Viewport3D`/`AvatarModel`/services from `@ci-avatar/core` as the web app.

## What this PR changes (the refactor)

The reusable gem from `ci-time-machine` was its **surface abstraction**, not its
(placeholder) vision-pro app. Backported and avatar-tuned into `packages/core/src/platform/`:

- **`surface.ts`** — `Surface` union (`desktop | mobile-ios | mobile-android | quest |
  vision-pro`) + `detectSurfaceSync()` (WebSpatial injects `visionOS|WebSpatial` into the
  UA, so the one build recognizes the Vision Pro container at runtime).
- **`capabilities.ts`** — `detectCapabilities()` (WebGL2 / WebGPU / WebXR immersive-vr/ar
  / hand-tracking / web-speech), frozen at boot.
- **`presets.ts`** — avatar-tuned `RenderPreset` per surface (DPR, AA, shadows,
  post-processing, WebXR foveation, `preferWebGPU`, target FPS).

Wired in:
- `apps/vision-pro/src/App.tsx` resolves `presetFor(detectSurfaceSync())` and gates
  WebGPU by `preferWebGPU` (Quest's browser WebGPU is immature → stays off there).
- `apps/vision-pro/src/main.tsx` calls the **real** `initScene()` from
  `@webspatial/react-sdk` (v1.1.0) — dynamic-imported and guarded to the vision-pro
  surface, so the plain-browser build never loads or runs the spatial-OS init.
- Root `package.json` `pnpm.peerDependencyRules` allows `@webspatial/vite-plugin`
  (declares peer `vite ^6`) on the repo's Vite 7 — the build already works; this
  documents the compat and silences the warning.

Verified: `pnpm --filter @ci-avatar/vision-pro build` ✓, `@ci-avatar/web` build ✓,
platform unit tests ✓ (12), canon lint ✓.

## Roadmap (phased)

### Phase 1 — Foundation (this PR)
Surface/capabilities/presets seam + surface-aware WebGPU + guarded `initScene`. ✅

### Phase 2 — Spatial layout (native volumes)
Today the whole app renders as one spatialized WebGL window. Lift the 2D UI into
WebSpatial volumes so the avatar and the chat/controls occupy real 3D space:
- Wrap `ChatPanel` / `ControlOverlay` in `SpatializedContainer` (from `@webspatial/react-sdk`)
  with `--xr-background-material` (already set transparent in `index.css`).
- Give the avatar its own volume; anchor chat as a follow-panel.
- Drive camera/head pose from `SpatialMonitor` (head-coupled framing already exists via
  `AvatarModel.onHeadLocated`).

### Phase 3 — Surface presets → renderer
Thread `RenderPreset` all the way into `Scene3D`: DPR cap, `PostProcessing` quality,
shadow toggle, and WebXR `foveation` per surface (currently `PostProcessing` quality is
hardcoded). Adopt the same `presetFor` in `apps/web` for mobile/Quest-browser tuning.

### Phase 4 — Test parity (L3/L5 on WebSpatial)
Add a vision-pro variant of the `AvatarHarness` capture surface (`@webspatial/react-sdk`
JSX) so the WebP visual matrix + render matrix run against the spatial build too, not
just `apps/web`. Wire a `build:avp` smoke into CI (dry-run; device/simulator stays manual).

### Phase 5 — Platform fan-out (2026 roadmap, per the pitch)
- **Android XR / Pico / Horizon OS**: WebSpatial's export targets + the same
  `detectSurfaceSync` seam. Add surfaces + presets as SDKs land.
- **Publish**: `publish:avp` → App Store Connect (visionOS); parallel store paths for
  Pico/Horizon as WebSpatial adds them.
- **Enterprise**: on-prem agent backend via the existing BFF (`apps/proxy`) so spatial
  clients talk to a private CI-Server, not a public API.

## Open items / risks
- **`build:avp` / `publish:avp`** need macOS + Xcode + visionOS SDK — not runnable in
  headless CI; keep as a manual/device gate (Phase 4 adds a build-only dry-run).
- **`initScene` runtime behavior** is verified to compile + stay out of the web build;
  its on-device effect needs a Vision Pro / simulator pass (Phase 2).
- **WebGPU MToon path** on visionOS is preset-preferred but unproven on-device — validate
  before enabling by default; the `useHasWebGPU` gate keeps it safe.
