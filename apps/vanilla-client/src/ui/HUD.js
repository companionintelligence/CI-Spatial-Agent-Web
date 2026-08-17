import { saveConfigPatch, resetStoredConfig } from '../config.js';

/**
 * HUD — DOM overlay UI: status pills, chat log, text input, push-to-talk,
 * Enter AR/VR, settings drawer, toasts and the flat-mode camera PiP with a
 * detection dot overlay. The HUD root doubles as the dom-overlay element in
 * AR sessions so the same UI stays usable on Quest.
 */
export class HUD {
  constructor(config, events) {
    this.config = config;
    this.events = events;
    this.root = document.getElementById('hud');

    this._el = {};
    for (const id of [
      'splash', 'splash-status', 'status-backend', 'dot-backend', 'status-agent',
      'dot-agent', 'status-detect', 'dot-detect', 'btn-camera', 'btn-come',
      'btn-ar', 'btn-vr', 'btn-settings', 'settings', 'chat-log', 'chat-input',
      'ptt-btn', 'pip', 'toasts',
      'set-ai-base', 'set-ai-model', 'set-ai-key', 'set-avatar', 'set-tts',
      'set-stt', 'set-frames', 'set-detect', 'set-proactive', 'set-save', 'set-reset',
    ]) {
      this._el[id] = document.getElementById(id);
    }

    this._pipVideo = null;
    this._pipCanvas = null;

    this._wireChat();
    this._wirePtt();
    this._wireSettings();
    this._wireEvents();
  }

  setSplash(text) {
    if (this._el['splash-status']) this._el['splash-status'].textContent = text;
  }

  hideSplash() {
    this._el.splash?.classList.add('hidden');
  }

  setBackendLabel(label) {
    this._el['status-backend'].textContent = label;
  }

  enableXRButtons(caps, onEnterAR, onEnterVR) {
    if (caps.immersiveAR) {
      this._el['btn-ar'].disabled = false;
      this._el['btn-ar'].addEventListener('click', onEnterAR);
    }
    if (caps.immersiveVR) {
      this._el['btn-vr'].disabled = false;
      this._el['btn-vr'].addEventListener('click', onEnterVR);
    }
  }

  onCameraToggle(fn) {
    this._el['btn-camera'].addEventListener('click', fn);
  }

  onComeHere(fn) {
    this._el['btn-come'].addEventListener('click', fn);
  }

  addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    this._el['chat-log'].appendChild(div);
    while (this._el['chat-log'].children.length > 60) {
      this._el['chat-log'].firstChild.remove();
    }
    this._el['chat-log'].scrollTop = this._el['chat-log'].scrollHeight;
  }

  toast(text, ms = 4500) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    this._el.toasts.appendChild(div);
    setTimeout(() => div.remove(), ms);
  }

  /** Show the webcam PiP (flat mode) with a detection overlay canvas. */
  showPip(video) {
    if (this._pipVideo === video) {
      this._el.pip.style.display = 'block';
      return;
    }
    this._pipVideo = video;
    this._el.pip.querySelectorAll('video, canvas').forEach((n) => n.remove());
    this._el.pip.prepend(video);
    this._pipCanvas = document.createElement('canvas');
    this._el.pip.appendChild(this._pipCanvas);
    this._el.pip.style.display = 'block';
  }

  hidePip() {
    this._el.pip.style.display = 'none';
  }

  get pipVisible() {
    return this._el.pip.style.display !== 'none' && this._el.pip.style.display !== '';
  }

  drawPipDetections(detections) {
    if (!this._pipCanvas || !this._pipVideo || !this.pipVisible) return;
    const canvas = this._pipCanvas;
    const vw = this._pipVideo.videoWidth || 1280;
    const vh = this._pipVideo.videoHeight || 720;
    if (canvas.width !== vw) { canvas.width = vw; canvas.height = vh; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, vw, vh);

    for (const det of detections) {
      const cx = det.center[0] * vw;
      const cy = det.center[1] * vh;
      const r = Math.max(10, vw * 0.01);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();
      ctx.font = `bold ${Math.max(20, vw * 0.018)}px system-ui`;
      ctx.fillStyle = '#00ff88';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.strokeText(text, cx + r + 6, cy);
      ctx.fillText(text, cx + r + 6, cy);
    }
  }

  // ----- internal wiring -----

  _wireChat() {
    this._el['chat-input'].addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const text = this._el['chat-input'].value.trim();
      if (!text) return;
      this._el['chat-input'].value = '';
      this.events.emit('user-text', text);
    });
  }

  _wirePtt() {
    const btn = this._el['ptt-btn'];
    const start = (e) => {
      e.preventDefault();
      this.events.emit('ptt-start');
    };
    const end = (e) => {
      e.preventDefault();
      this.events.emit('ptt-end');
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', (e) => {
      if (e.buttons) end(e);
    });

    // Hold Space to talk when not typing.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement !== this._el['chat-input']) {
        e.preventDefault();
        this.events.emit('ptt-start');
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && document.activeElement !== this._el['chat-input']) {
        e.preventDefault();
        this.events.emit('ptt-end');
      }
    });
  }

  _wireSettings() {
    const el = this._el;
    el['btn-settings'].addEventListener('click', () => {
      el.settings.classList.toggle('open');
      if (el.settings.classList.contains('open')) this._fillSettings();
    });

    el['set-save'].addEventListener('click', () => {
      saveConfigPatch({
        ai: {
          baseUrl: el['set-ai-base'].value.trim() || '/v1',
          model: el['set-ai-model'].value.trim() || this.config.ai.model,
          apiKey: el['set-ai-key'].value.trim(),
        },
        character: { url: el['set-avatar'].value.trim() || this.config.character.url },
        speech: { ttsMode: el['set-tts'].value, sttMode: el['set-stt'].value },
        vision: {
          attachFrameToChat: el['set-frames'].checked,
          detectionEnabled: el['set-detect'].checked,
        },
        agent: { proactive: el['set-proactive'].checked },
      });
      location.reload();
    });

    el['set-reset'].addEventListener('click', () => {
      resetStoredConfig();
      location.reload();
    });
  }

  _fillSettings() {
    const el = this._el;
    el['set-ai-base'].value = this.config.ai.baseUrl;
    el['set-ai-model'].value = this.config.ai.model;
    el['set-ai-key'].value = this.config.ai.apiKey;
    el['set-avatar'].value = this.config.character.url;
    el['set-tts'].value = this.config.speech.ttsMode;
    el['set-stt'].value = this.config.speech.sttMode;
    el['set-frames'].checked = this.config.vision.attachFrameToChat;
    el['set-detect'].checked = this.config.vision.detectionEnabled;
    el['set-proactive'].checked = this.config.agent.proactive;
  }

  _wireEvents() {
    const el = this._el;
    this.events.on('chat', ({ role, text }) => this.addMessage(role, text));
    this.events.on('agent-action', ({ tool, args }) => {
      const detail = tool === 'say' ? '' : ` ${JSON.stringify(args)}`;
      this.addMessage('action', `⚡ ${tool}${detail}`);
    });
    this.events.on('agent-state', (state) => {
      el['status-agent'].textContent = state;
      el['dot-agent'].className = `dot ${state === 'idle' ? '' : 'busy'}`;
    });
    this.events.on('detector-status', (up) => {
      el['dot-detect'].className = `dot ${up ? 'on' : ''}`;
      el['status-detect'].textContent = up ? 'detector ✓' : 'detector off';
    });
    this.events.on('stt-listening', () => el['ptt-btn'].classList.add('listening'));
    this.events.on('stt-stopped', () => el['ptt-btn'].classList.remove('listening'));
    this.events.on('stt-error', (msg) => this.toast(msg));
    this.events.on('toast', (msg) => this.toast(msg));
    this.events.on('flat-detections', (detections) => this.drawPipDetections(detections));
  }
}
