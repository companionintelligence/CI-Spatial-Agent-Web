# WebXR Scene Understanding

This module implements WebXR Scene Understanding functionality for the CI-XR-Web application, enabling spatial tracking, scene analysis, and integration with AI services for augmented reality experiences.

## Features

- **Bounded Reference Spaces**: Support for room-scale WebXR tracking using bounded-floor reference spaces
- **Spatial Anchors**: Creation and management of persistent spatial anchors in XR space
- **Local Database**: SQLite-based storage using IndexedDB for persistent location data
- **AI Integration**: Integration with Ollama/CI-Server for image analysis using llama4/llava models
- **Scene Analysis**: Automatic detection and analysis of objects and locations in XR scenes
- **API Synchronization**: Bidirectional sync with CI-Server for collaborative experiences

## Architecture

### Core Components

1. **WebXRSceneUnderstanding**: Main service for managing XR session, anchors, and scene analysis
2. **XRLocationDatabase**: IndexedDB-based storage for persistent location data
3. **CIServerIntegration**: HTTP API client for Ollama/CI-Server communication
4. **useWebXRSceneUnderstanding**: React hook that integrates all services

### Data Flow

```
WebXR Session → Scene Understanding → Local Database → CI Server
     ↑                    ↓                ↓              ↓
User Interaction ← Scene Analysis ← Location Storage ← AI Analysis
```

## Usage

### Basic Setup

```tsx
import { useWebXRSceneUnderstanding } from '../services/webxr/useWebXRSceneUnderstanding'

function XRScene({ xrStore }) {
  const sceneUnderstanding = useWebXRSceneUnderstanding(xrStore, {
    enabled: true,
    autoAnalyzeImages: true,
    autoSendToServer: false,
    ciServerUrl: 'http://localhost:11434'
  })

  // Access scene understanding state
  const {
    isInitialized,
    isSessionActive,
    locations,
    boundedGeometry,
    error
  } = sceneUnderstanding

  return (
    <XR store={xrStore}>
      {/* Your XR content */}
      {locations.map(location => (
        <mesh key={location.id} position={location.anchor.position}>
          <sphereGeometry args={[0.05]} />
          <meshStandardMaterial color="yellow" />
        </mesh>
      ))}
    </XR>
  )
}
```

### Manual Anchor Creation

```tsx
const handleCreateAnchor = async () => {
  const location = await sceneUnderstanding.createAnchor(
    [0, 0, -1], // position
    'User-created anchor' // description
  )
  
  if (location) {
    console.log('Anchor created:', location)
  }
}
```

### Image Analysis

```tsx
const handleAnalyzeLocation = async (location) => {
  const analysis = await sceneUnderstanding.analyzeLocation(location)
  
  if (analysis?.success) {
    console.log('Analysis:', analysis.description)
    console.log('Objects found:', analysis.objects)
  }
}
```

### Server Synchronization

```tsx
// Send single location
await sceneUnderstanding.sendLocationToServer(location)

// Sync all locations
const { success, failed } = await sceneUnderstanding.syncAllLocationsToServer()
console.log(`Synced ${success} locations, ${failed} failed`)
```

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```env
# WebXR Scene Understanding Configuration
VITE_CI_SERVER_URL=http://localhost:11434
VITE_CI_SERVER_API_KEY=your-api-key-here
VITE_WEBXR_SCENE_UNDERSTANDING_ENABLED=true
VITE_WEBXR_AUTO_ANALYZE_IMAGES=true
VITE_WEBXR_AUTO_SEND_TO_SERVER=false
```

### Service Options

```tsx
const options = {
  enabled: true, // Enable/disable scene understanding
  autoAnalyzeImages: true, // Automatically analyze captured images
  autoSendToServer: false, // Automatically send data to server
  ciServerUrl: 'http://localhost:11434', // Ollama server URL
  ciServerApiKey: 'optional-api-key' // Optional API key
}
```

## API Reference

### SceneLocation Interface

```typescript
interface SceneLocation {
  id: string
  anchor: SceneAnchor
  description: string
  imageData?: string // base64 encoded image
  metadata?: Record<string, any>
}

interface SceneAnchor {
  id: string
  position: [number, number, number]
  orientation: [number, number, number, number]
  timestamp: number
  type: 'plane' | 'mesh' | 'point'
  confidence: number
}
```

### Hook Return Value

```typescript
interface WebXRSceneUnderstandingState {
  isInitialized: boolean
  isSessionActive: boolean
  locations: SceneLocation[]
  boundedGeometry: { boundsGeometry: DOMPointReadOnly[] } | null
  lastAnalysis: ImageAnalysisResponse | null
  error: string | null
  
  // Methods
  createAnchor: (position, description?) => Promise<SceneLocation | null>
  analyzeLocation: (location) => Promise<ImageAnalysisResponse | null>
  sendLocationToServer: (location) => Promise<boolean>
  syncAllLocationsToServer: () => Promise<{ success: number; failed: number }>
  clearAllLocations: () => Promise<boolean>
  testServerConnection: () => Promise<boolean>
}
```

## Server Requirements

### Ollama/CI-Server Setup

1. Install and run Ollama: `ollama serve`
2. Pull a vision model: `ollama pull llava`
3. Ensure server is accessible at the configured URL
4. Optional: Set up API key authentication

### Expected API Endpoints

- `GET /api/tags` - List available models
- `POST /api/generate` - Generate text/analyze images
- `POST /api/locations` - Store location data (if implementing custom endpoints)
- `POST /api/locations/batch` - Batch location storage

## Troubleshooting

### WebXR Not Available

Ensure you're testing in a WebXR-compatible browser and environment:
- Chrome/Edge with WebXR flag enabled
- HTTPS connection required for WebXR APIs
- Physical XR device or emulator

### IndexedDB Issues

Check browser support and permissions:
- IndexedDB available in all modern browsers
- May be disabled in private/incognito mode
- Storage quota limits may apply

### Server Connection Issues

Verify Ollama/CI-Server configuration:
- Server running on correct port
- CORS configured for web requests
- API endpoints accessible
- Models loaded and available

## Testing

Run the test suite:

```bash
npm test src/tests/webxr-scene-understanding.test.ts
```

Tests cover:
- Scene understanding initialization
- Anchor creation and management
- Database operations
- Server integration
- Error handling scenarios

## Contributing

When extending this module:

1. Follow TypeScript interfaces for type safety
2. Add comprehensive error handling
3. Update tests for new functionality
4. Document API changes in this README
5. Consider backwards compatibility

## References

- [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [WebXR Bounded Reference Spaces](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Bounded_reference_spaces)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)