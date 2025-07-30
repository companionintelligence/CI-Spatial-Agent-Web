# CI-XR-Web Implementation Plan

`/archive` contains the old plain javascript implementation. Our goal with the new project structure is to modernise and rebuild this using react, typescript and react-three-fiber.

## Project Structure

### Directory Organization
```
src/
├── app/           # Main application structure and orchestration
│   └── App.tsx    # Main app component that combines services and components
├── components/    # Reusable UI components (pure, declarative)
│   ├── Header.tsx
│   ├── ChatHistory.tsx
│   ├── AvatarViewport.tsx
│   ├── ChatInput.tsx
│   ├── ControlButton.tsx
│   └── index.ts
├── services/      # State management and API integrations
│   ├── types.ts
│   ├── chatService.ts
│   ├── layoutService.ts
│   └── index.ts
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

---

## Implementation Status Summary

### ✅ Completed Phases

#### Phase 1: Core UI & Data Structure
Complete React-based chat interface with TypeScript, responsive design, and service layer architecture.

#### Phase 2: 3D Avatar System  
Full Three.js integration with React Three Fiber, GLB model loading, lighting, and camera controls.

#### Phase 3: Audio Input/Output
Complete audio pipeline with VAD, STT (Web Speech API), TTS, and audio queue management with echo cancellation.

#### Phase 4: LLM Integration
**Recently Completed** - Comprehensive LLM system with:

**Core Components:**
- `src/services/llmTypes.ts` - Type definitions and interfaces
- `src/services/llmService.ts` - Main service with local/remote support  
- `public/sw.js` - WebLLM service worker for local models
- `.env.example` - Environment configuration template

**Features Implemented:**
- ✅ **Local LLM Support**: WebLLM integration with Llama-3.1-8B-Instruct-q4f32_1-MLC
- ✅ **Remote API Integration**: OpenAI, Anthropic, Ollama support with environment config
- ✅ **Streaming Responses**: "Breath" chunking pattern for natural TTS integration
- ✅ **System Prompt Management**: Avatar-aware conversational prompts
- ✅ **Conversation Context**: Full message history with role-based structure
- ✅ **Barge-in Interruption**: Real-time interruption with "stop" command support

**Technical Achievements:**
- Direct port from `archive/chat/llm.js` with modern React/TypeScript patterns
- Web worker implementation for local model performance
- Recursive useEffect bug fixes for stable callback management
- Real-time streaming to TTS with natural sentence breaks
- Environment variable configuration for API keys and endpoints
- Comprehensive error handling and status reporting
- Debug panel integration showing LLM status and thinking state

**Archive Functionality Preserved:**
- Message flow: `{human:{text:"..."}} → {llm:{breath:"...",final:true|false}}`
- MIN_BREATH_LENGTH=20 threshold for TTS chunking
- `<think>...</think>` block processing for models like DeepSeek
- Interrupt timestamp handling for preventing stale responses
- Worker pattern for optimal local model performance

The LLM integration is now fully functional and ready for avatar animation integration in Phase 5.

### 🚧 Next Priority: Phase 5 - Avatar Animation
Ready to implement viseme-based lip sync, facial expressions, and gesture animations.
