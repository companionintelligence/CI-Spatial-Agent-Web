import type { ErrorEvent } from '@sentry/node'
import { describe, expect, it } from 'vitest'

import { scrubEvent, scrubString, scrubUrl, scrubValue } from '../src/telemetry/index.js'
import { MAX_STRING_LENGTH, SCRUB_CASES } from '../src/telemetry/scrubFixtures.js'

const event = (partial: unknown) => partial as ErrorEvent

describe('scrubString', () => {
  it('redacts bearer tokens', () => {
    const scrubbed = scrubString('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def')

    expect(scrubbed).toContain('[Filtered]')
    expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })

  it('redacts labelled secrets', () => {
    expect(scrubString('api_key=sk-live-1234567890')).not.toContain('sk-live-1234567890')
    expect(scrubString('password: hunter2')).not.toContain('hunter2')
    expect(scrubString('{"token":"abcdef123456"}')).not.toContain('abcdef123456')
  })

  it('redacts tailscale auth keys', () => {
    expect(scrubString('tskey-auth-abc123-def456')).toBe('[Filtered]')
  })

  it('redacts credentials embedded in connection URLs', () => {
    const scrubbed = scrubString('postgres://ci:pgadmin_s3cure@db:5432/companion')

    expect(scrubbed).not.toContain('pgadmin_s3cure')
    expect(scrubbed).toContain('[Filtered]')
  })

  it('collapses home directories, which leak account names', () => {
    expect(scrubString('/Users/liam/devel/ci/file.ts')).toBe('~/devel/ci/file.ts')
    expect(scrubString('/home/ci/data/timeline.db')).toBe('~/data/timeline.db')
    expect(scrubString('C:\\Users\\liam\\app.log')).toBe('~\\app.log')
  })

  it('collapses Windows home paths in both slash styles', () => {
    // Regression: the macOS pattern used to match inside `C:/Users/…` first,
    // leaving a stranded `C:~/…`.
    expect(scrubString('C:\\Users\\liam\\app.log')).toBe('~\\app.log')
    expect(scrubString('C:/Users/liam/AppData/ci')).toBe('~/AppData/ci')
  })

  it('truncates oversized strings, so a transcript cannot ride out in a message', () => {
    const scrubbed = scrubString('a'.repeat(MAX_STRING_LENGTH + 1000))

    expect(scrubbed).toHaveLength(MAX_STRING_LENGTH + '… [truncated]'.length)
    expect(scrubbed.endsWith('… [truncated]')).toBe(true)
  })

  it('leaves ordinary text alone', () => {
    expect(scrubString('Cannot read properties of undefined (reading "id")')).toBe(
      'Cannot read properties of undefined (reading "id")'
    )
  })
})

describe('scrubUrl', () => {
  it('drops the query string and hash', () => {
    expect(scrubUrl('http://proxy:8787/api/chat?q=my+private+question#top')).toBe('http://proxy:8787/api/chat')
  })

  it('keeps a bare path intact', () => {
    expect(scrubUrl('/api/tts')).toBe('/api/tts')
  })

  it('handles unparseable input without throwing', () => {
    expect(scrubUrl('::not a url::?q=secret')).toBe('::not a url::')
  })
})

describe('scrubValue', () => {
  it('filters sensitive keys at any depth', () => {
    const scrubbed = scrubValue({ a: { b: { authorization: 'Bearer x', keep: 'ok' } } }) as Record<string, never>

    expect(scrubbed.a.b.authorization).toBe('[Filtered]')
    expect(scrubbed.a.b.keep).toBe('ok')
  })

  it('bottoms out on a deeply nested structure instead of recursing forever', () => {
    let deep: Record<string, unknown> = { end: 'value' }
    for (let i = 0; i < 20; i += 1) {
      deep = { nested: deep }
    }

    expect(JSON.stringify(scrubValue(deep))).toContain('[Truncated]')
  })

  it('walks arrays', () => {
    expect(scrubValue(['/Users/liam/x', 'plain'])).toEqual(['~/x', 'plain'])
  })

  it('passes non-string primitives through untouched', () => {
    expect(scrubValue(42)).toBe(42)
    expect(scrubValue(null)).toBeNull()
    expect(scrubValue(undefined)).toBeUndefined()
    expect(scrubValue(true)).toBe(true)
  })
})

