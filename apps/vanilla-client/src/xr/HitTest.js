import * as THREE from 'three/webgpu';

/**
 * HitTestManager — thin wrapper over the WebXR Hit Test API.
 *
 * castFromViewer(angleH, angleV) fires a one-shot angled ray from the viewer:
 * the technique this project uses for anchoring detection labels to real
 * surfaces — a detection's normalized camera-frame position is converted to
 * yaw/pitch and raycast into the room.
 *
 * Quest budgets concurrent hit-test sources (~5-8), so one-shot casts create
 * a source, wait for the first result (or a timeout), then cancel it. The
 * character's floor height comes from the 'local-floor' reference space
 * (y = 0 is the real floor), so no extra probing is needed for locomotion.
 */
export class HitTestManager {
  constructor(engine, xrSessions) {
    this.engine = engine;
    this.xr = xrSessions;
    this._active = new Set();   // in-flight one-shot casts
    this.maxConcurrent = 5;

    this._euler = new THREE.Euler();
    this._quat = new THREE.Quaternion();
  }

  get available() {
    return !!(this.xr.session && this.xr.viewerSpace && this.xr.refSpace
      && typeof self.XRRay !== 'undefined');
  }

  /**
   * One-shot angled hit test from the viewer.
   * @returns {Promise<{position: THREE.Vector3, hit: boolean}>} world-space
   *   point — the surface hit, or a fallback point along the ray.
   */
  castFromViewer(angleH, angleV, { timeoutMs = 1500, fallbackDistance = 2.5 } = {}) {
    this._euler.set(angleV, angleH, 0, 'YXZ');
    this._quat.setFromEuler(this._euler);
    const viewerDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this._quat);

    const fallback = () => {
      const headPos = new THREE.Vector3();
      const headQuat = new THREE.Quaternion();
      this.engine.getHeadPose(headPos, headQuat);
      const worldDir = viewerDir.clone().applyQuaternion(headQuat);
      return { position: headPos.addScaledVector(worldDir, fallbackDistance), hit: false };
    };

    if (!this.available || this._active.size >= this.maxConcurrent) {
      return Promise.resolve(fallback());
    }

    const session = this.xr.session;
    const ray = new XRRay(
      { x: 0, y: 0, z: 0, w: 1 },
      { x: viewerDir.x, y: viewerDir.y, z: viewerDir.z, w: 0 },
    );

    return new Promise((resolve) => {
      let source = null;
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        this._active.delete(entry);
        try { source?.cancel(); } catch { /* session may have ended */ }
        resolve(result);
      };

      const entry = {
        onFrame: (xrFrame) => {
          if (!source) return;
          const results = xrFrame.getHitTestResults(source);
          if (results.length > 0) {
            const pose = results[0].getPose(this.xr.refSpace);
            if (pose) {
              const p = pose.transform.position;
              finish({ position: new THREE.Vector3(p.x, p.y, p.z), hit: true });
            }
          }
        },
      };
      this._active.add(entry);

      session
        .requestHitTestSource({ space: this.xr.viewerSpace, offsetRay: ray })
        .then((s) => { source = s; })
        .catch(() => finish(fallback()));

      setTimeout(() => finish(fallback()), timeoutMs);
    });
  }

  /** Drive in-flight casts from the frame loop. */
  update({ xrFrame }) {
    if (!xrFrame || this._active.size === 0) return;
    for (const entry of [...this._active]) entry.onFrame(xrFrame);
  }
}
