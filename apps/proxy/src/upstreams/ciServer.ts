import type { ResolvedConfig } from '../config.js'
import type { ChatEvent, ChatRequest, UpstreamAdapter } from './types.js'

/**
 * CI-Server ("Companion Memory") adapter — the proprietary-backend seam.
 *
 * Interface-conformant stub. When the CI-Server chat/memory endpoint and its auth
 * scheme are finalized, implement `chat` here to stream from CI-Server and map its
 * response onto the normalized ChatEvent contract; nothing else in the proxy or
 * client changes.
 */
export function createCiServerAdapter(_cfg: ResolvedConfig): UpstreamAdapter {
  return {
    name: 'ci-server',

    // eslint-disable-next-line require-yield
    async *chat(_req: ChatRequest, _signal: AbortSignal): AsyncGenerator<ChatEvent> {
      // TODO: implement CI-Server streaming + auth (session/token).
      yield { type: 'error', message: 'CI-Server upstream is not implemented yet' }
    },

    async health() {
      return { ok: false, detail: 'ci-server adapter not implemented' }
    }
  }
}
