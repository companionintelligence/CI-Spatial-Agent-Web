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
- **ARKit needs the facial rig loaded first.** `prepare_for_arkit` only operates on
  `human.keys.all_added_shapekeys`; on a fresh human those don't exist yet, so the op is a
  no-op. Call `human.expression.load_facial_rig()` first — it imports the 43 FACS body keys
  (+ 5 tongue keys) from `<content>/models/face_rig.json` — **then** run
  `prepare_for_arkit(suffix='long')`, which renames the `_L`/`_R` halves to `Left`/`Right`,
  yielding 33/35 of the app's ARKit contract morphs verbatim. `facemorphs.load_facial_rig`
  does both. The 2 remaining (`eyesClosed`, `mouthSmile`) are synthesised as combined L/R
  blends (`mappings.ARKIT_SYNTHESISED`).
- **The 15 Oculus `viseme_*` morphs are now DERIVED (solved).** They are not in HumGen's ARKit
  set, so `facemorphs.derive_visemes` bakes each as its own shape key from a weighted blend of
  the ARKit mouth/jaw shapes (`mappings.VISEME_FROM_ARKIT`, the standard ARKit→Oculus-viseme
  correspondence) via `shape_key_add(from_mix=True)` so they export as real morph targets.
  Verified: 14/15 deform (`viseme_sil` is the neutral rest morph), 15/15 present.
- **Content path MUST end with a separator.** HumGen concatenates `str(pref.filepath) +
  relative_path` raw (no `os.path.join`) for hair etc., so `~/HumGen_content` (no trailing `/`)
  yields `/HumGen_contenthair/...` → `FileNotFoundError`. `generate_avatar._enable_addons`
  appends `os.sep`.

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
  generate_vrm.py         # NATIVE VRM 1.0 entry (recommended — no RPM re-skin)
  generate_avatar.py      # legacy GLB entry (RPM re-skin, Strategy D)
  mappings.py             # HUMGEN_TO_VRM_HUMANBONES + RPM map, viseme/ARKit tables, VRM binds
  lib/
    humgen.py             # generate a HumGen human (+ clothing/footwear/hair-haircards)
    skeleton.py           # Strategy D: import RPM T-pose, transfer weights, drop HG rig (GLB path)
    facemorphs.py         # rename/bind HumGen shape keys -> viseme_* + ARKit names
    glb_export.py         # export .glb (morph targets + skin, no baked anims)
    vrm_export.py         # VRM1 humanoid + expressions + head-part/hair/material fixes, export .vrm
  presets/ci_default.json # persona seed presets
  batch.sh                # loop presets -> blender --background per avatar -> validate
  validate_avatar.mjs     # CI gate: assert viseme_* + ARKit morphs + (RPM) bones
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

## Status

The GLB pipeline is **complete and verified end-to-end** against the installed
HumGen3D v4.0.29 + content packs. `generate_avatar.py` produces a validated,
app-ready GLB in one headless run:

```bash
"/Applications/Blender 4.5.app/Contents/MacOS/Blender" --background --factory-startup \
  --python pipeline/generate_avatar.py -- \
  --seed 12 --gender female --name humgen-aria-01 --height 1.68 \
  --emit glb --out apps/web/public/assets/avatars --content-path ~/HumGen_content
node pipeline/validate_avatar.mjs apps/web/public/assets/avatars/humgen-aria-01.glb
#   ✓ visemes 15/15   ✓ ARKit morphs 35/35   ✓ RPM bones 8/8   PASS
```

What's DONE and verified:

- **HumGen v4 API** (`humgen.py`) — ✅ `Human.get_preset_options` / `from_preset`;
  `.body/.face/.skin.randomize()` (call directly, never truthiness-test the prop
  collections — they recurse); `human.height.set(cm)`; body = `human.objects.body`.
