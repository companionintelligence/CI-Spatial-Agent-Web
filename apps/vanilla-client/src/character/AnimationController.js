import * as THREE from 'three/webgpu';

/**
 * AnimationController — drives the character's body.
 *
 * Layer 1 (base locomotion): if the glTF embeds clips whose names match
 * idle/walk/talk, an AnimationMixer crossfades between them. Otherwise a
 * procedural fallback animates whatever rig nodes exist: hover-bob + sway
 * for the robot, breathing + arm relax for humanoids — so any model moves
 * believably out of the box.
 *
 * Layer 2 (gestures): short procedural one-shots (wave, nod, shake, point,
 * celebrate) composed onto bones over the base layer. Procedural gestures
 * work on both skinned humanoids and rigid-node robots since they only need
 * the discovered head/arm nodes.
 *
 * Speaking energy (from LipSync) adds subtle head bob while talking.
 */

const CLIP_PATTERNS = {
  idle: /idle|breath|stand/i,
  walk: /walk|run|move/i,
  talk: /talk|speak/i,
};

const TWO_PI = Math.PI * 2;

export class AnimationController {
  constructor(character) {
    this.character = character;
    this.state = 'idle';            // 'idle' | 'walk'
    this.speakingEnergy = 0;

    this._mixer = null;
    this._actions = {};
    this._activeAction = null;

    this._gesture = null;           // { name, t, duration }
    this._gestureQueue = [];

    this._blinkTimer = 1.5 + Math.random() * 3;
    this._blinkPhase = -1;

    this._tmpQuat = new THREE.Quaternion();
    this._tmpEuler = new THREE.Euler();

    this._setupClips();
  }

  _setupClips() {
    const clips = this.character.clips;
    if (!clips?.length) return;
    this._mixer = new THREE.AnimationMixer(this.character.model);
    for (const [state, pattern] of Object.entries(CLIP_PATTERNS)) {
      const clip = clips.find((c) => pattern.test(c.name));
      if (clip) this._actions[state] = this._mixer.clipAction(clip);
    }
    if (this._actions.idle) {
      this._activeAction = this._actions.idle;
      this._activeAction.play();
    }
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    const next = this._actions[state];
    if (next && next !== this._activeAction) {
      next.reset().play();
      if (this._activeAction) this._activeAction.crossFadeTo(next, 0.3, true);
      this._activeAction = next;
    }
  }

  /** Play a named gesture; queues if one is already running. */
  playGesture(name, duration = 2.0) {
    const known = ['wave', 'nod', 'shake', 'point', 'celebrate', 'think'];
    if (!known.includes(name)) name = 'nod';
    if (this._gesture) {
      if (this._gestureQueue.length < 2) this._gestureQueue.push({ name, duration });
      return;
    }
    this._gesture = { name, t: 0, duration };
  }

  get gestureActive() {
    return !!this._gesture;
  }

  update(dt, time) {
    if (this._mixer) this._mixer.update(dt);

    // Procedural base layer only when no clip drives the body.
    if (!this._activeAction) this._proceduralBase(time);

    this._updateGesture(dt, time);
    this._updateBlink(dt);

    // Talking feedback for morph-less faces (robot screen glow).
    this.character.setTalkGlow(this.speakingEnergy);
  }

  _proceduralBase(time) {
    const c = this.character;
    const model = c.model;
    const walking = this.state === 'walk';

    // Hover bob — faster + stronger while moving.
    const bobFreq = walking ? 2.6 : 1.1;
    const bobAmp = walking ? 0.035 : 0.018;
    model.position.y = model.userData.baseY ?? (model.userData.baseY = model.position.y);
    model.position.y += Math.sin(time * bobFreq * TWO_PI * 0.5) * bobAmp;

    // Lean into motion / gentle idle sway.
    const lean = walking ? 0.12 : 0.025 * Math.sin(time * 0.7);
    model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, walking ? lean : 0, 0.08);
    model.rotation.z = Math.sin(time * 0.9) * (walking ? 0.04 : 0.015);

