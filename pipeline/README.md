# Avatar Asset Pipeline (Blender)

Headless **HumGen3D → RPM-skeleton re-skin (Strategy D) → GLB/VRM** pipeline that
emits avatars satisfying the app's [rig contract](../docs/AVATAR-PIPELINE.md#2-the-rig-contract-what-every-avatar-must-expose).

> Design docs: [`ASSET-PIPELINE.md`](../docs/ASSET-PIPELINE.md) ·
> [`AVATAR-PIPELINE.md`](../docs/AVATAR-PIPELINE.md) ·
> [`DRIVE-ASSETS.md`](../docs/DRIVE-ASSETS.md)

## Toolchain (local — `~/Desktop/BlenderTools/`)

The installers + content packs are on disk (newer than the Drive copies), so no
download is needed to install:

| Tool | Version (desktop) | File |
|------|-------------------|------|
| HumGen3D | **v4.0.29** | `HumGen3D_v4_0_29.zip` |
| HumGen content | Base_Humans/Clothes/Hair/Poses V4_1 + 8K_Textures (optional, 2 GB) | `*.hgpack` |
| Auto-Rig Pro | **3.78.28** (+ rig_tools 3.78.24) | `auto_rig_pro_3.78.28.zip` |
| SimpleBake | 2.8.4 | `SimpleBake 2.8.4.zip` |
| SpeedRetopo | 0.4.1 (Blender 5.1) | `speedretopo_*.zip` |
| glTF exporter (patched) | — | `io_scene_gltf2.zip` |
| RPM animation library | v1.0.0 | `animation-library-master.zip` (also unzipped at `~/devel/3d/animation-library-master`) |

> ⚠️ This machine is **arm64 (Apple Silicon)**, but only `AI_macIntel_1.20.zip`
> (Auto-Rig-Pro AI, Intel) is present — base ARP works; the AI auto-detect feature
> would need the Apple-Silicon build. Strategy D doesn't use ARP anyway.

## Verified against the real HumGen3D v4.0.29 API

Inspecting the installer source resolved the scaffold's flagged TODOs:

- **Generate:** `Human.from_preset(Human.get_preset_options(gender)[i])` + `.body/.face/.skin.randomize()`. ✅ matches.
- **No creation phase.** v4 has no `finish_creation_phase` (that was v3) — `from_preset()`
  returns an exportable mesh directly. The scaffold no longer depends on it.
- **ARKit is a built-in operator.** `bpy.ops.hg3d.prepare_for_arkit(suffix='long')` emits the
  standard ARKit blendshape names directly — **no hand-authored HUMGEN→ARKit table needed**
  (`facemorphs.bind_arkit` now calls it).
- **Export via `human.export.to_glb(path, ...)`** — `export` is a **`@property`** (not a
  method) returning an `ExportBuilder`, so it's `human.export.to_glb(...)`, **not**
  `human.export().to_glb(...)` (the latter raises `'ExportBuilder' object is not callable`).
- **Bake textures BEFORE exporting; do NOT pass `bake_textures=True`.** In v4.0.29
  `to_glb(..., bake_textures=True)` crashes inside the addon (`HumGen3D.common.os` shadows
  stdlib `os` and has no `.path`, so `os.path.dirname` throws). Instead call
  `human.process.baking.bake_all(folder, 4)` first (writes body/eyes/teeth PBR PNGs), then
  `human.export.to_glb(path, bake_textures=False)`. Baking is mandatory or textures are empty.
  Since Strategy D swaps the rig, we export via the raw glTF exporter and must bake first
  (`glb_export.bake_textures`). Verified: a baked GLB is ~14 MB with 11 embedded images,
  20 morph targets on the body mesh, and a 102-joint skin.
- **Stock Blender 4.5 glTF exporter offers only `GLB` and `GLTF_SEPARATE`, not
  `GLTF_EMBEDDED`.** The `GLB` path (`to_glb`) works out of the box, so the patched
  `io_scene_gltf2.zip` is **not needed** for our GLB pipeline (and that zip only ships
  3.6/4.0/4.1 builds — none for 4.5). Only install it if you specifically need
  `to_gltf_embedded`.
- **Still open:** the 15 Oculus `viseme_*` morphs are NOT part of HumGen's ARKit set — they
  need a separate derivation (viseme-from-ARKit or a dedicated viseme rig). This is the last
  face-morph gap; author it against the installed mesh's shape keys via BlenderMCP.

## What this produces

For each persona: a `.glb` (web/XR, +Z forward, morph targets + RPM skin) and
optionally a `.vrm` (VRM 1.0, humanoid + expressions). Both satisfy the rig
contract: the 15 Oculus `viseme_*` morphs, the ARKit-52 facial morphs, and the
RPM bones `Hips/Spine/Spine1/Spine2/Neck/Head/LeftEye/RightEye`. Body animations
are **not** baked in — they stay the shared RPM clip library (238 clips) the app
already loads externally; the pipeline only guarantees the skeleton matches
bone-for-bone.

## Layout

