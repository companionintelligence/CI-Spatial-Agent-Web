# Companion Gap Analysis — Voice · Avatar · Animation · LLM · Functionality

_Benchmarks CI-Spatial-Companion-WebXR against five open reference avatar/VTuber projects and
turns the deltas into a prioritized, file-level improvement plan. Generated from a multi-agent
audit of this repo (branch context: post-`feat/gallery-qa`) cross-referenced with the five repos
below. File:line refs marked ✅ were re-verified against the live source; the rest come from the
audit and should be spot-checked before implementation._

## TL;DR

This app is **architecturally ahead** of most reference repos for a privacy-first spatial
companion: browser-rendered VRM/GLB on react-three-fiber, a real streaming Hono BFF, breath-chunked
TTS, VAD barge-in, and a rich emote/gaze/viseme service layer. The gaps are **less "missing
subsystems" and more "half-wired seams and correctness bugs that strand capability that is already
80% built."** A striking share of the highest-value fixes are one-to-few lines that light up
dormant engines.

Three strategic through-lines, ranked:

1. **Memory is the flagship hole.** The CI-Server "Companion Memory" adapter is a literal
   `not implemented` stub ([`apps/proxy/src/upstreams/ciServer.ts:19`](../apps/proxy/src/upstreams/ciServer.ts)),
   and there is **zero** conversation persistence, RAG, or context-window management. Every
   reference repo at least persists conversation. This is the owner-priority integration and the
   thing that turns a talking avatar into a companion.
2. **Voice fidelity & latency.** Lip-sync is text-approximated with `Math.random()` inter-word
   pauses (the declared Whisper alignment model is never run), there is **no** amplitude fallback
   (zero `AnalyserNode` in the tree), and the client discards the BFF's streaming by buffering
   `response.arrayBuffer()` before playback. `spar` (Azure viseme events + JALI coarticulation) and
   `Scthe` (Oculus viseme + lead/delay) set the accuracy bar; `PunithVT`/`Scthe` set the
   sentence-streaming latency bar.
