# Round 2 — first-answer activation gate critic

Date: 2026-08-16
Artifact under review: the Round 1 builder result in the canonical React/BFF
path
Builder record: [`ROUND-1-BUILDER.md`](ROUND-1-BUILDER.md)

This is a source/contract re-critique. It is not a visual audit: no browser
surface was opened because the Product Design browser guardrail still requires
the user to select the browser first.

## Blind artifact review

The builder improved the truthfulness of the diagnostic seam:

- `/api/health` now distinguishes `ok` from `degraded` and reports memory
  configuration separately.
- Settings can ask for health and renders chat, memory, and TTS states.
- A failed proxy turn now becomes a visible backend-failure response.

The decisive problem remains: this state is not an activation gate. The owner
can still receive an answer without checking it, and the result is not carried
into the LLM/session state. The app still has a plausible-response path that
can be mistaken for a connected being.

## Evidence

- `apps/web/src/App.tsx:83-101` still opens onboarding only for microphone
  consent and writes `ci_avatar_onboarded`; it does not require or consume
  connection state.
- `packages/core/src/components/common/OnboardingOverlay.tsx:1-100` still
  explains only microphone permission and text-chat skip behavior.
- `packages/core/src/components/control/SettingsPanel.tsx:182-213,394-465`
  now owns the health request and display, but only while Settings is open and
  only after the owner clicks **Check connection**.
- `packages/core/src/services/llm/config/llmConfig.ts:53-63` still permits
  `script` as the default when deployment configuration does not override it.
- `packages/core/src/services/llm/llmService.ts:235-243` still uses directed
  responses when the model is loading or not ready. The proxy failure is now
  visible when that request actually reaches the proxy, but no shared
  activation state prevents the earlier fallback path.
- `apps/proxy/src/upstreams/ciServer.ts:5-23` remains a stub, so a truthful
  health check can report that memory is not connected but cannot yet make the
  memory-grounded journey pass.

## Being Test score

| Test | Score | Re-critique finding |
|---|---|---|
| Five-minute first conversation | **Partial for generic chat; fail for a grounded answer** | The diagnostic is better, but it is not shown or enforced before the first answer, and scripted/directed responses remain possible |
| Trusted continuity | **Fail** | CI-Server, provenance, uncertainty, and post-delete behavior are still absent |
| Coordinated liveness | **Partial** | Source-backed render/TTS guards remain, but no canonical-app embodiment probe or fresh browser/XR evidence exists |
| Consented useful action | **Fail** | No canonical tool contract, confirmation, receipt, or cancellation path |
| Privacy explainability | **Fail** | Mic consent is not memory consent; inspect/source/forget/delete remain absent |
| 20-turn/XR reliability | **Fail / unproven** | Unit/build evidence is strong, but no first-owner journey, 20-turn soak, or sustained device run was captured |

**Round 2 score: 0 full passes, 2 partials, 4 fails/unproven.** The score is
unchanged; the evidence is more actionable.

## Reference bar

These primary-source references make the target more concrete without being
treated as proof that Spatial Companion matches them:

1. [Google's Gemini universal-assistant direction](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-universal-ai-assistant/)
   connects the Astra research line to video understanding, screen sharing,
   memory, natural voice, and planning/action across devices. Use it as the
   continuity/context bar: our six-state journey must show what context was
   used and what survives deletion.
2. [Meta's 2025 Meta AI app announcement](https://about.fb.com/news/2025/04/introducing-meta-ai-app-new-way-access-your-ai-assistant/)
   describes preference memory, full-duplex voice, a visible microphone-use
   indicator, and handoff between glasses, app, web, and history. Use it as the
   control/continuity bar: our journey must make sensing state and cross-surface
   identity legible, not implicit.
3. [OpenAI's production Realtime API announcement](https://openai.com/index/introducing-gpt-realtime/)
   frames production voice around low latency, natural turn-taking, image
   context, function calling, and safety disclosure. Use it as the embodied
   interaction bar: measure first audio, stop-on-interruption, recovery, and
   action confirmation rather than judging only avatar appearance.

No direct same-viewport/device comparison was possible in this round. The
replacement objective tests are the repository's six-state journey, 50
interruption trials, 20-turn browser soak, and sustained Quest/AVP session
measurements already required by the product plan.

## Largest remaining gap

The health truth is not connected to the first-answer decision. A user can see
“not configured” in Settings and still receive a convincing scripted or
directed response elsewhere. That is a product-trust failure, not a missing
polish detail.

## Next decisive test

Introduce one explicit activation state machine consumed by onboarding and the
LLM/session path:

`unverified → demo-only | chat-only | memory-ready`

Then test that:

- `unverified` cannot be counted as activation;
- `demo-only` is visibly labeled and never counted as a grounded answer;
- `chat-only` explains that private memory is unavailable;
- `memory-ready` carries the owner/session and evidence contract; and
- a failed or interrupted turn returns to a visible recoverable state.

The next builder should implement the smallest version of this gate before
adding vision, tools, or more avatar features.
