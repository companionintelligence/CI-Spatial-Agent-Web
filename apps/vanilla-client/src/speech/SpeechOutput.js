/**
 * SpeechOutput — the character's voice.
 *
 * Adapters, tried in order under 'auto':
 *   'openai'  POST {ai.baseUrl}/audio/speech  (OpenAI-compatible: speaches,
 *             Kokoro/Piper bridges, OpenAI…) → WAV/MP3 bytes
 *   'piper'   GET {piperUrl}?text=…           (plain Piper HTTP server)
 *   'browser' window.speechSynthesis          (no audio graph — LipSync gets
 *             synthetic pulses via onWordBoundary)
 *
 * Decoded audio plays through: source → gain → panner(HRTF) → destination,
 * with an AnalyserNode tap feeding LipSync. The panner is positioned at the
 * character's head each frame so the voice is spatialized in 3D/AR.
 */
export class SpeechOutput {
  constructor(config, events) {
    this.config = config;
    this.events = events;

    this.ctx = null;
    this.analyser = null;
    this._gain = null;
    this._panner = null;
    this._source = null;
    this._speakingPromise = null;
    this._cancelCurrent = null;
    this._mode = config.speech.ttsMode;
    this._autoResolved = null;     // remembered working adapter under 'auto'

    this.onWordBoundary = null;    // (word) => void — browser adapter only
  }

  /** Must be called from a user gesture at least once (autoplay policy). */
  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._gain = this.ctx.createGain();
      this._panner = this.ctx.createPanner();
      this._panner.panningModel = 'HRTF';
      this._panner.distanceModel = 'inverse';
      this._panner.refDistance = 1;
      this._panner.rolloffFactor = 0.6;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.6;

      this._gain.connect(this.analyser);
      this.analyser.connect(this._panner);
      this._panner.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  get speaking() {
    return !!this._speakingPromise;
  }

  /** Update the spatial position of the voice (character head, world space). */
  setSourcePosition(pos) {
    if (!this._panner) return;
    const p = this._panner;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
  }

  /** Update the audio listener from the camera (world position + orientation). */
  setListenerPose(pos, forward, up) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
      l.forwardX.value = forward.x;
      l.forwardY.value = forward.y;
      l.forwardZ.value = forward.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /**
   * Speak text. Interrupts anything currently playing.
   * @returns {Promise<void>} resolves when playback finishes or is stopped.
   */
  async speak(text) {
    if (!text?.trim() || this._mode === 'off') return;
    this.stop();
    this.ensureContext();
    this.events.emit('speech-start', text);

    const finish = () => {
      this._speakingPromise = null;
      this._cancelCurrent = null;
      this.events.emit('speech-end');
    };

    const run = async () => {
      const mode = this.config.speech.ttsMode;
      const order =
        mode === 'auto'
          ? (this._autoResolved ? [this._autoResolved, 'browser'] : ['openai', 'piper', 'browser'])
          : [mode];

      for (const adapter of order) {
        try {
          if (adapter === 'browser') {
            await this._speakBrowser(text);
          } else {
            const buffer = adapter === 'openai'
              ? await this._fetchOpenAI(text)
              : await this._fetchPiper(text);
            await this._playBuffer(buffer);
          }
          if (mode === 'auto') this._autoResolved = adapter;
          return;
        } catch (err) {
          if (err?.name === 'Interrupted') return;
          console.warn(`[TTS] adapter '${adapter}' failed:`, err.message ?? err);
        }
      }
      this.events.emit('toast', 'Voice output unavailable — check TTS settings');
    };

    this._speakingPromise = run().finally(finish);
    return this._speakingPromise;
  }

  stop() {
    this._cancelCurrent?.();
    this._cancelCurrent = null;
    try { window.speechSynthesis?.cancel(); } catch { /* unsupported */ }
    if (this._source) {
      try { this._source.stop(); } catch { /* already stopped */ }
      this._source = null;
    }
  }

  async _fetchOpenAI(text) {
    const { ai, speech } = this.config;
    const res = await fetch(`${ai.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: speech.ttsModel,
        voice: speech.ttsVoice,
        input: text,
        response_format: 'wav',
      }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async _fetchPiper(text) {
    const url = `${this.config.speech.piperUrl}?text=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Piper HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async _playBuffer(arrayBuffer) {
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    return new Promise((resolve, reject) => {
      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this._gain);
      this._source = source;

      let interrupted = false;
      this._cancelCurrent = () => {
        interrupted = true;
        try { source.stop(); } catch { /* already stopped */ }
      };
      source.onended = () => {
        if (this._source === source) this._source = null;
        if (interrupted) {
          const err = new Error('interrupted');
          err.name = 'Interrupted';
          reject(err);
        } else {
          resolve();
        }
      };
      source.start();
    });
  }

  _speakBrowser(text) {
    return new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      if (!synth) {
        reject(new Error('speechSynthesis unavailable'));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const lang = this.config.speech.language;
      if (lang) utterance.lang = lang;

      let interrupted = false;
      this._cancelCurrent = () => {
        interrupted = true;
        synth.cancel();
      };
      utterance.onboundary = () => this.onWordBoundary?.();
      utterance.onend = () => {
        if (interrupted) {
          const err = new Error('interrupted');
          err.name = 'Interrupted';
          reject(err);
        } else {
          resolve();
        }
      };
      utterance.onerror = (e) => {
        if (interrupted || e.error === 'interrupted' || e.error === 'canceled') {
          const err = new Error('interrupted');
          err.name = 'Interrupted';
          reject(err);
        } else {
          reject(new Error(`speechSynthesis: ${e.error}`));
        }
      };
      synth.speak(utterance);
      // Some browsers fire neither end nor error if speech never starts.
      setTimeout(() => {
        if (!synth.speaking && !synth.pending && !interrupted) resolve();
      }, 1000 + text.length * 120);
    });
  }
}
