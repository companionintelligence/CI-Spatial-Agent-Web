/**
 * boneResolver.ts — find a humanoid skeleton in an arbitrary glTF.
 *
 * Absorbed from CI-Spatial-Agent-Web-2's `Character.js`, which is the only place
 * in the fleet that solved this generically. The React client instead carried an
 * inline `alias()` block inside a `useEffect` that knew about exactly the rigs in
 * its own hardcoded catalog — so "support any avatar" was never true of it.
 *
 * Rigs disagree about everything: Ready Player Me uses `Head`/`Neck`/`Spine2`,
 * Mixamo prefixes `mixamorig`, VRM normalizes through `humanBones`, VRoid exports
 * Japanese-influenced names, and rigid-node robots have no humanoid skeleton at
 * all. Matching on patterns rather than on a fixed list is what makes a dropped-in
 * GLB work instead of standing inert.
 */

export type BoneSlot =
  | 'hips' | 'spine' | 'spine1' | 'spine2' | 'neck' | 'head'
  | 'leftEye' | 'rightEye'
  | 'leftShoulder' | 'rightShoulder'
  | 'leftArm' | 'rightArm'
  | 'leftForeArm' | 'rightForeArm'
  | 'leftHand' | 'rightHand'

/**
 * Ordered most-specific first. `head` deliberately anchors rather than matching
 * any substring: an RPM avatar ships a "Headphones" mesh, and binding gaze to a
 * prop is a memorable way to lose an afternoon.
 */
export const BONE_PATTERNS: Readonly<Record<BoneSlot, RegExp>> = {
  hips: /^(mixamorig)?(hips|pelvis|root)$/i,
  spine: /^(mixamorig)?spine$/i,
  spine1: /^(mixamorig)?(spine1|chest)$/i,
  spine2: /^(mixamorig)?(spine2|upperchest)$/i,
  neck: /^(mixamorig)?neck$/i,
  head: /^(mixamorig)?head$/i,
  leftEye: /^(mixamorig)?(lefteye|eye[_.]?l)$/i,
  rightEye: /^(mixamorig)?(righteye|eye[_.]?r)$/i,
  leftShoulder: /^(mixamorig)?(leftshoulder|shoulder[_.]?l)$/i,
  rightShoulder: /^(mixamorig)?(rightshoulder|shoulder[_.]?r)$/i,
  leftArm: /^(mixamorig)?(leftarm|upperarm[_.]?l|l[_.]?upperarm)$/i,
  rightArm: /^(mixamorig)?(rightarm|upperarm[_.]?r|r[_.]?upperarm)$/i,
  leftForeArm: /^(mixamorig)?(leftforearm|lowerarm[_.]?l|forearm[_.]?l)$/i,
  rightForeArm: /^(mixamorig)?(rightforearm|lowerarm[_.]?r|forearm[_.]?r)$/i,
  leftHand: /^(mixamorig)?(lefthand|hand[_.]?l)$/i,
  rightHand: /^(mixamorig)?(righthand|hand[_.]?r)$/i
}

/** The minimal structural node a resolver needs. three.js objects satisfy it. */
export interface NodeLike {
  name?: string
  isBone?: boolean
  isMesh?: boolean
  isSkinnedMesh?: boolean
}

export interface ResolveOptions {
  /** VRM humanoid lookup, when the model is a VRM. Authoritative when present. */
  humanoid?: (slot: BoneSlot) => NodeLike | null | undefined
}

/** VRM's humanoid bone names for the slots we care about. */
export const VRM_HUMAN_BONES: Readonly<Partial<Record<BoneSlot, string>>> = {
  hips: 'hips',
  spine: 'spine',
  spine1: 'chest',
  spine2: 'upperChest',
  neck: 'neck',
  head: 'head',
  leftEye: 'leftEye',
  rightEye: 'rightEye',
  leftShoulder: 'leftShoulder',
  rightShoulder: 'rightShoulder',
  leftArm: 'leftUpperArm',
  rightArm: 'rightUpperArm',
  leftForeArm: 'leftLowerArm',
  rightForeArm: 'rightLowerArm',
  leftHand: 'leftHand',
  rightHand: 'rightHand'
}

/**
 * Resolve every slot a model can offer.
 *
 * A VRM's own humanoid mapping wins outright — it is declared by the exporter
 * rather than guessed. Everything else falls back to name patterns, preferring
 * real bones over mesh nodes: a mesh that happens to match (`Headphones`,
 * `Hair_Head`) is only ever a last resort.
 */
export function resolveBones<T extends NodeLike>(
  nodes: readonly T[],
  options: ResolveOptions = {}
): Partial<Record<BoneSlot, T>> {
  const out: Partial<Record<BoneSlot, T>> = {}
  const meshFallback: Partial<Record<BoneSlot, T>> = {}

  const slots = Object.keys(BONE_PATTERNS) as BoneSlot[]

  if (options.humanoid) {
    for (const slot of slots) {
      const node = options.humanoid(slot)
      if (node) out[slot] = node as T
    }
  }

  for (const node of nodes) {
    const name = node.name ?? ''
    if (!name) continue
    for (const slot of slots) {
      if (out[slot]) continue
      if (!BONE_PATTERNS[slot].test(name)) continue
      const isMeshNode = Boolean(node.isMesh || node.isSkinnedMesh) && !node.isBone
      if (isMeshNode) meshFallback[slot] ??= node
      else out[slot] = node
    }
  }

  for (const slot of slots) {
    if (!out[slot] && meshFallback[slot]) out[slot] = meshFallback[slot]
  }

  return out
}

/**
 * Ready Player Me serves a stripped avatar by default. Requesting the morph sets
 * explicitly is the difference between a face that can lip-sync and one that
 * cannot, and it is invisible unless you know to ask — so ask, always.
 */
export function normalizeAvatarUrl(url: string): string {
  if (!/models\.readyplayer\.me\/.+\.glb/i.test(url)) return url
  if (/morphTargets/i.test(url)) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}morphTargets=Oculus%20Visemes,ARKit&textureAtlas=1024`
}
