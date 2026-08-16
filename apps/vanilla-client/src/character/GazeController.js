import * as THREE from 'three/webgpu';

/**
 * GazeController — keeps the character socially attentive.
 *
 * Target priority: explicit look_at (agent tool, timed) → the user's head →
 * straight ahead. Gaze yaw/pitch is clamped to a natural range relative to
 * the body; beyond that the locomotion layer turns the body (bodyTurnDemand).
 *
 * The head rotation is computed as a world-space shortest-arc delta from the
 * character's rest forward to the (clamped) target direction, conjugated
 * into the bone's parent frame — correct for any bone axis convention.
 * Characters without a head bone are handled by Locomotion's body yaw alone.
 */
export class GazeController {
  constructor(character, engine) {
    this.character = character;
    this.engine = engine;

    this.maxYaw = THREE.MathUtils.degToRad(60);
    this.maxPitch = THREE.MathUtils.degToRad(32);
    this.smoothing = 6;          // larger = snappier

    this._override = null;       // { position: Vector3, until: ms }
    this._target = new THREE.Vector3();
    this._targetYawLocal = 0;

    this._headWorld = new THREE.Vector3();
    this._rootQuat = new THREE.Quaternion();
    this._rootQuatInv = new THREE.Quaternion();
    this._localDir = new THREE.Vector3();
    this._clampedDir = new THREE.Vector3();
    this._restForward = new THREE.Vector3();
    this._delta = new THREE.Quaternion();
    this._desiredLocal = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._eyeQuat = new THREE.Quaternion();
    this._saccade = new THREE.Vector2();
    this._saccadeTimer = 0;
  }

  /** Look at a world position for `holdMs` (agent look_at tool). */
  lookAt(position, holdMs = 4000) {
    this._override = { position: position.clone(), until: performance.now() + holdMs };
  }

  clearOverride() {
    this._override = null;
  }

  /** Current gaze target in world space. */
  getTarget(out = new THREE.Vector3()) {
    return out.copy(this._target);
  }

  /** Yaw error (radians) beyond comfortable head range — locomotion turns
   *  the body when this is non-zero. */
  get bodyTurnDemand() {
    const over = Math.abs(this._targetYawLocal) - this.maxYaw * 0.85;
    return over > 0 ? Math.sign(this._targetYawLocal) * over : 0;
  }

  update(dt) {
    const c = this.character;

    if (this._override && performance.now() > this._override.until) this._override = null;
    if (this._override) {
      this._target.copy(this._override.position);
    } else {
      this.engine.getHeadPose(this._target);
    }

    // Target direction in the character root's frame (glTF characters face +Z).
    c.getHeadWorldPosition(this._headWorld);
    c.root.getWorldQuaternion(this._rootQuat);
    this._rootQuatInv.copy(this._rootQuat).invert();
    this._localDir.copy(this._target).sub(this._headWorld).applyQuaternion(this._rootQuatInv);
    if (this._localDir.lengthSq() < 0.0025) return;
    this._localDir.normalize();

    const yaw = Math.atan2(this._localDir.x, this._localDir.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(this._localDir.y, -1, 1));
    this._targetYawLocal = yaw;

    const head = c.bones.head;
    if (head && c.restPose.has(head)) {
      const yawC = THREE.MathUtils.clamp(yaw, -this.maxYaw, this.maxYaw);
      const pitchC = THREE.MathUtils.clamp(pitch, -this.maxPitch, this.maxPitch);

      // Rebuild the clamped direction and form a world-space shortest-arc
      // delta from the character's forward (+Z).
      this._euler.set(-pitchC, yawC, 0, 'YXZ');
      this._clampedDir.set(0, 0, 1).applyEuler(this._euler).applyQuaternion(this._rootQuat);
      this._restForward.set(0, 0, 1).applyQuaternion(this._rootQuat);
      this._delta.setFromUnitVectors(this._restForward, this._clampedDir);

      const desired = c.boneLocalFromWorldDelta(head, this._delta, this._desiredLocal);
      if (desired) {
        const k = 1 - Math.exp(-this.smoothing * dt);
        head.quaternion.slerp(desired, k);
      }
    }

    // Eye micro-saccades for rigs with eye bones (tiny angles — composing on
    // rest directly is fine here).
    this._saccadeTimer -= dt;
    if (this._saccadeTimer <= 0) {
      this._saccade.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.05);
      this._saccadeTimer = 0.4 + Math.random() * 2.2;
    }
    for (const slot of ['leftEye', 'rightEye']) {
      const eye = c.bones[slot];
      const rest = c.restPose.get(eye);
      if (!eye || !rest) continue;
      this._euler.set(this._saccade.y, this._saccade.x, 0);
      this._eyeQuat.setFromEuler(this._euler);
      eye.quaternion.copy(rest).multiply(this._eyeQuat);
    }
  }
}
