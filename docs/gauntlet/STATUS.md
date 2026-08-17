# Product-plan Gauntlet Status

Status: round 3 source critic complete; browser capture pending user-selected browser

## Goal

Make Spatial Companion a trusted, useful, alive virtual being platform—not a
feature collection or talking-avatar demo.

## Current bar

Use the Being Test in
[`PRODUCT-PLAN-GAUNTLET-PROMPT.md`](../PRODUCT-PLAN-GAUNTLET-PROMPT.md):
five-minute activation, trustworthy memory continuity, coordinated liveness,
consented useful action, legible privacy boundaries, and 20-turn/XR-session
reliability.

## Worktree evidence

- The user's active checkout is dirty on
  `feat/avatar-lip-sync-dynamics-visual-matrix`; do not modify it.
- The canonical layout branch is clean at
  `chore/sync-canonical-avatar-layout` (`a367c14`).
- This gauntlet branch is based on that clean layout branch.
- Other registered worktrees are mostly prunable video experiments; do not
  delete or repurpose them without explicit confirmation.

## Round 0 — discovery

- Artifact under review: [`docs/PRODUCT-PLAN.md`](../PRODUCT-PLAN.md)
- Critic record: [`ROUND-0-DISCOVERY.md`](ROUND-0-DISCOVERY.md)
- Score: **0 full passes, 2 partials, 4 fails/unproven** against the Being Test
- Largest gap: the missing **Trustworthy Companion Loop** — connection,
  grounded continuity, embodied recovery, and user control have not yet been
  proven together
- Current truth correction: the old C1/C2 animation review claims are stale
  relative to the current source; continuous rendering and TTS barge-in guards
  are present and unit-tested. The CI-Server adapter remains a stub, strict
  canonical-app embodiment assertions remain skipped, and memory privacy
  controls are absent.
- Verification: clean layout worktree passed **38 test files / 624 tests** and
  the recursive build (with existing large-chunk warnings). The gauntlet
  worktree has no installed `node_modules`, so those commands were run on the
  equivalent clean parent worktree rather than mutating this branch.

## Revision 1 — product-plan decisions

- Product plan revised around a P0 **Trustworthy Companion Loop** before
  perception or autonomous tools.
- CI-Server memory is now defined as a provenance/uncertainty/consent/delete
  contract, not merely a chat adapter.
- Embodied liveness, interruption recovery, 20-turn browser soak, and sustained
  XR performance are alpha gates rather than deferred Phase 4 work.
- `apps/vanilla-client` is recorded as a reference/prototype surface until its
  memory, perception, and tool contracts converge with the canonical client.

## Round 1 — activation and continuity contract

- Critic record: [`ROUND-1-ACTIVATION.md`](ROUND-1-ACTIVATION.md)
- Scope: canonical app onboarding, LLM readiness/fallback behavior, BFF health,
  and the normalized conversation contract
- Score: **0 full passes, 2 partials, 4 fails/unproven**
- Largest new finding: the current flow optimizes **time-to-chat**, not
  time-to-trusted-answer. `script` is the default fallback, `/api/health` is not
  surfaced in the web journey, and proxy failure is not consistently visible.
- Product-plan revision: added a connection truth surface, explicit
  demo/production separation, and a zero-tolerance metric for counting scripted
  fallback as connected activation.
- Browser evidence: **not captured**. Product Design's browser guardrail
  requires a user-selected browser; no browser preference is saved or selected
  in this task. The next step is a six-state canonical flow capture after that
  selection, not a claim of visual UX audit completion.

## Round 1 — builder pass

- Builder record: [`ROUND-1-BUILDER.md`](ROUND-1-BUILDER.md)
- Decision: make the existing health seam honest and user-visible before
  treating a response as a connected companion turn.
- Implemented: `/api/health` now reports `ok` versus `degraded` and a separate
  memory configuration/reachability block; Settings exposes a **Connection
  truth** check for chat, memory, and TTS; proxy failures become visible
  backend-failure responses.
- Verification: **38 test files / 625 tests passed**, focused DOM/proxy checks
  passed, and the recursive build passed. Existing chunk-size, Browserslist,
  lint-warning, and unrelated core-lint-error baselines remain documented in
  the builder record.
- Re-critique boundary: this closes the unused/overstated health diagnostic,
  but not first-run gating, CI-Server memory, provenance, privacy/delete, or
  browser/XR evidence. The Being Test score remains **0 full passes, 2
  partials, 4 fails/unproven** until those are independently tested.

## Round 2 — first-answer activation gate critic

- Critic record: [`ROUND-2-CRITIC.md`](ROUND-2-CRITIC.md)
- Artifact under review: the Round 1 builder result and its source-backed tests.
- Score: **0 full passes, 2 partials, 4 fails/unproven**; unchanged, but the
  largest gap is now precise.
- Verdict: the connection check is truthful but remains a Settings sidecar.
  It is not consumed by onboarding or the LLM/session path, so a plausible
  scripted/directed response can still be mistaken for a connected companion.
- Decision: add an explicit activation state machine before vision, tools, or
  further avatar polish: `unverified → demo-only | chat-only | memory-ready`.
- Reference bar: Google universal-assistant continuity, Meta cross-surface
  voice/memory control, and OpenAI production voice turn-taking are recorded
  with links and translated into objective repository tests in the critic
  record.
- Browser evidence remains **not captured** pending a user-selected browser.

## Round 3 — activation state builder and source critic

- Builder record: [`ROUND-3-BUILDER.md`](ROUND-3-BUILDER.md)
- Critic record: [`ROUND-3-CRITIC.md`](ROUND-3-CRITIC.md)
- Decision implemented: derive `unverified`, `demo-only`, `chat-only`, or
  `memory-ready` from the shared health seam, carry it into the web and Vision
  Pro/XR LLM sessions, and render it in onboarding, Settings, and the Chat Log.
- The LLM path now blocks unverified turns, refuses silent directed fallback
  for verified-but-starting sessions, and labels deterministic demo fallback.
- Verification: **41 test files / 632 tests passed**, focused activation/UI/LLM
  coverage passed, targeted changed-file lint had **0 errors**, and the
  recursive build passed with the existing chunk-size and Browserslist
  warnings.
- Score: **0 full passes, 2 partials, 4 fails/unproven**. The activation gap
  is closed as a source-level trust gate; the memory-grounding and embodied
  journey are not.
- Browser evidence remains **not captured** pending a user-selected browser.

## Next test

Implement the CI-Server trust contract, then select the browser surface and run
the revised first-conversation journey on the canonical web surface with a
seeded private-memory fixture. Capture the disconnected, connected-but-empty,
grounded-answer, interrupted-answer, memory-delete, and post-delete follow-up
states. Repeat the contract under Vision Pro/XR. Do not add autonomous tools to
the launch story until that journey passes the same six-test scorecard.
