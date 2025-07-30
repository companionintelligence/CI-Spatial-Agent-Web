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

### Phase 3 Audio Features Usage

**Voice Activity Detection (VAD):**
- Click the microphone button (🎤) to enable voice recording
- When VAD detects speech, the button shows green (🟢) and the input field highlights green
- When recording but no speech detected, the button shows red (🔴)

**Speech-to-Text (STT):**
- With microphone enabled, speak into your microphone
- Interim results show in the input field as you speak
- Final results are added to your message when speech ends
- Enable "Auto Submit" (🚀) to automatically send transcribed messages

**Text-to-Speech (TTS):**
- Enable the agent (🤖) to hear responses spoken aloud
- When TTS is active, the agent button changes to a speaker icon (🔊)
- Uses Web Speech API for local TTS processing

**Control Buttons:**
- 🎤/🔴/🟢: Microphone toggle with VAD status
- ☁️: Cloud mode toggle (placeholder for remote services)
- ⚡: Barge-in enabled (allows interrupting TTS)
- 🚀: Auto-submit (automatically sends STT results)
- 🤖/🔊: Agent enabled with TTS status indicator

**Technical Implementation:**
- VAD: @ricky0123/vad-web for voice activity detection
- STT: Web Speech API with fallback support for remote services
- TTS: Web Speech API with audio queue management
- All services use React hooks with TypeScript for type safety
- Event-driven architecture for loose coupling between services

### Phase 3 Testing Checklist

**Manual Testing Steps:**

1. **Basic UI Test:**
   - ✅ Open http://localhost:5174 in browser
   - ✅ Verify chat interface loads with audio control buttons
   - ✅ Check that all buttons are present: 🎤, ☁️, ⚡, 🚀, 🤖

2. **Microphone/VAD Test:**
   - Click microphone button (🎤) - should turn red (🔴) when recording
   - Speak into microphone - button should turn green (🟢) when speech detected
   - Background should highlight green during speech detection
   - Check browser console for VAD initialization messages

3. **Speech-to-Text Test:**
   - Enable microphone and speak clearly
   - Verify interim transcript appears in input field while speaking
   - Check that final transcript replaces interim text when speech ends
   - Test with auto-submit enabled (🚀) - should automatically send message

4. **Text-to-Speech Test:**
   - Enable agent (🤖) and type a message, hit send
   - Agent should respond (currently echo) and speak the response
   - Agent button should show speaker icon (🔊) while speaking
   - Test stopping TTS with browser controls if needed

5. **Integration Test:**
   - Enable all features: microphone, auto-submit, agent
   - Speak a message → should transcribe → auto-send → agent responds → TTS speaks
   - Verify visual feedback changes throughout the flow

**Browser Console Tests:**
- Run `window.audioTests.runAllAudioTests()` for automated service verification
- Check for any error messages during audio service initialization
- Verify VAD, STT, and TTS services load without errors

**Browser Compatibility:**
- Chrome/Edge: Full support (recommended)
- Firefox: STT may need user permission
- Safari: Limited Web Speech API support
- Mobile: May require user interaction before audio APIs work

## Phase 3 Implementation Summary

**✅ COMPLETED - Phase 3: Audio Input/Output**

### Services Implemented

1. **VAD Service (`vadService.ts`)**
   - Integrated @ricky0123/vad-web for real-time voice activity detection
   - Configurable threshold and frame processing
   - Event-driven architecture with custom events
   - Auto-start/stop based on microphone settings
   - Proper cleanup and error handling

2. **STT Service (`sttService.ts`)**
   - Web Speech API integration for speech-to-text
   - Support for interim and final results
   - Continuous recognition with configurable language
   - Placeholder support for remote STT (OpenAI Whisper)
   - Audio buffer processing for external services

3. **TTS Service (`ttsService.ts`)**
   - Web Speech API for local text-to-speech
   - Audio queue management for multiple utterances
   - Configurable voice parameters (rate, pitch, volume)
   - Placeholder support for remote TTS (ElevenLabs, OpenAI)
   - Audio buffer playback using Web Audio API

