# Avatar Pipeline

> How human avatars load, and the **rig contract** every avatar must satisfy.
> Drafted 2026-07-04. See [ASSET-PIPELINE.md](ASSET-PIPELINE.md) for generating new avatars.

## 1. Loading — one loader, two runtime paths

`packages/core/src/components/scene/avatar/AvatarModel.tsx` loads **every** avatar through a single
`GLTFLoader` with `@pixiv/three-vrm`'s `VRMLoaderPlugin` (+ `MToonMaterialLoaderPlugin` under WebGPU),
then branches on extension:

```ts
const isVRM = selectedModel.toLowerCase().endsWith('.vrm')
const avatarScene = isVRM ? vrm?.scene : gltf.scene
```

- **VRM path** (`Takeshi`, `Savi`): bones from `vrm.humanoid`, visemes/emotes via
  `vrm.expressionManager`, `VRMUtils.rotateVRM0` for VRM0 orientation, forward = **−Z**.
- **GLB path** (all CI models, default `Liam`): traverse `gltf.scene` for morph targets + bones by
  name, forward = **+Z**.

Camera framing finds the head bone (VRM: `humanoid.getRawBone('head')`; GLB: first bone whose name
`includes('head')`) and sits 0.5 u in front. The code itself flags this as *"very manual and
hardcoded, must standardize avatar input"* — which is exactly what the asset pipeline standardizes.

## 2. The rig contract (what every avatar MUST expose)

Verified from the service code **and** from a shipping asset (`25-1-3_CI_model_male_Greg.glb`). This
is the **Ready Player Me export profile** — reproduce it or the avatar breaks.

**A. Visemes (lip-sync)** — `services/visemes/visemeTypes.ts`
- **GLB → 15 Oculus visemes**, morph targets **prefixed `viseme_`**: `viseme_sil, viseme_PP,
  viseme_FF, viseme_TH, viseme_DD, viseme_kk, viseme_CH, viseme_SS, viseme_nn, viseme_RR, viseme_aa,
  viseme_E, viseme_I, viseme_O, viseme_U`. The loader only collects morphs whose name
  `startsWith('viseme_')` — **the prefix is mandatory.**
- **VRM → 5 mouth expressions** `aa, ee, ih, oh, ou`. Auto-detected; an `OCULUS_TO_VRM_MAPPING`
  collapses 15 → 5.

**B. Facial morphs (emotes)** — `services/emote/emoteTypes.ts` `FacialTarget` is the full
**ARKit-52 blendshape set** (`eyeBlinkLeft/Right, browDownLeft/Right, browInnerUp, mouthSmile,
mouthFrownLeft/Right, jawForward, jawOpen, cheekSquint*, noseSneer*, …`). GLB collection keeps morphs
whose name includes `eye/brow/mouth/nose/cheek/jaw`. VRM emotes route through VRM expression presets
(`happy, angry, sad, relaxed, surprised, blink, neutral`).

**C. Humanoid bones** — GLB emote/gaze services look up **exact** names (`Head`, `Neck`, `Spine`,
`Spine2`, `LeftEye`, `RightEye`); VRM uses `vrm.humanoid.humanBones`. Neck drives gaze; eyes drive
the "is the user in view" cone test. RPM/Mixamo naming (`Hips, Spine, Spine1, Spine2, Neck, Head,
LeftArm, LeftForeArm, LeftHand, …`).

## 3. Avatar catalog (`AvatarOptions.ts`)

14 entries; default **`Liam`** (`LiamCES2.glb`). 12 GLB CI models + 2 VRM (`takeshi.vrm`, `savi.vrm`).
Asset-management drift to clean up: an un-catalogued `heather.glb` (86 MB); the real `.vrm` files
aren't in-tree (only a zero-byte `savi.vrm:Zone.Identifier`) — fetched at deploy or LFS.

## 4. Animation split + the bug (see [ANIMATION-PIPELINE.md](ANIMATION-PIPELINE.md))

VRM avatars use `.vrma` clips (retargeted to the VRM humanoid at load); GLB avatars use `.glb` clips
(must share the skeleton). **Two problems:** (1) the `gltfClips` filter is inverted
(`AvatarModel.tsx:44`) so the GLB-animation branch never gets a real `.glb`; (2) `ANIMATION_CLIPS` is
VRMA-only, so **the default GLB avatar has no working body animation** — the ~40 Mixamo GLB clips +
238 RPM clips on disk are unwired. Fixing this is the main payoff of wiring the animation manifest.

## 5. Why generate avatars (roadmap)

Personalization (roadmap P2) + giving GLB avatars real motion. The asset pipeline produces GLB **and**
VRM outputs that satisfy the rig contract above, from a HumGen3D human re-skinned onto the RPM
skeleton — see [ASSET-PIPELINE.md](ASSET-PIPELINE.md). A `validate_avatar.mjs` CI gate should assert
the `viseme_*` set, ARKit morphs, and RPM bones are all present before an avatar ships.
