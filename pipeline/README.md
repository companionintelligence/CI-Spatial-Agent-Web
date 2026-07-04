# Avatar Asset Pipeline (Blender)

Headless **HumGen3D → RPM-skeleton re-skin (Strategy D) → GLB/VRM** pipeline that
emits avatars satisfying the app's [rig contract](../docs/AVATAR-PIPELINE.md#2-the-rig-contract-what-every-avatar-must-expose).

> Design docs: [`ASSET-PIPELINE.md`](../docs/ASSET-PIPELINE.md) ·
> [`AVATAR-PIPELINE.md`](../docs/AVATAR-PIPELINE.md) ·
> [`DRIVE-ASSETS.md`](../docs/DRIVE-ASSETS.md)

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

### 2. HumGen3D v4.0.27 + content packs (~4 GB)

Not installed on this machine — fetch from Google Drive (`liam@lifescope.io`,
under *Tools - PlugIns → Blender Extensions*, see [`DRIVE-ASSETS.md`](../docs/DRIVE-ASSETS.md)):

| Asset | Drive fileId |
|---|---|
| `HumGen3D_v4_0_27.zip` | `1QvR0cPw2QoP9BIWGCbjy79lRGGdYQ9-q` |
| Base_Humans (705 MB) | `1NGZbuRA8dpFzYkUEbHgXZIcNXm5UHAd2` |
| Base_Clothes (1.11 GB) | `1johLMr0GWNCbCJJeLEdVPLYsZYcTd_ao` |
| Base_Hair | `1IoQqRJEf67cVy68d551qSQWLOV2xaZFb` |
| Base_Poses | `1Q933URQ0enJs7TOmrUkNkDyp0H3cU-dm` |
| 8K_Textures (2.12 GB) | `1hEYdll0WZJuguCGB9ftJ3w1-pTG-BL71` |

Install the addon zip, then install each `.hgpack`/content pack into a content
directory and point HumGen at it (see step 4). HumGen human generation **fails
without the packs + a content path set** — this is a hard requirement even
headless.

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
  --humgen-zip ~/Downloads/HumGen3D_v4_0_27.zip \
  --vrm-zip    ~/Downloads/VRM-Addon-for-Blender-*.zip \
  --content-path ~/Documents/HumGen
```

This enables both addons, sets the HumGen content path, and saves user prefs.
Install the content packs into `--content-path` via HumGen's own installer
(interactive/BlenderMCP) — the packs are too large to script blindly.

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

- **HumGen v4 API calls** (`humgen.py`) — `Human.from_preset`, `.randomize()`,
  `finish_creation_phase()` signatures. Flagged `# TODO: verify against installed addon`.
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
