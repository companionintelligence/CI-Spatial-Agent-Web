#!/usr/bin/env bash
#
# batch.sh — generate every avatar in a preset file, then validate each output.
#
# Loops the presets JSON, invokes `blender --background --python generate_avatar.py`
# per avatar, and runs validate_avatar.mjs on every emitted GLB/VRM. Exits
# non-zero if any avatar fails to generate or fails the rig-contract gate.
#
# Usage:
#   pipeline/batch.sh [presets.json] [--content-path <humgen-content-dir>]
#
# Defaults to pipeline/presets/ci_default.json. Requires `jq` and a runnable
# Blender 4.5 (see pipeline/README.md).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

BLENDER="${BLENDER:-/Applications/Blender 4.5.app/Contents/MacOS/Blender}"
PRESETS="${1:-$HERE/presets/ci_default.json}"

# optional --content-path passthrough for HumGen (needed under --factory-startup)
CONTENT_PATH=""
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --content-path) CONTENT_PATH="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required" >&2; exit 2; }
[[ -x "$BLENDER" ]] || { echo "ERROR: Blender not executable at: $BLENDER" >&2; exit 2; }
[[ -f "$PRESETS" ]] || { echo "ERROR: presets not found: $PRESETS" >&2; exit 2; }

OUT_DIR="$(jq -r '.output_dir' "$PRESETS")"
# resolve output dir relative to repo root if not absolute
[[ "$OUT_DIR" = /* ]] || OUT_DIR="$REPO_ROOT/$OUT_DIR"

echo "== batch: $(jq '.avatars | length' "$PRESETS") avatars -> $OUT_DIR =="

fail=0
count="$(jq '.avatars | length' "$PRESETS")"
for i in $(seq 0 $((count - 1))); do
  name="$(jq -r ".avatars[$i].name" "$PRESETS")"
  seed="$(jq -r ".avatars[$i].seed" "$PRESETS")"
  gender="$(jq -r ".avatars[$i].gender" "$PRESETS")"
  height="$(jq -r ".avatars[$i].height // empty" "$PRESETS")"
  emit="$(jq -r ".avatars[$i].emit // \"glb\"" "$PRESETS")"

  echo ""
  echo "-- [$((i + 1))/$count] $name (seed=$seed gender=$gender height=${height:-default} emit=$emit) --"

  gen_args=(--seed "$seed" --gender "$gender" --name "$name" --emit "$emit" --out "$OUT_DIR")
  [[ -n "$height" ]] && gen_args+=(--height "$height")
  [[ -n "$CONTENT_PATH" ]] && gen_args+=(--content-path "$CONTENT_PATH")

  if ! "$BLENDER" --background --factory-startup \
      --python "$HERE/generate_avatar.py" -- "${gen_args[@]}"; then
    echo "!! generation FAILED for $name" >&2
    fail=1
    continue
  fi

  # validate every emitted format
  IFS=',' read -ra formats <<< "$emit"
  for fmt in "${formats[@]}"; do
    if [[ "$fmt" == "glb" ]]; then
      target="$OUT_DIR/$name.glb"
    else
      target="$OUT_DIR/vrm/$name.vrm"
    fi
    if [[ ! -f "$target" ]]; then
      echo "!! expected output missing: $target" >&2
      fail=1
      continue
    fi
    if ! node "$HERE/validate_avatar.mjs" "$target"; then
      echo "!! validation FAILED for $target" >&2
      fail=1
    fi
  done
done

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "== batch complete: all avatars generated and validated =="
else
  echo "== batch FINISHED WITH FAILURES ==" >&2
fi
exit "$fail"
