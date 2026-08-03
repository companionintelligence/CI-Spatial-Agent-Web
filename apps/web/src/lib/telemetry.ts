/**
 * Browser error reporting for the Spatial Companion SPA.
 *
 * Opt-in and off by default: without `VITE_SENTRY_DSN` baked in at build time
 * nothing initialises, the SDK is tree-shaken out of the bundle entirely, and
 * the app makes no request to Sentry. `initTelemetry` is safe to call more than
 * once and safe to call when reporting is disabled.
 *
 * This app is a conversation: the user speaks to an avatar and a local model
 * answers. Prompts and model output are user content and must never leave the
 * device, so on top of the fleet-standard scrubbing this copy takes two extra
 * precautions — see `initTelemetry` for the console-breadcrumb one.
 */

import * as Sentry from '@sentry/react'

let initialized = false

/** Tag on every event from this bundle. Matches the published image name. */
const COMPONENT = 'ci-spatial-companion-webxr'

/** Noise that says nothing about a defect: a stale chunk after a redeploy. */
const CHUNK_LOAD_PATTERNS = [
  /Loading chunk \S+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i
]

/** Extension/browser noise the app can neither cause nor fix. */
const IGNORED_PATTERNS = [/ResizeObserver loop/i, /^Non-Error promise rejection captured/i, ...CHUNK_LOAD_PATTERNS]

function messagesOf(event: Sentry.ErrorEvent): string[] {
  return [event.message, ...(event.exception?.values ?? []).map((value) => value.value)].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
}

export function shouldDropEvent(event: Sentry.ErrorEvent): boolean {
  return messagesOf(event).some((text) => IGNORED_PATTERNS.some((pattern) => pattern.test(text)))
}

/**
 * Strip query and hash from a URL.
 *
 * Deliberately a plain split rather than `new URL()`: it leaves the origin and
 * path exactly as written (no percent-encoding, no base-URL guessing for
 * relative paths) and cannot throw.
 */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0] ?? url
}

// Kept in lockstep with the BFF scrubber at
// apps/proxy/src/telemetry/scrubEvent.ts. Duplicated rather than shared because
// the two live in separate build graphs; change both together.
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:api[-_ ]?key|token|password|secret|jwt|auth)[\s=:"']+[^\s"',}\]]+/gi,
  /tskey-[A-Za-z0-9-]+/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi
]

// Windows first — see the note on the BFF copy: the macOS pattern otherwise
// matches inside `C:/Users/<name>` and leaves a stranded `C:~/…`.
const HOME_PATH_PATTERNS = [
  /[A-Za-z]:\\Users\\[^\\/\s]+/g, // Windows (backslash)
  /[A-Za-z]:\/Users\/[^/\s]+/g, // Windows (forward-slash)
  /\/Users\/[^/\s]+/g, // macOS
  /\/home\/[^/\s]+/g // Linux
]

// `messages|prompt|completion|transcript|utterance` is this repo's addition to
// the fleet pattern: in a chat client those key names are the conversation
// itself, and unlike a credential no regex over the *value* would recognise it.
const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|cookie|jwt|api[-_ ]?key|dsn|pepper|private[-_]?key|hub[-_]user|messages|prompt|completion|transcript|utterance/i

const MAX_STRING_LENGTH = 8000

export function scrubString(value: string): string {
  let scrubbed = value

  for (const pattern of HOME_PATH_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '~')
  }

  for (const pattern of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[Filtered]')
  }

  if (scrubbed.length > MAX_STRING_LENGTH) {
    return `${scrubbed.slice(0, MAX_STRING_LENGTH)}… [truncated]`
  }

  return scrubbed
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[Truncated]'
  }

  if (typeof value === 'string') {
    return scrubString(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, depth + 1))
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, nested] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[Filtered]' : scrubValue(nested, depth + 1)
    }

    return result
  }

  return value
}

/** Breadcrumb `data` keys whose value is a URL (fetch/xhr/navigation crumbs). */
const URL_VALUED_KEYS = new Set(['url', 'from', 'to'])

/** Request headers whose value is a URL the user navigated from. */
const URL_VALUED_HEADERS = ['referer', 'referrer', 'location']

/**
 * Scrub one breadcrumb in place.
 *
 * `breadcrumbsIntegration` records fetch, xhr, console, dom and history crumbs.
 * fetch/xhr carry `data.url` with the full query string; console crumbs carry
 * the joined `message` plus the raw `data.arguments`. Console capture is turned
 * off at init in this app (the app logs whole conversations), but this stays as
 * the belt-and-braces half in case a future integration re-adds them.
 */
