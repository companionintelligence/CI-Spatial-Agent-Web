# Avatar Animation Pipeline

> How avatar body animation works, the current gaps, and the plan to make animations
> data-driven and wire the 200+ Ready Player Me library. Drafted 2026-07-04.

## 1. Overview

```
motion asset (GLB / VRMA)  →  load + retarget + rename  →  drei useAnimations (mixer + actions)
    →  animationService (state machine: crossfade, queue, cycling, personality)
    →  triggers (startup · avatar click · chat/LLM breath)  →  avatar
```

Everything lives in `packages/core/src`. The default avatar is hardcoded to
`AvatarOptions.Liam` → `/assets/avatars/LiamCES2.glb` (`AvatarModel.tsx:21`).

## 2. Two skeleton families (the key mental model)

Clips are only interchangeable **within** a skeleton family without a retarget step.

| Family | Avatars | Clips | Retarget |
|---|---|---|---|
| **RPM / Mixamo GLB** | all CI GLB models (`LiamCES2`, `25-1-3_CI_model_*`, `rpm-mixamo-*`, `unbranded-*`) | the 39 bundled GLB clips **+ the 240 RPM library clips** | **none** — identical bone names (`Hips`, `Spine`, `LeftArm`, `Head`, … under `Armature`) |
| **VRM humanoid** | `Takeshi`, `Savi` (`.vrm`) | the 9 VRMA clips | per-VRM via `createVRMAnimationClip(anim, vrm)` at load |

**Verified:** the CI GLB avatars, the 39 bundled GLB clips, and the RPM animation-library
(`/Users/liam/devel/3d/animation-library-master`) all share the identical RPM/Mixamo bone set —
so the **RPM 240-clip library is drop-in for every GLB avatar with zero retargeting.** GLB
(Mixamo-named) clips are *not* directly compatible with the VRM humanoid.

## 3. Load path (`AvatarModel.tsx` → `useExternalAnimations`)

