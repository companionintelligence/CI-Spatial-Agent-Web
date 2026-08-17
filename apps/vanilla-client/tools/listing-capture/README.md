# Listing capture

Reproducible screenshots + FTUE GIF for the marketplace listing, rendered from
the **live engine** in a headless browser (WebGL2 via SwiftShader — no GPU or
display required).

## Why headless SwiftShader

The app is WebGL/WebXR/WebGPU. In CI / sandbox environments there is no GPU and
no display, so capture uses a headless Chromium (`@sparticuz/chromium`, which
bundles a SwiftShader build) driven by `puppeteer-core`. The app is forced onto
the WebGL2 backend with `?gpu=0`, and detection/proactive features are disabled
(`&detect=0&proactive=0`) so no external backends are needed.

## Usage

```bash
npm run build                                    # produce dist/
npm i -D puppeteer-core @sparticuz/chromium ffmpeg-static   # capture-only deps
node tools/listing-capture/capture.mjs           # stills  -> .capture/*.png
node tools/listing-capture/capture-gif.mjs        # FTUE GIF -> .capture/ftue.gif
```

> The capture-only dependencies are intentionally **not** in the app's
> `package.json` — install them ad hoc when (re)generating listing assets, then
> copy the chosen outputs from `.capture/` into `docs/listing/media/`.

Both scripts spin up a tiny static server for `dist/` on `127.0.0.1:4173`,
launch Chromium with fake camera/mic devices, walk the first-run experience
(splash → character reveal → greeting → settings → "come here" → viewfinder),
and write outputs to `.capture/` (git-ignored).

- `capture.mjs` — desktop + mobile stills.
- `capture-gif.mjs` — records the cold-boot reveal via CDP screencast and
  encodes a small, shareable GIF with `ffmpeg-static`.
