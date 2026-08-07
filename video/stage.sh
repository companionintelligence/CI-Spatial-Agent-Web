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
