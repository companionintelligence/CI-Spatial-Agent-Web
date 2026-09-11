import * as THREE from 'three/webgpu';
import { loadConfig } from './config.js';
import { Engine } from './core/Engine.js';
import { XRSessionManager } from './xr/XRSession.js';
import { HitTestManager } from './xr/HitTest.js';
import { Character } from './character/Character.js';
import { AnimationController } from './character/AnimationController.js';
import { GazeController } from './character/GazeController.js';
import { Locomotion } from './character/Locomotion.js';
import { LipSync } from './character/LipSync.js';
import { SpeechOutput } from './speech/SpeechOutput.js';
import { SpeechInput } from './speech/SpeechInput.js';
import { Perception } from './perception/Perception.js';
import { Agent } from './agent/Agent.js';
import { Memory } from './agent/Memory.js';
import { HUD } from './ui/HUD.js';
import { XRPanel } from './ui/XRPanel.js';

export async function boot() {
  const config = loadConfig();
  const container = document.getElementById('scene-container');

  // --- engine + UI shell ---
  const engine = new Engine(config);
  const hud = new HUD(config, engine.events);
  const events = engine.events;

  hud.setSplash('initializing renderer…');
  await engine.init(container);
  hud.setBackendLabel(`${engine.backendLabel}${engine.caps.xr ? ' · WebXR' : ''}`);

  // --- XR plumbing ---
  const xr = new XRSessionManager(engine, { domOverlayRoot: hud.root });
  const hitTest = new HitTestManager(engine, xr);

  // --- character ---
  hud.setSplash('loading character…');
  let character;
  try {
    character = await Character.load(config.character.url, {
      targetHeight: config.character.targetHeight,
    });
  } catch (err) {
    console.error('[Boot] avatar failed to load, falling back to robot:', err);
    hud.toast('Avatar failed to load — using default robot');
    character = await Character.load('./gltf/robot/robot.gltf', {
      targetHeight: config.character.targetHeight,
    });
  }
  engine.scene.add(character.root);

  // Soft contact shadow so the character reads as grounded everywhere.
  character.root.add(makeShadowDisc(Math.max(0.35, character.height * 0.32)));

  const animation = new AnimationController(character);
  const gaze = new GazeController(character, engine);
  const locomotion = new Locomotion(character, engine, config.character);
  const lipSync = new LipSync(character);
  locomotion.placeAt(new THREE.Vector3(0, 0, -1.4));

  // --- speech ---
  const speechOut = new SpeechOutput(config, events);
  const speechIn = new SpeechInput(config, events);
  speechOut.onWordBoundary = () => lipSync.pulse();
  events.on('speech-start', () => lipSync.pulse(150, 0.4));

  // Create/resume the audio context on the first interaction and hook the
  // analyser into lip sync (autoplay policy requires a user gesture).
  const unlockAudio = () => {
    speechOut.ensureContext();
    lipSync.setAnalyser(speechOut.analyser);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // --- memory, perception, agent ---
  const memory = new Memory(config);
  const perception = new Perception(engine, xr, hitTest, memory, config, events);
  const agent = new Agent({
    config, events, engine, character, locomotion, gaze, animation,
    speechOut, perception, memory,
  });

  // --- input wiring ---
  events.on('user-text', (text) => agent.handleUtterance(text));
  const pttStart = () => {
    speechOut.stop();          // barge-in
    unlockAudio();
    speechIn.start();
  };
  const pttEnd = () => speechIn.stop();
  events.on('ptt-start', pttStart);
  events.on('ptt-end', pttEnd);
  events.on('xr-ptt-start', pttStart);
  events.on('xr-ptt-end', pttEnd);

  hud.onComeHere(() => {
    const spot = locomotion.frontOfUser(1.2);
    locomotion.walkTo(spot);
    events.emit('chat', { role: 'action', text: '⚡ coming over' });
  });

  hud.onCameraToggle(async () => {
    if (engine.presenting) {
      perception.toggleViewfinder();
      return;
    }
    if (hud.pipVisible) {
      hud.hidePip();
    } else {
      await perception.startCamera();
      if (perception.camera.video) hud.showPip(perception.camera.video);
    }
  });

  // --- XR session buttons + placement ---
  hud.enableXRButtons(
    engine.caps,
    () => xr.enter('immersive-ar').catch((e) => hud.toast(`AR failed: ${e.message}`)),
    () => xr.enter('immersive-vr').catch((e) => hud.toast(`VR failed: ${e.message}`)),
  );

  events.on('xr-start', async ({ mode }) => {
    speechOut.ensureContext();
    lipSync.setAnalyser(speechOut.analyser);
    if (mode === 'immersive-ar') {
      await perception.startCamera();   // passthrough camera for vision
      hud.hidePip();
    }
    // Place the companion on the floor in front of the user and greet.
    setTimeout(() => {
      locomotion.floorY = 0;            // local-floor: y=0 is the real floor
      locomotion.placeAt(locomotion.frontOfUser(1.4));
      animation.playGesture('wave');
    }, 600);
  });

  const xrPanel = new XRPanel(engine, character, events);

  // --- per-frame system order ---
  const camForward = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  const voicePos = new THREE.Vector3();

  engine.addSystem(hitTest);
  engine.addSystem(perception);
  engine.addSystem({
    update({ dt, time }) {
      gaze.update(dt);
      const moveState = locomotion.update(dt, gaze.bodyTurnDemand);
      animation.setState(locomotion.isMoving && moveState === 'walk' ? 'walk' : 'idle');
      lipSync.update(dt);
      animation.speakingEnergy = lipSync.energy;
      animation.update(dt, time);

      // Spatialized voice: panner at the character's mouth, listener at the camera.
      character.getHeadWorldPosition(voicePos);
      speechOut.setSourcePosition(voicePos);
      engine.getHeadPose(camPos, camQuat);
      camForward.set(0, 0, -1).applyQuaternion(camQuat);
      camUp.set(0, 1, 0).applyQuaternion(camQuat);
      speechOut.setListenerPose(camPos, camForward, camUp);
    },
  });
  engine.addSystem(xrPanel);

  // --- done ---
  hud.hideSplash();
  events.emit('chat', {
    role: 'assistant',
    text: `Hi! I'm ${config.agent.name}. Hold the mic (or Space) to talk, or type below. ` +
      `${engine.caps.immersiveAR ? 'Enter AR to bring me into your room. ' : ''}` +
      'I can look around, walk, gesture, and tell you what I see.',
  });
  animation.playGesture('wave');

  console.log('[Boot] CI Spatial Companion ready', {
    backend: engine.backendLabel,
    caps: engine.caps,
    character: config.character.url,
  });
}

function makeShadowDisc(radius) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.renderOrder = 1;
  return mesh;
}
