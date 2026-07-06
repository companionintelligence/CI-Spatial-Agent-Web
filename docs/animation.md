# Animation — The Body Mixer & Expression Library

The **body** puppetry system: a state machine over `THREE.AnimationMixer` that plays and
blends a library of clips, plus the map of every expression and **how the LLM triggers
them**. Faces (visemes/emotes) are in [`avatar.md`](avatar.md); the big picture is in
[`architecture.md`](architecture.md).

Code: `packages/core/src/services/animation/` — `animationService.ts` (the state machine),
`config/animationClips.ts` (the catalog), `config/personalityConfig.ts` (cycling weights),
`useAnimationService.ts` (React hook). Clips are the shared `assets/animations/*.glb`.

## How the mixer works

Blending is delegated to three.js' native `AnimationAction.crossFadeTo` (with time-warp);
clip completion is driven by the mixer's `'finished'` event. One clip is "current"; a
one-shot gesture crossfades in over the base idle and returns to idle when it finishes.

```mermaid
stateDiagram-v2
  [*] --> Idle : initializeDefaultAnimation
  Idle --> Transitioning : performAction(immediate) — crossFadeTo(idle→clip)
  Transitioning --> Playing : transition settles (isTransitioning=false)
  Playing --> Transitioning : queued item drains / finite clip 'finished'
  Playing --> Idle : finite gesture 'finished' → advanceToNext → idle
  Idle --> Idle : cycling (optional) on cycle timer
  note right of Transitioning
    crossFadeTo interrupts an in-flight
    transition — immediate always plays now
  end note
  note right of Playing
    queue drains whenever a transition
    settles (not just on 'finished'),
    so gestures behind an infinite idle
    never stall
  end note
```

### The queue (why "mixing" now works)

A performance is either **immediate** (plays now, crossfading from whatever is current) or
**queued**. Queued items advance when:

1. a **finite** clip fires the mixer `'finished'` event, **or**
2. **any** transition settles and the queue is non-empty (`updateAnimation` drains it), **or**
3. personality **cycling** is enabled (off by default).

> Rule 2 is the fix for *"mixing not working"*: previously a gesture queued behind an
> **infinite** idle (which never fires `'finished'`) sat in the queue forever. Now the
> update loop drains it, `immediate` performances interrupt cleanly, and re-triggering a
> finite gesture replays it. Regression-tested in `animationService.node.test.ts`.

```mermaid
sequenceDiagram
  participant LLM as LLM response
  participant R as reactionIntegration
  participant AS as animationService
  participant MX as THREE.AnimationMixer
  LLM->>R: text → detectEmotionFromText → emotion + intensity
  R->>R: EMOTION_TO_CATEGORY[emotion] → category
  R->>AS: performAction({category, immediate, speed, blendTime})
  AS->>AS: pickLoadedClipByCategory(category)
  AS->>MX: currentAction.crossFadeTo(clipAction, blend, warp)
  MX-->>AS: 'finished' (finite clip)
  AS->>AS: advanceToNext → back to idle
```

## The expression library (full catalog)

Two catalogs, chosen by the active avatar's skeleton (`getAvatarCatalog(isVRM)`):
**GLB clips** for RPM/Mixamo/HumGen GLB skeletons, **VRMA clips** for VRM humanoids.
Durations are read from the real clip at load; `∞` = looping (`loopCount: Infinity`).

### GLB clips (33) — `GLB_CLIPS`

| Clip | Category | Loop | Blend ms | Speed | Notes |
|---|---|---|---|---|---|
| `idle-stable` | idle | ∞ | 1000 | 1 | default idle (priority 1) |
| `basic-idle` | idle | ∞ | 1000 | 1 | |
| `standing-idle-watch` | idle | ∞ | 1000 | 1 | |
| `Talking` · `Talking-1` · `Talking-2` | communication | 1 | 500 | 1 | talking beats |
| `Telling-A-Secret` | communication | 1 | 500 | 1 | |
| `Waving` | gesture | 1 | 500 | 0.9 | greet |
| `Arm-Gesture` · `Head-Gesture` | gesture | 1 | 500 | 1 | |
| `Happy-Hand-Gesture` | gesture | 1 | 500 | 1 | |
| `Hands-Forward-Gesture` | gesture | 1 | 500 | 0.9 | |
| `Whatever-Gesture` | gesture | 1 | 500 | 1 | |
| `Clapping` | gesture | 1 | 450 | 1 | |
| `Pointing-Forward` | gesture | 1 | 500 | 1 | wayfinding |
| `Salute` | gesture | 1 | 500 | 1 | |
| `Shoulder-Rubbing` · `Agreeing` | gesture | 1 | 500 | 1 | |
| `Surprised` · `Reacting` | expression | 1 | 400–500 | 1 | reactions |
| `Thinking` | expression | 1 | 600 | 0.9 | |
| `Looking` · `Looking-1` · `Looking-Behind` | expression | 1 | 600 | 1 | |
| `Shaking-It-Off` | expression | 1 | 450 | 1 | |
| `Cocky-Head-Turn` | expression | 1 | 500 | 1 | |
| `dance` · `dance-action` | action | 1 | 800 | 1 | priority 5 |
| `bow` · `throw` | action | 1 | 500–600 | 1 | |
| `Praying` · `Spin-In-Place` · `Crazy-Gesture` | action | 1 | 500–600 | 1 | |
| `walking` | movement | ∞ | 400 | 1 | locomotion base |

### Feminine motion set (7) — `FEMININE_CLIPS`

