/**
 * XRSessionManager — enters/exits immersive-ar and immersive-vr sessions,
 * wires controller input (trigger = push-to-talk, squeeze = viewfinder
 * toggle), and exposes the XR reference space used by hit testing.
 */
export class XRSessionManager {
  constructor(engine, { domOverlayRoot } = {}) {
    this.engine = engine;
    this.events = engine.events;
    this.domOverlayRoot = domOverlayRoot ?? null;

    this.session = null;
    this.mode = null;            // 'immersive-ar' | 'immersive-vr' | null
    this.viewerSpace = null;     // XRReferenceSpace ('viewer') for hit testing
    this.refSpace = null;        // primary reference space ('local-floor')

    this._controllersWired = false;
  }

  get active() {
    return !!this.session;
  }

  get isAR() {
    return this.mode === 'immersive-ar';
  }

  async enter(mode) {
    if (this.session) await this.exit();

    const init = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hit-test', 'anchors', 'hand-tracking'],
    };
    if (mode === 'immersive-ar' && this.domOverlayRoot) {
      init.optionalFeatures.push('dom-overlay');
      init.domOverlay = { root: this.domOverlayRoot };
    }

    const session = await navigator.xr.requestSession(mode, init);
    this.session = session;
    this.mode = mode;

    const xr = this.engine.renderer.xr;
    xr.setReferenceSpaceType('local-floor');
    await xr.setSession(session);

    this.refSpace = xr.getReferenceSpace();
    try {
      this.viewerSpace = await session.requestReferenceSpace('viewer');
    } catch {
      this.viewerSpace = null;
    }

    this._wireControllers();

    // AR shows passthrough (transparent background, hide the virtual stage);
    // VR keeps the virtual stage as the floor reference.
    this.engine.setEnvironmentVisible(mode !== 'immersive-ar', mode === 'immersive-ar');

    session.addEventListener('end', () => {
      this.session = null;
      this.mode = null;
      this.viewerSpace = null;
      this.refSpace = null;
      this.engine.setEnvironmentVisible(true, false);
      this.events.emit('xr-end');
    });

    this.events.emit('xr-start', { mode, session });
    console.log(`[XR] entered ${mode}`);
    return session;
  }

  async exit() {
    if (this.session) {
      try { await this.session.end(); } catch { /* already ending */ }
    }
  }

  _wireControllers() {
    if (this._controllersWired) return;
    this._controllersWired = true;

    const xr = this.engine.renderer.xr;
    for (const i of [0, 1]) {
      const controller = xr.getController(i);
      if (!controller) continue;
      controller.addEventListener('selectstart', () => this.events.emit('xr-ptt-start'));
      controller.addEventListener('selectend', () => this.events.emit('xr-ptt-end'));
      controller.addEventListener('squeezestart', () => this.events.emit('xr-squeeze'));
      this.engine.scene.add(controller);
    }
  }
}
