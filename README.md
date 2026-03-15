# CI Spatial Companion

WebXR and WebSpatial

Embodied AI Avatar framework with WebXR and Vision Pro support.

## Structure

```
├── packages/
│   └── core/           # Shared services, components, and utilities
├── apps/
│   ├── web/            # Standard web application
│   └── vision-pro/     # Apple Vision Pro (WebSpatial) application
```

## Development

```bash
# Install dependencies
pnpm install

# Start web dev server
pnpm dev:web

# Start Vision Pro dev server
pnpm dev:vision
```

## Core Features

- **3D Avatar System**: VRM-based avatars with emotion and speech animation
- **LLM Integration**: Local (WebLLM, Ollama) and cloud backends
- **Voice Pipeline**: STT → LLM → TTS with viseme lip sync
- **WebXR Support**: AR/VR experiences via @react-three/xr
- **WebGPU Rendering**: Optional high-performance rendering

## Architecture

### Services
- `llm/` - Language model integration (WebLLM, Ollama, Cloud APIs)
- `tts/` - Text-to-speech with VITS
- `stt/` - Speech-to-text with Whisper
- `vad/` - Voice activity detection
- `viseme/` - Lip sync viseme generation
- `emote/` - Facial expression system
- `animation/` - Body animation system

### Components
- `scene/` - 3D scene and avatar rendering
- `chat/` - Chat UI components
- `control/` - Settings and control panels

## License

Copyright Companion Intelligence - LifeScope Inc. Private and confidential.