```
pipeline/
  README.md               # this file
  install_addons.py       # enable HumGen3D + VRM addon, set content path, save prefs
  generate_avatar.py      # main entry (args after --)
  mappings.py             # RPM_TO_VRM_HUMANBONES, viseme/ARKit tables, VRM expression binds
  lib/
    humgen.py             # generate a HumGen human
    skeleton.py           # Strategy D: import RPM T-pose, transfer weights, drop HG rig
    facemorphs.py         # rename/bind HumGen shape keys -> viseme_* + ARKit names
    glb_export.py         # export .glb (morph targets + skin, no baked anims)
    vrm_export.py         # configure VRM1 humanoid + expressions, export .vrm
  presets/ci_default.json # persona seed presets
  batch.sh                # loop presets -> blender --background per avatar -> validate
  validate_avatar.mjs     # CI gate: assert viseme_* + ARKit morphs + RPM bones
```

## Prerequisites

### 1. Blender 4.5 LTS (pinned)

```
/Applications/Blender 4.5.app/Contents/MacOS/Blender
```

Verified runnable headless: `Blender 4.5.6 LTS`. **Do not** target Blender 5.x —
HumGen 4.0.27 + the VRM addon are validated against 4.5, and glTF/VRM operator
options drift 4.x→5.x. Override the path if needed via `BLENDER=... pipeline/batch.sh`.

### 2. HumGen3D v4.0.29 + content packs (~4.5 GB) — INSTALLED

Installed on this machine on 2026-07-04 (addon in
`~/Library/Application Support/Blender/4.5/scripts/addons/HumGen3D`, content in
`~/HumGen_content`, ~4.5 GB). The installer + packs are on disk under
`~/Desktop/BlenderTools/`:

| Asset | File | Content-pack json |
|---|---|---|
| HumGen3D addon | `HumGen3D_v4_0_29.zip` | — |
| Base_Humans (705 MB) | `Base_Humans_V4_1.hgpack` | `Base_Humans.json` |
| Base_Poses | `Base_Poses_V4_0.hgpack` | `Base_Poses.json` |
| Base_Hair (112 MB) | `Base_Hair_V4_1.hgpack` | `Base_Hair.json` |
| Base_Clothes (1.11 GB) | `Base_Clothes_V4_1.hgpack` | `Base_Clothes.json` |
| DPL collab | `DPL_HGV4_Collab_V6_01.hgpack` | `DPL_HGV4_Collection.json` |
| 8K_Textures (2.12 GB, optional) | `8K_Textures_OPTIONAL_V4_0.hgpack` | `8K_Textures.json` |

> Google Drive fallback copies (`liam@lifescope.io`, *Tools - PlugIns → Blender
> Extensions*) are older (v4.0.27); prefer the on-disk v4.0.29 assets above. See
> [`DRIVE-ASSETS.md`](../docs/DRIVE-ASSETS.md) for the Drive fileIds.

HumGen human generation **fails without the packs + a content path set** — this is
a hard requirement even headless. **`Base_Hair` is effectively required**: the
shipped human presets reference hair assets, so `Human.from_preset(...)` raises
`FileNotFoundError` on a missing hair `.json` until the hair pack is imported.

**Headless pack import (the real procedure).** HumGen's GUI installs packs via a
file-select popup that can't run `--background`. `pipeline/import_content_packs.py`
replicates it: it fills `context.scene.installpacks_col` (each item's `.name` =
zip path, `.json_path` = the in-zip `content_packs/*.json`, `.alert = "None"`) and
runs the stock `hg3d.cpackinstall` operator, which unzips each pack into the content
`filepath`. Run it after `install_addons.py`:

```bash
"/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
  --background --python pipeline/import_content_packs.py -- \
  ~/Desktop/BlenderTools/Base_Humans_V4_1.hgpack \
  ~/Desktop/BlenderTools/Base_Poses_V4_0.hgpack \
  ~/Desktop/BlenderTools/Base_Hair_V4_1.hgpack \
  ~/Desktop/BlenderTools/Base_Clothes_V4_1.hgpack \
  ~/Desktop/BlenderTools/DPL_HGV4_Collab_V6_01.hgpack \
  ~/Desktop/BlenderTools/8K_Textures_OPTIONAL_V4_0.hgpack
```