    // Head speech bob rides on top of gaze (applied after gaze in update order).
    if (c.bones.head && this.speakingEnergy > 0.02) {
      const head = c.bones.head;
      this._tmpEuler.set(this.speakingEnergy * 0.06 * Math.sin(time * 11), 0, 0);
      this._tmpQuat.setFromEuler(this._tmpEuler);
      head.quaternion.multiply(this._tmpQuat);
    }

    // Idle arm micro-sway (skip while a gesture owns the arms).
    if (!this._gesture) {
      for (const side of ['leftArm', 'rightArm']) {
        const arm = c.bones[side];
        if (!arm) continue;
        const sign = side === 'leftArm' ? 1 : -1;
        c.poseBoneCharacterFrame(
          arm,
          Math.sin(time * 0.8 + sign) * 0.03,
          0,
          sign * Math.sin(time * 0.6) * 0.02,
        );
      }
    }
  }

  _updateGesture(dt, time) {
    if (!this._gesture) {
      if (this._gestureQueue.length) this._gesture = { ...this._gestureQueue.shift(), t: 0 };
      else return;
    }

    const g = this._gesture;
    g.t += dt / g.duration;
    if (g.t >= 1) {
      this._restoreGestureBones();
      this._gesture = null;
      return;
    }

    // Smooth attack/release envelope over the whole gesture.
    const env = Math.sin(Math.PI * Math.min(g.t, 1));
    const c = this.character;
    // Rotations are expressed in the character's frame (glTF forward = +Z,
    // up = +Y, so the right arm hangs along +X and the left along -X) and
    // conjugated into each bone's parent space — the same numbers work on
    // humanoid skeletons and rigid robot nodes. Rotating about +Z lifts the
    // right arm outward; -Z lifts the left. +X pitches the head down.
    const apply = (node, ex, ey, ez) => c.poseBoneCharacterFrame(node, ex, ey, ez);

    switch (g.name) {
      case 'wave': {
        const osc = Math.sin(g.t * Math.PI * 6) * 0.35;
        apply(c.bones.rightArm, 0, 0, (2.0 + osc * 0.4) * env);
        apply(c.bones.rightForeArm, 0, osc * env, 0.4 * env);
        break;
      }
      case 'nod':
        apply(c.bones.head, Math.abs(Math.sin(g.t * Math.PI * 4)) * 0.3 * env, 0, 0);
        break;
      case 'shake':
        apply(c.bones.head, 0, Math.sin(g.t * Math.PI * 5) * 0.4 * env, 0);
        break;
      case 'point':
        // Swing the right arm forward (+Z) and lift it a little.
        apply(c.bones.rightArm, 0, -1.0 * env, 0.35 * env);
        break;
      case 'celebrate': {
        const bounce = Math.abs(Math.sin(g.t * Math.PI * 4));
        apply(c.bones.leftArm, 0, 0, -(2.4 + bounce * 0.2) * env);
        apply(c.bones.rightArm, 0, 0, (2.4 + bounce * 0.2) * env);
        break;
      }
      case 'think':
        apply(c.bones.head, -0.12 * env, 0, 0.2 * env);
        apply(c.bones.rightArm, 0, -0.6 * env, 0.9 * env);
        break;
    }
  }

  _restoreGestureBones() {
    const c = this.character;
    for (const slot of ['leftArm', 'rightArm', 'leftForeArm', 'rightForeArm']) {
      const node = c.bones[slot];
      const rest = c.restPose.get(node);
      if (node && rest) node.quaternion.copy(rest);
    }
  }

  _updateBlink(dt) {
    if (!this.character.blinkTargets.length) return;
    if (this._blinkPhase >= 0) {
      this._blinkPhase += dt;
      const t = this._blinkPhase / 0.15;
      this.character.setBlink(t < 1 ? Math.sin(Math.PI * Math.min(t, 1)) : 0);
      if (t >= 1) {
        this._blinkPhase = -1;
        this._blinkTimer = 1.5 + Math.random() * 4;
      }
    } else {
      this._blinkTimer -= dt;
      if (this._blinkTimer <= 0) this._blinkPhase = 0;
    }
  }
}
