import { createSimpleStore } from '@hexafield/simple-store'

/** The avatar's conversational state, shared by the status pill and the rig. */
export type ConversationStatus = 'loading' | 'idle' | 'listening' | 'thinking' | 'speaking'

/**
 * The single source of truth for "what is the companion doing right now".
 *
 * The app has always computed this — the status pill needs it — but it never
 * reached the avatar, which was told only `speaking` or `idle`. Every
 * conversation-state behaviour in AvatarDynamicsEngine was therefore
 * unreachable: the listening lean, the attentive brow raise, the gaze aversion
 * and elevated blink rate while thinking. All of it was written, tested, and
 * never once ran.
 *
 * A store rather than a prop because the consumer is a per-frame render loop
 * several components deep; prop-drilling it would re-render the avatar on every
 * status change, which is exactly what the memoization there exists to prevent.
 */
export const ConversationStatusState = createSimpleStore<{ status: ConversationStatus }>({
  status: 'idle'
})

export function setConversationStatus(status: ConversationStatus): void {
  if (ConversationStatusState.get().status !== status) {
    ConversationStatusState.set({ status })
  }
}
