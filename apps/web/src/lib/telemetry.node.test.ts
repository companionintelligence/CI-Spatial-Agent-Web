import type { ErrorEvent } from '@sentry/react'
import { describe, expect, it } from 'vitest'

import { scrubBrowserEvent, scrubString, scrubUrl, scrubValue, shouldDropEvent } from './telemetry'
import { KEY_SCRUB_CASES, MAX_STRING_LENGTH, SCRUB_CASES } from './telemetryScrubFixtures'

const event = (partial: unknown) => partial as ErrorEvent

describe('scrubUrl', () => {
  it('drops the query string and hash', () => {
    expect(scrubUrl('https://companion.local/?env=datacenter-1970s#chat')).toBe('https://companion.local/')
  })

  it('keeps a bare path intact', () => {
    expect(scrubUrl('/api/chat')).toBe('/api/chat')
  })

  it('leaves the origin and path exactly as written', () => {
    expect(scrubUrl('https://companion.local/a b/c')).toBe('https://companion.local/a b/c')
  })

  it('handles unparseable input without throwing', () => {
    expect(scrubUrl('::not a url::?q=secret')).toBe('::not a url::')
  })
})

describe('shouldDropEvent', () => {
  it.each([
    'Loading chunk 42 failed',
    'Failed to fetch dynamically imported module: /assets/x.js',
    'Importing a module script failed',
    'ResizeObserver loop completed with undelivered notifications'
  ])('drops known noise: %s', (message) => {
    expect(shouldDropEvent(event({ message }))).toBe(true)
  })

  it('drops noise carried on the exception value rather than the message', () => {
    expect(shouldDropEvent(event({ exception: { values: [{ value: 'Loading chunk 7 failed' }] } }))).toBe(true)
  })

  it('keeps a real application error', () => {
    expect(shouldDropEvent(event({ message: 'Cannot read properties of undefined' }))).toBe(false)
  })

  it('returns null for a dropped event, so it is never sent', () => {
    expect(scrubBrowserEvent(event({ message: 'ResizeObserver loop limit exceeded' }))).toBeNull()
  })
})

describe('scrubString', () => {
  it('redacts credentials and collapses home paths', () => {
    expect(scrubString('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.a.b')).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(scrubString('api-key: sk-live-42')).not.toContain('sk-live-42')
    expect(scrubString('/Users/liam/devel/ci/file.ts')).toBe('~/devel/ci/file.ts')
  })

  it('truncates oversized strings, so a transcript cannot ride out in a message', () => {
    const scrubbed = scrubString('a'.repeat(MAX_STRING_LENGTH + 1000))

    expect(scrubbed).toHaveLength(MAX_STRING_LENGTH + '… [truncated]'.length)
    expect(scrubbed.endsWith('… [truncated]')).toBe(true)
  })
})

describe('scrubValue', () => {
  it('filters sensitive keys at any depth and walks arrays', () => {
    const scrubbed = scrubValue({ list: [{ authorization: 'Bearer x', path: '/home/ci/notes' }] }) as {
      list: { authorization: string; path: string }[]
    }

    expect(scrubbed.list[0]!.authorization).toBe('[Filtered]')
    expect(scrubbed.list[0]!.path).toBe('~/notes')
  })

  it('bottoms out on a deeply nested structure instead of recursing forever', () => {
    let deep: Record<string, unknown> = { end: 'value' }
    for (let i = 0; i < 20; i += 1) {
      deep = { nested: deep }
    }

    expect(JSON.stringify(scrubValue(deep))).toContain('[Truncated]')
  })
})

describe('scrubBrowserEvent', () => {
  it('scrubs the message, exception values and extra', () => {
    const scrubbed = scrubBrowserEvent(
      event({
        message: 'failed at /Users/liam/notes with api_key=sk-live-123456',
        exception: { values: [{ value: 'Bearer eyJhbGciOiJIUzI1NiJ9.a.b rejected' }] },
        extra: { password: 'hunter2' }
      })
    )!

    expect(scrubbed.message).toContain('~/notes')
    expect(scrubbed.message).not.toContain('sk-live-123456')
    expect(scrubbed.exception!.values![0]!.value).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect((scrubbed.extra as Record<string, unknown>).password).toBe('[Filtered]')
  })

  it('survives a cyclic extra payload', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' }
    cyclic.self = cyclic

    expect(() => scrubBrowserEvent(event({ extra: cyclic }))).not.toThrow()
  })

  it('passes through an event with nothing to scrub', () => {
    expect(scrubBrowserEvent(event({ message: 'plain failure' }))).toEqual({ message: 'plain failure' })
  })

  it('removes the machine name if one ever appears', () => {
    expect(scrubBrowserEvent(event({ message: 'x', server_name: 'MacBook-Pro.local' }))!.server_name).toBeUndefined()
  })
})

