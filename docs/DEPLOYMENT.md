# Deployment and Ollama Tunneling

## Backend proxy (BFF) — the recommended path for container deploys

The app ships a small same-origin backend proxy (`@ci-avatar/proxy`, `apps/proxy`) that
brokers chat to a server-configured upstream (Ollama by default, or any OpenAI-compatible
endpoint / CI-Server). The browser talks only to `/api/chat`, so **no `OLLAMA_ORIGINS` CORS
config or public cloudflared tunnel is needed** for the marketplace container — and API keys
never ship in the browser bundle.

**Local dev:**

```bash
pnpm dev:proxy        # starts the BFF on :8787 (upstream from env, default host Ollama)
pnpm dev:web          # Vite dev server; /api is proxied to :8787 (see vite.config.ts)
```

The proxy reads its upstream from env at runtime: `APP_UPSTREAM` (`ollama` | `openai` |
`ci-server`), `APP_OLLAMA_URL` (default `http://host.docker.internal:11434`), `APP_OLLAMA_MODEL`,
`APP_OPENAI_URL` / `APP_OPENAI_API_KEY` / `APP_OPENAI_MODEL`, `PORT` (8787).

`APP_ALLOWED_ORIGINS` (comma-separated) allows browser origins to call the proxy
**cross-origin**. Leave it unset for the container and dev-server deployments, which are
same-origin and need no CORS headers at all. Set it when the SPA is served from a
different origin than the proxy — the static Cloudflare Pages build at
`https://avatar.ci.computer` talking to a tunnelled proxy. See the Cloudflare Pages
section below.

**Container:** two images — the nginx-served SPA
(`ghcr.io/companionintelligence/ci-spatial-companion-webxr`) and the proxy
(`ghcr.io/companionintelligence/ci-spatial-companion-proxy`). nginx reverse-proxies `/api/` →
`proxy:8787` with buffering off (see `nginx/default.conf`). See `marketplace/` for the
runtipi manifest wiring both.

## Runtime configuration (no rebuild)

The SPA reads `/config.json` at boot, which the nginx entrypoint (`nginx/40-render-config.sh`)
generates from container env on start — so a prebuilt image can be pointed at any Ollama/proxy
URL and model at **install time**:

```bash
docker run --rm -p 8080:5173 \
  -e APP_LLM_PROVIDER=proxy \
  -e APP_OLLAMA_URL=http://host.docker.internal:11434 \
  -e APP_LLM_MODEL=gemma3:1b \
  ghcr.io/companionintelligence/ci-spatial-companion-webxr:latest
```

Users can further override the URL/model in-app via the **Settings (⚙️)** panel; overrides
persist to `localStorage`. Precedence: `localStorage` > runtime `/config.json` > build-time
`VITE_LLM_*` defaults.

## Cloudflare Pages — `https://avatar.ci.computer`

The static SPA is served from Cloudflare Pages (project **`avatars`**) at
**<https://avatar.ci.computer>**. The project's own `https://avatars-zbe.pages.dev`
stays live alongside it and is what preview deploys use.

`.github/workflows/pages-deploy.yml` builds `apps/web/dist` and deploys it on every push
to `main`, then runs `scripts/cloudflare-domain.mjs` to make sure the hostname is still
wired up.

### What "static" means here

This origin serves **files only** — there is no `/api/chat` on `avatar.ci.computer`. The
container deployment gets a same-origin BFF because nginx reverse-proxies `/api/` to the
proxy container; Pages has no such hop. So a Pages deploy needs a backend somewhere else,
and the browser has to be told where. Two things make that work:

1. **`dist/config.json`** — written at build time by `scripts/pages-config.mjs` from
   `APP_*` env, the same variable names the container's nginx entrypoint uses. It sets
   `proxy_url` to the **absolute** URL of your backend. (In the container the equivalent
   file is generated at container start instead; on Pages nothing runs at request time,
   so it has to be baked into the build.)
2. **`APP_ALLOWED_ORIGINS` on the proxy** — the call is now cross-origin, so the proxy
   must return CORS headers for this origin or the browser discards every response. The
   proxy sends none by default, which is what keeps the same-origin container deployment
   unchanged.

### Two deploy paths write to this project — set the build env on both

