# Spatial Companion — product video

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**

Generates a **16:9 desktop cut** and a **9:16 mobile cut** of Spatial Companion's FTUE and major
screens, from this repo's own UI. Both are produced from [`storyboard.json`](storyboard.json).

## The stage

This app has **one route**; every filmable state is an overlay composed in
`apps/web/src/App.tsx`. Boot it exactly the way this repo's own capture harness does
(`playwright.config.capture.ts`), on **port 5178** — not 5173:

```bash
# from the repo root, in a separate terminal
corepack enable
pnpm install --frozen-lockfile
PORT=5178 pnpm --filter @ci-avatar/web dev
```

`predev` runs `scripts/pack-assets.mjs` first, which copies **~210 MB** of avatars,
animations and props into `apps/web/public/assets` (gitignored). First boot is slow;
capturing before it finishes gives you an empty scene and 404s on every GLB.

The app needs no backend for any of these shots: with no `/config.json` and no
`VITE_LLM_PROVIDER` it falls back to the offline `script` provider, and
[`capture.config.mjs`](capture.config.mjs) pins that explicitly and stubs the
response set so the transcript is fixed.

## Quick start

```bash
npm install
npx playwright install --with-deps chromium
npm run doctor        # verify node / ffmpeg / playwright / hyperframes / fonts

# with the app's dev server running on :5178 (see "The stage" above):
npm run capture       # drive the real UI -> assets/shots/*.png (both viewports)
npm run build         # storyboard.json -> build/{landscape,portrait}/index.html
npm run check         # HyperFrames gate: lint, runtime, layout, motion, contrast
npm run render        # -> out/ci-spatial-companion-webxr-landscape.mp4 and out/ci-spatial-companion-webxr-portrait.mp4
```

## Editing the video

Everything editorial lives in [`storyboard.json`](storyboard.json) — scene order, durations,
captions, narration, and which screens appear. The **capture spec for each shot lives in the same
file**, so the script and the screenshots cannot drift apart.

Adding a beat is: add a scene, add its shot's `capture` block, `npm run capture -- --only <id>`,
then `npm run build && npm run render`.

## Media

Drop prepared media into `assets/media/` and point `media.music` at it. Per-scene voiceover is
picked up automatically from `assets/audio/<sceneId>.mp3`; regenerate it from the storyboard's
`narration` fields with `npm run narrate`.

## What is committed

`assets/shots/*.png` and `assets/audio/*.mp3` **are** committed — they are the record of what the
product looked like. `build/` and `out/` are not.

**Byte-stability does not hold in this repo.** Every shot contains a live WebGL avatar whose
render loop never stops (`Scene3D.tsx` keeps `frameloop` at `"always"` deliberately), and
`capture.config.mjs` does not mask the canvas because the avatar is the product. Compare these
shots perceptually, not with an exact-match gate — the full reasoning, and every other
determinism hazard found in this app, is written up at the top of
[`capture.config.mjs`](capture.config.mjs).

See [CI-Engineering `projects/product-video-pipeline/`](https://github.com/companionintelligence/CI-Engineering/tree/main/projects/product-video-pipeline)
for the full contract.