describe('scrubEvent', () => {
  it('scrubs the message and exception values', () => {
    const scrubbed = scrubEvent(
      event({
        message: 'failed for /Users/liam/notes',
        exception: { values: [{ value: 'Bearer secrettokenvalue rejected' }] }
      })
    )!

    expect(scrubbed.message).toBe('failed for ~/notes')
    expect(scrubbed.exception!.values![0]!.value).not.toContain('secrettokenvalue')
  })

  it('filters sensitive keys in extra, at any depth', () => {
    const scrubbed = scrubEvent(
      event({
        extra: { outer: { password: 'hunter2', note: '/home/ci/x' }, dsn: 'https://k@o1.ingest.sentry.io/2' }
      })
    )!
    const extra = scrubbed.extra as { outer: { password: string; note: string }; dsn: string }

    expect(extra.outer.password).toBe('[Filtered]')
    expect(extra.outer.note).toBe('~/x')
    expect(extra.dsn).toBe('[Filtered]')
  })

  it('survives a cyclic extra payload', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' }
    cyclic.self = cyclic

    expect(() => scrubEvent(event({ extra: cyclic }))).not.toThrow()
  })

  it('passes through an event with nothing to scrub', () => {
    expect(scrubEvent(event({ message: 'plain failure' }))).toEqual({ message: 'plain failure' })
  })

  it('removes the machine hostname', () => {
    expect(scrubEvent(event({ server_name: 'MacBook-Pro-2.local' })).server_name).toBeUndefined()
  })
})

describe('scrubEvent — request data', () => {
  it('drops cookies, the parsed body and the query string', () => {
    const scrubbed = scrubEvent(
      event({
        request: {
          cookies: { session: 'abc' },
          data: { messages: [{ role: 'user', content: 'what did the doctor say' }] },
          query_string: 'q=private+search',
          headers: { authorization: 'Bearer abc', 'user-agent': 'curl/8' }
        }
      })
    )!

    expect(scrubbed.request!.cookies).toBeUndefined()
    expect(scrubbed.request!.data).toBeUndefined()
    expect(scrubbed.request!.query_string).toBe('[Filtered]')
    expect(scrubbed.request!.headers!.authorization).toBe('[Filtered]')
    expect(scrubbed.request!.headers!['user-agent']).toBe('curl/8')
  })

  it('strips the query string from request.url, not just query_string', () => {
    // requestDataIntegration sets include.url unconditionally and builds it from
    // req.url, which on a Node server is path+query — so filtering query_string
    // alone redacts nothing.
    const scrubbed = scrubEvent(
      event({
        request: { url: 'http://proxy:8787/api/chat?q=oncologist', query_string: 'q=oncologist' }
      })
    )!

    expect(scrubbed.request!.url).toBe('http://proxy:8787/api/chat')
    expect(scrubbed.request!.query_string).toBe('[Filtered]')
  })

  it('strips the query string from the referer header', () => {
    const scrubbed = scrubEvent(
      event({ request: { headers: { Referer: 'https://companion.local/?ask=divorce%20lawyer' } } })
    )!

    expect(scrubbed.request!.headers!.Referer).toBe('https://companion.local/')
  })

  it('strips the query string from a location redirect header', () => {
    expect(scrubEvent(event({ request: { headers: { location: '/chat?q=private' } } })).request!.headers!.location).toBe(
      '/chat'
    )
  })

  it('filters the hyphenated x-api-key header', () => {
    // sendDefaultPii:false does NOT stop request headers reaching the event —
    // it only resolves an IP-oriented deny list for span attributes.
    expect(
      scrubEvent(event({ request: { headers: { 'x-api-key': 'ci_live_abcdef123456' } } })).request!.headers![
        'x-api-key'
      ]
    ).toBe('[Filtered]')
  })

  it('filters x-ci-hub-user, which carries the household username', () => {
    const headers = scrubEvent(
      event({ request: { headers: { 'x-ci-hub-user': 'liam', 'x-ci-hub-user-signature': 'abc' } } })
    )!.request!.headers!

    expect(headers['x-ci-hub-user']).toBe('[Filtered]')
    expect(headers['x-ci-hub-user-signature']).toBe('[Filtered]')
  })
})

