# Service API Documentation

## Overview

This document provides technical documentation for the main service API hooks in the CI-XR-Web application. Each service is designed as an isolated module with specific configuration options and APIs for different aspects of the conversational AI system.

## useVADService

Voice Activity Detection service that monitors microphone input for speech detection.

### Configuration Options

```typescript
interface AudioConfig {
  microphoneEnabled: boolean    // Enable/disable microphone access
  vadThreshold: number         // Speech detection sensitivity (0.0-1.0)
  volume: number              // Audio volume level
  vadEnabled: boolean         // Enable/disable VAD processing
}
```

### API

```typescript
const vad = useVADService({
  config: vadConfig,
  onVADResult: (result: VADResult) => void,
  onSpeechStart: () => void,
  onSpeechEnd: (audio: ArrayBuffer) => void
})

// State
vad.isListening: boolean     // Currently listening for speech
vad.isDetecting: boolean     // Currently detecting speech

// Actions
vad.actions.startListening()
vad.actions.stopListening()
vad.actions.initializeVAD()
```

### Example

```typescript
const vadService = useVADService({
  config: { vadThreshold: 0.8, microphoneEnabled: true },
  onVADResult: (result) => {
    console.log('Speech detected:', result.isSpeech, 'Confidence:', result.confidence)
  }
})
```

---

## useSTTService

Speech-to-Text service for converting spoken audio to text transcripts.

### Configuration Options

```typescript
interface STTConfig {
  language: string           // Recognition language (e.g., 'en-US')
  continuous: boolean        // Continuous recognition mode
  remote: boolean           // Use remote API vs browser API
  apiKey?: string          // API key for remote services
}
```

### API

```typescript
const stt = useSTTService({
  config: sttConfig,
  onPerform: (result: STTPerformResult) => void,
  onInterimTranscript: (text: string) => void
})

// State  
stt.isListening: boolean
stt.allowed: boolean        // Permission granted
stt.desired: boolean        // User wants to listen

// Actions
stt.actions.startListening()
stt.actions.stopListening()
stt.actions.setDesired(desired: boolean)
```

### Example

```typescript
const sttService = useSTTService({
  config: { language: 'en-US', continuous: true },
  onPerform: (result) => {
    if (result.final) {
      console.log('Final transcript:', result.text)
    }
  }
})
```

---

## useLLMService

Large Language Model service supporting local and remote AI model inference.

### Configuration Options

```typescript
interface LLMConfig {
  llm_provider: 'ollama' | 'mlc' | 'openai' | 'script'
  ollama_url?: string        // Ollama server URL
  ollama_model?: string      // Ollama model name
  mlc_model?: string         // WebLLM model name
  openai_api_key?: string    // OpenAI API key
  openai_api_url?: string    // OpenAI-compatible API URL
  openai_model?: string      // Model name (e.g., 'gpt-4')
}
```

### API

```typescript
const llm = useLLMService({
  config: llmConfig,
  onStatus: (status: LLMStatusUpdate) => void,
  onResponse: (response: LLMResponse) => void
})

// State
llm.state.ready: boolean
llm.state.loading: boolean
llm.state.thinking: boolean
llm.state.messages: Array<{role: string, content: string}>

// Actions
llm.actions.load()
llm.actions.processUserInput(request: LLMPerformRequest)
llm.actions.clearHistory()
```

### Example

```typescript
const llmService = useLLMService({
  config: { llm_provider: 'ollama', ollama_url: 'http://localhost:11434' },
  onResponse: (response) => {
    console.log('AI Response:', response.breath)
  }
})
```

---

## useTTSService

Text-to-Speech service for converting text to spoken audio with timing data.

### Configuration Options

```typescript
interface TTSConfig {
  voice: string              // Voice identifier
  speed: number             // Speech rate (0.1-10.0)
  pitch: number             // Voice pitch (0.0-2.0)
  volume: number            // Audio volume (0.0-1.0)
  remote: boolean           // Use remote TTS API
  apiKey?: string          // API key for remote services
  url?: string             // TTS service URL
  model?: string           // TTS model name
  voiceSettings?: {
    stability?: number      // Voice stability (ElevenLabs)
    similarity_boost?: number // Voice similarity (ElevenLabs)
  }
}
```

### API

