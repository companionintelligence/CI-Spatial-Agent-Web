/**
 * `beforeSend` payload scrubber for the BFF.
 *
 * Everything that flows through this proxy is a conversation: the request body
 * of `POST /api/chat` is the user's whole prompt history, and `POST /api/tts` is
 * the assistant's spoken reply. None of it may reach Sentry, so anything on its
 * way out is treated as hostile until proven otherwise — credentials redacted,
 * home directories collapsed to `~` (they leak account names), oversized strings
 * truncated so a stray blob can't smuggle a transcript out inside an exception
 * message.
 *
 * Ported from CI-Server's `common/telemetry/scrubEvent.ts` (itself ported from
 * CI-Hub's `sentry-scrubber.ts`) so the fleet redacts identically. Kept in
 * lockstep with the browser copy at `apps/web/src/lib/telemetry.ts`; the two
 * live in separate build graphs, so change both together.
 */

import type { ErrorEvent } from '@sentry/node'

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:api[-_ ]?key|token|password|secret|jwt|auth)[\s=:"']+[^\s"',}\]]+/gi,
  /tskey-[A-Za-z0-9-]+/gi,
  // Postgres/Redis/AMQP URLs carry credentials in the authority section.
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi
]

// Windows first: the macOS pattern also matches the `/Users/<name>` inside
// `C:/Users/<name>`, and replacing that leaves a stranded `C:~/…` with the drive
// letter still attached. The longest-prefix forms have to win.
const HOME_PATH_PATTERNS = [
  /[A-Za-z]:\\Users\\[^\\/\s]+/g, // Windows (backslash)
  /[A-Za-z]:\/Users\/[^/\s]+/g, // Windows (forward-slash)
  /\/Users\/[^/\s]+/g, // macOS
  /\/home\/[^/\s]+/g // Linux
]

// `api[-_ ]?key` (not the literals `apikey|api_key`) so the hyphenated header
// forms match too — the SDK ships request headers even with sendDefaultPii
// disabled, and `hub[-_]user` is CI-Hub's `X-CI-Hub-User`, which carries the
// household username.
//
// `messages|prompt|completion|transcript|utterance` is this repo's addition to
// the fleet pattern: on an LLM proxy those key names are the conversation
// itself, and unlike a credential no regex over the *value* would recognise it.
const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|cookie|jwt|api[-_ ]?key|dsn|pepper|private[-_]?key|hub[-_]user|messages|prompt|completion|transcript|utterance/i

// Headers whose value is a URL the user navigated from — same query-string
// exposure as request.url, and not caught by SENSITIVE_KEY_PATTERN.
const URL_VALUED_HEADERS = ['referer', 'referrer', 'location']

const MAX_STRING_LENGTH = 8000

/** Strip query and hash from a URL. */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0] ?? url
}

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
  // Guard against cyclic/deep structures — a runaway walk in beforeSend would
  // stall the reporting path on every captured error.
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

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.message) {
    event.message = scrubString(event.message)
  }

  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = scrubString(exception.value)
      }

      // Node's stack parser keeps the absolute path in `filename`/`abs_path`,
      // which leaks the account name outside Docker. `vars` holds captured
      // locals — in this proxy those are `body`, `messages`, `text`: the
      // conversation. `LocalVariables` is dropped at init (see instrument.ts);
      // this is the belt-and-braces half.
      //
      // Deliberately NOT path-redacting the body of `filename` beyond the
      // home-dir collapse: Sentry groups issues on it.
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
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>
  }

  // The hostname is the same account-identifying data we collapse `/Users/<name>`
  // to `~` to avoid. `includeServerName: false` in instrument.ts stops the SDK
  // setting it; this is the belt-and-braces half.
  delete event.server_name

  if (event.request) {
    // `data` is the parsed request body — on `/api/chat` that is the entire
    // prompt history, on `/api/tts` the assistant's reply. Never send it.
    delete event.request.cookies
    delete event.request.data

    if (event.request.query_string) {
      event.request.query_string = '[Filtered]'
    }

    // `request.url` is built from `req.url`, which on a Node server is
    // path+query — so it carries byte-identical content to the query_string we
    // just filtered. Filtering one without the other redacts nothing.
    if (typeof event.request.url === 'string') {
      event.request.url = scrubUrl(event.request.url)
    }

    if (event.request.headers) {
      const headers = scrubValue(event.request.headers) as Record<string, string>

      for (const [key, value] of Object.entries(headers)) {
        if (URL_VALUED_HEADERS.includes(key.toLowerCase()) && typeof value === 'string') {
          headers[key] = scrubUrl(value)
        }
      }

      event.request.headers = headers
    }
  }

  // `consoleIntegration` turns every console call into a breadcrumb carrying the
  // joined `message` plus the raw arguments in `data`; `httpIntegration` records
  // outgoing-request crumbs whose `data.url` still has its query string.
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (typeof breadcrumb.message === 'string') {
        breadcrumb.message = scrubString(breadcrumb.message)
      }

      if (breadcrumb.data) {
        const data = scrubValue(breadcrumb.data) as Record<string, unknown>

        for (const key of ['url', 'from', 'to']) {
          const value = data[key]

          if (typeof value === 'string') {
            data[key] = scrubUrl(value)
          }
        }

        breadcrumb.data = data
      }
    }
  }

  return event
}
