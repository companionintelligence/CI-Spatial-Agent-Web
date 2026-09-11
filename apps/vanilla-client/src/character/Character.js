import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Character — loads any glTF/GLB character and discovers what it can do:
 *
 *  - bones / named nodes (head, neck, spine, arms, eyes) by name heuristics,
 *    so both humanoid skeletons (Ready Player Me, Mixamo) and rigid-node
 *    robots (the bundled robot.gltf) get gaze + gestures.
 *  - morph targets: Oculus visemes (viseme_aa…), ARKit (jawOpen, eyeBlink*),
 *    generic mouthOpen — used by LipSync and blinking.
 *  - "face surfaces": emissive meshes named face/screen, pulsed while
 *    speaking when no mouth morphs exist (robot face screen).
 *  - embedded animation clips (idle/walk/talk/gesture by name) when present.
 *
 * Ready Player Me URLs automatically request viseme + ARKit morph targets.
 */

const OCULUS_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
];

const ARKIT_BLENDSHAPES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
  'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'noseSneerLeft', 'noseSneerRight', 'tongueOut'
];

// Module-level scratch objects for the bone-posing helpers.
const _e = new THREE.Euler();
const _qOffset = new THREE.Quaternion();
const _qRoot = new THREE.Quaternion();
const _qRootInv = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();

const BONE_PATTERNS = {
  head: /(^|[^a-z])head$|^head([^a-z]|$)/i,
  neck: /neck/i,
  spine: /spine|chest|torso|top_body/i,
  hips: /hips|pelvis|root|lower_sphere/i,
  leftEye: /lefteye|eye[_.]?l\b/i,
  rightEye: /righteye|eye[_.]?r\b/i,
  leftArm: /leftarm$|left_arm|upperarm[_.]?l|arm[_.]?l\b|l[_.]?upperarm/i,
  rightArm: /rightarm$|right_arm|upperarm[_.]?r|arm[_.]?r\b|r[_.]?upperarm/i,
  leftForeArm: /leftforearm|forearm[_.]?l|lowerarm[_.]?l/i,
  rightForeArm: /rightforearm|forearm[_.]?r|lowerarm[_.]?r/i,
};

