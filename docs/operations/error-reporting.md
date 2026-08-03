# Error reporting (Sentry)

Spatial Companion can report crashes to [Sentry](https://sentry.io). It is
**opt-in and off by default**: with no DSN configured, no Sentry code
initialises, the SDK is not even in the browser bundle, and neither container
makes an outbound connection.

This follows the fleet contract set by CI-Server (`docs/operations/error-reporting.md`
there is the reference); CI-Import-Tools and Companion-Planning ship the same
env contract.

## Privacy posture

This app is a **conversation**. The user speaks to an avatar, a local model
answers, and the reply is spoken back. Prompts and model output are user content
and must never leave the device — which makes reporting here deliberately
narrower than a Sentry default install, and narrower in two places than the rest
of the fleet:

| Setting | Value | Why |
|---|---|---|
| `sendDefaultPii` | `false` | No IPs, cookies, or request bodies. |
| `tracesSampleRate` | `0` | Errors only. Traces would ship request shapes, and this proxy's requests *are* the conversation. |
| Session replay | not installed | Would record the conversation on screen. |
| Profiling | not installed | — |
| `includeServerName` | `false` (proxy) | The hostname identifies the household like a home path does. |
| `LocalVariables` integration | **removed** (proxy) | See below. |
| Console breadcrumbs | **off** (browser) | See below. |
| `beforeSend` | scrubber | Redacts credentials and home paths, drops cookies/body/query string. |

### The two conversation-specific hardenings

Both were found by reading what the SDK actually collects by default, and
neither could be fixed by a `beforeSend` regex — no pattern recognises prose as
private.

1. **`LocalVariables` is dropped from the proxy's integrations.** It is on by
   default in `@sentry/node`, and with `captureAllExceptions` (its default) it
   attaches captured locals to *handled* exceptions too. The locals of the
   `/api/chat` handler are `body` and `messages` — the user's entire prompt
   history — and of `/api/tts`, `text`, the assistant's reply. This is the Node
   equivalent of the `include_local_variables=False` the fleet's Python services
   set. The scrubber still walks `frame.vars` as the belt-and-braces half.

2. **Console breadcrumbs are off in the browser.** `breadcrumbsIntegration`
   records `console.*` calls by default, with the joined message *and* the raw
   arguments. This app logs:

   | Call site | What it logs |
   |---|---|
   | `packages/core/src/services/llm/models/llmCloud.ts:53` | the entire outbound request body — every prompt and reply in the conversation |
   | `packages/core/src/services/llm/models/llmCloud.ts:65` | the `RequestInit`, including the `Authorization: Bearer <api key>` header |
   | `packages/core/src/services/llm/models/llmLocal.ts:72` | each generated fragment as it is published |
   | `packages/core/src/services/tts/ttsService.ts:16,457` | the text being spoken |

   These are legitimate development logs, so rather than delete them the app
   installs `breadcrumbsIntegration({ console: false })` and never records the
   crumbs at all. fetch/xhr/dom/history crumbs stay: none of them carries a
   request body, and this app puts no user content in a URL (chat, TTS and the
   consent check are all `POST`/`GET` with the content in the body — audited).

### Kill switches

Two switches disable reporting even when a DSN is baked into an image, so an
operator can turn it off without a rebuild:

| Variable | Effect |
|---|---|
| `CI_TELEMETRY=off` | Explicit opt-out (also `false`, `0`, `no`, `disabled`). |
| `CI_LOCAL_ONLY=true` | Local-only mode means zero phone-home (also `1`, `yes`, `on`). |

`CI_LOCAL_ONLY` takes precedence over `CI_TELEMETRY`, which takes precedence
over the DSN. The resolved reason is exposed as `disabledReason`
(`local-only` | `opt-out` | `no-dsn`) and logged at proxy start.

The marketplace manifest ships these as a user-facing **"Share crash reports"**
toggle (`marketplace/ci-spatial-companion-webxr/config.json`), default **off**,
wired to `CI_TELEMETRY` on *both* services in `docker-compose.json`.

## What gets scrubbed

`apps/proxy/src/telemetry/scrubEvent.ts` and `apps/web/src/lib/telemetry.ts`
implement the same rules. They are separate build graphs, so the code is
duplicated on purpose; the shared case list
(`apps/proxy/src/telemetry/scrubFixtures.ts` ↔
`apps/web/src/lib/telemetryScrubFixtures.ts`) is run by both suites and a drift
test compares the two files byte for byte.

- Bearer tokens, `api_key=` / `password:` / `token:` style pairs, Tailscale
  `tskey-…`, and credentials in connection URLs → `[Filtered]`
- Home directories (`/Users/<name>`, `/home/<name>`, `C:\Users\<name>`) → `~`,
  since they leak the account name. Windows patterns are applied **first**: the
  macOS rule otherwise matches inside `C:/Users/<name>` and leaves a stranded
  `C:~/…`
- Object and header keys matching
  `password|secret|token|authorization|cookie|jwt|api[-_ ]?key|dsn|pepper|private_key|signature`
  → `[Filtered]`. The hyphenated form matters: `sendDefaultPii: false` does
  **not** stop request headers reaching the event — it only resolves an
  IP-oriented deny list for span attributes — so this regex is the only guard.
- Object and header keys matching the anchored identity set
  `(?:^|[-_])user$|(?:^|[-_])owner$|username|email|forwarded|^remote-` →
  `[Filtered]`. These name a *person* rather than carrying a credential, so no
  value-level rule can ever catch them. The BFF sits behind CI-Hub's Traefik
  forward-auth, which injects `X-CI-Hub-User`, `-Timestamp` and `-Signature` on
  every authenticated request; the SDK ships the headers that *arrived*, so all
  three reach the event with no reference in our code at all. Anchored on
  purpose: `user-agent`, `user_id` and `owner_id` stay as diagnostics.
- **Plus, only in this repo:** keys matching
  `messages|prompt|completion|transcript|utterance` → `[Filtered]`. In a chat
  client those key names *are* the conversation, and no regex over the value
  would recognise it.
- The BFF copy and the browser copy must declare those two key regexes as
  **byte-identical literals**; a test in each suite reads both source files and
  compares them, and the shared `KEY_SCRUB_CASES` list is run against both
  implementations through `scrubValue`, request headers and breadcrumb `data`.
- Request cookies and bodies dropped; **query strings removed from
  `request.query_string`, from `request.url`, and from the
  `referer`/`referrer`/`location` headers** — the SDK builds `request.url` from
  `req.url`, which on a Node server is path+query, so filtering only
  `query_string` redacts nothing
- Stack frame `filename` / `abs_path` (absolute paths outside Docker), the
  `context_line` / `pre_context` / `post_context` source snippets the
  ContextLines integration attaches around the throw site, and captured `vars`.
  The path *body* is deliberately left intact beyond the home-dir collapse —
  Sentry groups issues on `filename`
- `server_name` (the machine hostname) removed, and `includeServerName: false`
  set at init on the proxy
- Breadcrumbs: `message`, and the whole `data` **object** — not each value in
  turn, or the crumb's own keys are never key-checked and a bare `data.token` or
  `data.prompt` ships intact — with `url`/`from`/`to` then treated as URLs. This
  matters more than it sounds: fetch/xhr crumbs carry `data.url` *with the query
  string*, and console crumbs carry raw arguments (which is why the browser does
  not record them at all)
- Strings over 8 KB truncated, so a stray blob can't smuggle a transcript out
  inside an exception message
- Cyclic and deeply nested payloads bottom out at depth 8 rather than stalling
  `beforeSend`

The browser copy additionally drops chunk-load and `ResizeObserver` noise
outright.

### The browser consent check

A DSN baked into the bundle at build time cannot be revoked afterwards, so the
kill switches would not reach the browser on their own. Before calling
`Sentry.init`, the SPA asks `GET /api/config/telemetry` whether reporting is
permitted and **fails closed** if that endpoint is unreachable, non-2xx, or
malformed. In the container nginx proxies `/api/` to the sidecar from the same
origin (`nginx/default.conf`); in dev the Vite server proxies it to
`pnpm dev:proxy` on `:8787`.

This is what makes the marketplace "Share crash reports" toggle actually apply
to the browser.

> **One deliberate difference from CI-Server's `TelemetryConfigController`.**
> There the API and the bundle ship in one container, so the endpoint resolves
> the *whole* gate, `SENTRY_DSN` included. Here the SPA and the proxy are two
> separate images, and the proxy may legitimately have no `SENTRY_DSN` of its
> own. Resolving the DSN half in the sidecar would mean a web image built *with*
> a DSN never reports unless an unrelated DSN was also set on the proxy — a
> silent, undiagnosable failure. So this endpoint answers only the question it
> can answer for the browser — *is reporting permitted right now?* — from the
> two kill switches. The DSN half of the gate stays at the browser's build time,
> where it also decides whether the SDK is bundled at all.

The endpoint never returns the DSN, and is deliberately unauthenticated (there
is no auth on this proxy at all).

### Bundle shape

With `VITE_SENTRY_DSN` unset the whole init path folds to dead code and the SDK
is tree-shaken out entirely. Measured on this repo (total `dist/**/*.js` bytes,
`pnpm --filter @ci-avatar/web build`):

| Build | Total JS | `captureException` occurrences |
|---|---|---|
| `origin/main`, before this change | 12,965,440 B | 0 |
| no DSN | **12,965,468 B** | **0** |
| `VITE_SENTRY_DSN` set | **13,058,289 B** | 3 |

That is **+92,821 B raw (+90.6 kB)** for the SDK with a DSN, and **+28 B**
without one — the residue of the folded `void initTelemetry()` call. No
`@sentry` string of any kind survives in the DSN-less bundle.

Keep the module-scope shape exactly as written:

```ts
const DSN = import.meta.env.VITE_SENTRY_DSN   // NO optional chaining
…
if (!DSN) return
```

`import.meta.env.X?.trim()` folds under Rollup but **not** under `rolldown-vite`,
which silently kept the entire SDK in a sibling repo's DSN-less bundle. This app
is on Rollup-backed Vite 6 today; the shape is what keeps it safe if that
changes.

## Sentry projects

One project per marketplace app id, matching the fleet convention
(`ci-memory` for CI-Server, `ci-import-tools` for CI-Import-Tools):

Spatial Companion reports into the **`ci-spatial-companion-webxr`** project in
the `companion-intelligence` org. **The project does not exist yet** — the org
sets `allowMemberProjectCreation: false`, so an owner has to create it and issue
the DSNs.

Its two components are separated by the `component` tag, which is set on every
event and matches the published image names:

| Component | `component` tag | DSN variable |
|---|---|---|
| `apps/web` (SPA) | `ci-spatial-companion-webxr` | `VITE_SENTRY_DSN` (**build time**) |
| `apps/proxy` (BFF) | `ci-spatial-companion-proxy` | `SENTRY_DSN` (runtime) |

Point both at the same DSN and filter by `component:` in Sentry, or split them
into two projects later without touching any code — the env contract is the same
either way.

```
sentry issue list companion-intelligence/ci-spatial-companion-webxr --query "component:ci-spatial-companion-proxy"
```

`apps/vision-pro` is **not** instrumented: it ships to the App Store rather than
as a marketplace container, and it has no BFF of its own to ask for consent, so
it would fail closed on every launch.

## Enabling it

Proxy (runtime env — no rebuild):

```bash
SENTRY_DSN=https://<key>@o<org>.ingest.us.sentry.io/<id>
SENTRY_ENV=production          # or APP_ENVIRONMENT, or NODE_ENV
APP_VERSION=0.1.0              # release becomes ci-spatial-companion-proxy@0.1.0
```

Browser (**build time** — Vite bakes it in; it must be present when
`pnpm --filter @ci-avatar/web build` runs, not at container start):

```bash
docker build \
  --build-arg VITE_SENTRY_DSN=https://<key>@o<org>.ingest.us.sentry.io/<id> \
  --build-arg VITE_SENTRY_ENVIRONMENT=production \
  --build-arg VITE_SENTRY_RELEASE=ci-spatial-companion-webxr@0.1.0 \
  -t ci-spatial-companion-webxr .
```

Turning it off again, without a rebuild:

```bash
CI_TELEMETRY=off    # on the proxy container: stops the BFF, and the browser too
CI_LOCAL_ONLY=true  # beats everything
```

## Verifying

```bash
sentry issue list companion-intelligence/ci-spatial-companion-webxr --query "is:unresolved"
```

To confirm reporting is genuinely inert without a DSN, start the proxy with no
`SENTRY_DSN` and check the startup line — it prints
`[proxy] error reporting off (no-dsn)` — and that no request reaches
`ingest.sentry.io`. For the browser, grep the built bundle:

```bash
grep -rl captureException apps/web/dist   # must print nothing without a DSN
```

## Where it hooks in

| Path | Role |
|---|---|
| `apps/proxy/src/instrument.ts` | `Sentry.init`; must stay the first import in `server.ts`. Also owns the crash/shutdown handlers |
| `apps/proxy/src/telemetry/settings.ts` | Resolves the opt-in gate from env |
| `apps/proxy/src/telemetry/scrubEvent.ts` | `beforeSend` scrubber |
| `apps/proxy/src/routes/config.ts` | `GET /api/config/telemetry` — the browser consent endpoint |
| `apps/proxy/src/server.ts` | `app.onError` captures unexpected route failures |
| `apps/web/src/lib/telemetry.ts` | Browser gate, consent check and scrubber |
| `apps/web/src/main.tsx` | Calls `initTelemetry()` before render, unawaited |

### Reporting never changes app behaviour

- With reporting **off**, `installCrashHandlers()` registers *nothing*. The proxy
  has no process handlers of its own, so Node's default crash behaviour and exit
  codes are untouched.
- With reporting **on**, `uncaughtException` / `unhandledRejection` capture,
  flush (bounded, 2 s, raced against a real unref'd timer — `Sentry.close()`
  alone is not a real bound), then `process.exit(1)` — the same code Node 20
  produces unhandled. Sentry's own `OnUncaughtException` / `OnUnhandledRejection`
  integrations are dropped, both to avoid double-reporting and because the
  latter defaults to mode `warn`, which would *swallow* a rejection Node exits on.
- `SIGTERM`/`SIGINT` flush once and then **re-raise the signal** with the handler
  already removed by `process.once`, so the process still dies of the signal and
  the exit status is unchanged.
- `app.onError` is a line-for-line copy of Hono's own default error handler
  (duck-typed `'getResponse' in err` check included), plus the capture. No
  response, status or body changes.

## Not wired up yet

- **Release + source map upload in CI.** `docker-publish.yml` does not pass
  `VITE_SENTRY_DSN` / `VITE_SENTRY_RELEASE` or run `sentry sourcemaps upload`, so
  browser stack traces would be minified. CI-Hub's `desktop-release.yml` has the
  pattern to copy.
- **The Sentry project itself.** See above — an org owner has to create
  `ci-spatial-companion-webxr` and issue the DSNs.
- **In-app consent UI.** Reporting is an install-time toggle
  (marketplace form field), not a setting in the app's own ⚙️ panel.
