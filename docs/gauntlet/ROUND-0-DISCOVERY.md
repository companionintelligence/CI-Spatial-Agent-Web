# Round 0 — Discovery and independent critic

Date: 2026-08-16
Artifact under review: [`../PRODUCT-PLAN.md`](../PRODUCT-PLAN.md)
Branch: `codex/product-plan-gauntlet`
Evidence base: clean `chore/sync-canonical-avatar-layout` at `a367c14`, based on
`origin/main` at `9fb53f8`

This is a source- and test-grounded critic pass. A score is a release-evidence
score, not a claim that the product has no capability. `Pass` means the behavior
is both present and exercised on the relevant surface; `Partial` means the
behavior exists in a narrower surface or has only indirect evidence; `Fail`
means the product promise is missing or contradicted by the current source.

## Evidence ledger

### E1 — The current liveness baseline is better than the old review says

- `packages/core/src/components/scene/Scene3D.tsx:319-337` leaves R3F's
  continuous loop enabled. The comment explicitly records why `frameloop="demand"`
  must not return: avatar mixer, blink, gaze, lip-sync, and spring-bone work do
  not call `invalidate()`.
- `packages/core/src/services/tts/ttsService.ts:69-81,127-145,517-560` now tracks
  the active audio source, invalidates stale queue generations, stops the live
  source, clears the queue, and resynchronizes the next message id.
- `packages/core/src/services/tts/ttsService.dom.test.ts` contains regression
  coverage for the barge-in queue and active audio-source behavior.

The committed `docs/ANIMATION-SYSTEM-REVIEW.md` still labels the former C1/C2/H2
failures as current. It remains valuable backlog history, but it cannot be used
as a current release score without reconciling it against source and tests.

### E2 — The differentiating memory path is still absent

`apps/proxy/src/upstreams/ciServer.ts:5-23` is an interface-conformant stub:
`chat()` yields `CI-Server upstream is not implemented yet`, and `health()` is
false. `apps/proxy/src/routes/health.ts:9-36` can report that state, but there is
no memory-grounded conversation path for the canonical client yet.

### E3 — The test pyramid proves rig pieces, not the complete being loop

- The clean layout worktree ran `corepack pnpm test`: **38 files / 624 tests
  passed**.
- The same worktree ran `corepack pnpm build`: proxy, vanilla client, web, and
  vision-pro builds passed. The build still reports large-chunk warnings.
- `docs/TESTING-PIPELINE.md:139-149` says the strict L4 embodiment assertions
  are skipped. `tests/scenarios/_scenario.ts:90-103` confirms the current
  scenario probe is observational and has no service-state/debug hook.
- `tests/scenarios/hospitality.spec.ts`, `retail.spec.ts`, and
  `education.spec.ts` therefore do not yet release-gate coordinated gesture,
  expression, lip-sync, or real barge-in behavior.
- L3/L5 use `window.__harness` and committed WebP artifacts. That is useful
  evidence, but the harness is not the same user journey as the canonical app.

The testing documentation also repeats the old `frameloop="demand"` explanation;
that documentation drift should be treated as a release-quality problem because
it makes a fixed production path look broken and hides the remaining gaps.

### E4 — The vanilla client is a second capability surface, not proof of GA

The staged `apps/vanilla-client` contains `Memory`, `Perception`, and a
`ToolRegistry`, but those systems are not wired into the canonical React/BFF
client. They should be treated as a valuable prototype/reference implementation
until the platform contracts are shared or the surface is explicitly launched.

### E5 — Telemetry consent is not companion-memory control

`apps/proxy/src/routes/config.ts:7-56` exposes an opt-out gate for error
reporting. A source search found no canonical web flow for inspecting a memory
item's provenance, approving retention, forgetting/deleting it, or stopping a
tool action. The plan must not count telemetry opt-out as satisfying the memory
privacy promise.

## Reference experiences and measurable lessons

These are behavior references, not instructions to copy their cloud
architecture.

