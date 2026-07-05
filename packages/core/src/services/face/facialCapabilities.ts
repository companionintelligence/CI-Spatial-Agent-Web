/**
 * Runtime facial-rig inspection: given a loaded head (VRM expression manager or a GLB
 * scene with morph targets), collect the addressable facial channel names and classify
 * the head into a facial tier (see facialTiers.ts). AvatarModel uses this to pick the
 * richest facial driver a given avatar supports.
 */

import { detectFacialTier, describeFacialTier, type FacialTier, type FacialTierId } from './facialTiers'

export interface FacialRigInfo {
  tier: FacialTierId
  info: FacialTier
  /** Every morph/expression name the head exposes (lowercased-unique on detect). */
  names: string[]
  isVRM: boolean
}

interface MorphMesh {
  morphTargetDictionary?: Record<string, number>
}
interface SceneLike {
  traverse: (cb: (o: unknown) => void) => void
}
interface VRMLike {
  expressionManager?: { expressionMap?: Record<string, unknown> } | null
}

/** Collect VRM expression names (VRM path). */
export function facialNamesFromVRM(vrm: VRMLike): string[] {
  return Object.keys(vrm.expressionManager?.expressionMap ?? {})
}

/** Collect morph-target names across all morphable meshes in a GLB scene. */
export function facialNamesFromScene(scene: SceneLike): string[] {
  const names = new Set<string>()
  scene.traverse((o: unknown) => {
    const dict = (o as MorphMesh).morphTargetDictionary
    if (dict) for (const k of Object.keys(dict)) names.add(k)
  })
  return [...names]
}

/**
 * Inspect a loaded head and return its facial tier + channel names. Pass the VRM when
 * the head is a VRM (expression-manager route); otherwise pass the GLB scene root.
 */
export function inspectFacialRig(args: { scene?: SceneLike; vrm?: VRMLike | null }): FacialRigInfo {
  const isVRM = !!args.vrm
  const names = isVRM
    ? facialNamesFromVRM(args.vrm as VRMLike)
    : args.scene
      ? facialNamesFromScene(args.scene)
      : []
  const tier = detectFacialTier(names, { isVRM })
  return { tier, info: describeFacialTier(tier), names, isVRM }
}
