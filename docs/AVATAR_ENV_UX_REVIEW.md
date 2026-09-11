# Companion Intelligence — Avatars, Environments & UX Review

> **Confidential — Companion Intelligence Spatial Ecosystem**

This document delivers a comprehensive technical and aesthetic review of the 3D avatar systems, environments, and UX across [`CI-Spatial-Agent-Web`](file:///Users/liam/devel/ci/CI-Spatial-Agent-Web) and [`CI-Spatial-Agent-Web-2`](file:///Users/liam/devel/ci/CI-Spatial-Agent-Web-2).

---

## 1. 3D Avatars Review

### 1.1 Model Taxonomy & Skeletons
The avatar catalog currently contains **24+ character rigs** across two core formats:
1. **ReadyPlayerMe GLB (RPM 2.0)**: Standardized humanoid topology rigged with Mixamo mocap bone naming and exported with Oculus visemes + ARKit 52 facial blendshapes.
2. **VRM Humanoids (VRM 0.0 & 1.0)**: Standardized humanoid skeletons with UniVRM secondary spring bones (hair, accessories, cloth) and expression blendshape groups (`aa`, `ee`, `ih`, `oh`, `ou`, `blink`, `happy`, `angry`, `sad`, `surprised`, `relaxed`).

| Dimension | GLB (RPM / Custom) | VRM Humanoid | Evaluation |
|---|---|---|---|
| **Bone Hierarchy** | `Hips` → `Spine` → `Spine2` → `Neck` → `Head` | `humanBones` normalized schema | Both skeletons now correctly resolve head/neck/eye bones via canonical aliases. |
| **Gaze Tracking** | Direct bone Euler damping | `VRMHumanoid.lookAt` or bone control | Head & neck pitch/yaw smoothly tracks the user cursor / XR gaze. |
| **Secondary Physics** | None (rigid mesh/skin) | SpringBoneManager (active at 60 FPS) | VRM models have a noticeable advantage in perceived liveliness due to dynamic hair/cloth sway. |
| **Facial Rigging** | 52 ARKit + 15 Oculus morphs | 10 Expression presets | ARKit morphs provide substantially higher speech precision and subtle micro-expression fidelity. |

### 1.2 Facial Vitality & Autonomous Dynamics
Previous avatar implementations suffered from the "dead mannequin" effect when idle (static gaze, unmoving face, frozen eyelids). The newly integrated `AvatarDynamicsEngine` resolves this via:
- **Poisson-Interval Blinking**: Naturally distributed blinks (2.5s–6.0s intervals, 160ms closure) prevent rhythmic robotic blinking.
- **Saccadic Eye-Darts**: Subtle micro-saccades (1.5°–3.0° shifts every 1.2s–3.5s) emulate biological eye fixation.
- **Respiratory Sway**: Gentle harmonic chest expansion and head pitch (0.2 Hz).
- **Acoustic Eyebrow Accents**: Dynamic brow inner raising keyed to TTS audio emphasis.

### 1.3 Multi-Band FFT Audio Lip-Sync
- Traditional single-envelope volume tracking often results in unnatural "jaw flapping".
- The updated 3-band FFT analyzer isolates:
  - **Low Band (80–350 Hz)**: Drives `jawOpen` and mouth depth.
  - **Mid Band (350–2000 Hz)**: Drives formant shapes (`mouthFunnel`, `mouthPucker`, `mouthRollLower`).
  - **High Band (2000–5000 Hz)**: Drives fricatives and sibilants (`mouthStretchLeft/Right`, `mouthSmile`, `viseme_SS`).
- In addition, phonetic schedules from `PhonemeTimingEngine` provide zero-latency lookahead articulation when text is available.

---

## 2. Environments & Lighting Review

### 2.1 The 1970s Datacenter Diorama
The flagship environment features 11 meticulously modelled vintage mainframe props:
- Mainframe & Storage: IBM 1401 CPU, IBM 1401 Mainframe, IBM 2401 Tape Drive, IBM 3350 Disk Storage, RAMAC 305.
- Terminals & Microcomputers: IBM 3178 Terminal, Kenbak-1, Commodore PET, Xerox Alto, Prologica CP500, Engelbart Mouse.

#### Lighting & Ambiance Assessment
- **IBL Calibration**: Scene `environmentIntensity` is tuned to **0.14** (down from 1.0), preventing washed-out walls and allowing the diorama’s point lights and screen terminals to illuminate the space authentically.
- **Key & Rim Directionals**: 4-point directional light rig (`rigScale: 0.42`) provides subtle fill and rim accents without overpowering the scene's retro aesthetic.
- **Shadow Mapping**: 2048px on high quality, 1024px on medium, disabled on software renderers (SwiftShader).

### 2.2 Camera Staging & Framing
- **16:9 Landscape (Desktop / VR)**:
  - Camera distance: **2.4m** from head bone.
  - Target drop: **-0.28m** (pitches camera slightly downward, bringing the back wall of machines into shot while keeping the avatar in a classic mid-shot).
- **9:16 Portrait (Mobile / Touch)**:
  - Camera distance: **3.6m** from head bone.
  - Target drop: **-0.10m** (widens horizontal frustum to prevent the room from being cropped out).

---

## 3. User Experience (UX) & Interaction Review

### 3.1 HUD & Overlay Hierarchy
1. **Glassmorphic Aesthetic**:
   - Translucent frosted containers (`backdrop-filter: blur(16px)`, `border: 1px solid rgba(255,255,255,0.10)`).
   - High contrast dark-mode color scheme ensures full legibility across varying 3D camera angles.
2. **Floating Chat Overlay**:
   - Live speech bubbles render character-by-character streaming tokens from the LLM.
   - Interactive chat history panel collapses cleanly to maximize 3D viewport immersion.
3. **Control Dock**:
   - Quick access to microphone toggle, sound volume, camera recentering, environment selector, and avatar customizer.
   - Floating action buttons with accessible tooltips and clear active states.

### 3.2 Conversational Flow & Voice UX
- **Zero-Latency Voice Barge-In**: When the user speaks while the avatar is talking, VAD immediately interrupts TTS playback and resets the animation mixer to an active listening stance.
- **Multi-Modal Input**: Seamless switching between typed text and voice speech.
- **Interactive Avatar Click Reactions**: Clicking or tapping the avatar triggers a spontaneous positive greeting and happy emotion.

### 3.3 Multi-Platform & XR Experience
- **Desktop & Mobile Web**: Fluid responsive layout with auto-adapting camera distance.
- **Meta Quest 3 (WebXR)**: Full immersive 6DOF spatial room scale with raycast controller and hand tracking support.
- **Apple Vision Pro (WebSpatial)**: Spatial windowing with eye/pinch interaction support.

---

## 4. Codebase Consolidation Blueprint

### 4.1 Identified Code Overlap
The canonical `CI-Spatial-Agent-Web` monorepo and the standalone
`CI-Spatial-Agent-Web-2` (Vanilla Three.js/WebGPU) repo overlap in:
1. GLTF/VRM loader routines & bone alias discovery.
2. Audio FFT analysis & viseme mapping algorithms.
3. Gaze tracking & saccade calculation.
4. LLM/STT/TTS service integration.

### 4.2 Staged Monorepo Architecture
The first consolidation boundary is now in place: the vanilla client is staged at
`apps/vanilla-client/` in `CI-Spatial-Agent-Web`, while `CI-Spatial-Agent-Web-2`
remains standalone until the migration is reviewed and the duplicate repo can be
retired safely.

```
CI-Spatial-Agent-Web/
├── packages/
│   ├── core/                  # Universal Avatar Engine (pure TS, framework-agnostic)
│   │   ├── services/          # LLM, TTS, STT, VAD, Visemes, Emotes, Dynamics
│   │   ├── rendering/         # RendererConfig, PostProcessing, Shaders
│   │   ├── animation/         # Clip catalogs, transition blending, locomotion
│   │   └── math/              # Bone orientation, quaternions, gaze projection
│   └── ui/                    # Shared glassmorphic UI components (HUD, dock, chat)
├── apps/
│   ├── web/                   # Primary React + Three.js / R3F Web client
│   ├── vision-pro/            # Apple Vision Pro WebSpatial client
│   ├── vanilla-client/        # Lightweight Vanilla Three.js / WebGPU client (from Web-2)
│   └── proxy/                 # Streaming backend proxy for Ollama / CosyVoice / OpenAI
└── docs/
    └── visual-tests/          # Automated visual regression & animation media gallery
```
