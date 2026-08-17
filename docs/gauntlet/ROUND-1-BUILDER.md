# Round 1 — Activation truth builder pass

Date: 2026-08-16
Artifact under review: canonical settings/BFF connection path
Prior critic: [`ROUND-1-ACTIVATION.md`](ROUND-1-ACTIVATION.md)

## Builder decision

Make the connection state observable before the owner treats a response as a
working companion turn. Keep the change small and source-backed:

1. Give the existing `/api/health` route an honest aggregate status instead of
   always returning `ok`.
2. Report whether CI-Server memory is configured and reachable separately from
   generic chat reachability.
3. Put a user-invoked **Connection truth** check in the canonical Settings
   panel, with explicit chat, memory, and TTS states.
4. Surface a failed proxy response through the same visible backend-failure
   path used by the direct Ollama/OpenAI providers.

This is a diagnostic and trust correction, not a claim that memory continuity
is implemented. The CI-Server adapter remains a stub, and the first-run
onboarding screen still does not gate the first answer on this check.

## Source changes

- `apps/proxy/src/routes/health.ts` now returns `status: 'degraded'` when chat
  or TTS is unreachable and adds a `memory` block with configured/reachable
  state.
- `packages/core/src/components/control/SettingsPanel.tsx` adds a
  `Connection truth` card that calls `/api/health`, distinguishes healthy,
  degraded, unreachable, and not-yet-checked states, and renders chat,
  memory, and TTS details.
- `packages/core/src/services/llm/llmService.ts` now calls
  `surfaceBackendFailure('Proxy', ...)` instead of logging a proxy failure and
  letting the turn appear silent.
- Focused coverage was added in
  `packages/core/src/components/control/SettingsPanel.dom.test.tsx` and
  `apps/proxy/test/routes.chat.test.ts`.

## Verification

- `corepack pnpm test` — **38 test files, 625 tests passed**.
- Focused DOM/proxy run — **2 files, 8 tests passed**.
- `corepack pnpm build` — **passed**; existing large-chunk and stale
  Browserslist warnings remain.
- Proxy lint — **0 errors**, existing unused-disable warnings remain.
- Changed-core-file lint — **0 errors**, existing React Hook warnings remain.
- The full core lint command still has unrelated baseline errors in
  `packages/core/src/components/scene/avatar/AvatarModel.tsx` and
  `packages/core/src/services/visemes/visemeTable.node.test.ts`; those files
  were not changed in this builder pass.

## Re-critique boundary

The builder pass closes the specific “health exists but is not an honest,
user-visible decision” gap. It does not close these Being Test failures:

- health is in Settings, not yet in first-run activation;
- `script`/directed fallback is still available as a silent path;
- CI-Server memory retrieval, provenance, uncertainty, consent, and delete are
  not implemented;
- the conversation event contract still lacks those fields;
- no fresh browser screenshots or XR run exist in this task.

The next decisive test is an independent critic pass against the six-state
first-conversation journey, followed by browser capture once the user selects
the browser surface.
