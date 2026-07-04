# Spatial Companion — Product Improvement & Launch Plan

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**
> Owner: Liam Broza · Drafted 2026-07-04 · Horizon: H2 2026 → 2027

---

## 1. Executive summary

**Spatial Companion** (`CI-Spatial-Companion-WebXR`) is Companion Intelligence's embodied,
voice-first client: a lip-synced 3D VRM avatar you talk to, rendered in AR/VR on Meta Quest and
Apple Vision Pro, and in any WebGPU/WebGL browser or iPad. It is the **face** of the CI platform —
the surface where the appliance's private memory and local models become a person you can look at
and speak with.

This plan takes the app from "impressive demo" to "shippable product on three channels" in three
moves:

1. **Foundation (done — this rework).** Runtime-configurable LLM connection, a same-origin backend
   proxy (BFF), canonical CI branding, a native animation pipeline, and a real automated test suite.
   The app is now a clean CI-Marketplace container.
2. **Connected companion (Q3 2026).** Wire the avatar to CI-Server (Companion Memory) so it *knows
   you*, harden the connection/onboarding UX, and ship to the CI-Marketplace as the flagship
   appliance experience.
3. **Perception & presence (Q4 2026 → 2027).** Passthrough camera vision, gaze, locomotion, agent
   tools, and personalization — realizing the "CI Embodied Companion" north-star on the open WebXR
   stack, then App Store / Quest distribution.

The strategic bet: **the companion is the product; the appliance is the moat.** Everyone can ship a
chat avatar; only CI can ship one that runs entirely on your own device, remembers your life
privately, and lives in your space.

---

## 2. Where we are today (post-rework baseline)

**Shipped in this rework (PR #88):**

| Area | State |
|------|-------|
| Rendering | VRM avatar (three.js r182 / R3F 9 / three-vrm 3.5), WebGL default + opt-in WebGPU MToon |
| Voice | STT + VAD + TTS with viseme lip-sync, barge-in |
| Animation | Native `crossFadeTo` + additive scaffolding + event-driven cycling |
| LLM | Local (Ollama/WebLLM) + **new same-origin BFF proxy** (multi-upstream, streaming, abortable) |
| Config | **Runtime `/config.json`** + in-app Settings; no rebuild to repoint |
| XR | WebXR AR + VR sessions (Quest / Vision Pro / XREAL) + browser/iPad fallback |
| Brand | Canonical CI teal tokens + Montserrat |
| Distribution | GHCR images + **CI-Marketplace manifest** (runtipi) |
| Quality | vitest (services + proxy + components) + Storybook; Playwright E2E |

**What's still missing (the product gaps):** it doesn't yet *remember* you (no CI-Server memory
wiring), can't *see* (no passthrough/vision), can't *move* (idle/gesture only), has no agent
**tools**, and no personalization. These are the roadmap.

---

## 3. Product vision & positioning

**Vision.** A companion that is *present* — embodied in your space, aware of your world through
sight and voice, grounded in a private memory of your life, and useful because it can act. Inspired
by Google Astra and Meta AI, but **local-first and yours**.

**Positioning.**

> *"The AI companion that lives on your device, in your space, and only in your trust."*

| Axis | Spatial Companion | Cloud avatars (e.g. hosted VTubers, character apps) |
|------|-------------------|------------------------------------------------------|
| Where it runs | Your appliance / device (local models) | Someone else's cloud |
| What it remembers | Your private CI memory, on-prem | Their servers |
| Where it appears | AR/VR in your room + browser | 2D app window |
| Who owns the data | You | The vendor |

**Platform role.** Spatial Companion is the **Client-layer flagship**: Capture → Portal → **Server
(memory)** ← Hub ← Marketplace, with Spatial Companion as the human-facing embodiment of Server +
Hub inference. It is the demo that sells the appliance.

---

## 4. Target users & use cases

1. **Appliance owners (primary).** People who bought into CI for private, local AI. The companion is
   the "wow" that justifies the box. Use: daily check-ins, hands-free Q&A over their own memory,
   ambient presence.
2. **Vision Pro / Quest early adopters.** Spatial-computing enthusiasts who want a resident AI
   character. Use: an in-room companion, spatial dashboards, voice control.
3. **Developers / integrators.** The BFF + tool registry make it a reference embodiment for CI apps.
4. **Prospects / demos (GTM).** The browser build at a public URL is the top-of-funnel proof.

---

## 5. Improvement roadmap (phased)

Ratings: **P0** must-have · **P1** high-value · **P2** differentiator.

### Phase 0 — Stabilize & ship ✅ (this rework, Q3 2026)
Runtime config, BFF, branding, animation refactor, tests, marketplace manifest. *Done in PR #88.*

### Phase 1 — Connected Companion (Q3 2026) — "it knows me"
- **P0 · CI-Server memory integration.** Implement the `ci-server` BFF adapter (auth + chat +
  retrieval) so the companion answers from the owner's private memory. This is the single most
  important feature — it's what no competitor can copy. *(Builds directly on the stubbed
  `apps/proxy/src/upstreams/ciServer.ts`.)*
