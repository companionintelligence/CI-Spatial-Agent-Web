/**
 * LipSync — audio-driven viseme puppeteering.
 *
 * Reads the TTS playback through a WebAudio AnalyserNode and maps short-time
 * energy + spectral centroid onto Oculus viseme morph targets (the approach
 * popularized by SALSA-style lip sync: amplitude picks mouth openness,
 * spectral shape picks the vowel group). Degrades gracefully:
 *
 *   1. Oculus visemes (Ready Player Me)  → full viseme blending
 *   2. jawOpen / mouthOpen morph         → energy-driven jaw
 *   3. neither (bundled robot)           → speakingEnergy drives the face
 *      screen glow + head bob via AnimationController
 *
 * For browser speechSynthesis (no audio graph access) `pulse()` provides
 * synthetic energy from word-boundary events.
 */
export class LipSync {
  constructor(character) {
    this.character = character;
    this.energy = 0;             // smoothed 0..1 — exposed for body language
    this.lowBand = 0;
    this.midBand = 0;
    this.highBand = 0;

    this._analyser = null;
    this._freqData = null;
    this._weights = new Map();   // viseme/blendshape → current weight
    this._activeViseme = 'viseme_sil';
    this._pulseUntil = 0;
    this._pulseLevel = 0;

    this.attack = 0.45;          // smoothing toward louder
    this.release = 0.18;         // smoothing toward silence
  }

  /** Attach to the speech output's analyser (null to detach). */
  setAnalyser(analyser) {
    this._analyser = analyser;
    this._freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  }

  /** Synthetic mouth movement for TTS paths without an audio graph. */
  pulse(durationMs = 220, level = 0.7) {
    this._pulseUntil = performance.now() + durationMs;
    this._pulseLevel = level;
  }

  update(dt) {
    let rawEnergy = 0;
    let rawLow = 0;
    let rawMid = 0;
    let rawHigh = 0;
    let centroid = 0;

    if (this._analyser && this._freqData) {
      this._analyser.getByteFrequencyData(this._freqData);
      const n = this._freqData.length;
      const sampleRate = this._analyser.context.sampleRate;
      const binHz = sampleRate / 2 / n;

      const lo = Math.max(1, Math.floor(80 / binHz));
      const midCut = Math.min(n - 1, Math.floor(350 / binHz));
      const highCut = Math.min(n - 1, Math.floor(2000 / binHz));
      const hi = Math.min(n - 1, Math.ceil(5000 / binHz));

      let sum = 0;
      let weighted = 0;
      let sumLow = 0;
      let sumMid = 0;
      let sumHigh = 0;

      for (let i = lo; i <= hi; i++) {
        const v = this._freqData[i] / 255;
        sum += v;
        weighted += v * i * binHz;
        if (i <= midCut) sumLow += v;
        else if (i <= highCut) sumMid += v;
        else sumHigh += v;
      }

      const count = Math.max(1, hi - lo + 1);
      const lowCount = Math.max(1, midCut - lo + 1);
      const midCount = Math.max(1, highCut - midCut);
      const highCount = Math.max(1, hi - highCut);

      rawEnergy = Math.min(1, (sum / count) * 2.2);
      rawLow = Math.min(1, (sumLow / lowCount) * 2.5);
      rawMid = Math.min(1, (sumMid / midCount) * 2.5);
      rawHigh = Math.min(1, (sumHigh / highCount) * 3.0);
      centroid = sum > 0.001 ? weighted / sum : 0;
    }

    if (performance.now() < this._pulseUntil) {
      rawEnergy = Math.max(rawEnergy, this._pulseLevel * (0.6 + 0.4 * Math.random()));
      rawLow = rawEnergy * 0.8;
      rawMid = rawEnergy * 0.6;
      rawHigh = rawEnergy * 0.4;
      centroid = 400 + Math.random() * 1200;
    }

    const k = rawEnergy > this.energy ? this.attack : this.release;
    const smoothFactor = Math.min(1, k * dt * 60);
    this.energy += (rawEnergy - this.energy) * smoothFactor;
    this.lowBand += (rawLow - this.lowBand) * smoothFactor;
    this.midBand += (rawMid - this.midBand) * smoothFactor;
    this.highBand += (rawHigh - this.highBand) * smoothFactor;

    this._applyVisemes(centroid);
  }

  _applyVisemes(centroid) {
    const c = this.character;
    const e = this.energy;
    const low = this.lowBand;
    const mid = this.midBand;
    const high = this.highBand;

    // 1. Oculus Visemes
    if (c.hasVisemes) {
      let target = 'viseme_sil';
      if (e > 0.05) {
        if (e < 0.15) target = 'viseme_nn';
        else if (centroid < 500) target = 'viseme_aa';
        else if (centroid < 850) target = 'viseme_O';
        else if (centroid < 1300) target = 'viseme_E';
        else if (centroid < 2000) target = 'viseme_I';
        else if (high > 0.3) target = 'viseme_SS';
        else target = 'viseme_CH';
      }
      this._activeViseme = target;

      for (const viseme of Object.keys(c.visemeIndex)) {
        if (viseme === 'jawOpen' || viseme === 'mouthOpen') continue;
        const current = this._weights.get(viseme) ?? 0;
        const goal = viseme === target ? Math.min(1, e * 1.6) : 0;
        const next = current + (goal - current) * 0.35;
        this._weights.set(viseme, next);
        if (Math.abs(next) > 0.001 || Math.abs(current) > 0.001) {
          c.setVisemeWeight(viseme, next);
        }
      }
    }

    // 2. ARKit Blendshapes (ReadyPlayerMe standard & ARKit models)
    if (c.hasARKitMorphs) {
      const arkitGoals = {
        jawOpen: e > 0.04 ? Math.min(1, e * 1.3 + low * 0.4) : 0,
        mouthFunnel: centroid > 400 && centroid < 1000 ? Math.min(0.8, mid * 1.2) : 0,
        mouthPucker: centroid < 600 ? Math.min(0.7, low * 0.9) : 0,
        mouthStretchLeft: centroid > 1400 ? Math.min(0.7, high * 0.9) : 0,
        mouthStretchRight: centroid > 1400 ? Math.min(0.7, high * 0.9) : 0,
        mouthSmileLeft: centroid > 1800 ? Math.min(0.5, high * 0.6) : 0,
        mouthSmileRight: centroid > 1800 ? Math.min(0.5, high * 0.6) : 0,
        mouthClose: e < 0.03 ? 0.2 : 0,
        mouthRollLower: low > 0.4 ? Math.min(0.4, low * 0.5) : 0,
        mouthShrugUpper: mid > 0.5 ? Math.min(0.4, mid * 0.5) : 0,
        mouthShrugLower: low > 0.5 ? Math.min(0.3, low * 0.4) : 0
      };

      for (const [shape, goal] of Object.entries(arkitGoals)) {
        const current = this._weights.get(shape) ?? 0;
        const next = current + (goal - current) * 0.35;
        this._weights.set(shape, next);
        if (Math.abs(next) > 0.001 || Math.abs(current) > 0.001) {
          c.setBlendshape(shape, next);
        }
      }
    } else if (c.hasMouthMorph) {
      const w = Math.min(1, e * 1.4);
      c.setVisemeWeight('jawOpen', w);
      c.setVisemeWeight('mouthOpen', w);
    }
  }

  get speaking() {
    return this.energy > 0.04;
  }
}
