export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  model?: string
  stream?: boolean
}

/**
 * The single normalized event contract the client consumes, regardless of which
 * upstream produced it. Each adapter maps its native stream onto this shape.
 */
export type ChatEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface UpstreamAdapter {
  readonly name: string
  /** Stream normalized events from the upstream. Honors `signal` for cancellation. */
  chat(req: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatEvent>
  /** Lightweight reachability probe for /api/health. */
  health(): Promise<{ ok: boolean; detail?: string }>
}

/**
 * Yield newline-delimited lines from a fetch Response body, buffering partial
 * lines across chunk/TCP boundaries. Shared by the NDJSON (Ollama) and SSE
 * (OpenAI) adapters.
 */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        yield buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
      }
    }
    buffer += decoder.decode()
    if (buffer.length > 0) yield buffer
  } finally {
    reader.releaseLock()
  }
}