The Pages project has the **Cloudflare dashboard git integration** connected *and* is
deployed by `.github/workflows/pages-deploy.yml`. Both push to the same project, so
whichever finishes last wins. This is visible on any PR: the
`cloudflare-workers-and-pages` bot comments with a branch preview URL that the workflow
never created.

That matters because `dist/config.json` is generated from build env, and **the two paths
read their env from different places**:

| Path | Triggers on | Reads `APP_*` from |
| --- | --- | --- |
| Dashboard git integration | every push, every branch (previews included) | Pages project → Settings → **Environment variables** |
| `pages-deploy.yml` | push to `main` | GitHub → **repository variables** |

Set the values in **both**, or a deploy from the path you forgot ships without a backend
URL. `config.json` is then simply absent — and because Pages falls back to the SPA for an
unmatched path, requesting it returns `index.html` with HTTP 200 rather than a 404. The
loader guards on the response's content type, so it correctly resolves to `{}` and the app
falls back to build-time defaults; the symptom is a working site with no chat backend, not
an error.

If you would rather have one path, disconnect the dashboard git integration and keep the
workflow (the workflow is the one that also ensures the custom domain), or delete the
workflow and set everything in the dashboard. Keeping both is fine as long as their env
agrees.

### Serving the backend from your own machine over a tunnel

Run the BFF on your own hardware and expose it with a named Cloudflare tunnel. Unlike the
quick `trycloudflare.com` tunnels below, a named tunnel keeps a stable hostname across
restarts — which matters, because the hostname is baked into the Pages build.

```bash
# 1. Run the proxy, allowing the Pages origin to call it.
APP_UPSTREAM=ollama \
APP_OLLAMA_URL=http://localhost:11434 \
APP_OLLAMA_MODEL=gemma3:1b \
APP_ALLOWED_ORIGINS="https://avatar.ci.computer,https://avatars-zbe.pages.dev" \
  pnpm dev:proxy

# 2. Expose it on a stable hostname (one-time: `cloudflared tunnel create avatar-api`
#    and a DNS route for avatar-api.ci.computer).
cloudflared tunnel run --url http://localhost:8787 avatar-api
```

Then point the Pages build at it with these **repository variables** (Settings → Secrets
and variables → Actions → Variables). They are variables, not secrets: they are written
into `config.json`, which every visitor can read.

| Variable | Value | Why |
| --- | --- | --- |
| `APP_LLM_PROVIDER` | `proxy` | Use the BFF rather than talking to Ollama from the browser. |
| `APP_PROXY_URL` | `https://avatar-api.ci.computer/api/chat` | Absolute — there is no `/api` on the Pages origin. |
| `APP_LLM_MODEL` | `gemma3:1b` | Model label shown and requested. |
| `APP_TTS_MODE` | `browser` | Optional; `browser` needs nothing installed. |
| `APP_STT_REMOTE` | `false` | Optional; `true` routes speech input to the appliance's Whisper. |

Never put an API key in these — `config.json` is public. Keys belong in the proxy's own
environment, which is the reason the proxy exists.

Without them the build still succeeds and the site still loads; it just falls back to the
build-time defaults (the scripted demo persona), and chat has no backend.

### Required GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT` (`avatars`)

The deploy step is skipped with a warning, not failed, when these are absent.

### This org's Actions policy blocks third-party actions — don't reintroduce one

The workflow deploys by calling the **wrangler CLI over `npx`**, not with
`cloudflare/pages-action` or `cloudflare/wrangler-action`. That is deliberate. This
organisation's GitHub Actions policy allows only a specific set of actions, and the
Cloudflare ones are not on it:

```
##[error]Unable to resolve actions. Cannot access repositories 'cloudflare/pages-action'.
```

A blocked action fails the job at *"Prepare all required actions"*, **before any step
runs** — so the run dies in about seven seconds, no `if:` condition can guard it, and the
log shows no step output to explain why. That is what made this workflow fail on ~90
consecutive pushes to `main`, and it is why no Pages deploy ever reached
`avatars-zbe.pages.dev` from CI. (The failures were previously attributed to the missing
Cloudflare secrets, and a skip-when-absent check was added for them. That check is
genuinely useful, but it never ran and could not have been the cause.)

`actions/*` and `pnpm/action-setup` are allowed — `test.yml` uses the latter and passes,
which is why the setup steps here mirror it. If you add a step that needs a new
third-party action, expect it to be blocked the same way; either get it allowlisted, or do
what the deploy step does and call the tool's CLI directly.