describe('scrubBrowserEvent — leaks confirmed by adversarial review', () => {
  it('strips the query string and hash from request.url', () => {
    const scrubbed = scrubBrowserEvent(
      event({ request: { url: 'https://companion.local/?ask=what%20did%20the%20doctor%20say' } })
    )!

    expect(scrubbed.request!.url).toBe('https://companion.local/')
  })

  it('drops request cookies and query_string outright', () => {
    const scrubbed = scrubBrowserEvent(
      event({ request: { cookies: { session: 'abc' }, query_string: 'ask=private' } })
    )!

    expect(scrubbed.request!.cookies).toBeUndefined()
    expect(scrubbed.request!.query_string).toBeUndefined()
  })

  it('strips the query string from the referer header set by httpContextIntegration', () => {
    const scrubbed = scrubBrowserEvent(
      event({ request: { headers: { Referer: 'https://companion.local/chat?ask=divorce%20lawyer' } } })
    )!

    expect(scrubbed.request!.headers!.Referer).toBe('https://companion.local/chat')
  })

  it('filters the hyphenated x-api-key header', () => {
    const scrubbed = scrubBrowserEvent(event({ request: { headers: { 'x-api-key': 'ci_live_abc123' } } }))!

    expect(scrubbed.request!.headers!['x-api-key']).toBe('[Filtered]')
  })

  it('scrubs frame paths and captured locals', () => {
    const frame = scrubBrowserEvent(
      event({
        exception: {
          values: [
            {
              value: 'boom',
              stacktrace: {
                frames: [
                  {
                    filename: '/Users/liam/devel/ci/App.tsx',
                    abs_path: '/Users/liam/devel/ci/App.tsx',
                    vars: { note: '/home/ci/journal', token: 'abc' }
                  }
                ]
              }
            }
          ]
        }
      })
    )!.exception!.values![0]!.stacktrace!.frames![0]!

    expect(frame.filename).toBe('~/devel/ci/App.tsx')
    expect(frame.abs_path).toBe('~/devel/ci/App.tsx')
    expect((frame.vars as Record<string, unknown>).note).toBe('~/journal')
    expect((frame.vars as Record<string, unknown>).token).toBe('[Filtered]')
  })

  it('keeps a bundled frame path intact so Sentry can still group the issue', () => {
    const frame = scrubBrowserEvent(
      event({
        exception: { values: [{ value: 'boom', stacktrace: { frames: [{ filename: '/assets/index-abc123.js' }] } }] }
      })
    )!.exception!.values![0]!.stacktrace!.frames![0]!

    expect(frame.filename).toBe('/assets/index-abc123.js')
  })

  it('strips the query string from fetch/xhr breadcrumb urls', () => {
    const scrubbed = scrubBrowserEvent(
      event({
        breadcrumbs: [
          { category: 'fetch', data: { url: '/api/chat?ask=private', method: 'POST' } },
          { category: 'navigation', data: { from: '/a?x=1', to: '/b?y=2' } }
        ]
      })
    )!

    expect(scrubbed.breadcrumbs![0]!.data!.url).toBe('/api/chat')
    expect(scrubbed.breadcrumbs![1]!.data!.from).toBe('/a')
    expect(scrubbed.breadcrumbs![1]!.data!.to).toBe('/b')
  })

  it('scrubs a console breadcrumb message and its raw arguments', () => {
    // Console crumbs are switched off at init in this app, but if an integration
    // ever puts them back the payload still has to be safe.
    const scrubbed = scrubBrowserEvent(
      event({
        breadcrumbs: [
          {
            category: 'console',
            message: 'LLM - sending request to remote {"api_key":"sk-live-42"}',
            data: { arguments: ['Authorization: Bearer eyJreal.token.here'] }
          }
        ]
      })
    )!

    expect(scrubbed.breadcrumbs![0]!.message).not.toContain('sk-live-42')
    expect(JSON.stringify(scrubbed.breadcrumbs![0]!.data!.arguments)).not.toContain('eyJreal.token.here')
  })
})

