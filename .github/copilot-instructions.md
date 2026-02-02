# Copilot instructions (CI-WebXR-Avatars)

## Repo shape & intent
- Monorepo (pnpm workspaces): `packages/core` is the shared engine; `apps/web` and `apps/vision-pro` are thin shells.
- Prefer changing behavior in `packages/core/src/**` and consuming it from apps via `@ci-avatar/core` imports.

## Dev workflows (use these commands)
- Install: `pnpm install`
- Dev servers:
  - Web: `pnpm dev:web` (Vite on `http://localhost:5173`)
  - Vision Pro: `pnpm dev:vision` (Vite on `http://localhost:5174`)
- Build all workspaces: `pnpm build`
- Lint all workspaces: `pnpm lint`
- Format: `pnpm format`

## E2E tests (Playwright)
- Install browsers once: `pnpx playwright install`
- Run suites:
  - `pnpm test:e2e` / `pnpm test:e2e:ui` / `pnpm test:e2e:debug`
  - `pnpm test:agent`, `pnpm test:audio`, `pnpm test:animation`
- Playwright auto-starts the web dev server with Ollama env vars (see `playwright.config.ts`). Have Ollama running at `http://localhost:11434` for default test config.

## Core architecture (how the app actually works)
- `useAgent` (`packages/core/src/services/useAgent.ts`) is the orchestration hub:
  - VAD (`services/vad`) detects speech → STT (`services/stt`) transcribes.
  - LLM (`services/llm`) streams responses as small “breath” chunks; `useAgent` feeds those to TTS and appends to conversation.
  - TTS (`services/tts`) emits `WhisperData`; visemes (`services/visemes`) turn that into lip-sync sequences.
  - Emotes/animations are triggered via `integration/reactionIntegration.ts` and barge-in logic via `integration/emotionIntegration.ts`.
- UI wiring pattern (both apps):
  - Configure `AppConfigState` via `@hexafield/simple-store`.
  - Create `agent = useAgent(agentConfig)` and pass `agent.services.{visemes,emotes,animations}` into `Viewport3D`.
  - Chat/controls live in overlays (`components/chat/**`, `components/control/**`).

## Rendering conventions
- 3D entrypoint: `Scene3D` + `Viewport3D` (`packages/core/src/components/scene/**`).
- Renderer quality/capabilities live under `packages/core/src/components/scene/rendering/**` (adaptive WebGL/WebGPU + postprocessing + XR enhancements).
- WebGPU is feature-gated in apps via `useHasWebGPU()` and `AppConfigState.webGPUEnabled`.

## Configuration knobs (env vars used in code)
- LLM: `VITE_LLM_PROVIDER` (`script|mlc|ollama|openai`) and related vars in `packages/core/src/services/llm/config/llmConfig.ts`.
- TTS: `VITE_TTS_MODE` defaults to `pocket` and `VITE_POCKET_TTS_URL` defaults to `http://localhost:8000` (`packages/core/src/services/tts/ttsConfig.ts`).
- VAD/STT: `VITE_VAD_THRESHOLD`, `VITE_VAD_ENABLED`, `VITE_STT_*` (see `services/vad/vadConfig.ts`, `services/stt/sttConfig.ts`).

## Editing guidance (project-specific)
- If you add/remove public APIs, update exports in `packages/core/src/index.ts` (and keep `packages/core/package.json#exports` shape intact).
- Directed/fallback responses are loaded from `/assets/directed-responses.json` (served from each app’s `public/assets/`).
