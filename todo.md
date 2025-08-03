# CI-XR-Web Implementation Plan

`/archive` contains the old plain javascript implementation. Our goal with the new project structure is to modernise and rebuild this using react and typescript.

DO NOT add notes to this file, just check off checkboxes as progress is made.

## Project Structure

### Directory Organization
```
src/
├── app/           # Main application structure and orchestration
├── components/    # Reusable UI components (pure, declarative)
├── services/      # State management and API integrations
└── App.tsx        # Entry point that renders app/App.tsx
```

### Architecture Principles
- **Separation of Concerns**: UI components are pure and declarative
- **Service Layer**: All state management and business logic in services
- **Data-Driven**: Components receive data via props, emit events via callbacks
- **Easy Refactoring**: UI and business logic can be changed independently
- **Type Safety**: Full TypeScript support with interfaces

## Phase 1: Core UI & Data Structure ✅
- [x] Create React data store for chat messages
- [x] Implement message history display with user/agent styling
- [x] Add text input with submit functionality
- [x] Create control button state management
- [x] Add keyboard shortcuts (Enter to submit)
- [x] Implement responsive layout switching
- [x] Split components into reusable modules
- [x] Create service layer for state management
- [x] Setup TypeScript interfaces and types

## Phase 2: 3D Avatar System ✅
- [x] Setup Three.js integration in React
- [x] Create 3D scene with camera controls
- [x] Load GLB avatar models from assets
- [x] Implement basic lighting system
- [x] Add scene background/environment loading
- [x] Create avatar pose management
- [x] Setup React Three Fiber and Drei
- [x] Create reusable Scene3D component
- [x] Implement AvatarModel component with animations
- [x] Add OrbitControls for camera interaction

## Phase 3: Audio Input/Output ✅
- [x] Implement voice activity detection (VAD) using @ricky0123/vad-web
- [x] Add microphone recording functionality with Web API integration
- [x] Create speech-to-text (STT) system using Web Speech API
- [x] Implement text-to-speech (TTS) integration with Web Speech API
- [x] Add audio playback controls and queue management
- [x] Create audio echo cancellation through service isolation
- [x] Integrate VAD, STT, and TTS services into main app
- [x] Add visual feedback for audio states (VAD detection, recording, speaking)
- [x] Connect STT results to chat input with auto-submit option
- [x] Connect TTS to agent responses for voice output

## Phase 4: LLM Integration ✅
- [x] Setup local LLM support (WebLLM)
- [x] Add remote LLM API integration (OpenAI/Ollama)
- [x] Implement streaming responses
- [x] Create system prompt management
- [x] Add conversation context handling
- [x] Implement barge-in interruption

## Phase 5: Avatar Animation
- [ ] Create viseme-based lip sync
- [ ] Implement facial expression system
- [ ] Add idle animation loops
- [ ] Create gesture animation system
- [ ] Implement gaze tracking
- [ ] Add automatic blinking

## Phase 6: Advanced Performance
- [ ] Create emotion-based animations
- [ ] Implement speech diarization
- [ ] Add audio-driven animation timing
- [ ] Create animation queueing system
- [ ] Implement facial micro-expressions
- [ ] Add body language gestures

## Phase 7: Configuration & Controls
- [ ] Create settings panel
- [ ] Implement local/cloud toggle
- [ ] Add auto-submit configuration
- [ ] Create avatar selection system
- [ ] Implement voice selection
- [ ] Add performance tuning controls

## Phase 8: Advanced Features
- [ ] Create multi-avatar support
- [ ] Implement scene environment switching
- [ ] Add custom animation loading
- [ ] Create conversation export/import
- [ ] Implement usage analytics
- [ ] Add accessibility features
