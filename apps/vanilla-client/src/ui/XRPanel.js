import * as THREE from 'three/webgpu';

/**
 * XRPanel — in-world speech bubble for immersive sessions (where the DOM
 * HUD may be unavailable, e.g. VR or AR without dom-overlay). A small
 * canvas-textured plane floats above the character's head, billboards to
 * the user, and shows the agent state plus its last line.
 */
export class XRPanel {
  constructor(engine, character, events) {
    this.engine = engine;
    this.character = character;

    this._canvas = document.createElement('canvas');
    this._canvas.width = 768;
    this._canvas.height = 256;
    this._ctx = this._canvas.getContext('2d');
    this._texture = new THREE.CanvasTexture(this._canvas);

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.2),
      new THREE.MeshBasicMaterial({
        map: this._texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
    engine.scene.add(this.mesh);

    this._state = 'idle';
    this._line = '';
    this._lineUntil = 0;
    this._headPos = new THREE.Vector3();
    this._userPos = new THREE.Vector3();

    events.on('agent-state', (state) => {
      this._state = state;
      this._draw();
    });
    events.on('chat', ({ role, text }) => {
      if (role !== 'assistant') return;
      this._line = text;
      this._lineUntil = performance.now() + Math.min(12000, 2500 + text.length * 60);
      this._draw();
    });
  }

  update({ presenting }) {
    this.mesh.visible = presenting && (this._state !== 'idle' || performance.now() < this._lineUntil);
    if (!this.mesh.visible) return;

    this.character.getHeadWorldPosition(this._headPos);
    this._headPos.y += 0.28;
    this.mesh.position.lerp(this._headPos, 0.2);
    this.engine.getHeadPose(this._userPos);
    this.mesh.lookAt(this._userPos);
  }

  _draw() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(10, 14, 22, 0.85)';
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 36);
    ctx.fill();
    ctx.strokeStyle = this._state === 'idle' ? 'rgba(0,255,136,0.7)' : '#ffb347';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = this._state === 'idle' ? '#00ff88' : '#ffb347';
    ctx.font = 'bold 34px system-ui, sans-serif';
    const label = { idle: '●', thinking: '… thinking', speaking: '🗣 speaking' }[this._state] ?? this._state;
    ctx.fillText(label, 36, 56);

    if (this._line) {
      ctx.fillStyle = '#e8edf6';
      ctx.font = '32px system-ui, sans-serif';
      this._wrapText(this._line, 36, 110, w - 72, 42, 3);
    }
    this._texture.needsUpdate = true;
  }

  _wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(/\s+/);
    let line = '';
    let lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (this._ctx.measureText(test).width > maxWidth && line) {
        lines++;
        if (lines >= maxLines) {
          this._ctx.fillText(`${line}…`, x, y);
          return;
        }
        this._ctx.fillText(line, x, y);
        y += lineHeight;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) this._ctx.fillText(line, x, y);
  }
}
