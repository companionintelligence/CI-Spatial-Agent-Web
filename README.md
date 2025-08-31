# CI-XR-Web Services Library

## COPYRIGHT COMPANION INTELLIGENCE - LIFESCOPE INC
## DO NOT DISTRIBUTE
## PRIVATE AND CONFIDENTIAL

A library of AI-powered conversational agent services for XR/VR applications, designed to work with webspatial and Vision OS apps.

# Technologies used

- Vite
- Typescript  
- React
- threejs
- WebXR

## Features

- **3D Avatar System**: Interactive avatars with emotion and speech animation
- **Emote Service**: Automatic facial expressions based on conversation sentiment  
- **Voice Integration**: STT, TTS, and viseme-based lip sync
- **XR Support**: WebXR-compatible for AR/VR experiences
- **Directed Mode**: Pre-configured responses from JSON file for controlled interactions
- **NPM Library**: Exportable services for use in other applications

## Library Usage

### Installation

```bash
npm install ci-xr-web
```

### Peer Dependencies

```bash
npm install react react-dom three @pixiv/three-vrm @pixiv/three-vrm-animation
npm install @react-three/fiber @react-three/drei @react-three/xr  
npm install @huggingface/transformers @mlc-ai/web-llm @ricky0123/vad-web ollama
```

### Quick Start

```typescript
import { useAgent } from 'ci-xr-web'
import type { AgentConfig, AgentCallbacks } from 'ci-xr-web'

const config: AgentConfig = {
  vad: { vadThreshold: 0.6 },
  llm: { provider: 'mlc' },
  tts: { enabled: true },
  autoSubmitEnabled: true,
  bargeInEnabled: true
}

function MyComponent() {
  const agent = useAgent(config)
  
  useEffect(() => {
    agent.actions.loadLLM()
    agent.actions.initializeVAD()
  }, [])
  
  return (
    <button onClick={() => agent.actions.startVADListening()}>
      Start Listening
    </button>
  )
}
```

### Available Services

- **useAgent**: Complete unified agent service
- **useConversationService**: Message history management
- **useLLMService**: Language model integration
- **useSTTService**: Speech-to-text processing
- **useTTSService**: Text-to-speech with lip sync
- **useVADService**: Voice activity detection
- **useVisemeService**: Lip sync animation
- **useEmoteService**: Facial expressions
- **useAnimationService**: Character animations

## Development Configuration

### Directed Mode

The app includes a directed mode that reads responses from a JSON file instead of using the LLM. To enable:

1. Set `directedMode: true` in the app configuration
2. Edit `src/assets/directed-responses.json` to define your responses

The JSON structure supports:
- **trigger**: Text to match in user input (exact or partial)
- **response**: The response text to return
- **emotion**: Optional emotion for the avatar

Example:
```json
{
  "responses": [
    {
      "id": "welcome",
      "trigger": "hello", 
      "response": "Hello! I'm here to help you.",
      "emotion": "friendly"
    }
  ]
}
```

## Install & Run

```bash
ollama run llama3.2

cp .env.local.default .env.local

npm i
npm run dev
```

## Build Library

```bash
npm run build:lib
```