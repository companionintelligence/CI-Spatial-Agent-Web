# CI-XR-Web

## COPYRIGHT COMPANION INTELLIGENCE - LIFESCOPE INC

## DO NOT DISTRIBUTE

## PRIVATE AND CONFIDENTIAL

# Technologies used

- Vite
- Typescript
- React
- threejs

## Features

- **3D Avatar System**: Interactive avatars with emotion and speech animation
- **Emote Service**: Automatic facial expressions based on conversation sentiment
- **Voice Integration**: STT, TTS, and viseme-based lip sync
- **XR Support**: WebXR-compatible for AR/VR experiences
- **Directed Mode**: Pre-configured responses from JSON file for controlled interactions

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

```
ollama run llama3.2

cp .env.local.default .env.local

npm i
npm run dev
```