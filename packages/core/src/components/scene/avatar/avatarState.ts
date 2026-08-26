import { createSimpleStore } from '@hexafield/simple-store'

import { AvatarOptions } from './AvatarOptions'

/**
 * Which avatar is mounted, and which per-frame producers are live.
 *
 * Deliberately its own module rather than living beside the renderer: the
 * Settings panel needs to read and set it, and importing it from `AvatarModel`
 * dragged three.js into every consumer — including jsdom component tests, where
 * it fails to resolve outright.
 */
export const AvatarState = createSimpleStore({
  /** A catalog path or any user-supplied GLB/VRM URL. See resolveAvatarSource. */
  selectedModel: AvatarOptions.Greg as string,
  visemesEnabled: true,
  selectedAnimation: '',
  emotesEnabled: true,
  animationsEnabled: true,
  dynamicsEnabled: true
})