Female GLB avatars (detected from the model filename: `female`/`woman`) get **female-actor
mocap** for the motion-defining categories — masculine and feminine avatars move differently.
Clips come from the RPM animation library (same Mixamo skeleton, no retargeting; head/neck
tracks are dropped at load so the gaze service owns the head, mirroring the VRMA path).

| Clip | Category | Loop | Replaces |
|---|---|---|---|
| `F_Standing_Idle_001` *(default idle)* · `F_Standing_Idle_Variations_002` | idle | ∞ | `idle-stable` · `basic-idle` · `standing-idle-watch` |
| `F_Talking_Variations_001` · `F_Talking_Variations_002` | communication | 1 | `Talking` · `Talking-1` · `Talking-2` |
| `F_Dances_001` · `F_Dances_005` · `F_Dances_006` | action | 1 | `dance` · `dance-action` |

Unisex gestures/expressions/actions (`Waving`, `Clapping`, `bow`, …) are shared by both sets.
`getAvatarCatalog(isVRM, feminine)` picks the catalog; `FEMININE_GLB_CLIPS` is the merged
female catalog, so category-based selection (LLM reactions, cycling) automatically picks
feminine clips for female avatars. Assets: `assets/animations/rpm/feminine/` (~1.6 MB).

### VRMA clips (6) — `VRMA_CLIPS`

| Clip | Category | Loop |
|---|---|---|
| `idle_loop` | idle | ∞ |
| `surprise_greet` · `pose` | gesture | 1 |
| `victory_sign` · `finger_gun` · `dance_move` | action | 1 |

Categories: `idle · communication · gesture · expression · action · movement`.

## How to call animations with the LLM

### 1. Automatic (the default) — emotion → gesture

Every LLM response runs through `createReactionFromMessage(text)`, which detects an
emotion and maps it to an animation **category** (`reactionIntegration.EMOTION_TO_CATEGORY`).
The mixer then resolves a **loaded clip of that category** for the active avatar — so it
works for any skeleton without naming a clip.

| Emotion (from `detectEmotionFromText`) | Animation category | Example clips picked |
|---|---|---|
| `happy` | gesture | Waving, Clapping, Happy-Hand-Gesture, … |
| `love` | gesture | (gesture set) |
| `angry` | expression | Reacting, Cocky-Head-Turn, … |
| `fear` | expression | Surprised, Shaking-It-Off, … |
| `sad` | expression | Thinking, Looking, … |
| `disgust` | expression | (expression set) |
| `neutral` | — (stay in idle) | — |

`detectEmotionFromText` keys off keywords/emoji (e.g. *great/amazing/😊* → happy;
*sorry/😢* → sad; *furious/😡* → angry; *scared/😨* → fear; *gross/🤮* → disgust;
*love you/❤️* → love). `getEmotionIntensity` (*extremely/incredibly* → 0.8–1.0) modulates
playback speed (0.7–1.4×) and blend time.

**So: to make the avatar gesture, have the LLM's reply carry the emotion in its words** —
an enthusiastic reply naturally triggers a gesture; a somber one triggers an expression;
a neutral reply stays in idle. The lip-sync + facial emote fire from the same reaction.

### 2. Explicit — the performAction API

```ts
// Play a specific clip immediately, over the idle base:
animations.actions.performAction({
  clip: GLB_CLIPS['Salute'],   // or getAvatarCatalog(isVRM)[name]
  immediate: true,
  loopCount: 1,
  blendTime: 400,
  speed: 1
})

// Or by category (avatar-agnostic — resolves a loaded clip of that category):
animations.actions.performAction({ category: 'gesture', immediate: true, loopCount: 1 })

// Queue instead of interrupt (plays after the current finishes / settles):
animations.actions.performAction({ clip, immediate: false })
```

`AnimationPerformanceData`: `{ clip? | category?, immediate?, loopCount?, blendTime?, speed? }`.
Omit `immediate` to queue; the mixer drains the queue when the current transition settles.

### 3. Startup & interaction defaults

- **On load:** a greet clip (`getGreetClip`) plays, then crossfades to the looping idle.
- **Avatar click:** a random `action`-category clip + a happy emote.
- **Barge-in:** a user "stop/wait" (`shouldTriggerBargeIn`) aborts the LLM stream and relaxes the performance.

## QA — the visual gallery

Every clip is captured as a short animated **WebP** via the harness
(`apps/web/harness.html` → `e2e/capture/gen-webp.mjs`) into
[`docs/visual-tests/`](visual-tests/) — **93 clips across 6 avatars** (male + female · GLB + VRM),
organized into manifest-driven sub-pages: [body animations](visual-tests/animations.md) (63 — full
GLB catalog on Greg + a subset on Cara/Brad + the VRMA clips on Erik/Yuki),
[faces](visual-tests/faces.md) (24 — lip-sync + emotes on Greg/Cara plus the expressive VRMs
Yuki/Kenji), [eye movement](visual-tests/eyes.md) (2 — deterministic gaze + blink), and
[blend combos](visual-tests/blends.md) (4). Captures use isolated single-clip playback
(`__harness.captureClip`) with a first-frame trim so there's no crossfade/loop-seam glitch.

> Two clips are intentionally **excluded** from the fixed-camera gallery: `idle-stable` (the default
> idle's motion is below the WebP-lossy threshold — `basic-idle` is shown instead) and `walking`
> (root motion walks the avatar out of frame). VRM **facial** expressiveness is per-avatar: anime/VRoid
> VRMs (Yuki, Kenji) express fully; realistic imports (Erik) have empty expression binds and appear in
> the body pages only. See [`avatar.md`](avatar.md).

Regenerate with `node e2e/capture/gen-webp.mjs`. See [`TESTING-PIPELINE.md`](TESTING-PIPELINE.md) (layer L3).
