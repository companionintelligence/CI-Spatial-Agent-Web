# Round 1 — Activation and continuity contract

Date: 2026-08-16
Artifact under review: [`../PRODUCT-PLAN.md`](../PRODUCT-PLAN.md)
Prior round: [`ROUND-0-DISCOVERY.md`](ROUND-0-DISCOVERY.md)
Branch: `codex/product-plan-gauntlet`

This round tests the revised first-conversation promise against the canonical
source and BFF contract. It is a source/contract critic pass, not a visual UI
audit: no browser was opened because no user-selected browser is available in
the current task, and the browser guardrail requires that choice before capture.

## Current activation path

1. `apps/web/src/App.tsx:83-101` shows onboarding only when the microphone has
   not been enabled and stores `ci_avatar_onboarded` in local storage.
2. `packages/core/src/components/common/OnboardingOverlay.tsx:50-61` explains
   microphone permission and offers **Skip** for text chat. It does not explain
   model/provider readiness, CI-Server availability, memory state, privacy, or
   what a grounded answer means.
3. `packages/core/src/components/control/SettingsPanel.tsx:278-337` exposes
   provider, URL, and model fields, but no connection test, health result,
   memory status, consent state, or recovery instruction.
4. `packages/core/src/services/llm/config/llmConfig.ts:53-63` defaults the
   client to `llm_provider: 'script'` unless deployment configuration overrides
   it. This is useful for demos but cannot be the silent default for a product
   that promises a private-memory answer.
5. `packages/core/src/services/llm/llmService.ts:235-243` uses directed
   responses whenever the model is loading or not ready. In the proxy branch,
   `:349-357` logs a failed result but does not surface the same visible backend
   failure state used by the direct Ollama/OpenAI branches.
6. `apps/proxy/src/routes/health.ts:14-35` provides chat/TTS reachability, but a
   source search found no canonical web consumer of `/api/health`. The endpoint
   is therefore diagnostic infrastructure without an activation decision in
   the user journey.

The current scenario tests intentionally bypass this path:
`tests/scenarios/_scenario.ts:17-22` clears overrides, marks onboarding complete,
and forces scripted responses before the app renders. That makes the scenario
suite deterministic, but it cannot prove five-minute real activation or a
memory-grounded first answer.

## Continuity contract gap

`apps/proxy/src/upstreams/types.ts:6-27` currently carries only messages, an
optional model, and chunk/done/error events. There is no normalized field for:

- owner/session identity and authentication context;
- memory retrieval or source identifiers;
- confidence/uncertainty or “not enough evidence” state;
- retention consent, forget/delete, or post-delete behavior; or
- a visible action/confirmation requirement.

`apps/proxy/src/upstreams/ciServer.ts:5-23` remains a stub, so the canonical
client cannot satisfy the continuity test regardless of how polished the
onboarding screen becomes.

## Round 1 scorecard

| Test | Score | Round 1 finding |
|---|---|---|
| Five-minute first conversation | **Partial for generic chat; fail for the promised grounded answer** | Scripted fallback can produce a fast conversation, but the product does not establish that the owner is connected to CI-Server or that the answer is grounded in private data |
| Trusted continuity | **Fail** | CI-Server is unimplemented and the normalized BFF contract has no provenance/uncertainty fields |
| Coordinated liveness | **Partial** | Current render/TTS/viseme fixes are source-backed, but canonical-app embodiment remains uninstrumented and unproven in this round |
| Consented useful action | **Fail** | No canonical tool contract, consent receipt, or action-result event |
| Privacy explainability | **Fail** | Microphone onboarding and telemetry opt-out exist; memory consent, inspect, source, and delete do not |
| 20-turn/XR reliability | **Fail / unproven** | Automated unit/build evidence exists, but no fresh owner journey or sustained device run was captured |

**Round 1 score: 0 full passes, 2 partials, 4 fails/unproven.** The score did
not improve because the first round's proposed gates are not yet implemented;
the evidence is now more precise about why.

## Critic verdict

The activation flow currently optimizes **time-to-chat**, while the product plan
promises **time-to-trusted-answer**. The most dangerous ambiguity is a plausible
scripted fallback or silent proxy failure appearing like a functioning companion.
The user needs to know which of these states they are in:

`Disconnected → Connected, memory empty → Grounded answer with sources → Interrupted and recovered → Memory deleted → Follow-up no longer uses it`

Until those states are visible and testable, a five-minute metric is measuring a
demo shortcut rather than activation.

## Plan changes required by this round

1. Add a **connection truth surface** to Phase 1: test chat, TTS, and CI-Server
   separately; show the result before the first answer; make unreachable states
   actionable.
2. Separate `script` from owner activation. It may remain an explicit demo/test
   provider, but it must not silently stand in for a connected private-memory
   companion.
3. Add a versioned BFF conversation contract carrying owner/session context,
   memory evidence, uncertainty, retention decisions, and action-confirmation
   events.
4. Make proxy failure visible and stop claiming a successful turn when no
   connected provider answered.
5. Keep the browser capture as the next evidence step once the user selects the
   browser surface. Capture screenshots for the six states above and do not call
   that a full UX audit until those screenshots exist.

## Next test

After a browser is selected, run the canonical first-conversation flow with a
seeded fixture and record the six states in order. The first implementation
builder should then wire the connection truth surface and BFF contract against
the failing states, followed by an independent critic re-score.
