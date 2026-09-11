import type { ResolvedConfig } from '../config.js'
import { selectUpstream } from './index.js'
import type { ChatEvent, ChatMessage, ChatRequest, UpstreamAdapter } from './types.js'

/**
 * CI-Server ("Companion Memory") adapter.
 *
 * Was a stub that yielded `{ type: 'error', message: 'not implemented yet' }`.
 * That single line is why the companion had no memory of any kind: history was
 * fresh React state on every mount, nothing was persisted, nothing was recalled,
 * and the full conversation was resent unbounded on every turn.
 *
 * WHAT THIS IS, AND IS NOT
 * ------------------------
 * CI-Server's `/memory` API is a MEMORY service, not a text generator. So this
 * adapter is not a third generation backend — it is a memory wrapper around
 * whichever generation upstream is already configured:
 *
 *   1. L0 — `GET /memory/context` once per session: a pre-formatted markdown
 *      block describing the user (name, relationships, preferences, dossier).
 *   2. L1 — `POST /memory/recall` per turn: hybrid keyword/semantic search over
 *      the knowledge graph for whatever the user just said.
 *   3. Generate — delegate to the configured chat upstream with both blocks
 *      injected ahead of the system prompt.
 *   4. `POST /memory/turn` afterwards so the exchange is remembered.
 *
 * Written against the live contract in CI-Server's MemoryController, not a
 * guess: the routes, payload shapes and `{ block }` responses are all read from
 * that file. Auth is an API key with the memory scope.
 */

interface RecallResponse {
  block?: string
  resultCount?: number
}

interface ContextResponse {
  block?: string
}

/** Cached L0 block. It describes the USER, not the turn, so it is stable. */
let cachedContextBlock: { value: string; fetchedAt: number } | null = null
const CONTEXT_TTL_MS = 5 * 60_000

export function __resetMemoryCache(): void {
  cachedContextBlock = null
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  signal: AbortSignal
): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    // Memory is an ENHANCEMENT. A companion that answers without its notes is
    // far better than one that refuses to answer because the notes are down.
    return null
  }
}

export function createCiServerAdapter(cfg: ResolvedConfig): UpstreamAdapter {
  const base = cfg.ciServerUrl
  const headers = {
    'content-type': 'application/json',
    ...(cfg.ciServerApiKey ? { 'x-api-key': cfg.ciServerApiKey } : {})
  }

  const loadContextBlock = async (signal: AbortSignal): Promise<string> => {
    const now = Date.now()
    if (cachedContextBlock && now - cachedContextBlock.fetchedAt < CONTEXT_TTL_MS) {
      return cachedContextBlock.value
    }
    const payload = await fetchJson<ContextResponse>(
      `${base}/memory/context`,
      { method: 'GET', headers },
      signal
    )
    const value = payload?.block?.trim() ?? ''
    cachedContextBlock = { value, fetchedAt: now }
    return value
  }

  const recall = async (query: string, signal: AbortSignal): Promise<string> => {
    if (!query.trim()) return ''
    const payload = await fetchJson<RecallResponse>(
      `${base}/memory/recall`,
      { method: 'POST', headers, body: JSON.stringify({ query, maxResults: cfg.memoryMaxResults }) },
      signal
    )
    return payload?.block?.trim() ?? ''
  }

  const persistTurn = async (messages: ChatMessage[], reply: string): Promise<void> => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser && !reply) return
    const turn = [
      ...(lastUser ? [{ role: 'user' as const, content: lastUser.content }] : []),
      ...(reply.trim() ? [{ role: 'assistant' as const, content: reply }] : [])
    ]
    if (turn.length === 0) return
    // Fire and forget: the user is already reading the reply, and blocking the
    // stream's completion on a write would make memory a latency tax.
    await fetchJson(
      `${base}/memory/turn`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ platform: 'spatial-companion', messages: turn })
      },
      new AbortController().signal
    )
  }

  return {
    name: 'ci-server',

    async *chat(req: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
      const generation = selectUpstream({ ...cfg, upstream: cfg.memoryGenerationUpstream })

      const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')
      const [contextBlock, recallBlock] = await Promise.all([
        loadContextBlock(signal),
        recall(lastUser?.content ?? '', signal)
      ])

      const memoryBlocks = [contextBlock, recallBlock].filter(Boolean)
      const augmented: ChatMessage[] = memoryBlocks.length
        ? [
            {
              role: 'system',
              content: `What you remember about the person you are talking to:\n\n${memoryBlocks.join('\n\n')}`
            },
            ...req.messages
          ]
        : req.messages

      let reply = ''
      for await (const event of generation.chat({ ...req, messages: augmented }, signal)) {
        if (event.type === 'chunk') reply += event.content
        yield event
      }

      // Only remember completed turns. Persisting a barge-in would teach the
      // companion half-sentences it never actually said.
      if (!signal.aborted) await persistTurn(req.messages, reply)
    },

    async health() {
      try {
        const res = await fetch(`${base}/health`, { method: 'GET' })
        return { ok: res.ok, detail: `ci-server ${res.status}` }
      } catch (err) {
        return { ok: false, detail: `ci-server unreachable: ${(err as Error).message}` }
      }
    }
  }
}