```typescript
const tts = useTTSService({
  config: ttsConfig,
  onSpeechStart: (text: string, whisperData: WhisperData) => void,
  onSpeechEnd: () => void
})

// State
tts.isSpeaking: boolean
tts.audioQueue: number      // Number of queued audio items

// Actions
tts.actions.speak(text: string)
tts.actions.stopSpeaking()
tts.actions.addToQueue(audioBuffer: ArrayBuffer)
tts.actions.processQueue()
```

### Example

```typescript
const ttsService = useTTSService({
  config: { speed: 1.2, pitch: 1.0, remote: false },
  onSpeechStart: (text, whisperData) => {
    visemeService.actions.generateSequence(whisperData, Date.now())
  }
})
```

---

## useVisemeService

Viseme service for generating lip-sync animations from speech timing data.

### Configuration Options

No direct configuration - integrates with TTS timing data and avatar systems.

### API

```typescript
const visemes = useVisemeService()

// Actions
visemes.actions.generateSequence(whisperData: WhisperData, startTime: number)
visemes.actions.updateVisemes(currentTime: number)
visemes.actions.applyToRig(currentTime: number, amplify?: number)
visemes.actions.setupForVRM(vrm: VRMObject)
visemes.actions.setupForMorphTargets(morphs: MorphTarget[], dictionary: VisemeDictionary)
visemes.actions.reset()

// Getters
visemes.getters.getCurrentTargets(): VisemeTarget
visemes.getters.getSequence(): VisemeSequenceItem[]
```

### Example

```typescript
const visemeService = useVisemeService()

// Setup for VRM avatar
visemeService.actions.setupForVRM(vrmAvatar)

// Generate sequence from TTS whisper data
const sequence = visemeService.actions.generateSequence(whisperData, startTime)

// Update in animation loop
useAnimationFrame((time) => {
  visemeService.actions.updateVisemes(time)
  visemeService.actions.applyToRig(time, 1.0)
})
```

---

## useEmoteService

Emotional expression service for managing facial expressions, gaze, and performance behaviors.

### Configuration Options

No direct configuration - uses emotion types and performance data structures.

### API

```typescript
const emotes = useEmoteService()

// Core Controls
emotes.setEmotion(emotion: EmotionType)
emotes.performAction(performanceData: PerformanceData)
emotes.triggerGaze(options?: GazeOptions)
emotes.reset()
emotes.onBargeIn()

// Update Loop
emotes.update(currentTime?: number)

// Setup
emotes.setupForVRM(vrm: VRMObject)
emotes.setupForMorphTargets(morphs: MorphTarget[], dictionary: EmoteDictionary)

// Application
emotes.applyToVRM(vrm: VRMObject)
emotes.applyToMorphTargets(morphs: MorphTarget[], dictionary: EmoteDictionary)

// State Access
emotes.getCurrentTargets(): Partial<FacialTarget>
emotes.getCurrentEmotion(): EmotionType
emotes.isPerforming(): boolean
```

### Example

```typescript
const emoteService = useEmoteService()

// Setup for VRM avatar
emoteService.setupForVRM(vrmAvatar)

// Trigger emotion and gaze
emoteService.setEmotion('happy')
emoteService.triggerGaze({ duration: 2000, randomness: 0.7 })

// Update in animation loop
useAnimationFrame((time) => {
  emoteService.update(time)
  emoteService.applyToVRM(vrmAvatar)
})
```

---

## Integration Patterns

### Service Coordination

Services are designed to work together through event callbacks and shared data structures:

1. **VAD → STT**: VAD speech detection triggers STT transcription
2. **STT → LLM**: Final transcripts are sent to LLM for processing
3. **LLM → TTS**: AI responses are converted to speech with timing data
4. **TTS → Visemes**: Speech timing generates lip-sync sequences
5. **LLM → Emotes**: Response analysis triggers emotional expressions

### Avatar Integration

Both viseme and emote services support two avatar types:
- **VRM avatars**: Use `expressionManager.setValue()` interface
- **Morph target avatars**: Direct manipulation of `morphTargetInfluences` arrays

### Performance Considerations

- Services maintain internal state via `useRef` to avoid unnecessary re-renders
- Animation updates should be called in `requestAnimationFrame` loops
- Whisper data generation approximates timing for local TTS
- Emote performances coordinate with viseme sequences for natural behavior
