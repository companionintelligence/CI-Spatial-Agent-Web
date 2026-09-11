/**
 * SpeechInput — push-to-talk voice capture.
 *
 * 'whisper' records mic audio (MediaRecorder, webm/opus) while PTT is held,
 * then POSTs it to an OpenAI-compatible /audio/transcriptions endpoint
 * (Whisper, faster-whisper/speaches, etc.). 'browser' uses the Web Speech
 * API. 'auto' tries whisper and falls back to browser on failure.
 *
 * Emits via the shared bus: 'stt-listening', 'stt-stopped',
 * 'stt-result' (text), 'stt-error' (message).
 */
export class SpeechInput {
  constructor(config, events) {
    this.config = config;
    this.events = events;

    this._stream = null;
    this._recorder = null;
    this._chunks = [];
    this._recognition = null;
    this._listening = false;
    this._autoResolved = null;
  }

  get listening() {
    return this._listening;
  }

  get mode() {
    const configured = this.config.speech.sttMode;
    if (configured !== 'auto') return configured;
    return this._autoResolved ?? 'whisper';
  }

  async start() {
    if (this._listening || this.config.speech.sttMode === 'off') return;
    this._listening = true;
    this.events.emit('stt-listening');

    try {
      if (this.mode === 'browser') this._startBrowser();
      else await this._startRecorder();
    } catch (err) {
      this._listening = false;
      this.events.emit('stt-error', `Microphone unavailable: ${err.message ?? err}`);
    }
  }

  async stop() {
    if (!this._listening) return;
    this._listening = false;
    this.events.emit('stt-stopped');

    if (this._recognition) {
      try { this._recognition.stop(); } catch { /* already stopped */ }
      return;
    }
    if (this._recorder && this._recorder.state !== 'inactive') {
      this._recorder.stop();
    }
  }

  async _startRecorder() {
    if (!this._stream) {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    }
    this._chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : '';
    this._recorder = new MediaRecorder(this._stream, mime ? { mimeType: mime } : undefined);
    this._recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this._chunks.push(e.data);
    };
    this._recorder.onstop = () => this._transcribe();
    this._recorder.start();
  }

  async _transcribe() {
    const blob = new Blob(this._chunks, { type: this._recorder?.mimeType || 'audio/webm' });
    this._chunks = [];
    if (blob.size < 1500) return;   // tap, not speech

    const { ai, speech } = this.config;
    const form = new FormData();
    form.append('file', blob, 'speech.webm');
    form.append('model', speech.sttModel);
    if (speech.language) form.append('language', speech.language);

    try {
      const res = await fetch(`${ai.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
      const data = await res.json();
      const text = (data.text ?? '').trim();
      if (this.config.speech.sttMode === 'auto') this._autoResolved = 'whisper';
      if (text) this.events.emit('stt-result', text);
    } catch (err) {
      console.warn('[STT] whisper endpoint failed:', err.message ?? err);
      if (this.config.speech.sttMode === 'auto' && this._browserAvailable()) {
        this._autoResolved = 'browser';
        this.events.emit('toast', 'Whisper unreachable — using browser speech recognition');
      } else {
        this.events.emit('stt-error', 'Transcription failed — check the STT endpoint');
      }
    }
  }

  _browserAvailable() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  _startBrowser() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) throw new Error('Web Speech API not supported');

    const rec = new Recognition();
    rec.continuous = false;
    rec.interimResults = false;
    if (this.config.speech.language) rec.lang = this.config.speech.language;

    rec.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (text) this.events.emit('stt-result', text);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        this.events.emit('stt-error', `Speech recognition: ${e.error}`);
      }
    };
    rec.onend = () => {
      this._recognition = null;
      if (this._listening) {
        this._listening = false;
        this.events.emit('stt-stopped');
      }
    };
    this._recognition = rec;
    rec.start();
  }
}