describe('scrubEvent — stack frames', () => {
  it('scrubs frame paths and captured locals', () => {
    const frame = scrubEvent(
      event({
        exception: {
          values: [
            {
              value: 'boom',
              stacktrace: {
                frames: [
                  {
                    filename: '/Users/liam/devel/ci/x.ts',
                    abs_path: '/Users/liam/devel/ci/x.ts',
                    vars: { noteText: '/home/ci/journal', password: 'hunter2' }
                  }
                ]
              }
            }
          ]
        }
      })
    )!.exception!.values![0]!.stacktrace!.frames![0]!

    expect(frame.filename).toBe('~/devel/ci/x.ts')
    expect(frame.abs_path).toBe('~/devel/ci/x.ts')
    expect((frame.vars as Record<string, unknown>).noteText).toBe('~/journal')
    expect((frame.vars as Record<string, unknown>).password).toBe('[Filtered]')
  })

  it('keeps the frame path body intact so Sentry can still group the issue', () => {
    const frame = scrubEvent(
      event({
        exception: {
          values: [{ value: 'boom', stacktrace: { frames: [{ filename: '/app/dist/routes/chat.js' }] } }]
        }
      })
    )!.exception!.values![0]!.stacktrace!.frames![0]!

    expect(frame.filename).toBe('/app/dist/routes/chat.js')
  })
})

describe('scrubEvent — breadcrumbs', () => {
  it('scrubs breadcrumb messages and data', () => {
    const scrubbed = scrubEvent(event({ breadcrumbs: [{ message: 'GET /Users/liam', data: { token: 'abc123' } }] }))!

    expect(scrubbed.breadcrumbs![0]!.message).toBe('GET ~')
    expect(scrubbed.breadcrumbs![0]!.data!.token).toBe('[Filtered]')
  })

  it('strips the query string from a breadcrumb url', () => {
    const scrubbed = scrubEvent(
      event({ breadcrumbs: [{ category: 'http', data: { url: 'http://host.docker.internal:11434/api/chat?q=secret' } }] })
    )!

    expect(scrubbed.breadcrumbs![0]!.data!.url).toBe('http://host.docker.internal:11434/api/chat')
  })

  it('filters a console breadcrumb that captured raw arguments', () => {
    const scrubbed = scrubEvent(
      event({
        breadcrumbs: [
          {
            category: 'console',
            message: 'sending request api_key=sk-live-42',
            data: { arguments: ['Authorization: Bearer eyJreal.token.here'], messages: [{ content: 'private' }] }
          }
        ]
      })
    )!
    const crumb = scrubbed.breadcrumbs![0]!

    expect(crumb.message).not.toContain('sk-live-42')
    expect(JSON.stringify(crumb.data!.arguments)).not.toContain('eyJreal.token.here')
    expect(crumb.data!.messages).toBe('[Filtered]')
  })
})

describe('scrubEvent — LLM conversation content', () => {
  it('filters a `messages` key wherever it appears', () => {
    // The single highest-risk payload in this repo: /api/chat bodies are the
    // user's prompt history, and no value-level regex recognises prose.
    const scrubbed = scrubEvent(
      event({ extra: { body: { messages: [{ role: 'user', content: 'I was diagnosed with…' }] } } })
    )!

    expect(JSON.stringify(scrubbed.extra)).not.toContain('diagnosed')
  })

  it.each(['messages', 'prompt', 'completion', 'transcript', 'utterance'])(
    'filters the `%s` key',
    (key) => {
      const scrubbed = scrubEvent(event({ extra: { [key]: 'the user said something private' } }))!

      expect((scrubbed.extra as Record<string, unknown>)[key]).toBe('[Filtered]')
    }
  )
})

describe('shared scrub fixtures', () => {
  // The same list is exercised by the web bundle's suite. If a rule is added
  // here but not there (or vice versa) the copies have drifted.
  it.each(SCRUB_CASES.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const actual = scrubString(testCase.input)

    if (testCase.expected !== undefined) {
      expect(actual).toBe(testCase.expected)
    }

    for (const forbidden of testCase.mustNotContain ?? []) {
      expect(actual).not.toContain(forbidden)
    }
  })

  it('the two fixture files have not drifted', async () => {
    const [fs, path, url] = await Promise.all([import('node:fs/promises'), import('node:path'), import('node:url')])
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const proxy = path.resolve(here, '../src/telemetry/scrubFixtures.ts')
    const web = path.resolve(here, '../../web/src/lib/telemetryScrubFixtures.ts')

    const [a, b] = await Promise.all([fs.readFile(proxy, 'utf8'), fs.readFile(web, 'utf8')])

    // The web copy carries an extra header comment; the case list must match.
    const cases = (source: string) => source.slice(source.indexOf('export interface ScrubCase'))

    expect(cases(a)).toBe(cases(b))
  })
})
