# Facial Animation Plan — Tiered Systems for Heads of Varying Detail

The companion must lip-sync and emote across a wide range of heads: simple VRoid VRMs, RPM
pro models, parametric HumGen faces (FACS/ARKit), and eventually MetaHuman. Rather than one
face system stretched thin, we run **several facial-animation systems tiered by capability**,
behind one driver, and **standardize on VRM wherever possible**.

## The core idea: one vocabulary, tiered heads

Everything speaks **ARKit-52** internally (our `FacialTarget` already is the ARKit set, and
the emote mood configs already map emotions → ARKit blendshapes). A loaded head is classified
into the richest tier it can drive; the driver maps the ARKit-52 vocabulary onto whatever that
head exposes, degrading gracefully toward the VRM-standard baseline.

| Tier | Rank | Channels | Heads | Facial detail |
|---|---|---|---|---|
| `none` | 0 | 0 | body-only meshes | — |
| **`vrm-basic`** | 1 | ~12 | VRoid / legacy VRMs | 5 mouth visemes + emotion presets + blink/look |
| `oculus-viseme` | 2 | 15 | GLB w/ `viseme_*` | richer phoneme lip-sync |
| **`arkit`** | 3 | 52 | RPM pro, HumGen (`prepare_for_arkit`) | per-eye, brow, cheek, jaw, lip detail |
| `facs` | 4 | 43 | HumGen native FACS | anatomical muscle AUs (authoring-side) |
| `metahuman` | 5 | ~700 | MetaHuman (roadmap) | photoreal, ARKit-bridged |

Implemented in `packages/core/src/services/face/`:
- **`facialTiers.ts`** — the tier model + canonical `ARKIT_52`, `OCULUS_VISEMES`,
  `VRM_STANDARD_EXPRESSIONS`, and `detectFacialTier(names)`.
- **`facialCapabilities.ts`** — `inspectFacialRig({scene|vrm})` walks a loaded head's morph
  targets (GLB) or expression map (VRM) and returns its tier + channels. 11 unit tests.

This mirrors the render-target `presetFor(surface)` seam from the WebSpatial work: detect
capability once at load, dispatch by tier.

## "Use standard VRM as much as possible"

VRM 1.0's expression system is the unifier. It carries the **standard** mouth visemes
(aa/ee/ih/oh/ou) + emotion presets (happy/angry/sad/relaxed/surprised/neutral) + blink/look —
**and arbitrary custom expressions.** So a detailed head can ship its ARKit-52 / FACS detail as
VRM *custom* expressions and flow through the one VRM runtime path (`vrm.expressionManager`).

Consequences we lean into:
- **Export HumGen as VRM 1.0**, not RPM-GLB. VRM brings its own humanoid rig standard, so
  `@pixiv/three-vrm-animation` retargets the VRMA clips via the humanoid bone map — **no RPM
  re-skin, no bone-rename** (this is exactly the fragility that broke clothed "Aria"). The
  ARKit-52 shape keys become VRM custom expressions; the 5 standard visemes + presets come for
  free. One head, one standard, both face and body solved.
- The **facial detail tier = how many expressions the VRM defines.** A VRoid VRM is
  `vrm-basic`; a HumGen-VRM with ARKit customs is `arkit`. The driver reads what's there.
- Non-VRM GLB (the existing 14 CI pro models) stays supported via the morph-target path
  (`arkit`/`oculus-viseme` by name) — a compatibility tier, not the target.

## Blender tooling reality (what we own, what's missing)

From a fresh inventory of the installed addons + the `~/Desktop/BlenderTools` stash:

- ✅ **HumGen3D 4.0.29 (installed)** — the FACS→ARKit engine. `load_facial_rig()` loads ~48
  FACS shape keys (30 face-rig bones); `prepare_for_arkit` renames `_L/_R`→`Left/Right` to emit
  **standard ARKit names for free**. This is the ARKit-52 *source*. Keep the pipeline's
  `load_facial_rig → prepare_for_arkit` flow (`pipeline/lib/facemorphs.py`).
- ✅ **Blender MCP (installed)** — scripts/automates the above.
- ✅ **Pipeline synthesis (in code)** — `facemorphs.py` derives the **15 Oculus visemes** and
  the **VRM 5-viseme + emotion presets** from the ARKit base; no plugin needed for those tiers.