- **P0 · Provider/connection config UX + diagnostics.** A first-run connection wizard and a
  diagnostics panel (Ollama reachable? model pulled? memory connected?) surfacing `/api/health`.
- **P0 · Onboarding polish.** Mic permission, model pull guidance, and a "say hi" moment.
- **P1 · Spatial audio for the voice.** Position TTS at the avatar's head in XR.
- **P1 · Response pacing controls.** Latency/interruptibility tuning already partially present.
- **Exit criteria:** an appliance owner installs from the Marketplace, and within 5 minutes the
  companion answers a question about their own data, hands-free, in the browser and on Quest.

### Phase 2 — Perception & Presence (Q4 2026) — "it sees and shares my space"
- **P2 · Passthrough camera vision.** Meta Quest passthrough / WebXR camera access → frames routed
  through the BFF to a local VLM (e.g. Qwen-VL / LLaMA-vision) for "what am I looking at?". The
  north-star's headline capability; the BFF's multi-upstream design already anticipates a VLM route.
- **P1 · Gaze & attention.** Extend `emote/gazeService` to eye/head tracking input; the avatar
  looks where you look.
- **P1 · Locomotion & richer animation.** Add walk/turn clips and (optionally) `@davidcks/r3f-vrm`
  for Mixamo FBX retargeting; the animation refactor makes additive layering tractable.
- **P1 · In-world XR chat panel & scene actions.** Recenter/scale/enter already exist; make the
  chat and controls spatial.
- **Exit criteria:** on Quest 3 passthrough, ask "what's on my desk?" and get a grounded answer;
  the avatar walks to and faces you.

### Phase 3 — Agentic Depth (Q1 2027) — "it can act and it's mine"
- **P0 · Tool registry & agent actions.** Let the companion call CI apps/tools (calendar, home,
  marketplace apps) through a typed registry via the BFF.
- **P1 · Structured memory with privacy controls.** User-visible memory with per-item consent.
- **P2 · Avatar personalization.** Swap VRM models, outfits, voices, personality presets (the
  animation personality system already exists).
- **P1 · Agent modes & prompt templates.** Task-scoped behaviors.
- **Exit criteria:** the companion completes a multi-step task ("add this to my list and remind me")
  and the user can pick its face and voice.

### Phase 4 — Performance & Scale (continuous, from Q4 2026)
- **P1 · Runtime quality slider + auto-throttle**, **foveated rendering + LOD**, **performance HUD**,
  **regression tests** (all already in the repo roadmap). Critical for standalone-headset framerate.

---

## 6. Technical foundation & platform integration

- **BFF is the integration spine.** Every capability above (memory, vision, tools) is a new
  `UpstreamAdapter` or route in `apps/proxy` — one seam, uniformly tested and streamed. Prioritize
  hardening it (auth, retries, observability) before piling features on.
- **CI-Server contract.** Define and version the Server chat/retrieval/memory API; the companion is
  its first serious consumer. Coordinate via CI-Engineering.
- **Two-image container.** Keep the SPA + proxy split; add a healthcheck and (later) a VLM route.
- **Testing debt to retire next:** R3F scene/agent story coverage (`@react-three/test-renderer`),
  device-matrix E2E on Quest/AVP, and performance-regression gates.
- **Known cleanups:** none blocking; the three-vrm `tslFn` warning was cosmetic and is suppressed.

---

## 7. Launch plan (go-to-market)

### 7.1 Distribution channels (in priority order)
1. **CI-Marketplace (appliance)** — *primary.* One-click install on the owner's box; the companion
   ships as the flagship app. Manifest + images ready; needs the screenshot gate + Server memory to
   be truly compelling.
2. **Public web build (Cloudflare Pages)** — top-of-funnel demo at `avatars-zbe.pages.dev` (or a
   branded domain). Bring-your-own-Ollama via the Settings panel; zero install.