(A startup `HumGenException: ... no humans found in path` is expected noise from the
addon's on-load handler and does not affect the import.)

> Optional web-atlas + rig toolchain (also owned, in Drive): Auto-Rig Pro
> `1_2JTW6lOB7cWo9Z14A3KvWqRnxfJToqw`, SimpleBake `1jYwh9Q7EZMAcQdFOP5z237rZ7RKFDVd3`,
> patched glTF exporter `1YcvNOWEohaB5TPdxi0NMJEnISGwU7KuW`, Better FBX
> `1hb3h9Gbck9zuEDe3ytr7HDnWrX-_zNm1`. The scaffold uses Blender's **bundled**
> glTF2 exporter; swap in the patched one only if you hit an export edge case.

### 3. VRM Addon for Blender

Fetch a **Blender-4.5-compatible** release of
[`saturday06/VRM-Addon-for-Blender`](https://github.com/saturday06/VRM-Addon-for-Blender)
(module `io_scene_vrm`). Only needed if you emit `vrm`.

### 4. RPM animation library (already on this machine)

```
/Users/liam/devel/3d/animation-library-master
```

Provides the RPM T-pose armatures the re-skin binds to
(`masculine/glb/Masculine_TPose.glb`, `feminine/glb/Feminine_TPose.glb`) — these
are the exact RPM/Mixamo rig, verified bone-for-bone against the app's shipping
`rpm-mixamo-t-posed.glb`.

## Install the addons (once)

```bash
"/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
  --background --python pipeline/install_addons.py -- \
  --humgen-zip ~/Desktop/BlenderTools/HumGen3D_v4_0_29.zip \
  --vrm-zip    ~/Downloads/VRM-Addon-for-Blender-*.zip \
  --content-path ~/HumGen_content
```

This enables both addons, sets the HumGen content path (`HG_PREF.filepath`), and
saves user prefs. Then import the `.hgpack` content packs headless with
`pipeline/import_content_packs.py` (see step 2 above) — the packs **are**
scriptable via the `hg3d.cpackinstall` operator, no GUI/BlenderMCP needed.

## Generate one avatar

```bash
"/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
  --background --factory-startup \
  --python pipeline/generate_avatar.py -- \
  --seed 42 --gender female --name Aria --height 1.68 \
  --emit glb,vrm --out apps/web/public/assets/avatars \
  --content-path ~/Documents/HumGen
```

`--factory-startup` gives reproducible/CI runs; because it ignores saved prefs,
`generate_avatar.py` re-enables the addons itself (so `--content-path` is passed
through). Drop `--factory-startup` + `--content-path` when authoring
interactively with BlenderMCP against your saved prefs.

## Batch-generate a preset file

```bash
pipeline/batch.sh pipeline/presets/ci_default.json --content-path ~/Documents/HumGen
```

Loops every avatar, generates it, and runs the validator on each output;
non-zero exit if any avatar fails to build or violates the rig contract.

## Validate an avatar (CI gate)

```bash
node pipeline/validate_avatar.mjs apps/web/public/assets/avatars/Aria.glb
node pipeline/validate_avatar.mjs apps/web/public/assets/avatars/Aria.glb --json
```

Asserts the `viseme_*` set, ARKit contract morphs, and RPM bones are all present;
exits non-zero (printing exactly what's missing) on any violation.

**Standalone:** the validator prefers three.js `GLTFLoader` (resolved from the
workspace's installed `three`) but **transparently falls back to a dependency-free
binary glTF parser** — the morph/bone names live in the GLB's JSON chunk, so the
name contract is checkable with zero deps. It runs today with no `pnpm install`.
To force the three path (e.g. once `three` is hoisted in CI), run it from a dir
where `import('three')` resolves; both paths check identical names. If you must
run it against a bundler-only three install, `node --experimental-vm-modules
pipeline/validate_avatar.mjs …` — but the binary fallback almost always makes
that unnecessary.

Verified against the shipping reference export `25-1-3_CI_model_male_Greg.glb`
(PASS, 15/15 visemes · 35/35 ARKit · 8/8 bones) and a bare RPM T-pose (correctly
FAILs — bones present, morphs absent).

## Status / what still needs the installed addons

The scaffold is complete and the **validator + all mapping tables are verified**
against on-disk assets. What cannot be validated until HumGen3D + the VRM addon
are installed:

- **HumGen v4 API calls** (`humgen.py`) — ✅ VERIFIED against installed v4.0.29:
  `Human.get_preset_options('male')` returns 42 presets; `Human.from_preset(opts[0])`
  builds a `Human` with an `HG_Body` mesh (25 286 verts / 25 324 polys, 24 shape
  keys). No `finish_creation_phase` in v4. Export is `human.export.to_glb(path)`
  (`export` is a `@property`); bake first via `human.process.baking.bake_all(folder, 4)`
  and pass `bake_textures=False` (the built-in bake-on-export path is broken in 4.0.29).
- **HumGen → app morph names** (`mappings.HUMGEN_TO_OCULUS_VISEME` /
  `HUMGEN_TO_ARKIT`) — HumGen ships a FACS set whose names won't 1:1 match; the
  real rename/bind table must be read off the installed mesh
  (`facemorphs.dump_shape_keys(mesh)`). Marked `# NEEDS VERIFICATION`.
- **Strategy-D weight transfer** (`skeleton.py`) — the HG-deform-bone → RPM-bone
  remap needs the installed HG rig's bone names; mesh/reparent plumbing is done.
- **VRM addon data paths** (`vrm_export.py`) — `vrm_addon_extension.vrm1.*` paths
  differ by addon version. Flagged.

Author these interactively via **BlenderMCP** against the real addons, then bake
the confirmed names into `mappings.py` / the `# TODO` sites and re-run the
validator to lock the rig contract.
```
