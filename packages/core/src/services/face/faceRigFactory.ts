import type { VRM } from '@pixiv/three-vrm'
import { MorphTargetFaceRig, VrmExpressionFaceRig, type FaceRig } from '@ci-avatar/engine'
import type * as THREE from 'three'

import { inspectFacialRig, type FacialRigInfo } from './facialCapabilities'

/**
 * Pick the richest face rig a loaded avatar can drive.
 *
 * A VRM is not automatically the VRM path: a VRM whose expression manager is
 * missing or empty (converted models routinely ship one) still has ordinary
 * glTF morph targets underneath, and driving those is strictly better than
 * driving nothing. So the choice is made on what the head actually exposes, not
 * on the file extension — which is the same mistake `isVRM ? … : …` branching
 * made everywhere in the render loop.
 */
export interface FaceRigResult {
  rig: FaceRig
  kind: 'vrm-expression' | 'morph-target' | 'none'
  /**
   * How much facial detail this head can actually drive.
   *
   * `facialTiers.ts` has classified heads into six tiers since it was written and
   * its own doc comment claims "AvatarModel uses this" — but nothing ever called
   * `detectFacialTier`; it was only re-exported from the package index. Reporting
   * it here is what makes the classification real, and it lets the UI tell a user
   * that the avatar they dropped in is body-animation-only instead of leaving them
   * wondering why its face never moves.
   */
  facial: FacialRigInfo
}

export function createFaceRig(
  meshes: readonly THREE.Mesh[],
  vrm?: VRM,
  scene?: THREE.Object3D
): FaceRigResult {
  const expressionCount = vrm?.expressionManager
    ? Object.keys(vrm.expressionManager.expressionMap ?? {}).length
    : 0

  const facial = inspectFacialRig(
    vrm?.expressionManager && expressionCount > 0
      ? { vrm }
      : { scene: scene as unknown as { traverse: (cb: (o: unknown) => void) => void } | undefined }
  )

  if (vrm?.expressionManager && expressionCount > 0) {
    return {
      facial,
      rig: new VrmExpressionFaceRig({
        expressionMap: vrm.expressionManager.expressionMap as unknown as Record<string, unknown>,
        setValue: (name, value) => vrm.expressionManager!.setValue(name, value),
        // The VRM expression manager batches; nothing lands until update() runs.
        update: () => vrm.expressionManager!.update()
      }),
      kind: 'vrm-expression'
    }
  }

  const withMorphs = meshes.filter((m) => m.morphTargetDictionary && m.morphTargetInfluences)
  if (withMorphs.length > 0) {
    return { facial, rig: new MorphTargetFaceRig(withMorphs), kind: 'morph-target' }
  }

  return { facial, rig: NULL_FACE_RIG, kind: 'none' }
}

/**
 * A head with no facial channels at all — the bare-mesh avatars in the catalog
 * (LiamCES2) and most scanned models. Body animation still works; the face is
 * simply inert, and saying so explicitly beats scattering null checks.
 */
export const NULL_FACE_RIG: FaceRig = {
  has: () => false,
  write: () => {}
}
