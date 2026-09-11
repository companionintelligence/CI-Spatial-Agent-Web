import { normalizeAvatarUrl } from './boneResolver'

/**
 * Resolve whatever a user gave us into a loadable avatar URL.
 *
 * The shipping app has no avatar picker at all — the model is a module constant —
 * so "supports any avatar" has never been testable by a user. This is the
 * function that makes it true: a catalog name, a bundled path, a Ready Player Me
 * share link, or a bare URL all resolve here, and anything that cannot possibly
 * load is rejected with a reason rather than failing as a blank viewport.
 */

export type AvatarSourceError = 'empty' | 'unsupported-extension' | 'unsupported-protocol'

export interface AvatarSourceResult {
  ok: boolean
  /** Loadable URL when ok. */
  url?: string
  error?: AvatarSourceError
  /** Human-readable reason, suitable for showing in the UI. */
  message?: string
}

const SUPPORTED = ['.glb', '.gltf', '.vrm']

/**
 * Ready Player Me hands out several link shapes. Only the `.glb` model URL is
 * loadable; the others are viewer pages that would 200 with HTML and fail deep
 * inside the glTF parser, where the error says nothing useful.
 */
function coerceReadyPlayerMe(raw: string): string {
  const rpmId = raw.match(/readyplayer\.me\/(?:avatar\?id=|gallery\/)?([0-9a-f]{24})/i)?.[1]
  if (rpmId) return `https://models.readyplayer.me/${rpmId}.glb`
  return raw
}

export function resolveAvatarSource(
  input: string,
  catalog: Readonly<Record<string, string>> = {}
): AvatarSourceResult {
  const raw = input?.trim()
  if (!raw) return { ok: false, error: 'empty', message: 'Enter an avatar name or URL.' }

  // A catalog name wins — it is the common case and needs no validation.
  if (catalog[raw]) return { ok: true, url: catalog[raw] }

  const coerced = coerceReadyPlayerMe(raw)

  if (/^[a-z][a-z0-9+.-]*:/i.test(coerced) && !/^https?:/i.test(coerced)) {
    return {
      ok: false,
      error: 'unsupported-protocol',
      message: 'Only http(s) URLs and bundled asset paths can be loaded.'
    }
  }

  const withoutQuery = coerced.split(/[?#]/)[0].toLowerCase()
  if (!SUPPORTED.some((ext) => withoutQuery.endsWith(ext))) {
    return {
      ok: false,
      error: 'unsupported-extension',
      message: `Expected a ${SUPPORTED.join(', ')} file.`
    }
  }

  return { ok: true, url: normalizeAvatarUrl(coerced) }
}