- **Clothing** (`humgen.py` `apply_clothing`) — ✅ VERIFIED v4.0.29 clothing API.
  `human.clothing.outfit` / `human.clothing.footwear` are `@property` accessors
  returning `OutfitSettings` / `FootwearSettings`; `.get_options()` lists relative
  preset paths (e.g. `outfits/female/Office/Pantsuit.blend`) and `.set(preset)`
  imports + fits the garment, tags each mesh `obj['cloth']`/`obj['shoe']`, and skins
  it to the HG rig. We apply a curated Office/Casual **outfit + footwear** BEFORE the
  bake + re-skin, so `bake_all` (which auto-includes `cloth`/`shoe` children) bakes
  the garment textures too. The garments are then Data-Transfer re-skinned onto the
  RPM armature exactly like the body, so they ride the shared RPM animation clips
  (verified: sweater→Arm/Spine, jeans→Leg, shoes→Foot bones). Their
  `Body Proportions` fit shape key is baked into the mesh on export (with stale
  custom split-normals cleared) so the fitted shape survives with no morph bloat.
  HumGen's clothing geometry-masks are stripped BEFORE baking (so the full body skin
  bakes, not black), then the clothing-covered body verts are deleted (edit-mode,
  preserving face shape keys) so the body can't clip through the garments.
- **Face morphs** (`facemorphs.py`) — ✅ `load_facial_rig()` → `prepare_for_arkit('long')`
  gives 33/35 ARKit morphs; `eyesClosed`/`mouthSmile` synthesised; all 15 `viseme_*`
  derived from ARKit blends and baked as real morph targets.
- **Strategy D re-skin** (`skeleton.py`) — ✅ FULL re-skin. Imports the in-tree
  `rpm-mixamo-t-posed.glb` (resolved from the canonical `assets/avatars/`, with the
  legacy `apps/web/public/...` path as fallback), which carries both the RPM armature
  AND a real skinned reference body (`Wolf3D_Avatar`, 82 RPM-named groups). Data
  Transfer (POLYINTERP_NEAREST VGROUP_WEIGHTS) copies those weights onto the HumGen
  body + every clothing mesh, which are then bound to the RPM armature; the HG rig is
  dropped. Output rides the RPM skeleton bone-for-bone (Hips→…→Head/LeftEye/RightEye).
- **Head-bone framing fix** (`skeleton.py` `_align_body_to_rpm`) — ✅ the body (and all
  clothing/eyes/teeth) is scaled about the WORLD ORIGIN so its crown-to-floor height,
  measured from real world-space vertices, matches the RPM reference **body mesh**
  (~1.82 m). The earlier code scaled to the RPM *armature* `dimensions.z` (1.867 m,
  inflated by leaf bones like `HeadTop_End` at z≈1.966) using the unreliable
  `body.dimensions.z`, so the body came out ~1.94 m tall while the Head/eye BONES
  stayed at RPM height — the face floated ~0.2 m above the eye bones and a head-relative
  camera framed the neck. Now the exported crown lands at 1.821 m (matching RPM
  exactly) and Head (1.557) / LeftEye+RightEye (1.634) bones coincide with the RPM
  reference bone-for-bone, so the head-relative gaze camera frames the face like the
  RPM avatars. Eyes/teeth are re-seated into the RPM-deformed sockets/mouth (they were
  authored to HumGen face proportions, which sit below the RPM sockets) and rigidly
  Head-bound.
- **GLB export** (`glb_export.py`) — ✅ bakes textures (body + clothing), flattens
  clothing fit shape keys, prunes non-face body shape keys, exports position-only
  morph deltas. ≈25 MB for a clothed female avatar (8 meshes, 23 embedded textures).

```

## Native VRM 1.0 path (`generate_vrm.py`) — the recommended avatar export

**This supersedes the RPM re-skin for HumGen avatars** (see
[`docs/FACIAL-ANIMATION-PLAN.md`](../docs/FACIAL-ANIMATION-PLAN.md) §"VRM-first
HumGen"). The RPM re-skin/retarget forced the HumGen body onto the RPM skeleton
and **broke the head** (teeth/eyes floated to the chest, procedural skin baked to
blotches). The native VRM path keeps the HumGen character exactly as HumGen
authors it — head, eyes, teeth, hair, clothing all on HumGen's own Rigify rig,
NO re-skin, NO bone-rename — and exports `.vrm` by mapping that rig onto the VRM
humanoid. `@pixiv/three-vrm-animation` then retargets the shared VRMA clips by
humanoid bone, so the head stays coherent.

```bash
"/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
  --background --python pipeline/generate_vrm.py -- \
  --gender female --name humgen-aria-01 --seed 6 \
  --content-path ~/HumGen_content \
  --out assets/avatars/humgen-aria-01.vrm