- Clips split by extension: `.vrma` → VRMA loader path; else → GLB path.
- **VRMA:** loaded with `VRMAnimationLoaderPlugin`, retargeted to the current VRM, `Normalized_`
  prefix stripped, and **neck/head tracks dropped** (so body motion doesn't fight gaze/visemes).
- **GLB:** bundled GLB clips carry an internal name `Armature|mixamo.com|Layer0`; the code renames
  each to its config key so `actions[clipName]` resolves.
- **Duration scaling:** `updateAnimationDurations` overwrites each clip duration with
  `real_seconds × 0.6 × 1000` ms — an unexplained global shortening factor feeding blend/relax math.
- Actions/mixer are built by drei `useAnimations(allAnimations, avatarRef)`, then handed to the
  service via `animationService.actions.setup(actions, mixer, avatar, idle_loop)`.

## 4. The animation service state machine (`animationService.ts`)

Refactored to native three.js (see [ci_core_architecture] history): `crossFadeTo` with time-warp
for blends, a mixer `'finished'` listener to advance finite clips, a `queue`, personality-based
cycling (six personalities, category weights; **cycling defaults off**), and `makeAdditiveClip`
scaffolding (present but unused). Public API: `setup`, `performAction`, `update`, `enqueue`,
`setPersonality`, `reset`.

## 5. Triggers

1. **Startup** — plays `surprise_greet` then queues `idle_loop` + a happy emote.
2. **Avatar click** — plays a random `action` clip, then re-queues `idle_loop`.
3. **Chat / LLM** — on each LLM breath, `createReactionFromMessage()` applies a facial emote and,
   if it returns an animation, plays it.

## 6. The gaps (audited)

- **The default "Liam" GLB avatar plays ZERO body animations.** Only VRMA clips are wired, and the
  loader only feeds VRMA to VRM avatars — so a GLB avatar gets an empty action set. The rich gesture
  library only comes alive for the two VRM avatars, and even then only the 6 wired VRMA.
- **~42 shipped animations are dead assets:** `animationClips.ts` wires only **6** clips; the other
  **39 GLB** + **3 VRMA** in `public/assets/animations/` are never referenced. `AnimationOptions` is `{}`.
- **Chat never drives body animation:** `selectAnimationForPerformance` (`reactionIntegration.ts`)
  has its entire emotion→clip mapping commented out and always returns `undefined` — it was written
  against the unwired 39 GLBs (`ANIMATION_CLIPS.wave`, `.bow`, … don't exist).
- **Bugs:** the `gltfClips` filter is inverted (`!endsWith('.glb')`); `useAnimationService.enableCycling`
  toggles the wrong flag (`enabled`, not `cyclingState.cyclingEnabled`), so cycling can't be enabled
  via the public API.

## 7. Plan — make animations data, not code

**A generated manifest** (`apps/web/public/assets/animations/manifest.json`) is the source of truth,
replacing the hardcoded `ANIMATION_CLIPS`. Per-clip record:

```jsonc
{ "id": "rpm.glb.dance.M_Dances_001", "name": "M_Dances_001",
  "path": "/assets/animations/rpm/dance/M_Dances_001.glb",
  "format": "glb", "skeleton": "rpm-mixamo", "category": "action",
  "motionSource": "male-actor", "duration": 4.2, "loop": false, "blendTime": 600 }
```

Steps:
1. Extend `AnimationClip` with `format` / `skeleton` / `id` / `tags`.
2. Add `tools/generate-animation-manifest.mjs` (walks the asset trees, extracts duration/loop from
   each glTF/VRMA, derives category + skeleton) wired into `prebuild`.
3. Add `config/animationManifest.ts` — `getClips({ skeleton, category })`; keep a small `NAMED_CLIPS`
   alias (`idle_loop`, `surprise_greet`, …) for the startup/click call sites.
4. In `useExternalAnimations`, **filter by the active avatar's `skeleton`** (not by extension) — this
   immediately lights up the 39 GLB clips for GLB avatars — and fix the inverted filter.
5. Re-enable `selectAnimationForPerformance` to map emotions/actions to **manifest categories**
   (`pickRandom(category, skeleton)`), so chat finally drives gestures.
6. Import the RPM 240 clips into `assets/animations/rpm/{idle,dance,expression,locomotion}` and
   **lazy-load by category** (see risks). Map RPM's 4 dirs → CI's 6 categories.

**Category mapping (RPM → CI):** `idle→idle`, `locomotion→movement`, `dance→action`,
`expression/Talking_*→communication`, `expression/Standing_Expressions_*→expression`.

## 8. Risks

- **Bundle size:** the RPM 240 clips ≈ **33 MB** on top of the existing 15 MB GLB + 6.6 MB VRMA, and
  today **everything is eager-loaded**. Wiring 240 clips into that pattern would download ~55 MB and
  build ~280 mixer actions before first frame. **Must** switch to manifest-filtered lazy loading
  (eager: idle + startup set; on-demand: everything else). Never eager-preload the full RPM set.
- **VRM ↔ GLB skeleton mismatch:** GLB/RPM clips won't animate VRM avatars without a Mixamo→VRM
  humanoid remap; keep the `skeleton` gate strict and make GLB→VRM retarget opt-in + tested.
- **Duplicate asset trees:** `apps/web` and `apps/vision-pro` each hold full copies — importing 240
  clips naively triples the footprint. Consolidate to a shared location or a copy step first.
- **Re-enabling chat→animation** changes runtime behavior a lot (gesture on every LLM breath); needs
  blend/queue tuning so gestures don't thrash against `idle_loop`.
- **`× 0.6` duration factor** feeds relax/blend timing; audit it once clips of very different lengths
  (multi-second RPM dances/locomotion) enter the pool.

_Retargeting toolchain (for VRM support + future custom rigs): Auto-Rig Pro is owned — see
[docs/ASSET-PIPELINE.md](ASSET-PIPELINE.md) and [docs/DRIVE-ASSETS.md](DRIVE-ASSETS.md)._
