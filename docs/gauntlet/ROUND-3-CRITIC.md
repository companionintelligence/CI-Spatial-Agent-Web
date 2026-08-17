# Round 3 — Activation state source critic

Date: 2026-08-16
Artifact under review: the Round 3 activation-state builder pass
Builder record: [`ROUND-3-BUILDER.md`](ROUND-3-BUILDER.md)

This is a source and contract re-critique. It is not a visual audit: no browser
surface was opened because the Product Design browser guardrail still requires
the user to select the browser first.

## Blind artifact review

The builder now makes the most important trust decision explicit. A canonical
web or Vision Pro/XR session cannot silently turn an unverified connection into
a believable assistant response. The same state is visible in onboarding and
Settings, remains visible in the Chat Log header, and is passed to the shared
LLM path.

The remaining risk is semantic overreach: `memory-ready` currently means that
the health endpoint reports a configured/reachable memory upstream. It does not
yet prove that a response used private memory, identify the source, disclose
uncertainty, or honor deletion.

## Evidence

- `packages/core/src/services/connection/connectionHealth.ts` is the single
  derivation seam. It maps script to `demo-only`, unreachable chat to
  `unverified`, reachable chat without memory to `chat-only`, and reachable
  configured memory to `memory-ready`.
- `packages/core/src/components/common/OnboardingOverlay.tsx` and
  `packages/core/src/components/control/SettingsPanel.tsx` both call the
  shared health check and update the parent activation state rather than
  maintaining independent local truth.
- `apps/web/src/App.tsx` and `apps/vision-pro/src/App.tsx` put the state into
  `agentConfig.llm.activation_state`; `ChatPanel` renders the state next to
  the conversation log.
- `packages/core/src/services/llm/llmService.ts` returns a recoverable
  unverified response, suppresses directed fallback for chat-only and
  memory-ready sessions while the model is starting, and annotates the LLM
  response with the activation state.
- The new tests cover all four state derivations, onboarding health display,
  the Chat Log state label, unverified blocking, and verified-but-starting
  fallback suppression.

## Being Test score

| Test | Score | Re-critique finding |
|---|---|---|
| Five-minute first conversation | **Partial** | The first-answer gate is now honest and recoverable, but a grounded answer cannot yet be proven because CI-Server memory and browser journey evidence are absent |
| Trusted continuity | **Fail** | No source ids, uncertainty, owner/session contract, consent, or post-delete behavior |
| Coordinated liveness | **Partial** | Existing source-backed render/TTS guards remain, but no canonical browser/XR run or interruption scorecard was captured |
| Consented useful action | **Fail** | No typed tool contract, confirmation, receipt, cancellation, or timeout path |
| Privacy explainability | **Fail** | Microphone consent is now distinguished from service connection, but memory inspect/forget/delete is still absent |
| 20-turn/XR reliability | **Fail / unproven** | Full unit/build evidence passes, but no 20-turn browser soak or sustained device session exists |

**Round 3 score: 0 full passes, 2 partials, 4 fails/unproven.** The score is
unchanged, but the activation failure is now blocked and observable rather
than silently converted into a plausible answer.

## Largest remaining gap

The product can now tell the owner whether chat and a memory upstream are
reachable, but it still cannot prove that a particular answer is grounded in
the owner's memory or explain how to inspect and delete that grounding.

## Next decisive test

Implement the CI-Server trust contract and run the seeded canonical journey:

1. disconnected / `unverified` recovery;
2. connected but empty / `chat-only` response;
3. grounded answer with source id and uncertainty;
4. interrupted answer with visible recovery;
5. memory delete with an explicit receipt; and
6. post-delete follow-up that does not repeat the deleted memory.

Capture those states in the selected browser, then repeat the same contract
under the Vision Pro/XR surface before adding perception or autonomous tools to
the launch story.