| Reference | Observable promise | Product lesson for Spatial Companion |
|---|---|---|
| [Google Project Astra / Gemini Live](https://deepmind.google/models/project-astra/) and [Gemini Live camera help](https://blog.google/products-and-platforms/products/gemini/gemini-live-camera-how/) | Real-time visual understanding, screen/camera sharing, and conversational help without forcing a separate analysis workflow | Perception must be part of the live turn and return grounded evidence, not a disconnected “vision mode” demo |
| [Meta AI personalized assistant](https://about.fb.com/news/2025/01/building-toward-a-smarter-more-personalized-assistant/) | Personalization is paired with user-directed memory and the ability to tell the assistant what to remember or forget | Memory needs visible control, provenance, and a reliable forget path before the product claims “it knows me” |
| [Character.AI memory](https://blog.character.ai/memory/) and [Character Calls](https://support.character.ai/hc/en-us/articles/23957274129691-Character-Calls-Voice-FAQ) | Memory is presented as editable facts/story context; voice calls are two-way and interruptible, with transcripts | A virtual being needs continuity controls and a voice loop that can be interrupted, inspected, and recovered—not just generated speech |

## Blind Being Test scorecard

| Test | Score | Current evidence | Release implication |
|---|---|---|---|
| 1. New owner reaches a first useful conversation in five minutes | **Partial** | Settings, local providers, BFF health, and offline scenario infrastructure exist; the CI-Server path is not connected and no fresh-install browser journey was recorded in this round | Measure p90 install-to-first grounded spoken answer, not install-to-generic-chat |
| 2. Trusted continuity with provenance, uncertainty, and no invented private memories | **Fail** | CI-Server adapter is a stub; no canonical memory source/uncertainty/delete UI was found | Memory integration and privacy controls are one P0 contract, not separate late polish |
| 3. Alive in the rendered product: voice, interruption, gaze, face, body, timing, recovery | **Partial** | Continuous production render loop and TTS barge-in regressions are present and unit-tested; strict canonical-app embodiment assertions are skipped, and the review still identifies untested gaze/avatar-switch/face-state risks | Make embodied state observable and gate the real app, not only the harness |
| 4. Notices a situation and completes a safe multi-step action with consent and visible result | **Fail** | Canonical BFF has no CI-Server tool registry; tool calling exists only in the staged vanilla client and is not a launched product path | Add typed tools only after consent, confirmation, and visible action receipts exist |
| 5. Privacy is legible, with stop/delete controls | **Fail** | Telemetry opt-out exists, but companion memory consent/provenance/forget controls are not present in the canonical web surface | Define a data contract and user control surface before storing personal memory |
| 6. Twenty turns and sustained XR use stay reliable | **Fail / unproven** | 624 automated tests and headless render-matrix coverage are green; no release-gated 20-turn browser soak, sustained XR session, or on-device 72-FPS gate is recorded | Reliability and performance are exit criteria for the first alpha, not Phase 4 backlog items |

**Round score: 0 full passes, 2 partials, 4 fails/unproven.**

## Independent critic verdict

The plan is directionally right but ordered around feature arrival rather than
trust formation. Its largest gap is the missing **Trustworthy Companion Loop**:

> connect → explain what is available → answer from private memory with evidence →
> speak and be interruptible → recover visibly → let the owner inspect and delete
> what was retained.

The current plan calls CI-Server memory “the single most important feature,” but
memory without liveness evidence, provenance, and deletion is not a trustworthy
being. Conversely, the current animation fixes show that the product can improve
materially without waiting for perception or tools. The roadmap should therefore
make the loop itself the first alpha gate and move vision/tools behind it.

## Decisions for the next plan revision

1. Replace “foundation done” with “code foundation present; product gate
   incomplete.” Reconcile stale review and testing docs with current source.
2. Create a P0 **Trustworthy Companion Loop** phase that combines connection,
   memory contract, privacy controls, embodied recovery, and real browser/XR
   evidence.
3. Make `source`, `confidence/uncertainty`, `consent`, `forget/delete`, and a
   visible action receipt part of the CI-Server/BFF contract—not future UI polish.
4. Add a non-production embodiment debug contract so L4 can assert active clip,
   emotion, viseme activity, interruption, and recovery on the canonical app.
5. Add explicit release gates: p90 five-minute activation, 50 interruption
   trials with no orphaned speech/mouth motion, a 20-turn browser soak, and a
   sustained Quest/XR session with the existing 72-FPS target.
6. Keep the vanilla client as a reference/prototype until its memory, perception,
   and tool contracts converge with the canonical client.

## Next test

Run the revised first-conversation journey on the canonical web surface in a
user-selected browser, with a seeded private-memory fixture and the BFF health
panel visible. Capture the first failure in each of these states: disconnected,
connected-but-empty memory, grounded answer, interrupted answer, memory delete,
and follow-up answer after delete. The next critic round should score those
states against the same six tests before adding vision or autonomous tools.