3. **Apple Vision Pro (App Store)** — via the existing WebSpatial packaging (`apps/vision-pro`).
   High-signal credibility channel; gated on App Review + a privacy policy.
4. **Meta Quest (App Lab → Store)** — WebXR PWA / packaged; the standalone-headset audience.

### 7.2 Launch phases
| Stage | When | Gate | Audience |
|-------|------|------|----------|
| **Private alpha** | Now → end Q3 2026 | Phase 1 memory + onboarding | Owner + insiders on the fleet |
| **Marketplace beta** | Q4 2026 | Screenshot gate, diagnostics, spatial audio | CI appliance owners |
| **Public web demo** | Q4 2026 | Perf pass, brand polish | Prospects, spatial-computing community |
| **Vision Pro / Quest** | Q1–Q2 2027 | Store review, privacy policy, perf | XR early adopters |
| **GA across channels** | 2027 | Tools + personalization | All CI users |

### 7.3 Positioning & messaging
- **Hook:** "Your AI, embodied — private, in your space."
- **Proof points:** runs locally (no cloud), remembers *your* life (CI memory), *sees* your room
  (passthrough), lives in AR/VR *and* the browser.
- **Assets:** a 30–60s spatial demo reel (Quest passthrough + Vision Pro), a browser try-it link, a
  one-pager, and marketplace screenshots. (Route through the `ci-marketing` skills / CI brand kit.)

### 7.4 Metrics / KPIs
- **Activation:** install → first successful voice answer (< 5 min target).
- **Memory value:** % of sessions asking a memory-grounded question.
- **Retention:** weekly returning companions per appliance.
- **Presence:** XR-session share vs. browser; median session length in XR.
- **Performance:** median FPS on Quest 3 (target ≥ 72) and AVP; TTS first-breath latency.
- **Funnel:** web-demo → appliance-owner conversions.

### 7.5 Pre-launch checklist (per channel)
- [ ] CI-Server memory adapter live and demoable (Phase 1)
- [ ] Marketplace screenshot gate captured on a CI OS device (fleet QA)
- [ ] Both GHCR images published + pinned
- [ ] Privacy policy URL (mic + camera + memory data handling)
- [ ] Perf pass on target headsets
- [ ] Demo reel + try-it link + one-pager
- [ ] App Store / App Lab metadata + review submission

---

## 8. Milestones & timeline

| Quarter | Milestone |
|---------|-----------|
| **Q3 2026** | ✅ Foundation (PR #88) · CI-Server memory adapter · onboarding + diagnostics · **private alpha** |
| **Q4 2026** | Spatial audio · perf pass · **Marketplace beta** · **public web demo** · passthrough-vision spike |
| **Q1 2027** | Tool registry · gaze + locomotion · **Vision Pro submission** · personalization v1 |
| **Q2 2027** | Quest Store · structured memory + privacy controls · **cross-channel GA** |

---

## 9. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| CI-Server memory API not ready | Blocks the core differentiator | Prioritize the Server contract now; ship provider-config value in parallel |
| Standalone-headset performance | XR feels bad → churn | Phase 4 perf work early; quality slider + auto-throttle; test on-device |
| WebXR passthrough-camera limits | Vision feature slips | Spike early; fall back to device-native camera bridges where WebXR can't |
| App Store review (privacy, mic/camera) | Delays AVP/Quest launch | Privacy policy + on-device story up front; TestFlight/App Lab beta first |
| Model RAM on appliances | Crashes on install | Default to small models (gemma3:1b); RAM-aware model picker; clear guidance |
| Scope creep across 4 phases | Nothing ships | Hard exit criteria per phase; Marketplace beta is the forcing function |

---

## 10. Immediate next actions (next 2–4 weeks)

1. **Merge PR #88** and the CI-Marketplace app PR; publish both GHCR images.
2. **Capture the Marketplace screenshot** on a CI OS device (fleet QA) to unblock deployment.
3. **Spec the CI-Server memory/chat API** with CI-Engineering; implement `ciServer.ts`.
4. **Build the connection wizard + diagnostics** panel over `/api/health`.
5. **Record a demo reel** (Quest passthrough + Vision Pro) and stand up the branded web try-it link.

> The companion is closer than it looks: the hard infrastructure (embodiment, voice, local LLM,
> runtime config, distribution) now exists. The remaining work is **connecting it to memory, giving
> it sight, and letting it act** — and telling that story on three screens.