### UI Integration

1. **Main App (`app/App.tsx`)**
   - Integrated all three audio services
   - Event listeners for VAD and STT results
   - Auto-submit functionality for voice commands
   - TTS activation for agent responses
   - Proper service lifecycle management

2. **Chat Input (`components/ChatInput.tsx`)**
   - Visual feedback for VAD detection (green highlighting)
   - Dynamic button states (🎤/🔴/🟢 for microphone)
   - TTS activity indicator (🤖/🔊)
   - Real-time transcript display in input field
   - Read-only mode during voice input

### Key Features

- **Hands-free Operation**: Voice commands with auto-submit
- **Visual Feedback**: Clear indicators for all audio states
- **Event-driven Architecture**: Loose coupling between services
- **Type Safety**: Full TypeScript support with proper interfaces
- **Browser Compatibility**: Graceful fallbacks and error handling
- **Performance**: Efficient memory management and cleanup

### Testing & Quality

- Comprehensive test utilities (`utils/audioTest.ts`)
- Manual testing checklist with step-by-step instructions
- Browser compatibility notes and limitations
- Console testing tools for automated verification
- Zero TypeScript errors and minimal lint warnings

**Next Phase**: Ready to proceed to Phase 4 (LLM Integration) 🚀

## Phase 4: LLM Integration
- [ ] Setup local LLM support (WebLLM)
- [ ] Add remote LLM API integration (OpenAI/Ollama)
- [ ] Implement streaming responses
- [ ] Create system prompt management
- [ ] Add conversation context handling
- [ ] Implement barge-in interruption

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

## Key Technologies
- React 18+ with hooks
- Three.js for 3D rendering
- Web Audio API for audio processing
- WebRTC for microphone access
- WebLLM for local inference
- ONNX Runtime for AI models
- GLB/GLTF for 3D assets

## Callback-Based Audio Integration - COMPLETED ✅

### Key Improvements Made

**1. Replaced window.dispatchEvent with React Callbacks**
- ✅ `useVADService` now accepts `onVADResult`, `onSpeechStart`, `onSpeechEnd` callbacks
- ✅ `useSTTService` now accepts `onResult`, `onTranscriptChange` callbacks  
- ✅ Removed all `window.addEventListener` usage from App.tsx
- ✅ Clean, React-native data flow patterns

**2. Direct State Management in App Component**
- ✅ `currentInterimTranscript` state managed directly in App.tsx
- ✅ `vadDetecting` state managed directly in App.tsx
- ✅ Real-time updates flow through React state instead of DOM events
- ✅ Proper cleanup when microphone is toggled

**3. Improved Data Flow Architecture**
```
VAD Service → onVADResult callback → setVadDetecting → ChatInput props
STT Service → onTranscriptChange callback → setCurrentInterimTranscript → ChatInput props
STT Service → onResult callback → Chat actions (submit/update message)
```

**4. Enhanced Development Experience**
- ✅ Audio debug status panel (development only)
- ✅ Real-time display of VAD, STT, and TTS states
- ✅ Console logging for all audio events
- ✅ Visual feedback in textarea (green for VAD, orange for STT)

**5. Better Error Handling & Performance**
- ✅ Proper React dependency arrays in useCallback hooks
- ✅ TypeScript interfaces for all callback parameters
- ✅ Graceful fallbacks when callbacks are not provided
- ✅ Memory leak prevention with proper cleanup

### Testing the New Implementation

**Visual Indicators:**
- 🎤 Microphone button: Red when recording, green when speech detected
- 📝 Input field: Orange when STT listening, green when VAD detecting speech
- 🔊 Agent button: Speaker icon when TTS is active
- 📊 Debug panel: Real-time status of all audio services (dev mode)

