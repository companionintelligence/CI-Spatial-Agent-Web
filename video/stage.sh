#!/usr/bin/env bash
#
# Spatial Companion's stage, for local video capture. Sourced by video/make.sh,
# which owns the generic capture/build/check/render steps; this file only has to
# get the app running and stop it again.
#
# Ported from the repo's own capture harness (playwright.config.capture.ts), so
# a local capture films exactly what the L4/L5 capture suite films. That harness
# sets `reuseExistingServer: true`, so the two compose rather than fighting over
# the port.
#
# ── DOES THIS STAGE NEED A HEADED BROWSER? NO. SETTLED, WITH NUMBERS. ─────────
#
# tools/stages.json carried a standing note that "WebXR never reached a
# renderable state in headless Chromium" and that "a real Mac with a GPU may do
# better" — which left open whether this stage has to run a HEADED browser. It
# does not, and the note was conflating two separate things. Measured on an
# M2 Max (Metal 4), Playwright 1.62.1, four launches against this stage:
#
#   launch                              WebGL renderer            immersive-vr/ar
#   ---------------------------------   -----------------------   ---------------
#   chromium.launch()                   SwiftShader (CPU)         false / false
#   + channel:"chromium"                ANGLE Metal, Apple M2 Max false / false
#   + channel + headless:false          ANGLE Metal, Apple M2 Max false / false
#   + headed + --force-webxr-runtime=   ANGLE Metal, Apple M2 Max false / false
#     openxr, --enable-features=OpenXR
#
# 1. THE 3D SCENE. This was the real blocker, and it is a BINARY problem, not a
#    headed/headless one. Bare `launch()` runs `chromium_headless_shell`, which
#    has no GPU path; `channel: "chromium"` runs the full Chrome-for-Testing
#    build and reaches Metal. capture.config.mjs already performs that upgrade.
#    Headless full Chromium rasterises on the GPU exactly as well as headed does,
#    and it is what captured all 14 shots here — including datacenter-diorama,
#    which blows the kit's 30s screenshot budget under SwiftShader.
#
# 2. THE IMMERSIVE SESSION. Not available on this machine in ANY launch mode.
#    `navigator.xr` is defined in all four (Chromium always exposes the
#    interface) and `inline` is supported in all four, but `immersive-vr` and
#    `immersive-ar` are false everywhere and requestSession fails identically,
#    headed included:
#
#      NotSupportedError: Failed to execute 'requestSession' on 'XRSystem':
#      No XR hardware found.
#
#    Forcing the runtime does not change it: macOS Chromium ships no OpenXR
#    device backend, so there is nothing for the flag to select. Going headed
#    buys exactly nothing here — the variable is the platform, not the window.
#
# So: keep capturing headless. An honest XR shot needs a Quest or Vision Pro
# browser, and a real session's output is a stereo framebuffer rather than a page
# screenshot, so it is a different capture path entirely — not a stage tweak.
# Do not spend another pass trying to coax an immersive session out of this Mac.

STAGE_PID=""

stage_up() {
  # 5178, not 5173. That is the port the capture harness already uses
  # (playwright.config.capture.ts: `CAPTURE_PORT || 5178`, "5173 is frequently
  # occupied"). Never reuse a port somebody else holds: a capture against
  # another server succeeds, produces plausible screenshots and is completely
  # wrong — the failure mode this pipeline exists to avoid.
  STAGE_PORT="$(pick_port 5178)"

  # 127.0.0.1, NEVER `localhost`. This is not cosmetic and not interchangeable:
  # on the hostname `localhost`, @react-three/xr injects a WebXR *emulator* plus
  # its dev UI, and that UI's "Enter XR" button lands in frame on every shot.
  # capture.config.mjs derives the same 127.0.0.1 URL from CAPTURE_PORT, so
  # exporting the port is all the kit needs to follow a relocation.
  STAGE_URL="http://127.0.0.1:$STAGE_PORT"
  export CAPTURE_PORT="$STAGE_PORT"
  [ "$STAGE_PORT" = 5178 ] || echo "note: :5178 was busy, using :$STAGE_PORT"

  ( cd "$REPO_ROOT" && pnpm install --frozen-lockfile --silent )

  ( cd "$REPO_ROOT" && PORT="$STAGE_PORT" pnpm --filter @ci-avatar/web dev ) > "$STAGE_LOG" 2>&1 &
  STAGE_PID=$!

  # Generous: `predev` packs every AvatarOptions entry into public/assets before
  # vite even starts, so a cold boot is slow. The repo's own harness allows 180s
  # for exactly this, and a capture that starts before the assets are packed
  # films placeholder avatars.
  for _ in $(seq 1 180); do
    curl -sfo /dev/null "$STAGE_URL" && break
    kill -0 "$STAGE_PID" 2>/dev/null || { echo "dev server exited during startup" >&2; return 1; }
    sleep 1
  done
  curl -sfo /dev/null "$STAGE_URL" || { echo "dev server never answered on :$STAGE_PORT" >&2; return 1; }
  echo "stage up at $STAGE_URL"
}

stage_down() {
  [ -n "$STAGE_PID" ] || return 0
  kill -0 "$STAGE_PID" 2>/dev/null || return 0

  # Kill pnpm's CHILDREN first, then pnpm. `pnpm --filter ... dev` spawns vite as
  # a child, and killing only pnpm leaves vite holding the port.
  #
  # Deliberately NOT `kill -- -<pgid>`: a background job in a non-interactive
  # shell shares the script's own process group, so signalling the group kills
  # make.sh too.
  pkill -P "$STAGE_PID" 2>/dev/null || true
  kill "$STAGE_PID" 2>/dev/null || true
  wait "$STAGE_PID" 2>/dev/null || true

  # Vite can outlive its parent if it re-parented; make sure the port is free,
  # or the next run refuses to start on a port it thinks somebody else owns.
  for _ in $(seq 1 10); do
    curl -sfo /dev/null "$STAGE_URL" || return 0
    sleep 1
  done
  echo "warning: something is still answering $STAGE_URL" >&2
}
