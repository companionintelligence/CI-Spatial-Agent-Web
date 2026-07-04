import type { ResolvedConfig } from '../config.js'
import { type ChatEvent, type ChatRequest, type UpstreamAdapter, readLines } from './types.js'

/**
 * OpenAI-compatible adapter (OpenAI, vLLM, Lemonade, ...). These stream SSE lines
 * `data: { choices: [{ delta: { content } }] }` terminated by `data: [DONE]`.
 */
export function createOpenAIAdapter(cfg: ResolvedConfig): UpstreamAdapter {
  return {
    name: 'openai',

    async *chat(req: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
      let res: Response
      try {
        res = await fetch(`${cfg.openaiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${cfg.openaiApiKey}`
          },
          body: JSON.stringify({
            model: req.model || cfg.openaiModel,
            messages: req.messages,
            stream: true
          }),
          signal
        })
      } catch (err) {
        yield { type: 'error', message: `openai request failed: ${(err as Error).message}` }
        return
      }

      if (!res.ok || !res.body) {
        yield { type: 'error', message: `openai responded ${res.status}` }
        return
      }

      for await (const line of readLines(res.body)) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }
        let obj: { choices?: { delta?: { content?: string } }[] }
        try {
          obj = JSON.parse(data)
        } catch {
          continue
        }
        const content = obj.choices?.[0]?.delta?.content
        if (content) yield { type: 'chunk', content }
      }
      yield { type: 'done' }
    },

    async health() {
      return {
        ok: Boolean(cfg.openaiApiKey),
        detail: cfg.openaiApiKey ? 'openai key present' : 'openai key missing'
      }
    }
  }
}
