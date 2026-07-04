# Spatial Companion

An immersive **WebXR** companion: a lip-synced 3D avatar you talk to by voice, in
AR/VR on Meta Quest and Apple Vision Pro — or in any WebGPU/WebGL browser and iPad.

It runs against models on **your** device. A built-in backend proxy brokers chat to
your host's **Ollama** (or any OpenAI-compatible endpoint), so the browser never needs
CORS exceptions or a public tunnel, and no conversation leaves your network.

## Getting started

1. Install [Ollama](https://ollama.com) on your host and pull a small model:
   ```bash
   ollama pull gemma3:1b
   ```
2. Install this app. It auto-detects host Ollama at `http://host.docker.internal:11434`.
3. Open the app, allow the microphone, and start talking. Change the model or point at a
   different Ollama/proxy URL any time from the in-app **Settings (⚙️)** panel — no rebuild.

## Features

- Voice conversation: real-time STT, TTS, and viseme lip-sync
- Expressive VRM avatar with native gesture/idle animation blending
- WebXR AR + VR sessions (Quest 3, Vision Pro, XREAL) with a browser/iPad fallback
- Runtime-configurable LLM connection (Ollama URL + model) at install time or in-app

## Notes

- Ensure the device has enough free RAM for the chosen model before running it.
- Source: <https://github.com/companionintelligence/CI-Spatial-Companion-WebXR>
