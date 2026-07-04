# CI-Marketplace app entry

Canonical source for this app's **CI-Marketplace** listing, kept in-repo so the manifest
versions with the app. To publish, copy `ci-spatial-companion-webxr/` into the marketplace
repo under `apps/`:

```bash
cp -R marketplace/ci-spatial-companion-webxr \
  ../CI-Marketplace/apps/ci-spatial-companion-webxr
```

(The working marketplace clones are `ci-market-apps/CI-Marketplace` and `HUB/CI-Marketplace`,
both on the `dev` branch — see the workspace CLAUDE.md.)

## Contents

- `config.json` — runtipi `app-info` manifest. The **Ollama URL** (`APP_OLLAMA_URL`,
  default `http://host.docker.internal:11434`) and **Model** (`APP_LLM_MODEL`) form fields
  are injected as container env at install time; the app reads them at runtime via
  `/config.json` (no rebuild).
- `docker-compose.json` — two services: the nginx-served SPA (`isMain`, internalPort 5173)
  and the `proxy` BFF (internalPort 8787). nginx reverse-proxies `/api/` → `proxy:8787`.
- `metadata/description.md` — store description.

## Before it can be published (manual steps)

Per the marketplace publication requirements:

1. **`metadata/logo.jpg`** (or `logo.png`) — not yet included; add a non-empty app logo.
2. **Screenshot gate** — `e2e/screenshots/ci-spatial-companion-webxr.png` must be captured on
   a CI OS device and committed to the marketplace repo. No screenshot ⇒ not deployed. This is
   a human/fleet-QA step and is intentionally **not** faked here.
3. Both images (`ci-spatial-companion-webxr:latest` and `ci-spatial-companion-proxy:latest`)
   must be published to GHCR — see the repo's `.github/workflows/`.
