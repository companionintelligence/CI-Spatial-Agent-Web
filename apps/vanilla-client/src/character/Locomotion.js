import * as THREE from 'three/webgpu';

/**
 * Locomotion — the room walking controller.
 *
 * Steer-then-move navigation on the floor plane: turn toward the target at
 * turnSpeed, advance at walkSpeed, arrive, then face the user. Respects the
 * user's personal space, keeps inside a home radius (set when the character
 * is placed in AR), turns the body when gaze demand exceeds the head's
 * comfortable range, and optionally wanders while idle.
 *
 * In AR the floor is y=0 of the 'local-floor' reference space — the real
 * floor — so the same controller works in flat 3D, VR and AR.
 */
export class Locomotion {
  constructor(character, engine, config) {
    this.character = character;
    this.engine = engine;

    this.walkSpeed = config.walkSpeed;
    this.turnSpeed = config.turnSpeed;
    this.personalSpace = config.personalSpace;
    this.wanderEnabled = config.wander;
    this.wanderRadius = config.wanderRadius;

    this.home = new THREE.Vector3();   // anchor the character roams around
    this.floorY = 0;

    this.state = 'idle';               // 'idle' | 'turn' | 'walk'
    this._target = new THREE.Vector3();
    this._onArrive = null;
    this._faceUserOnArrive = true;

    this._wanderTimer = 12 + Math.random() * 15;

    this._userHead = new THREE.Vector3();
    this._toTarget = new THREE.Vector3();
    this._flat = new THREE.Vector3();
  }

  /** Place the character at a world position (also resets home). */
  placeAt(position, { faceUser = true } = {}) {
    this.character.root.position.set(position.x, this.floorY, position.z);
    this.home.copy(this.character.root.position);
    this.stop();
    if (faceUser) this._faceUser(true);
  }

  /**
   * Walk to a world position. Resolves when arrived (or superseded).
   * @returns {Promise<boolean>} true if the destination was reached.
   */
  walkTo(position, { faceUser = true } = {}) {
    return new Promise((resolve) => {
      if (this._onArrive) this._onArrive(false);   // supersede previous walk
      this._target.set(position.x, this.floorY, position.z);
      this._clampTarget();
      this._onArrive = resolve;
      this._faceUserOnArrive = faceUser;
      this.state = 'turn';
    });
  }

  stop() {
    if (this._onArrive) {
      this._onArrive(false);
      this._onArrive = null;
    }
    this.state = 'idle';
  }

  get isMoving() {
    return this.state !== 'idle';
  }

  /** Point 1.2 m in front of the user, on the floor — "come here". */
  frontOfUser(distance = 1.2, out = new THREE.Vector3()) {
    const headPos = new THREE.Vector3();
    const headQuat = new THREE.Quaternion();
    this.engine.getHeadPose(headPos, headQuat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    out.copy(headPos).addScaledVector(fwd, distance);
    out.y = this.floorY;
    return out;
  }

  update(dt, gazeDemand = 0) {
    const root = this.character.root;
    root.position.y = this.floorY;

    if (this.state === 'idle') {
      // Turn-in-place when the gaze target is beyond head range.
      if (Math.abs(gazeDemand) > 0.01) {
        root.rotation.y += THREE.MathUtils.clamp(
          gazeDemand, -this.turnSpeed * dt, this.turnSpeed * dt);
      }
      this._maybeWander(dt);
      return 'idle';
    }

    // --- navigating ---
    this._toTarget.copy(this._target).sub(root.position);
    this._toTarget.y = 0;
    const dist = this._toTarget.length();

    if (dist < 0.15) {
      this.state = 'idle';
      if (this._faceUserOnArrive) this._faceUser(false);
      const cb = this._onArrive;
      this._onArrive = null;
      cb?.(true);
      return 'idle';
    }

    const targetYaw = Math.atan2(this._toTarget.x, this._toTarget.z);
    let yawErr = targetYaw - root.rotation.y;
    yawErr = Math.atan2(Math.sin(yawErr), Math.cos(yawErr));   // wrap to ±π

    const maxTurn = this.turnSpeed * dt;
    root.rotation.y += THREE.MathUtils.clamp(yawErr, -maxTurn, maxTurn);

    if (this.state === 'turn') {
      if (Math.abs(yawErr) < 0.25) this.state = 'walk';
      return 'idle';
    }

    // Walk forward along current heading (slows for sharp residual turns).
    const speedScale = Math.abs(yawErr) > 0.8 ? 0.4 : 1;
    const step = Math.min(this.walkSpeed * speedScale * dt, dist);
    root.position.x += Math.sin(root.rotation.y) * step;
    root.position.z += Math.cos(root.rotation.y) * step;
    return 'walk';
  }

  _clampTarget() {
    // Keep out of the user's personal space…
    this.engine.getHeadPose(this._userHead);
    this._flat.copy(this._target);
    this._flat.y = this._userHead.y;
    const toUser = this._flat.distanceTo(this._userHead);
    if (toUser < this.personalSpace) {
      const away = this._flat.sub(this._userHead);
      away.y = 0;
      if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
      away.normalize();
      this._target.set(
        this._userHead.x + away.x * this.personalSpace,
        this.floorY,
        this._userHead.z + away.z * this.personalSpace,
      );
    }
    // …and inside the roaming area around home.
    const fromHome = this._toTarget.copy(this._target).sub(this.home);
    fromHome.y = 0;
    const maxRange = this.wanderRadius * 2.5;
    if (fromHome.length() > maxRange) {
      fromHome.setLength(maxRange);
      this._target.copy(this.home).add(fromHome);
      this._target.y = this.floorY;
    }
  }

  _maybeWander(dt) {
    if (!this.wanderEnabled) return;
    this._wanderTimer -= dt;
    if (this._wanderTimer > 0) return;
    this._wanderTimer = 14 + Math.random() * 20;

    const angle = Math.random() * Math.PI * 2;
    const radius = this.wanderRadius * (0.3 + Math.random() * 0.7);
    this.walkTo(new THREE.Vector3(
      this.home.x + Math.cos(angle) * radius,
      this.floorY,
      this.home.z + Math.sin(angle) * radius,
    ));
  }

  _faceUser(instant) {
    this.engine.getHeadPose(this._userHead);
    const dx = this._userHead.x - this.character.root.position.x;
    const dz = this._userHead.z - this.character.root.position.z;
    const yaw = Math.atan2(dx, dz);   // character forward is +Z
    if (instant) this.character.root.rotation.y = yaw;
    // Otherwise the gaze controller's bodyTurnDemand finishes the turn
    // smoothly over the next frames.
  }
}
