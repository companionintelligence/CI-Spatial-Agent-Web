import type { VRM } from '@pixiv/three-vrm'
import { MorphTargetFaceRig, VrmExpressionFaceRig, type FaceRig } from '@ci-avatar/engine'
import type * as THREE from 'three'

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
export function createFaceRig(
  meshes: readonly THREE.Mesh[],
  vrm?: VRM
): { rig: FaceRig; kind: 'vrm-expression' | 'morph-target' | 'none' } {
  const expressionCount = vrm?.expressionManager
    ? Object.keys(vrm.expressionManager.expressionMap ?? {}).length
    : 0

  if (vrm?.expressionManager && expressionCount > 0) {
    return {
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
    return { rig: new MorphTargetFaceRig(withMorphs), kind: 'morph-target' }
  }

  return { rig: NULL_FACE_RIG, kind: 'none' }
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