function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = scrubString(breadcrumb.message)
  }

  if (!breadcrumb.data) {
    return
  }

  for (const [key, value] of Object.entries(breadcrumb.data)) {
    if (typeof value === 'string' && URL_VALUED_KEYS.has(key)) {
      breadcrumb.data[key] = scrubUrl(scrubString(value))
    } else {
      breadcrumb.data[key] = scrubValue(value)
    }
  }
}

export function scrubBrowserEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (shouldDropEvent(event)) {
    return null
  }

  if (event.message) {
    event.message = scrubString(event.message)
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrubString(exception.value)
    }

    // Bundled stack frames carry the served path, but a source-mapped or dev
    // frame carries the developer's absolute path, and `vars` would carry the
    // conversation.
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (typeof frame.filename === 'string') {
        frame.filename = scrubString(frame.filename)
      }

      if (typeof frame.abs_path === 'string') {
        frame.abs_path = scrubString(frame.abs_path)
      }

      if (frame.vars) {
        frame.vars = scrubValue(frame.vars) as Record<string, unknown>
      }
    }
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>
  }

  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url)
  }

  delete event.request?.cookies
  delete event.request?.query_string
  delete event.server_name

  // httpContextIntegration puts `document.referrer` here, and the browser's
  // default referrer policy keeps the full same-origin URL — query string and
  // all — which is exactly what scrubUrl exists to remove.
  if (event.request?.headers) {
    const headers = scrubValue(event.request.headers) as Record<string, string>

    for (const [key, value] of Object.entries(headers)) {
      if (URL_VALUED_HEADERS.includes(key.toLowerCase()) && typeof value === 'string') {
        headers[key] = scrubUrl(value)
      }
    }

    event.request.headers = headers
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    scrubBreadcrumb(breadcrumb)
  }

  return event
}

export function isTelemetryEnabled(): boolean {
  return initialized
}

// Read at module scope with no optional chaining, so the `if (!DSN) return`
// below folds to statically dead code and the SDK is tree-shaken out of a
// DSN-less build entirely. `import.meta.env.X?.trim()` does NOT fold under
// rolldown (it does under Rollup) — a shape difference that silently put the
// whole SDK back into a sibling repo's bundle. Keep this shape.
const DSN = import.meta.env.VITE_SENTRY_DSN

/**
 * Ask the appliance whether reporting is permitted right now.
 *
 * A DSN baked into the bundle at build time cannot be revoked afterwards, so
 * without this the `CI_TELEMETRY` / `CI_LOCAL_ONLY` kill switches — including
 * the marketplace "Share crash reports" toggle — would not apply to the browser.
 * The BFF answers on `/api/config/telemetry`; nginx proxies `/api/` to it from
 * this same origin in the container, and the Vite dev server proxies it to the
 * local `pnpm dev:proxy`.
 *
 * Fails CLOSED: if the endpoint is unreachable or malformed we do not report.
 * Silently reporting against a consent decision we could not read is the worse
 * failure — and this app's own chat path goes through the same BFF, so an
 * unreachable one means the app is degraded anyway.
 */
async function reportingPermitted(): Promise<boolean> {
  try {
    const response = await fetch('/api/config/telemetry', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    })

    if (!response.ok) {
      return false
    }

    return ((await response.json()) as { enabled?: unknown }).enabled === true
  } catch {
    return false
  }
}

/**
 * Start error reporting if permitted. Returns a promise for tests; callers may
 * ignore it — nothing is reported until consent is confirmed.
 */
export async function initTelemetry(): Promise<void> {
  if (initialized || typeof window === 'undefined') {
    return
  }

  if (!DSN) {
    return
  }

  const dsn = DSN.trim()

  if (!dsn || !(await reportingPermitted())) {
    return
  }

  // Re-check: an await elapsed, and a concurrent caller may have won.
  if (initialized) {
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE?.trim() || undefined,
    enabled: true,
    // Errors only — no tracing, no session replay, no PII.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    integrations: (defaults) => [
      ...defaults.filter((integration) => integration.name !== 'Breadcrumbs'),
      // Console breadcrumbs are the worst leak in this app and no `beforeSend`
      // regex could fix them: `llmCloud.ts` logs the entire outbound request —
      // every prompt and reply in the conversation, plus the `Authorization`
      // header — and `ttsService.ts` logs the text being spoken. Prose cannot be
      // recognised as private by pattern, so the crumbs are never recorded at
      // all. fetch/xhr/dom/history crumbs stay: none of them carries a body, and
      // this app puts no user content in a URL.
      Sentry.breadcrumbsIntegration({ console: false })
    ],
    beforeSend: scrubBrowserEvent
  })

  initialized = true
  Sentry.setTag('component', COMPONENT)
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    return
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context ?? {})) {
      if (value !== undefined) {
        scope.setExtra(key, value)
      }
    }

    Sentry.captureException(error)
  })
}
