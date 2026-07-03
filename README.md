# CI Spatial Companion

WebXR and WebSpatial

Embodied AI Avatar framework with WebXR and Vision Pro support.

## Interface

The 3D avatar viewport with the 2D control dock, logo, and chat-log chrome overlaid on top.

![Avatar Companion — dark](docs/ui/webxr-dark.png)

The shell is intentionally **dark-only**: it is an XR HUD, not a light-themable document surface, so the canon dark background (`#041620`) is kept even under a light OS preference. On the [Companion Intelligence design system](https://github.com/companionintelligence/CI-Common/tree/main/style) — teal primary, Montserrat, light + dark.

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

## Docker / CI Hub

A public multi-arch (amd64 + arm64) image is published to GHCR and used by the CI Hub
app store as **Avatar Companion**. nginx serves the built web app on internal port **5173**.

```bash
docker run -d -p 8080:5173 ghcr.io/companionintelligence/ci-spatial-companion-webxr:latest
# open http://localhost:8080
```

The published image is fully self-contained: with no LLM/TTS backend configured it
falls back to offline scripted responses (`script` provider), so the avatar, chat,
and animations work out of the box. Speech audio is disabled unless a TTS backend
is reachable.

### Connecting an LLM/TTS backend

Vite environment variables are **baked in at build time** — setting them on
`docker run` has no effect. To produce an image wired to a backend, pass build args:

```bash
docker build \
  --build-arg VITE_LLM_PROVIDER=ollama \
  --build-arg VITE_LLM_OLLAMA_API_URL=https://ollama.example.com \
  --build-arg VITE_LLM_OLLAMA_MODEL=gemma3:1b \
  -t avatar-companion .
```

| Build arg / env | Default | Purpose |
|---|---|---|
| `VITE_LLM_PROVIDER` | `script` | `script`, `ollama`, `mlc` (in-browser WebLLM), or `openai` |
| `VITE_LLM_OLLAMA_API_URL` | — | Ollama server URL (required for `ollama`) |
| `VITE_LLM_OLLAMA_MODEL` | `gemma3:1b` | Ollama model name |
| `VITE_TTS_MODE` | `pocket` | `pocket`, `browser` (speechSynthesis), `local`, or `remote` |
| `VITE_POCKET_TTS_URL` | `http://localhost:8000` | Pocket TTS server URL |

Note: the LLM/TTS requests are made from the **browser**, not the container, so the
backend URL must be reachable from the user's machine and must allow the app's
origin via CORS (for Ollama set `OLLAMA_ORIGINS`, see `pnpm ollama:serve`).

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