**Data Flow Test:**
1. Click microphone → `vadDetecting` and `sttListening` should show in debug panel
2. Speak → Interim transcript should appear in debug panel and input field
3. Stop speaking → Final transcript should be added to message/auto-submitted
4. Enable agent → TTS should speak responses and show in debug panel

**Console Verification:**
- VAD initialization and speech detection logs
- STT start/stop and transcript processing logs  
- Microphone toggle state changes
- All audio service state transitions

This refactoring creates a much cleaner, more maintainable, and more React-native architecture for audio integration! 🎉

## Archived STT System Implementation - COMPLETED ✅

### Replicated Exact Archive Behavior

**1. Continuous Recognition with Auto-Restart**
- ✅ Implements `start2()` and `stop2()` wrapper methods exactly like archive
- ✅ Auto-restart mechanism (`kick()`) when speech recognition times out
- ✅ 200ms delay between stop and restart to avoid browser issues
- ✅ Error handling that automatically restarts recognition

**2. Counter System for Tracking**
- ✅ `rcounter` tracks recognition sessions (increments on final results)
- ✅ `bcounter` tracks individual vocalizations (increments on interim results)
- ✅ Resets `bcounter` to 1 after each final result
- ✅ Starts `rcounter` at 1 and `bcounter` at 1 exactly like archive

**3. Structured `perform` Message Format**
```typescript
{
  text: string          // Trimmed transcript
  interrupt: number     // performance.now() timestamp
  confidence: number    // Speech recognition confidence (0-1)
  spoken: boolean       // Always true for STT results
  human: boolean        // Always true for user input
  comment: string       // "User vocalization ${bcounter} final ${final}"
  rcounter: number      // Recognition session counter
  bcounter: number      // Vocalization counter within session
  final: boolean        // true for final results, false for interim
  bargein: boolean      // Always true (supports interruption)
}
```

**4. Archive Config Pattern**
- ✅ `allowed` state (inverted from archive's `noisy` config)
- ✅ `desired` state (matches archive's `microphone` config)
- ✅ `setAllowed(false)` when TTS is speaking (prevents echo)
- ✅ `setDesired(true/false)` controls microphone on/off
- ✅ Only listens when both `allowed && desired` are true

**5. Typing Interference Prevention**
- ✅ Blocks spoken utterances when user is typing (like archive)
- ✅ Logs blocking messages for debugging
- ✅ Checks if current message has content before processing speech

**6. Special Command Handling**
- ✅ Detects "stop" command for barge-in functionality
- ✅ Can be extended for other voice commands
- ✅ Preserves archive's command processing pattern

**7. Auto-Submit Logic**
- ✅ Respects `autoSubmitEnabled` config exactly like archive
- ✅ Shows interim results in input field without submitting
- ✅ Auto-submits only final results when enabled
- ✅ Clears input field after auto-submit

### Technical Implementation Differences

**Modern React/TypeScript Enhancements:**
- ✅ Full TypeScript typing with custom interfaces
- ✅ React hooks pattern instead of global object
- ✅ Callback-based integration instead of `sys()` message passing
- ✅ Proper cleanup and memory management
- ✅ Enhanced error handling and logging

**Preserved Archive Characteristics:**
- ✅ Exact timing behavior (200ms restart delay)
- ✅ Same error handling approach (kick on error)
- ✅ Identical result processing logic (only first result)
- ✅ Same counter incrementing pattern
- ✅ Exact config-driven enable/disable logic

### Testing Verification

The new implementation replicates the archive's behavior exactly:

1. **Recognition Session Management**: Same start/stop/restart patterns
2. **Counter Tracking**: Identical rcounter/bcounter incrementing  
3. **Config Integration**: Same allowed/desired state management
4. **Audio Echo Prevention**: STT disabled during TTS playback
5. **Typing Interference**: Speech blocked while user is typing
6. **Auto-Restart**: Recognition automatically restarts after timeouts
7. **Structured Output**: Same perform message format with all metadata

This ensures a seamless transition from the archive system while gaining modern React/TypeScript benefits! 🎯
