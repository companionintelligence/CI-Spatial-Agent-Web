# Where we stand against DLP3D

A capability comparison between **CI Spatial Companion** (this repo) and
**[DLP3D / Digital Life Project 2](https://github.com/dlp3d-ai/dlp3d.ai)**, the
SIGGRAPH Asia 2025 Real-Time Live system, read against its source at
`dlp3d-ai/dlp3d.ai@main` in September 2026.

DLP3D is the closest public comparable to what we are building: an open-source,
real-time, LLM-driven 3D avatar you talk to in a browser. It is worth measuring
against precisely because it is good.

## The one-sentence difference

**DLP3D generates animation on a server with neural models and streams it to a
thin client; we synthesise animation in the browser from a clip library and
signal heuristics.**

Almost every gap below follows from that single architectural choice.

---

## Architecture side by side

| | DLP3D | CI Spatial Companion |
|---|---|---|
| Renderer | Babylon.js 8 | three.js 0.182 + react-three-fiber |
| Physics | Havok (WASM), 6DOF constraints | none (Verlet spring chains only) |
| Body animation | **`speech2motion` — neural, generated per utterance** | fixed clip library, weighted category pick |
| Facial animation | **`audio2face` — neural, generated per utterance** | FFT bands + phoneme schedule + real TTS timings |
| Transport | protobuf over WebSocket, one orchestrator round trip | HTTP/SSE per service |
| Sync | shared timeline, per-track `start_idx` alignment | client composes audio and animation independently |
| Buffering | **adaptive jitter buffer, p90 learned from history** | per-sentence blobs, no jitter model |
| Lifecycle | **explicit FSM: 22 states, 24 conditions** | implicit booleans + a status store |
| Avatars | MMD / Genshin models, MMD physics config | GLB + VRM, 25 in roster, any URL |
| Deployment | Docker Compose, several GPU services | single nginx container + optional proxy sidecar |
| Locale | English + Chinese | English |

## What DLP3D has that we do not

### 1. Neural animation — the fundamental gap

`speech2motion` and `audio2face` are separate repos, separate GPU services. They
turn an audio stream into whole-body motion and facial blendshape tracks. This is
categorically different from what we do:

- Our body language is a **selection** problem — pick a plausible clip from ~40.
  Theirs is a **generation** problem — produce novel motion matched to this
  utterance's prosody, emphasis and content.
- Our lip-sync is now genuinely good at the mouth (real per-viseme timings from
  HeadTTS, coarticulated). But the mouth is not the face. `audio2face` drives
  brows, cheeks, eyelids and head motion from the same acoustic signal.

**We cannot close this with heuristics, and we should stop trying.** The honest
options are (a) integrate an existing audio2face model as a Hub sidecar, or
(b) accept clip-based motion as the product's ceiling and invest in clip quality
and blending instead.

The appliance context cuts both ways: we already ship GPU inference on the Hub,
so a sidecar is architecturally normal here. But it is a model to train or
license, not a weekend.

### 2. A shared timeline

`orchestrator_v4.proto` returns audio, motion and face in one response, each
track carrying `*_timeline_start_idx` so the client aligns them to a common
clock. Latency hiding is explicit (`first_body_fast_response`), as is blending
generated motion into and out of idle (`max_front_extension_duration`,
`max_rear_extension_duration`).

We compose independently: TTS audio plays, the viseme schedule reads
`AudioContext.currentTime`, body animation runs off its own mixer. It works
because the mouth is slaved to the audio clock — but there is no mechanism to
align a *gesture* to a *word*, which is what makes DLP3D's characters look like
they mean what they say.

**This is worth stealing regardless of whether we ever ship neural motion.** A
shared utterance timeline that gestures can be scheduled against is useful with a
clip library too: "play the emphatic gesture ON the stressed word" is not
possible today.

### 3. An adaptive jitter buffer

`AdaptiveBufferSizeEstimator` learns, from history, the buffer size at which 90%
of streams play through without starving — heap-selecting the p90 sample and
weighting it against the current estimate. It is ABR thinking applied to
animation.

We do not need this yet, because we play complete per-sentence audio blobs. We
*will* need it the moment anything streams.

### 4. An explicit conversation FSM

22 states, 24 conditions, in one machine. Ours is spread across booleans in
`useAgent` plus a `ConversationStatusState` store. Theirs makes illegal
transitions unrepresentable and gives every failure path a name
(`ALGORITHM_GENERATION_FAILED`, `WAITING_FOR_STREAMED_ANIMATION_INTERRUPTED`).

This is the cheapest high-value thing on the list. It is pure logic, fully
testable, and it would have caught at least two bugs we shipped and later fixed
by hand (the stuck `isSpeaking` flag; the frozen expression after barge-in).

### 5. Physics-driven secondary motion

Havok rigid bodies with 6DOF constraints per dynamic bone. We now have a Verlet
spring solver (`packages/engine/src/motion/SpringChain.ts`), which is the right
scope — but see the asset finding below, because on our roster it has nothing to
act on.

### 6. Relationship and richer affect

`RelationshipStage` (Stranger → Acquaintance → Friend → Situationship → Lover)
with a numeric score, persisted per character. An 8-way emotion taxonomy that
includes **Shyness** — an affect we have no equivalent for.

A companion product that never changes how it relates to you over months is
leaving its whole premise on the table. We have persistent memory as of Phase 7;
we have no model of the relationship itself.

### 7. Multi-character, and internationalisation

DLP3D stages more than one character and models the relationships between them.
It ships English and Chinese throughout. We are single-character and
English-only.

## What we have that DLP3D does not

Worth being clear that this is not a one-way comparison.

- **Runs with no GPU and no server.** Ours degrades to a browser-only install
  with scripted responses. DLP3D's quick start needs API keys and GPU services.
- **Local-first and private by construction.** Chat is brokered to the user's own
  Ollama through a same-origin proxy; nothing leaves the network. DLP3D's hosted
  option is explicitly cloud.
- **Avatar portability.** GLB *and* VRM, 25 in the roster, plus any URL, with
  automatic facial-tier detection (ARKit-52 / Oculus visemes / VRM expressions).
  DLP3D is effectively MMD-shaped.
- **Real per-viseme timings with coarticulation.** Our Tier A path takes exact
  viseme timestamps from the TTS engine, including a bilabial-closure floor so
  /p/ /b/ /m/ survive to the screen. Strong, and independent of any model.
- **WebXR and visionOS.** AR and VR sessions, plus a WebSpatial Vision Pro build.
  DLP3D is a flat browser canvas.
- **One container.** Against a Compose file of GPU services.

## An asset finding that outranks most of this

While building the spring solver I measured the shipped rigs with the harness's
new `listBones()`:

| Avatar | Format | Bones | Dangling (hair/cloth) |
|---|---|---:|---:|
| Greg, Ash, Jack | GLB (RPM-derived) | 67 | **0** |
| Kenji | VRM | 78 | 3 |
| Maya | VRM | 87 | 2 |
| Yuki | VRM | 259 | 170 |

**Our first-party GLB avatars have no hair or cloth bones at all.** Their hair is
a static mesh welded to the head. No amount of engine work makes them move,
because there is nothing to move. DLP3D's characters look alive partly because
their MMD source models ship dense secondary-motion rigs with physics config
attached.

This is an **asset pipeline** problem and it is likely the single highest
realism-per-effort item available to us — cheaper than neural motion by orders of
magnitude, and it unblocks the solver we already have.

## Recommended order

1. **Author secondary-motion bones into the first-party avatars.** Asset work.
   Unblocks code that already exists and is tested.
2. **Conversation FSM.** Pure logic, high robustness return, no new dependencies.
3. **Shared utterance timeline.** Lets gestures land on words; prerequisite for
   anything neural later.
4. **Relationship model.** Cheap next to its product value, and it is the part of
   "companion" we currently do not implement.
5. **Evaluate an audio2face sidecar.** The big one. Scope it honestly before
   committing — it is a model, not a feature.
6. **Internationalisation.** Mechanical, and gates entire markets.

Explicitly *not* recommended: adopting Havok, or moving to Babylon. Neither buys
anything our architecture cannot get more cheaply.