function normalizeAvatarUrl(url) {
  if (/models\.readyplayer\.me\/.+\.glb/i.test(url) && !/morphTargets/i.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}morphTargets=Oculus%20Visemes,ARKit&textureAtlas=1024`;
  }
  return url;
}

export class Character {
  static async load(url, { targetHeight = 1.0 } = {}) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(normalizeAvatarUrl(url));
    return new Character(gltf, { targetHeight });
  }

  constructor(gltf, { targetHeight }) {
    // root (outer) carries locomotion position/heading; model (inner) carries
    // scale + ground offset so animation never fights navigation.
    this.root = new THREE.Group();
    this.root.name = 'character-root';
    this.model = gltf.scene;
    this.root.add(this.model);

    this.clips = gltf.animations ?? [];
    this.bones = {};
    this.restPose = new Map();   // node → rest quaternion (gesture/gaze basis)
    this.morphs = [];            // [{ mesh, dict }]
    this.visemeIndex = {};       // viseme name → [{ mesh, index }]
    this.blendshapeIndex = {};   // ARKit / facial morph name → [{ mesh, index }]
    this.blinkTargets = [];      // [{ mesh, index }]
    this.faceSurfaces = [];      // emissive meshes pulsed while talking
    this.height = 1;
    this.eyeHeight = 0.8;

    this._discover();
    this._normalizeScale(targetHeight);
    this._captureRestPose();
  }

  _discover() {
    const meshes = [];
    const meshCandidates = {};   // bone-slot fallbacks found on mesh nodes
    this.model.traverse((node) => {
      const isMesh = node.isMesh || node.isSkinnedMesh;
      if (isMesh) meshes.push(node);

      const name = node.name || '';
      for (const [slot, pattern] of Object.entries(BONE_PATTERNS)) {
        if (this.bones[slot] || !pattern.test(name)) continue;
        // Prefer real bones / grouping nodes; mesh nodes (e.g. an RPM
        // "Headphones" prop matching /head/) are only a fallback.
        if (isMesh) meshCandidates[slot] ??= node;
        else this.bones[slot] = node;
      }
      if (/face|screen|visor/i.test(name) && isMesh) {
        this.faceSurfaces.push(node);
      }
    });
    for (const [slot, node] of Object.entries(meshCandidates)) {
      this.bones[slot] ??= node;
    }

    // Rigid-node robots: a generic 'Arm' pair instead of left/right names —
    // resolve sides by world X position.
    if (!this.bones.leftArm && !this.bones.rightArm) {
      const arms = [];
      this.model.traverse((n) => {
        if (/^arm(\.\d+)?$/i.test(n.name || '')) arms.push(n);
      });
      if (arms.length >= 2) {
        this.model.updateWorldMatrix(true, true);
        const pos = new THREE.Vector3();
        arms.sort((a, b) =>
          a.getWorldPosition(pos).x - b.getWorldPosition(new THREE.Vector3()).x);
        this.bones.leftArm = arms[0];
        this.bones.rightArm = arms[arms.length - 1];
      }
    }

    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary;
      if (!dict) continue;
      this.morphs.push({ mesh, dict });

      for (const [name, index] of Object.entries(dict)) {
        if (OCULUS_VISEMES.includes(name)) {
          (this.visemeIndex[name] ??= []).push({ mesh, index });
        }
        if (
          ARKIT_BLENDSHAPES.includes(name) ||
          name.startsWith('mouth') ||
          name.startsWith('eye') ||
          name.startsWith('brow') ||
          name.startsWith('jaw')
        ) {
          (this.blendshapeIndex[name] ??= []).push({ mesh, index });
        }
      }

      for (const blink of ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed', 'Blink']) {
        if (blink in dict) this.blinkTargets.push({ mesh, index: dict[blink] });
      }
      if ('jawOpen' in dict) {
        (this.visemeIndex.jawOpen ??= []).push({ mesh, index: dict.jawOpen });
      }
      if ('mouthOpen' in dict) {
        (this.visemeIndex.mouthOpen ??= []).push({ mesh, index: dict.mouthOpen });
      }
    }

    console.log(
      '[Character] rig:', Object.keys(this.bones).join(', ') || 'none',
      '| visemes:', Object.keys(this.visemeIndex).length,
      '| blendshapes:', Object.keys(this.blendshapeIndex).length,
      '| clips:', this.clips.map((c) => c.name).join(', ') || 'none',
    );
  }

  _normalizeScale(targetHeight) {
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const rawHeight = Math.max(size.y, 0.01);

    // Humanoid-scale models (1.4–2.1 m) keep native size; everything else
    // (toy-scale robots, oversized exports) is normalized to targetHeight.
    let scale = 1;
    if (rawHeight < 1.4 || rawHeight > 2.1) scale = targetHeight / rawHeight;
    this.model.scale.setScalar(scale);

    // Rest the lowest point on y=0 of the root.
    const scaledBox = new THREE.Box3().setFromObject(this.model);
    this.model.position.y -= scaledBox.min.y;

    this.height = rawHeight * scale;
    this.eyeHeight = this.height * 0.85;
    if (this.bones.head) {
      this.model.updateWorldMatrix(true, true);
      const headPos = this.bones.head.getWorldPosition(new THREE.Vector3());
      const rootPos = this.root.getWorldPosition(new THREE.Vector3());
      const h = headPos.y - rootPos.y;
      if (h > 0.05) this.eyeHeight = h;
    }
  }

  _captureRestPose() {
    for (const node of Object.values(this.bones)) {
      if (node && !this.restPose.has(node)) {
        this.restPose.set(node, node.quaternion.clone());
      }
    }
  }

  /** World position of the head (or estimated eye height). */
  getHeadWorldPosition(out = new THREE.Vector3()) {
    if (this.bones.head) return this.bones.head.getWorldPosition(out);
    this.root.getWorldPosition(out);
    out.y += this.eyeHeight;
    return out;
  }

  /**
   * Pose a bone by a rotation expressed in the CHARACTER's frame (forward
   * = -Z, up = +Y), independent of the bone's local axis convention:
   *   local = Qp⁻¹ · Qroot · Qe · Qroot⁻¹ · Qp · rest
   * This is what makes the same gesture code work on a Mixamo/RPM skeleton
   * (arm bones with rolled joint axes) and on rigid robot nodes alike.
   */
  poseBoneCharacterFrame(node, ex, ey, ez) {
    const rest = this.restPose.get(node);
    if (!node || !rest || !node.parent) return;
    _e.set(ex, ey, ez);
    _qOffset.setFromEuler(_e);
    this.root.getWorldQuaternion(_qRoot);
    node.parent.getWorldQuaternion(_qParent);
    node.quaternion
      .copy(_qParent).invert()
      .multiply(_qRoot)
      .multiply(_qOffset)
      .multiply(_qRootInv.copy(_qRoot).invert())
      .multiply(_qParent)
      .multiply(rest);
  }

  /** Same conjugation with a world-space delta quaternion (gaze look-at). */
  boneLocalFromWorldDelta(node, worldDelta, out) {
    const rest = this.restPose.get(node);
    if (!node || !rest || !node.parent) return null;
    node.parent.getWorldQuaternion(_qParent);
    return out
      .copy(_qParent).invert()
      .multiply(worldDelta)
      .multiply(_qParent)
      .multiply(rest);
  }

  setVisemeWeight(viseme, weight) {
    const entries = this.visemeIndex[viseme];
    if (!entries) return false;
    for (const { mesh, index } of entries) {
      mesh.morphTargetInfluences[index] = weight;
    }
    return true;
  }

  setBlendshape(name, weight) {
    const entries = this.blendshapeIndex[name] || this.visemeIndex[name];
    if (!entries) return false;
    for (const { mesh, index } of entries) {
      mesh.morphTargetInfluences[index] = weight;
    }
    return true;
  }

  setBlendshapes(weights) {
    for (const [name, weight] of Object.entries(weights)) {
      this.setBlendshape(name, weight);
    }
  }

  setBlink(weight) {
    for (const { mesh, index } of this.blinkTargets) {
      mesh.morphTargetInfluences[index] = weight;
    }
  }

  /** Pulse emissive face surfaces (robot "talking screen" effect). */
  setTalkGlow(intensity) {
    for (const mesh of this.faceSurfaces) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if ('emissiveIntensity' in mat) {
          mat.emissiveIntensity = 1 + intensity * 2.5;
          if (mat.emissive && mat.emissive.getHex() === 0) mat.emissive.setHex(0x33ddff);
        }
      }
    }
  }

  get hasVisemes() {
    return OCULUS_VISEMES.some((v) => v in this.visemeIndex);
  }

  get hasARKitMorphs() {
    return Object.keys(this.blendshapeIndex).length > 0;
  }

  get hasMouthMorph() {
    return !!(this.visemeIndex.jawOpen || this.visemeIndex.mouthOpen || this.blendshapeIndex.jawOpen);
  }
}

export { OCULUS_VISEMES, ARKIT_BLENDSHAPES };
