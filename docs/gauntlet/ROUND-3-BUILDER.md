# Round 3 — Activation state builder pass

Date: 2026-08-16
Artifact under review: canonical web and Vision Pro/XR activation paths
Prior critic: [`ROUND-2-CRITIC.md`](ROUND-2-CRITIC.md)

## Builder decision

Make connection truth a session decision, not a Settings diagnostic. The
canonical clients now carry one explicit state into the shared LLM service:

| State | Meaning | First-answer behavior |
|---|---|---|
| `unverified` | Chat has not been proven reachable | Block the turn and give a recovery action |
| `demo-only` | The deterministic script provider is active | Allow the demo, label it, and never count it as grounded activation |
| `chat-only` | Chat is reachable but private memory is unavailable | Allow generic chat, but never use a scripted fallback while the model is starting |
| `memory-ready` | Chat and the configured memory upstream are reachable | Allow the normal provider path; memory provenance is still a separate contract |

This is intentionally a small trust gate. `memory-ready` means reachable, not
that CI-Server already provides source ids, uncertainty, consent, inspect, or
delete behavior.

## Source changes

- `packages/core/src/services/connection/connectionHealth.ts` centralizes the
  `/api/health` fetch, the four-state derivation, and user-facing labels.
- `OnboardingOverlay` and `SettingsPanel` now use the same health contract and
  update the shared activation state. Onboarding explains that microphone
  permission and service connection are separate decisions.
- `apps/web/src/App.tsx` and `apps/vision-pro/src/App.tsx` pass
  `activation_state` into the canonical `useAgent`/LLM session and expose the
  current state through onboarding, Settings, and the Chat Log header.
- `packages/core/src/services/llm/llmService.ts` blocks unverified sessions,
  refuses to turn a verified-but-starting model into a scripted answer, labels
  demo fallback, and carries the state on `LLMResponse` metadata.
- The shared `ActivationState` type is exported from the core package so the
  web and XR surfaces cannot silently diverge.

## Verification

- `corepack pnpm test` — **41 test files, 632 tests passed**.
- Focused activation, onboarding, Settings, Chat Log, LLM, and proxy run —
  **6 files, 19 tests passed**.
- Targeted ESLint on changed files — **0 errors**; three existing React Hook
  warnings remain in `llmService.ts`.
- `corepack pnpm build` — **passed** for proxy, vanilla client, web, and
  Vision Pro. Existing large-chunk and stale Browserslist warnings remain.
- `git diff --check` — **passed**.

## Re-critique boundary

This builder closes the Round 2 gap where a plausible response could bypass
the connection diagnostic. It does not claim the full Being Test:

- CI-Server memory retrieval is still a stub.
- `memory-ready` is health reachability, not a grounded-memory evidence
  contract.
- Source ids, confidence/uncertainty, consent, inspect, forget/delete, and
  post-delete behavior are still absent.
- No browser screenshots, seeded six-state journey, 20-turn soak, or sustained
  Quest/Apple Vision Pro run was captured because a user-selected browser is
  still required for the visual audit.

The next critic should test the visible first-answer state and then replace
the health-only `memory-ready` claim with a seeded CI-Server trust contract.