```

Requires the **VRM addon** installed as module `io_scene_vrm` (v4.3.1 verified) —
extract `VRM_Addon_for_Blender-*.zip`'s inner folder to
`~/Library/Application Support/Blender/4.5/scripts/addons/io_scene_vrm/`.

### Verified io_scene_vrm 4.3.1 API + the hard-won gotchas

- **Humanoid map** (`mappings.HUMGEN_TO_VRM_HUMANBONES`): HumGen Rigify deform
  bones → VRM humanoid slots via
  `armature.data.vrm_addon_extension.vrm1.humanoid.human_bones.<slot>.node.bone_name`.
  Slot attrs are **snake_case** (`left_upper_arm`). HumGen has no `hips` bone —
  `spine`→`hips`, `spine.001..003`→`spine/chest/upperChest`.
- **`eyeball.L/R` and `jaw` are DELIBERATELY left unmapped.** three-vrm normalizes
  every *mapped* humanoid bone to a canonical rest; HumGen's eye/jaw bones carry a
  ~90° rest rotation, so mapping them breaks the eye/teeth bind. Unmapped, those
  bones stay put. Gaze comes from the app's lookAt path, mouth-open from the `aa`
  viseme morph.
- **THE 'floating teeth/eyes' fix** (`vrm_export.boneparent_head_parts`): even
  unmapped, the eyes/teeth (separate meshes skinned to eyeball/jaw) float to the
  chest once the humanoid animates. The fix is to strip their skinning and
  **object-bone-parent** them rigidly to the `head` bone (the exporter turns this
  into a single-`head`-joint skin that three-vrm normalizes consistently with the
  body's head verts). Re-weighting or merging into the body both still float.
- **Do NOT set a target height.** `human.height.set(cm)` deforms the body via
  shape keys *after* the eyes/teeth are authored, which re-floats the bone-parented
  head parts. `generate_vrm.py` skips it; the preset default (~1.7 m) is used.
- **Clean skin/clothing textures** (`vrm_export.simplify_humgen_materials`): the
  HumGen skin/eye materials wire Base Color through a procedural node chain
  (freckles × aged-layer × cavity × makeup) the glTF exporter can't flatten — it
  exports **red/black skin**. We rebuild those materials as a plain Principled fed
  by the raw sRGB color map (+ normal/rough), which exports clean. Clothing already
  uses direct maps, so it exports clean (no bake needed — sidesteps the blotch bug).
- **Haircards** (`vrm_export.prepare_extras` + `simplify_hair_material`): HumGen's
  `convert_to_haircards` output is only *parented* (no skin) and its node-group
  alpha renders as a dark shard-soup. We weight it to `head` + rebuild the material
  as **MToon `alphaMode=MASK`** with a baked RGBA (RGB = hair tint, A = the strand
  mask from the `*_ALPHA` PNG's RGB) so cards cut out per-pixel. A **short** scalp
  cut is picked so cards don't drape over the face.
- **Expressions** (`vrm_export.configure_expressions`): VRM1 presets at
  `ext.vrm1.expressions.preset.<aa|ee|ih|oh|ou|happy|angry|sad|relaxed|surprised|blink|neutral>`;
  each `.morph_target_binds.add()` bind uses `.node.mesh_object_name` (str),
  `.index` (the morph **name** string in 4.3.1, not an int), `.weight`. The 5 mouth
  visemes bind the collapsed Oculus `viseme_*` morphs; emotion presets bind ARKit
  morphs (`mappings.VRM_VISEME_PRESETS` / `VRM_EXPRESSION_BINDS`). The full ARKit-52
  is additionally attached as VRM **custom** expressions (`expressions.custom.add()`)
  so the app can drive the `arkit` facial tier.
- **Textures embedded** downscaled to ≤1024 px + sparse shape keys
  (`export_try_sparse_sk`), landing a fully-clothed female avatar at ~38 MB.

### v2 fixes (`feat/aria-vrm-v2`) — eyes, leg-fold, framing

Three defects that survived the first native-VRM pass, each verified in a three-vrm
harness that reproduces the app's exact isVRM path (`VRMLoaderPlugin` +
`createVRMAnimationClip`, strip `Normalized_` / drop neck+head tracks, mixer on
`vrm.scene`, and — critically — **no** `vrm.update()` per frame, so the mixer drives
the RAW bones directly):

- **Blank white eyes → iris** (`vrm_export.simplify_eye_materials`): the earlier
  material-simplification dropped the iris. HumGen's eyes mesh has 3 material slots —
  an inner iris (`.HG_Eyes_Inner`, base colour = `.HG_Eye_Color.png` behind a Mix)
  and two outer cornea shells (`.HG_Eyes_Outer_*`, Glass/Mix shaders the glTF
  exporter flattens to **opaque white**, hiding the iris). Fix: rebuild the inner
  material as an opaque Principled fed by the iris colour map, and rebuild the outer
  shells as **transparent MToon** (`alphaMode=BLEND`, α≈0) so the iris shows through.
  Verified: exported eyes show a visible iris + pupil.
- **Legs fold up over the head under ANY clip** (`vrm_export.canonicalize_humanoid_rest`):
  the ROOT CAUSE is the exported rest pose, not the clip. HumGen's Rigify rig ships
  an A-pose whose deform bones carry large non-canonical rolls (upper_arm ≈ ±196°,
  thigh ≈ ±17°, foot ≈ −117°). The app strips the `Normalized_` prefix off the VRMA
  tracks and drives the RAW bones with values authored in three-vrm's NORMALIZED
  (world-axis-aligned) space; on a rig whose raw rest ≈ world axes (Erik / Work Boy)
  they map 1:1, but on HumGen's rolled rest they compose into a limb explosion — the
  legs fold up. Fix, weight-preservingly: (1) pose the deform chains into a true
  VRM-canonical **T-pose** (arms out ±X, legs straight down) and `pose.armature_apply`
  to bake it as the new rest (Blender re-binds the mesh); (2) **spine + legs** get an
  EDIT-mode reroll to a shared world-aligned frame → **identity** export node
  rotations + straight-down child offsets, matching Work Boy; (3) the **arms** get a
  weight-safe **pose-roll about their own axis + bake** (`_roll_correct_arms_via_pose`)
  — an EDIT-mode reroll of the arm bones detaches the forearm/hand skin, so they get
  the pose-roll instead. Verified: legs stay straight DOWN through idle / squat /
  crouch / dance clips (previously folded over the head).
- **Scale / head framing** — the export is already at natural human scale (head bone
  world Y ≈ 1.62 m, hips ≈ 0.87 m, ~1.8 m tall), matching the other VRMs, so the
  app's head-bone-relative camera (`AvatarModel.onHeadLocated`) frames it correctly.
  The earlier mis-framing was a *symptom* of the leg-fold collapsing the mesh; with
  the rest pose fixed, framing is correct.

> **Known residual:** raised-arm gesture clips that reach the forearm far overhead
> (e.g. `victory_sign`, `surprise_greet` at their peak) still shear the HumGen
> forearm/hand skin — a deep HumGen arm-skinning fragility through this
> `Normalized_`-stripped path. Standing, idle and gentle gestures render clean.

### Verified visually (three-vrm + headless Chromium)

Loaded `assets/avatars/humgen-aria-01.vrm` the way the app does (`VRMLoaderPlugin`
+ a shared VRMA via `createVRMAnimationClip`, dropping the clip's neck/head tracks
exactly like `AvatarModel.tsx`) and rendered shaded. Confirmed in an animated
arms-up gesture and a mouth-open (`aa`) close-up: **head attached to the neck,
teeth INSIDE the mouth (dY ≈ -0.002 m from the head, not at the chest), eyes in the
sockets with visible irises, clothing follows the arms with no explosion, no
blotched skin/clothing.** three-vrm resolves 16/16 required humanoid bones and 53
expressions (aa/ee/ih/oh/ou + happy/angry/sad/relaxed/surprised/neutral/blink +
35 ARKit customs); no NaN geometry.