- ◑ **Auto-Rig Pro 3.78.28 (owned, NOT installed)** — has a facial rig / face-mocap path;
  install only if we want bone-based facial mocap or to retarget the `animation-library`
  expression FBX clips.
- ❌ **VRM addon (`io_scene_vrm`) — NOT installed, NOT owned.** This is the **critical gap** for
  the VRM-standard strategy above: to export HumGen (or any Blender head) as a real `.vrm` with
  authored expressions, we need it. **Action: install `VRM_Addon_for_Blender`** and verify
  `pipeline/lib/vrm_export.py` targets it (today VRM export is scaffold-only).
- ❌ **Faceit — not owned.** The pipeline reproduces ARKit-52 from HumGen, so it's optional; it
  would be the drop-in to put ARKit-52 on a *non-HumGen* mesh (e.g. the legacy CI GLBs).
- ❌ **No MetaHuman-interop tooling** — see roadmap.

## MetaHuman — on the roadmap (now viable)

**The blocker lifted.** MetaHuman **5.6 (June 3 2025)** left Early Access and **dropped the
Unreal-only license restriction** — MetaHumans can now be used, exported, and **sold outside
Unreal** (Unity/Godot/**web**), royalty-free as "non-engine products," free under $1M/yr revenue.
Sources: [metahuman.com 5.6 release](https://www.metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release), [CG Channel (Jun 2025)](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/).

Why it fits our model:
- The rig is **FACS-based (Rig Logic)** and **ARKit-52 compatible by design** — Live Link Face
  maps the 52 ARKit coefficients onto a MetaHuman face with no retargeting, and Epic ships a
  `PA_MetaHuman_ARKit_Mapping` asset. So MetaHuman plugs into the **exact ARKit-52 seam** we
  already drive.
- Export path exists: **DNA → ARKit-52 (BlendShapeExporterV2 / UE5.6 DNA tutorial) at low LOD →
  FBX → glTF** (Blender; morph targets survive). You get an ARKit-52 blendshape face for the
  web, not the full 700-joint in-engine fidelity — treat it as a per-character offline bake.

Roadmap slotting — a **"Later" premium photoreal tier**, reusing the ARKit-52 layer, after the
VRM path is solid. Honest limits: not VRM-native (a second, heavier GLB avatar class behind the
same blendshape driver); no Rig-Logic wrinkle/tension maps on the web; heavy polycount → LOD
discipline.

> ⚠️ **Legal gate before shipping MetaHuman.** The EULA permits web/commercial use but
> **prohibits using MetaHuman assets to train or enhance AI models.** For an AI-driven avatar:
> rendering/animating a MetaHuman = fine; feeding its geometry/animation into model training =
> prohibited. Verify the exact clause with counsel (this is a `legal:compliance-check` task)
> before any commercial ship.

## Phased plan

1. **Foundation (this PR)** — tier model + capability detector + tests. ✅
2. **Driver dispatch** — refactor `visemesService`/`emoteService` to select their mapping by
   `inspectFacialRig(...).tier` at head load (they already branch VRM vs GLB; formalize into
   tier-keyed drivers). Wire `inspectFacialRig` into `AvatarModel` load; log the tier.
3. **VRM-first HumGen** — install `io_scene_vrm`; add a VRM export path to the pipeline (HumGen →
   VRM 1.0 with ARKit-52 as custom expressions + standard presets). Fixes Aria's rig fragility
   at the source and makes HumGen a first-class `arkit`-tier VRM.
4. **Detail up the legacy GLBs** — for CI pro models missing ARKit, either author via Faceit or
   accept `oculus-viseme`. Surface the tier in the avatar picker so detail is visible.
5. **MetaHuman tier (Later)** — after legal sign-off: DNA→ARKit-52→glTF bake of one MetaHuman,
   loaded through the same ARKit-52 driver as a photoreal option.

## Verification note

The rig-contract validator checks morph/bone **presence**, not geometry — it passed the broken
clothed Aria. Facial tiers must be **visually** verified (the WebP harness drives visemes/emotes
per tier). Add a per-tier row to the capture matrix as tiers land.