### Provisioning the custom domain

`scripts/cloudflare-domain.mjs` ensures both halves of the wiring — the custom domain on
the Pages project, and a proxied `CNAME` in the `ci.computer` zone pointing at the
project's `*.pages.dev`. It is idempotent: run it as often as you like, and when
everything already matches it changes nothing.

```bash
# See what it would do first.
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  node scripts/cloudflare-domain.mjs --project avatars --domain avatar.ci.computer --dry-run

# Then do it.
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  node scripts/cloudflare-domain.mjs --project avatars --domain avatar.ci.computer
```

The token needs:

| Scope | Permission | Used for |
| --- | --- | --- |
| Account | Cloudflare Pages → Edit | read the project, attach the custom domain |
| Zone | DNS → Edit | create or repoint the `CNAME` |
| Zone | Zone → Read | resolve `ci.computer` to its zone id |

The deploy workflow runs the same script with `continue-on-error`, so a token holding only
the Pages scope still deploys green — the step's log names what it could not do.

### Adding another agent hostname

The `*.ci.computer` scheme is per agent. To add one, deploy that app to its own Pages
project and run the same script against it — the script derives the zone from the
hostname, so nothing else changes:

```bash
node scripts/cloudflare-domain.mjs --project <its-pages-project> --domain <agent>.ci.computer
```

### Files that shape the Pages response

`apps/web/public/_headers` is copied verbatim into the deploy; every other target ignores
it. It sets:

- `Permissions-Policy` granting `xr-spatial-tracking` — a headset refuses `immersive-vr`
  without it, and Cloudflare's default policy does not include it.
- immutable caching for `/assets/*`, which is content-addressed and ~240 MB of media.
- `no-store` for `/config.json`, so a returning visitor is not pinned to an old backend URL.

**There is deliberately no `_redirects` file.** Pages already routes an unmatched path to
the SPA by itself, because the build ships no top-level `404.html`. Adding the usual
`/* /index.html 200` SPA rule would actively break the site: Pages applies `_redirects`
*"regardless of whether or not an asset matches the incoming request"*, so a catch-all
rewrite serves `index.html` in place of every hashed JS chunk and every avatar file.

Both halves of that are confirmed against a live branch preview, not just the docs:

```
$ curl -sI <preview>/some/deep/client/route
HTTP/2 200 ; content-type: text/html        # SPA fallback works with no _redirects

$ curl -sI <preview>/assets/index-DuAor7ps.js
HTTP/2 200 ; content-type: application/javascript
cache-control: public, max-age=31536000, immutable   # asset served, not shadowed

$ curl -sI <preview>/                       # _headers applied
permissions-policy: xr-spatial-tracking=(self), camera=(self), ...
```

## Local Ollama Over The Web (Quest 3 / iPad / XREAL)

### 1) Run Ollama and allow browser origins
```bash
OLLAMA_ORIGINS="https://avatar.ci.computer" ollama serve
```

If you also use a Cloudflare tunnel, include the tunnel URL:
```bash
OLLAMA_ORIGINS="https://avatar.ci.computer,https://your-tunnel.trycloudflare.com" ollama serve
```

### 2) Create a public tunnel to your local Ollama
```bash
cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"
```

You will get a URL like:
`https://your-tunnel.trycloudflare.com`

### 3) Point the app to the tunnel URL
Set this in the app you are running:

`apps/web/.env.local`
```env
VITE_LLM_PROVIDER=ollama
VITE_LLM_OLLAMA_API_URL=https://your-tunnel.trycloudflare.com
VITE_LLM_OLLAMA_MODEL=gemma3:1b
```

`apps/vision-pro/.env.local`
```env
VITE_LLM_PROVIDER=ollama
VITE_LLM_OLLAMA_API_URL=https://your-tunnel.trycloudflare.com
VITE_LLM_OLLAMA_MODEL=gemma3:1b
```

### Optional convenience scripts
From the repo root:

```bash
pnpm ollama:serve
pnpm ollama:tunnel
```

You can override defaults:
```bash
OLLAMA_ORIGINS="https://avatar.ci.computer,https://your-tunnel.trycloudflare.com" pnpm ollama:serve
OLLAMA_HOST_URL="http://localhost:11434" pnpm ollama:tunnel
```

## Notes
- `cloudflared` must be installed and authenticated.
- Use HTTPS for WebXR on headsets.
