/**
 * Browser copy of the shared redaction cases.
 *
 * The canonical list lives at `apps/proxy/src/telemetry/scrubFixtures.ts`. This
 * file is a byte-identical copy of it from the type declaration below onwards —
 * a drift test in each suite asserts exactly that. It is duplicated rather than
 * imported because the SPA and the BFF are separate build graphs and the web
 * app's tsconfig does not reach into apps/proxy.
 *
 * Redaction cases every copy of the scrubber must handle identically.
 *
 * There are two implementations of these rules in this repo — the BFF
 * (`apps/proxy/src/telemetry/scrubEvent.ts`) and the browser bundle
 * (`apps/web/src/lib/telemetry.ts`) — and they live in separate build graphs, so
 * nothing is shared between them at runtime. Both suites run this list through
 * their own `scrubString`, and a drift test compares the two files byte for byte.
 *
 * The list is kept identical to CI-Server's
 * `backend/apps/api/src/common/telemetry/scrubFixtures.ts`, which is the
 * fleet-wide reference: an earlier draft of that rollout shipped a browser copy
 * with NONE of the string rules, which adversarial review caught and a parity
 * check would have caught first.
 *
 * Deliberately expressed as string→string so it can be consumed by any copy
 * without importing an SDK type.
 */
export interface ScrubCase {
  readonly name: string
  readonly input: string
  /** Substrings that must NOT survive. */
  readonly mustNotContain?: readonly string[]
  /** Exact expected output, where the rule is fully deterministic. */
  readonly expected?: string
}

export const SCRUB_CASES: readonly ScrubCase[] = [
  {
    name: 'bearer token',
    input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def',
    mustNotContain: ['eyJhbGciOiJIUzI1NiJ9']
  },
  {
    name: 'labelled api key',
    input: 'api_key=sk-live-1234567890',
    mustNotContain: ['sk-live-1234567890']
  },
  {
    name: 'hyphenated api key',
    input: 'api-key: sk-live-0987654321',
    mustNotContain: ['sk-live-0987654321']
  },
  {
    name: 'labelled password',
    input: 'password: hunter2',
    mustNotContain: ['hunter2']
  },
  {
    name: 'tailscale auth key',
    input: 'tskey-auth-abc123-def456',
    expected: '[Filtered]'
  },
  {
    name: 'credentials in a connection URL',
    input: 'postgres://ci:pgadmin_s3cure@db:5432/companion',
    mustNotContain: ['pgadmin_s3cure']
  },
  {
    name: 'macOS home path',
    input: '/Users/liam/devel/ci/file.ts',
    expected: '~/devel/ci/file.ts'
  },
  {
    name: 'Linux home path',
    input: '/home/ci/data/timeline.db',
    expected: '~/data/timeline.db'
  },
  {
    name: 'Windows home path, backslash',
    input: 'C:\\Users\\liam\\app.log',
    expected: '~\\app.log'
  },
  {
    // Regression: the macOS rule used to match inside this and leave `C:~/…`.
    name: 'Windows home path, forward slash',
    input: 'C:/Users/liam/AppData/ci',
    expected: '~/AppData/ci'
  },
  {
    name: 'ordinary text is untouched',
    input: 'Cannot read properties of undefined (reading "id")',
    expected: 'Cannot read properties of undefined (reading "id")'
  }
]

/** Strings longer than this must be truncated by every copy. */
export const MAX_STRING_LENGTH = 8000

/**
 * Key-based redaction cases every copy must handle identically.
 *
 * Each `value` here is deliberately innocuous: no rule in `SCRUB_CASES` matches
 * any of them, so the KEY is the only signal there is, and each suite asserts
 * `scrubString(value) === value` first so a pass cannot be vacuous.
 *
 * That property is the whole reason this list exists. A scrubber that walks a
 * container's values one at a time instead of handing the container itself to
 * the value walk still redacts `authorization`, because `Bearer …` is caught by
 * the *value* rules — so an Authorization spot check reads clean while every
 * other key ships intact.
 */
export interface KeyScrubCase {
  readonly key: string
  /** Innocuous under the string rules — the key must be what redacts it. */
  readonly value: string
  /** `true`: must become `[Filtered]`. `false`: must survive as diagnostics. */
  readonly filtered: boolean
}

export const KEY_SCRUB_CASES: readonly KeyScrubCase[] = [
  // Credentials.
  { key: 'password', value: 'correcthorsebattery', filtered: true },
  { key: 'secret', value: 'shhh', filtered: true },
  { key: 'token', value: 'a1b2c3d4e5', filtered: true },
  { key: 'authorization', value: 'a1b2c3d4e5', filtered: true },
  { key: 'cookie', value: 'sid=9f3a', filtered: true },
  { key: 'jwt', value: 'header.payload.sig', filtered: true },
  { key: 'api-key', value: 'k-42', filtered: true },
  { key: 'api_key', value: 'k-42', filtered: true },
  { key: 'x-api-key', value: 'k-42', filtered: true },
  { key: 'SENTRY_DSN', value: 'https://k@o1.ingest.us.sentry.io/2', filtered: true },
  { key: 'pepper', value: 'nacl', filtered: true },
  { key: 'private_key', value: 'MIIEvQIBADAN', filtered: true },
  // CI-Hub's Traefik forward-auth injects X-CI-Hub-User/-Timestamp/-Signature on
  // every authenticated request, and the SDK ships the headers that ARRIVED.
  { key: 'signature', value: 'd34db33f', filtered: true },
  { key: 'x-ci-hub-signature', value: 'd34db33f', filtered: true },
  // Identity: these name a PERSON, so no value rule can ever catch them.
  { key: 'user', value: 'liam', filtered: true },
  { key: 'x-ci-hub-user', value: 'liam', filtered: true },
  { key: 'hub_user', value: 'liam', filtered: true },
  { key: 'owner', value: 'liam', filtered: true },
  { key: 'account_owner', value: 'liam', filtered: true },
  { key: 'username', value: 'liam', filtered: true },
  { key: 'email', value: 'liam@example.com', filtered: true },
  { key: 'x-forwarded-for', value: '192.168.0.5', filtered: true },
  { key: 'x-forwarded-user', value: 'liam', filtered: true },
  { key: 'remote-addr', value: '192.168.0.5', filtered: true },
  // Conversation content — this repo's addition to the fleet pattern. On an LLM
  // client and its BFF these key names ARE the conversation, and prose cannot be
  // recognised by a value pattern any more than a username can.
  { key: 'messages', value: 'how do I read this scan', filtered: true },
  { key: 'prompt', value: 'how do I read this scan', filtered: true },
  { key: 'completion', value: 'it looks benign', filtered: true },
  { key: 'transcript', value: 'it looks benign', filtered: true },
  { key: 'utterance', value: 'it looks benign', filtered: true },
  // Kept: the identity rules are anchored precisely so these stay diagnostic.
  { key: 'user-agent', value: 'Mozilla/5.0', filtered: false },
  { key: 'user_id', value: 'u-7', filtered: false },
  { key: 'userId', value: 'u-7', filtered: false },
  { key: 'owner_id', value: 'o-3', filtered: false },
  { key: 'method', value: 'POST', filtered: false },
  { key: 'accept', value: 'application/json', filtered: false }
]
