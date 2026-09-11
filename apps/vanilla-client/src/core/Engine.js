import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { detectCapabilities, chooseBackend } from './Capabilities.js';
import { EventBus } from './EventBus.js';

/**
 * Engine — owns the renderer (WebGPU with WebGL2 fallback), scene, cameras,
 * the frame loop, and the registry of updatable systems.
 *
 * Systems are plain objects with an optional `update(ctx)` method, where
 * ctx = { dt, time, xrFrame, presenting }. They are updated in registration
 * order each frame, before rendering.
 */
export class Engine {
  constructor(config) {
    this.config = config;
    this.events = new EventBus();
    this.systems = [];
    this.caps = null;
    this.backend = 'webgl2';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
    this.camera.position.set(0, 1.5, 1.8);
    // The camera must be in the scene graph so head-locked children
    // (viewfinder, HUD planes) render.
    this.scene.add(this.camera);

    this.clock = new THREE.Clock();
    this._headPos = new THREE.Vector3();
    this._headQuat = new THREE.Quaternion();

    this._stage = null;
    this._defaultBackground = new THREE.Color(0x0b0e14);
  }

  async init(container) {
    this.caps = await detectCapabilities();
    this.backend = chooseBackend(this.caps, this.config.renderer);

    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      alpha: true,
      forceWebGL: this.backend !== 'webgpu',
    });
    await this.renderer.init();

    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.config.renderer.maxPixelRatio));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene.background = this._defaultBackground;
    this._buildStage();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.9, -1.2);
    this.controls.maxDistance = 12;
    this.controls.update();

    window.addEventListener('resize', () => this._onResize(container));
    this._onResize(container);

    this.renderer.setAnimationLoop((time, xrFrame) => this._tick(time, xrFrame));

    const actualBackend = this.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    this.backendLabel = actualBackend;
    console.log(`[Engine] renderer ready — backend: ${actualBackend}`, this.caps);
    this.events.emit('ready', { backend: actualBackend, caps: this.caps });
    return this;
  }

  addSystem(system) {
    this.systems.push(system);
    return system;
  }

  get presenting() {
    return this.renderer?.xr?.isPresenting ?? false;
  }

  /** World-space head pose — works in and out of XR. */
  getHeadPose(outPos, outQuat) {
    let cam = this.camera;
    if (this.presenting) {
      const xrCam = this.renderer.xr.getCamera();
      if (xrCam) cam = xrCam.cameras?.[0] ?? xrCam;
    }
    cam.getWorldPosition(outPos ?? this._headPos);
    if (outQuat) cam.getWorldQuaternion(outQuat);
    return outPos ?? this._headPos;
  }

  /** Horizontal/vertical FOV (radians) of the active view — used to map
   *  normalized camera-frame coordinates onto rays. */
  getViewFov() {
    let cam = this.camera;
    if (this.presenting) {
      const xrCam = this.renderer.xr.getCamera();
      cam = xrCam?.cameras?.[0] ?? xrCam ?? cam;
    }
    const e = cam.projectionMatrix?.elements;
    if (e && Math.abs(e[0]) > 0.1 && Math.abs(e[5]) > 0.1) {
      return {
        h: 2 * Math.atan(1 / Math.abs(e[0])),
        v: 2 * Math.atan(1 / Math.abs(e[5])),
      };
    }
    return { h: (100 * Math.PI) / 180, v: (85 * Math.PI) / 180 };
  }

  /** Toggle scene dressing for AR passthrough vs VR/flat. */
  setEnvironmentVisible(visible, transparentBackground) {
    this.scene.background = transparentBackground ? null : this._defaultBackground;
    if (this._stage) this._stage.visible = visible;
  }

  _buildStage() {
    this._stage = new THREE.Group();
    this._stage.name = 'stage';

    const grid = new THREE.GridHelper(10, 20, 0x2a3344, 0x1a2030);
    grid.position.y = 0.001;
    this._stage.add(grid);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5, 48),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this._stage.add(floor);

    this.scene.add(this._stage);

    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x202833, 1.1);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(2, 4, 1.5);
    this.scene.add(dir);
  }

  _onResize(container) {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _tick(time, xrFrame) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const presenting = this.presenting;

    if (this.controls) this.controls.enabled = !presenting;

    const ctx = { dt, time: time / 1000, xrFrame, presenting, engine: this };
    for (const system of this.systems) {
      try {
        system.update?.(ctx);
      } catch (err) {
        console.error('[Engine] system update failed:', err);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