describe('scrubBrowserEvent — conversation content', () => {
  it('filters a `messages` key wherever it appears', () => {
    const scrubbed = scrubBrowserEvent(
      event({ extra: { state: { messages: [{ role: 'user', content: 'I was diagnosed with…' }] } } })
    )!

    expect(JSON.stringify(scrubbed.extra)).not.toContain('diagnosed')
  })

  it.each(['messages', 'prompt', 'completion', 'transcript', 'utterance'])('filters the `%s` key', (key) => {
    const scrubbed = scrubBrowserEvent(event({ extra: { [key]: 'the user said something private' } }))!

    expect((scrubbed.extra as Record<string, unknown>)[key]).toBe('[Filtered]')
  })
})

describe('shared scrub fixtures — parity with the BFF scrubber', () => {
  // The identical list lives at apps/proxy/src/telemetry/scrubFixtures.ts and is
  // run by that suite too.
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
    const web = path.resolve(here, 'telemetryScrubFixtures.ts')
    const proxy = path.resolve(here, '../../../proxy/src/telemetry/scrubFixtures.ts')

    const [a, b] = await Promise.all([fs.readFile(web, 'utf8'), fs.readFile(proxy, 'utf8')])

    // The web copy carries an extra header comment; the case list must match.
    const cases = (source: string) => source.slice(source.indexOf('export interface ScrubCase'))

    expect(cases(a)).toBe(cases(b))
  })
})

/**
 * The BFF suite runs this same list. Every value is innocuous under the string
 * rules — asserted below — so the KEY is the only signal, which is exactly what
 * `scrubBreadcrumb` used to skip: it handed `scrubValue` each crumb *value* in
 * turn, and `scrubValue` only consults the key while walking an object's own
 * entries. `authorization` was the one key that still worked, because
 * `Bearer …` is caught by the value rules however the walk is shaped.
 */
describe('shared key fixtures — the key is the only signal', () => {
  it.each(KEY_SCRUB_CASES.map((c) => [c.key, c] as const))('scrubValue: %s', (_key, testCase) => {
    expect(scrubString(testCase.value)).toBe(testCase.value)

    const scrubbed = scrubValue({ [testCase.key]: testCase.value }) as Record<string, unknown>

    expect(scrubbed[testCase.key]).toBe(testCase.filtered ? '[Filtered]' : testCase.value)
  })

  it.each(KEY_SCRUB_CASES.map((c) => [c.key, c] as const))('request header: %s', (_key, testCase) => {
    const headers = scrubBrowserEvent(event({ request: { headers: { [testCase.key]: testCase.value } } }))!.request!
      .headers!

    expect(headers[testCase.key]).toBe(testCase.filtered ? '[Filtered]' : testCase.value)
  })

  it.each(KEY_SCRUB_CASES.map((c) => [c.key, c] as const))('breadcrumb data: %s', (_key, testCase) => {
    const data = scrubBrowserEvent(event({ breadcrumbs: [{ data: { [testCase.key]: testCase.value } }] }))!
      .breadcrumbs![0]!.data!

    expect(data[testCase.key]).toBe(testCase.filtered ? '[Filtered]' : testCase.value)
  })

  it('still treats url/from/to as URLs after the object walk', () => {
    const data = scrubBrowserEvent(
      event({ breadcrumbs: [{ category: 'fetch', data: { url: '/api/chat?ask=private', method: 'POST' } }] })
    )!.breadcrumbs![0]!.data!

    expect(data.url).toBe('/api/chat')
    expect(data.method).toBe('POST')
  })
})

describe('scrubBrowserEvent — source snippets attached to a frame', () => {
  const frameWith = (frame: Record<string, unknown>) =>
    scrubBrowserEvent(event({ exception: { values: [{ value: 'boom', stacktrace: { frames: [frame] } }] } }))!
      .exception!.values![0]!.stacktrace!.frames![0]!

  it('scrubs context_line, pre_context and post_context', () => {
    const frame = frameWith({
      filename: '/assets/index-abc123.js',
      context_line: "const key = 'api_key=sk-live-1234567890'",
      pre_context: ['// built from /Users/liam/devel/ci'],
      post_context: ['fetch(url, { headers: { Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.a.b` } })']
    })

    expect(frame.context_line).not.toContain('sk-live-1234567890')
    expect(frame.pre_context![0]).toBe('// built from ~/devel/ci')
    expect(frame.post_context![0]).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })

  it('leaves a frame with no source context alone', () => {
    const frame = frameWith({ filename: '/assets/index-abc123.js' })

    expect(frame.context_line).toBeUndefined()
    expect(frame.pre_context).toBeUndefined()
  })
})