3. **Identity.** One static system prompt is shared by every avatar. `spar`'s per-character CMS and
   `Open-LLM-VTuber`'s `characters/` bundles show persona should bind `{prompt, voice, avatar,
   emotion-map}` together, and both show model-driven emotion beating our English-keyword heuristic.

---

## The five reference repos

| Repo | Stack / render | Voice + lip-sync | LLM binding | Standout ideas | License gotchas |
|---|---|---|---|---|---|
| **[spar-app/spar-services](https://github.com/spar-app/spar-services)** | Python FastAPI + Node TTS svc; **UE5 MetaHuman rendered server-side, Pixel-Streamed** (WebRTC video) | Azure Speech; **viseme-EVENT lip-sync** (`visemeReceived` + `<mstts:viseme>`), JALI coarticulation (bilabial ±30 ms, dedup, ~150 ms blend norm); SSML `express-as` emotion | vLLM **Qwen2.5-0.5B + LoRA** (persona), gpt-4o-mini **emotion classifier**, Claude for offline scenario authoring (Mirascope + Pydantic structured output + self-correcting retries), Redis session state | Per-character **Persona CMS**; decoupled emotion channel driving voice + face; Silero VAD barge-in | MIT (archived read-only) |
| **[Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)** | Python backend + **Live2D** web frontend | **7 ASR + 10 TTS** adapters; **amplitude→MouthOpenY** lip-sync (engine-agnostic) | ~10 LLM backends; **LLM emits `[joy]/[sad]` emotion tags** (regex-stripped, mapped to expressions — no classifier); **MCP tool-calling + status UI**; proactive speech; group conversation | Config-driven **`characters/` bundles** (prompt+model+voice+avatar); screen/cam ambient context; pet-mode overlay | MIT (Live2D sample models restricted) |
| **[PunithVT/ai-avatar-system](https://github.com/PunithVT/ai-avatar-system)** | Full cloud stack (Postgres, Celery, Terraform/ECS); **MuseTalk diffusion talking-head** (server-rendered) | faster-whisper; **Chatterbox zero-shot voice clone** (23 langs); **cascade TTS fallback**; **sentence-chunked streaming** synthesis (~1–2 s TTFW) | Provider-agnostic + 100% local mode (Ollama/vLLM); per-message emotion badge | **JWT + rate-limit + Postgres persistence + session resume**; observability (Prometheus/Sentry/OTel) | MIT |
| **[Scthe/ai-iris-avatar](https://github.com/Scthe/ai-iris-avatar)** | **Unity HDRP** desktop; Python STT/TTS svc | **Oculus Lipsync** (audio→viseme) with **lead/delay** offset; XTTS voice clone | Local (Ollama) | **Spring-bone hair physics**; **eye saccades + arbitrary-object gaze**; distinct idle-vs-speaking sets; **remote event-trigger API** (WS `play-vfx` + HTTP `/prompt`); **latency dashboard** | GPLv3; XTTS **non-commercial**; Oculus Lipsync **Oculus-SDK-licensed** (avoid libs, copy concepts) |
| **[OpenReplicant/ProtoReplicant](https://github.com/OpenReplicant/ProtoReplicant)** (Alli) | Browser **VRM** (VU-VRM / Automattic), three.js-style | Faster-Whisper (tiny); Coqui TTS; viseme mouth from TTS | Kobold Horde / AI Horde (pygmalion-6b); character prompt template + **persistent chatlogs**; import/export personas | **Drag-drop VRM** avatar swap; "broadcast-ready" | Unspecified |

**Closest peers to us:** ProtoReplicant (browser VRM, same pipeline shape) and Open-LLM-VTuber
(local-first, adapter-rich). **Highest-fidelity but wrong architecture for us:** spar (UE Pixel
Streaming) and PunithVT (MuseTalk diffusion) are cloud-GPU, server-rendered video — the opposite of
a browser VRM companion. **Borrow their techniques (viseme events, emotion classifier, streaming,
voice clone), never their deployment model.**

### What NOT to copy

- **spar's UE Pixel Streaming** and **PunithVT's MuseTalk diffusion** — cloud-GPU server-rendered
  video; fights local-first/WebXR. Take the viseme-event, emotion-classifier, streaming, and
  voice-clone techniques only.
- **Unity/HDRP (Scthe)** and **Live2D 2D (Open-LLM-VTuber)** as engines — we are three.js/VRM/GLB.
- **Oculus Lipsync** (Windows-only, Oculus-SDK license) and **XTTS** (non-commercial) — replicate
  the *concept* in JS/WASM against the already-integrated **CosyVoice2** instead.
- **spar's per-session AWS/Azure GPU orchestration** and **PunithVT's Terraform/ECS/Celery** — CI
  is an appliance; CI-Server already owns persistence.
- Product-specific pieces: spar's sales-grading/scenario-authoring, Open-LLM-VTuber's BiliBili
  live-stream client. Langfuse/Sentry/OTel are fine but low priority for a local box.

---

## Current state of our stack (what already exists)

| Subsystem | We have | Key files |
|---|---|---|
| **Voice — TTS** | Breath-chunked streaming BFF (`/api/tts` → CosyVoice2), anti-buffering headers, in-order playback queue | `apps/proxy/src/routes/tts.ts`, `upstreams/cosyvoice.ts`, `services/tts/ttsService.ts` |
| **Voice — STT/VAD** | Web Speech API STT, Silero-style VAD that gates STT | `services/stt/sttService.ts`, `services/vad/vadService.ts` |
| **Voice — visemes** | Viseme sequence + per-frame rig application (VRM expressionManager + GLB morphs) | `services/viseme(s)/visemeService.ts` |
| **Avatar/render** | r3f scene, VRM + GLB loaders, 30-avatar catalog, WebGPU path, Vision-Pro WebSpatial build | `components/scene/**`, `AvatarOptions.ts` |
| **Animation** | Native `crossFadeTo` mixer state machine, 33 GLB + 6 VRMA clips, **feminine motion set**, 6 personality presets | `services/animation/animationService.ts`, `config/animationClips.ts`, `personalityConfig.ts` |
| **Emote/face** | Mood baselines, auto-blink, camera-geometry gaze, facial ticks, ARKit-52 + VRM expression paths | `services/emote/**` |
| **LLM** | Provider-agnostic streaming (Ollama/proxy/OpenAI/MLC/script), 3-layer runtime config, Settings panel | `services/llm/**`, `config/**`, `components/control/SettingsPanel.tsx` |
| **Integration** | `text → emotion → animation category → clip` reaction hook; barge-in path | `services/integration/**`, `hooks/useAgent.ts` |

We are **not** starting from zero on any axis. The work is finishing seams.

---

## Prioritized gap matrix

Impact × effort. **Effort:** S ≈ hours · M ≈ 1–3 days · L ≈ 1–2 wks · XL ≈ multi-week/cross-repo.

### P0 — Critical / flagship

| # | Gap | Area | Effort | Evidence & seam |
|---|---|---|---|---|
| 1 | **No persistent / long-term / retrieval memory.** History is fresh React state each mount; no conversation persistence, no RAG/embeddings, no context-window management (unbounded history resent every turn). | functionality | XL | Stub `ciServer.ts:19` yields `not implemented`; `llmService.ts` seeds only `SYSTEM_PROMPT`. Every reference repo persists conversation. **Fix:** implement `createCiServerAdapter.chat()` onto the existing normalized `ChatEvent` SSE contract (zero client change); add a retrieval step before the call + inject at the `getSystemPrompt()` seam; persist transcript to CI-Server (PostgreSQL 18 + pgvector) after each turn; client-side IndexedDB cache for offline resume; token-budgeted history truncation/summarization. **De-risk:** land client-side persistence + history truncation first (M) so the companion survives reloads before the CI-Server side is ready. |

### P1 — High impact, mostly small (quick wins)

| # | Gap | Area | Effort | Evidence & seam |
|---|---|---|---|---|
| 2 | **STT drops speech after the first segment.** ✅ | voice | **S** | `sttService.ts:217` `for (let i = event.resultIndex; i < 1 && i < event.results.length; ++i)` — once `resultIndex` advances past 0 the body never runs. **Fix:** iterate to `event.results.length`, dispatch on `.isFinal`. Add a multi-segment-event unit test. *(verified in live source)* |
| 3 | **VRM spring bones never tick** — hair/skirt/accessory jiggle frozen on every VRM. ✅ | avatar | **S** | `AvatarModel.tsx:390` calls only `vrm.expressionManager?.update()`; no `vrm.update(delta)`. **Fix:** call `vrm.update(delta)` (drives expressions + lookAt + spring bones in one call) — but **verify it doesn't double-apply expressions or fight the gaze service's manual neck/eye control**; gate physics rate via `getPerformanceHints.physicsUpdateRate` on headsets. |
| 4 | **Personality idle-cycler is dead code** — `enableCycling()` toggles the wrong flag, so the avatar sits in one looping idle. ✅ | animation | **S** | `useAnimationService.ts:39` calls `setAnimationEnabled` (master gate) not `cyclingState.cyclingEnabled`. The whole weighted-random idle picker + 6 personalities never run. **Fix:** correct the setter; default cycling on for conversational scenes; confirm clips exist per category so picks don't no-op. *(bug verified; enabling is a behavior change — test before shipping)* |
| 5 | **Client TTS playback is non-streaming** — discards the BFF's chunked streaming by buffering `response.arrayBuffer()` before decode, so time-to-first-sound waits on the whole clip. | voice | L | `ttsService.ts:184/231` buffer then `decodeAudioData`. BFF already streams (`tts.ts`), CosyVoice pipes `res.body` untouched. **Fix:** MSE `SourceBuffer` or Web-Audio ring-buffer via `response.body.getReader()`; start playback on first chunk; abort on barge-in. Biggest perceived-latency win with #6. |
| 6 | **Cross-turn barge-in doesn't stop network providers.** A new user turn doesn't abort the in-flight Ollama/proxy/OpenAI stream; its breath fragments keep calling `tts.speak()`. Only MLC truly stops. | llm-binding | M | Interrupt passed **by value** into `processUserInput` (`llmService.ts:290`), so stale-work guards never fire. **Fix:** thread interrupt as a live getter/ref or per-turn `AbortController`; check before every `tts.speak()`; reuse the `AbortController` the BFF already honors on disconnect (`chat.ts:45`). `useAgent` already resets on barge-in — this makes the LLM/TTS actually stop feeding it. |
| 7 | **Amplitude mouth fallback absent** — zero audio analysis in the tree, so the cheap "jaw follows loudness" safety net under viseme drift doesn't exist. | voice | S | No `AnalyserNode` anywhere (verified empty). **Fix:** add one in `ttsService.playAudioBuffer`, compute RMS, drive jaw-open through the ready-made `visemesToRig` `amplify` param. This *is* Open-LLM-VTuber's whole lip-sync as a robustness floor. |
| 8 | **Lip-sync is text-approximated, never phoneme-accurate.** Visemes from a fixed-150-WPM guess + `Math.random()` pauses; declared `Xenova/whisper-tiny` alignment model never imported. | voice | L | `tts/whisperDataGenerator.ts` (random pauses); `ttsConfig.ts:17` whisper-tiny referenced nowhere. **Fix:** emit real word timings — BFF/CosyVoice returns word timestamps, or run whisper-tiny/whisperX in a Web Worker on synthesized audio; thread real `WhisperData` into `visemes.generateSequence`. Port spar's JALI coarticulation into `lipsyncConvert`. Ship #7 first as the net. |
| 9 | **No self-hosted/offline STT** — Web Speech API is Chromium-only and streams mic audio to Google; absent in Firefox/most XR browsers. The VAD already captures utterance audio and throws it away. | voice | L | `sttService.ts:89` browser-only; `STTConfig.remote/apiKey` unused; `vadService.ts:82` ArrayBuffer discarded. **Fix:** BFF `/api/stt` Whisper route (faster-whisper/whisper.cpp) paralleling `/api/tts`; a `remote` branch that forwards the VAD-captured audio. Makes voice-in work offline and in non-Chrome XR. |
| 10 | **Single static persona for every avatar** — one generic prompt; identity decoupled from the chosen 3D avatar (Yuki/Kenji/Erik/Greg talk identically). | llm-binding | M | `systemPrompt.ts:5` one prompt; `AvatarOptions` carries no persona/voice. **Fix:** `Persona` schema `{systemPrompt, voiceProfile, llm overrides, emotion-tag map, avatar binding}` attached per `AvatarOptions` entry; inject at `getSystemPrompt()` seam + thread `voiceProfile` to TTS; inject persona server-side too so the CI-Server adapter inherits it. |
| 11 | **Emotion→face is a brittle English keyword/emoji heuristic** — misfires on paraphrase/other languages; intensity never reaches the face; 3 of 9 emotions unreachable. | animation | M | `emotionIntegration.ts` substring match (English-only); emotion applied at hardcoded 0.8 weight; intensity only scales clip speed. **Fix:** adopt Open-LLM-VTuber's model-agnostic **tag pipeline** — inject `[joy]/[sad]` vocab into the persona prompt, regex-strip tags from breath text before TTS, route tag→emotion+category through the existing `createReactionFromMessage` hook; feed intensity into `applyEmotion` to scale amplitude. No second model. |

### P2 — Medium

| # | Gap | Area | Effort | Note |
|---|---|---|---|---|
| 12 | **No tool/function-calling / MCP** — the companion talks but can't act (calendar, search, device, memory writes). `ChatMessage` is text-only. | functionality | L | Extend the `ChatEvent` contract for tool-call/result events; MCP client in the Hono BFF (keys server-side); dispatch at the `useAgent` `onResponse` seam; start with 3 safe local tools (time, memory query, web search). |
| 13 | **No voice cloning / per-avatar voice** — one global voice string; every avatar sounds the same. | voice | M | Extend `TtsRequest` + `/api/tts` body with a reference-audio field; thread `voiceProfile` via `AvatarOptions`. **CosyVoice2 already supports zero-shot cloning** — no new engine. Pairs with #10. |
| 14 | ~~**Default TTS targets an ad-hoc `localhost:8000` Pocket server, not the same-origin BFF.**~~ **FIXED** | architecture | S | `ttsConfig.ts` now defaults `mode:'browser'`. The originally-proposed flip to `'remote'` was *not* taken: `/api/tts` needs the BFF **and** a CosyVoice2 upstream, so it has the same silent-text failure the note warned about. `'browser'` is the only mode with no dependency at all, so it is the floor; `remote`/`pocket`/`local` remain opt-in upgrades via `VITE_TTS_MODE`. |
| 15 | **Additive layering is dead code** — every gesture fully replaces the base idle, losing breathing/sway ("frozen while gesturing"). | animation | M | `makeAdditiveClip`/`blendMode:'additive'` exist but no clip is tagged additive. **Fix:** tag a breathing/weight-shift idle as additive, run it as a concurrent action composited after the base clip. Needs one authored additive clip per skeleton family. |
| 16 | **No proactivity / external event channel** — model only invoked reactively (STT or submit). | functionality | M | **Fix:** idle/proactivity timer + a BFF event channel (SSE/WS) that pushes "speak this" / "play this" into `useAgent`, mirroring Scthe's remote-trigger API. Gate proactive speech behind gaze/presence. Natural hook for CI-Server/capture clients to drive the companion from real-world context. |
| 17 | **No TTS fallback chain** — *partially addressed.* A dead primary no longer latches **silent**-text degradation on the pocket path: an unreachable Pocket server now degrades to browser `speechSynthesis` for the session (`ttsService.ts`, `degradedToBrowser`). Still missing: the same fallback for `remote`/`local`, and any intermediate-quality tier. | voice | M | **Remaining fix:** add XTTS/Piper/Edge adapters on the existing `TtsAdapter` interface; ordered fallback (CosyVoice → Piper → browser `speechSynthesis`). Keep local Piper as the always-available offline floor. The browser floor now exists — this is about the tiers above it, and about extending the degrade to the other two backend modes. |
| 18 | **Gaze has one input (camera geometry), no attention model** — no saccades, no look-at hands/objects, no conversational aversion. The utterance counter plumbed "for gaze" is never read. | animation | M | **Fix:** add micro-saccades, blink-coupled shifts, and aversion (avert during "thinking"/LLM latency, return on turn-end) at the `initiateGaze` seam; consume `bcounter`; in XR look at tracked hands/controllers. |
| 19 | **Gestures aren't speech/beat-driven** — one gesture per LLM breath from substring matching, unrelated to sentence rhythm; word timings already computed but only the viseme path reads them. | animation | L | **Fix:** beat/emphasis scheduler enqueuing timed gestures against whisper `wtimes` at the animation FIFO-queue seam; vary per-call speed/blendTime for emphasis. Depends on #8 + #15. |
| 20 | **BFF `/api/chat` and `/api/tts` have no auth/rate-limiting** — any origin client can drive the upstream (and the server-side OpenAI key). Matters once the Portal tunnel exposes public ingress. | architecture | M | **Fix:** rate-limit + a simple auth gate (session token / OIDC via Portal IdP) in Hono middleware in front of `/api/chat`, `/api/tts`, future `/api/stt` and tool routes. Scope to the public-ingress path so single-user local stays frictionless. |
| 21 | **Shadows/AO configured but invisible** — avatar reads flat and ungrounded; `useSSAO` flag set but PostProcessing only adds Bloom. | avatar | S–M | **Fix (S):** traverse avatar `child.castShadow=true` + add a receiving ground/contact-shadow. **(M):** N8AO/SSAO pass honoring the existing flag; gate by surface preset. Weakly evidenced by refs (different render tiers) — below memory/voice/persona. |

### P3 — Dev leverage

| # | Gap | Area | Effort | Note |
|---|---|---|---|---|
| 22 | **No latency/timing profiling** across VAD→STT→LLM→TTS→visemes — makes the streaming-latency work hard to validate. | architecture | M | **Fix:** `performance.mark` the `useAgent` stages (STT-final, LLM-first-token, TTS-first-byte, first-audio, first-viseme) + a debug HUD. Scthe ships exactly this. Pairs with #5/#8 as the measurement tool. |

---

## Quick wins to ship first

Low effort, high leverage — several are outright correctness bugs that strand built capability:

1. **Spring bones** (S) — `vrm.update(delta)` in `AvatarModel` useFrame unfreezes hair/skirt/accessory physics on every VRM. *(gap #3 — verify no expression double-apply / gaze conflict)*
2. **STT continuous-mode fix** (S) — `sttService.ts:217` `i < 1` bound drops later segments; iterate `event.results.length`. *(gap #2 — pure bug)*
3. **Idle-variety unlock** (S) — fix `enableCycling` to set `cyclingState.cyclingEnabled`; the personality idle picker is already built. *(gap #4)*
4. **Amplitude mouth fallback** (S) — an `AnalyserNode` + RMS → jaw-open via the existing `amplify` param; mouth always tracks sound. *(gap #7)*
5. **TTS lead/delay + audio-anchored clock** (S/M) — anchor the viseme timeline to `AudioBufferSourceNode.currentTime` (not `performance.now()`), add a small negative offset so the mouth shapes a beat early. *(Scthe)*
6. **Shadow wiring** (S) — cast/receive flags + a ground plane; grounding for free. *(gap #21)*
7. **LLM emotion tags over keyword heuristic** (S/M) — `[joy]/[sad]` tags injected into the prompt, regex-stripped before TTS, mapped via the existing `EMOTION_TO_CATEGORY`. Cross-language, no extra model. *(gap #11)*

---

## Suggested sequencing

- **Sprint 1 — "Liveness for free" (all S):** #2 STT bug, #3 spring bones, #4 idle-cycler, #7 amplitude mouth, #21 shadow wiring, #14 TTS default. Each is a small, self-contained visible improvement.
- **Sprint 2 — "It listens and stops" (voice/latency):** #6 real barge-in, #5 streaming playback, #22 latency HUD (build it first to measure #5/#6), #9 offline STT route.
- **Sprint 3 — "It has identity":** #10 Persona schema, #11 emotion-tag pipeline, #13 per-avatar voice clone (CosyVoice2 zero-shot).
- **Sprint 4 — "It remembers" (flagship, cross-repo):** #1 CI-Server memory adapter + retrieval + client persistence + history budgeting. Land client-side persistence first.
- **Sprint 5 — "It acts":** #12 MCP tools, #16 proactivity/event channel, #20 BFF auth (gate before public tunnel).
- **Continuous polish:** #8 phoneme lip-sync, #15 additive layering, #18 attention model, #19 beat gestures.

---

## Appendix — reference-repo license notes

- **spar** MIT (archived) · **PunithVT** MIT · **Open-LLM-VTuber** MIT (Live2D sample models
  under Live2D's restricted license) · **Scthe** GPLv3 with XTTS (non-commercial) + Oculus Lipsync
  (Oculus SDK) sub-components · **ProtoReplicant** unspecified. For anything reused verbatim, clear
  the sub-component licenses; for the copyleft/non-commercial ones, **reimplement the concept**
  against our own MIT-compatible stack (CosyVoice2, three-vrm, MediaPipe).

_Sources: multi-agent scout of the five repos' READMEs/source + a four-subsystem internal code
audit, synthesized into this matrix. Companion to [`PERCEPTION-PLAN.md`](PERCEPTION-PLAN.md)
(CV/AR/VLM expansion), [`animation.md`](animation.md), and [`avatar.md`](avatar.md)._
