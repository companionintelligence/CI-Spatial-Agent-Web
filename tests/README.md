# CI-XR-Web E2E Testing

This directory contains end-to-end tests for the CI-XR-Web application using Playwright.

## Test Suites

### 1. Agent Tests (`agent.spec.ts`)
Tests the AI agent's conversation capabilities:
- **Question Bank Testing**: Tests responses to various question categories
  - Greetings
  - Information queries
  - Technical questions
  - Conversational questions
  - Math and logic
  - Follow-up questions
  - Edge cases
- **Response Quality**: Validates that responses match expected patterns
- **Context Maintenance**: Verifies the agent remembers conversation context
- **Rapid Messages**: Tests handling of consecutive messages
- **Avatar Animation**: Ensures avatar continues animating during conversations

### 2. Audio Tests (`audio.spec.ts`)
Tests speech-to-text (STT) and text-to-speech (TTS) functionality:

#### STT Tests:
- Browser API availability (Web Speech API, AudioContext)
- Microphone permission handling
- VAD (Voice Activity Detection) initialization
- Fake audio stream injection for testing
- Microphone toggle UI

#### TTS Tests:
- Speech Synthesis API availability
- Voice enumeration
- TTS event monitoring (speak, start, end, error)
- Viseme generation for lip sync
- TTS queue management
- Voice settings configuration

#### Integration Tests:
- Audio context creation and management
- Permission handling
- Half-duplex communication (no simultaneous talk/listen)

### 3. Animation Tests (`animation.spec.ts`)
Tests the 3D avatar animation system:

#### Core Animation:
- Canvas rendering and visibility
- Three.js and WebGL context
- Idle animation activity
- Frame rate monitoring (target: 60 FPS, minimum: 30 FPS)
- Animation state transitions

#### Avatar Features:
- VRM model loading
- Lip synchronization during speech
- Blinking animation (2-8 second intervals)
- Facial expressions
- Gaze following behavior
- Emotion-based animations

#### Performance:
- Memory leak detection
- Window resize handling
- Sustained animation quality

## Running Tests

### Prerequisites
```bash
# Install dependencies (if not already done)
pnpm install

# Install Playwright browsers
pnpx playwright install
```

### Run All Tests
```bash
pnpm test:e2e
```

### Run Specific Test Suites
```bash
# Agent conversation tests
pnpm test:agent

# Audio (STT/TTS) tests
pnpm test:audio

# Animation tests
pnpm test:animation
```

### Interactive Mode
```bash
# Run with UI (great for development)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Debug mode (step through tests)
pnpm test:e2e:debug
```

### View Test Reports
```bash
pnpm test:report
```

## Test Data

### Question Bank (`data/questionBank.ts`)
Contains categorized test questions:
- **greetings**: Simple hello/hi messages
- **information**: Questions about the agent
- **technical**: AI/ML/tech questions
- **conversational**: Casual conversation
- **mathLogic**: Math problems
- **followUp**: Context-dependent questions
- **edgeCases**: Empty, long, emoji, caps, etc.
- **interruption**: Barge-in test phrases

## Configuration

Test configuration is in `playwright.config.ts`:
- **Base URL**: http://localhost:5174
- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Permissions**: Microphone and speaker access
- **Browser Args**: Fake media devices for testing
- **Web Server**: Automatically starts dev server with Ollama config

## Writing New Tests

### Test Template
```typescript
import { test, expect } from '@playwright/test'

test('should do something', async ({ page }) => {
  // Navigate
  await page.goto('/')
  
  // Wait for app to load
  await page.waitForSelector('canvas', { timeout: 30000 })
  
  // Perform actions
  const input = page.locator('input').first()
  await input.fill('test message')
  await input.press('Enter')
  
  // Assert
  await expect(page.locator('.response')).toBeVisible()
})
```

### Helper Functions
Common helpers are available in each test file:
- `waitForAgentReady(page)`: Wait for full app initialization
- `sendMessage(page, message)`: Send a chat message
- `waitForAgentResponse(page)`: Wait for and get response
- `checkAvatarAnimation(page)`: Verify animation is active
- `isAvatarAnimating(page)`: Check if avatar is animating
- `estimateFPS(page)`: Calculate frame rate

## CI/CD Integration

Tests are configured to run in CI environments:
- Automatic browser installation
- Parallel execution disabled (for consistent results)
- JSON and HTML reports generated
- Screenshots and videos on failure
- Trace collection on retry

## Debugging Tips

1. **Use UI Mode**: `pnpm test:e2e:ui` - Best for development
2. **Take Screenshots**: Tests auto-capture on failure
3. **Check Console Logs**: Look in `playwright-report/`
4. **Slow Down**: Add `page.waitForTimeout()` to see what's happening
5. **Inspector**: Use `page.pause()` to debug at specific points
6. **Check Network**: Look at failed requests in trace viewer

## Known Issues

1. **STT Testing**: Requires fake media stream injection
2. **TTS Verification**: Browser policy may block audio in headless mode
3. **Animation Comparison**: Sensitive to timing, may need adjustment
4. **Ollama Dependency**: Tests require Ollama running locally

## Environment Variables

Tests respect these environment variables:
- `CI`: Enables CI-specific behavior
- `VITE_LLM_PROVIDER`: Set to `ollama` for tests
- `VITE_LLM_OLLAMA_API_URL`: Ollama API endpoint
- `VITE_LLM_OLLAMA_MODEL`: Model to use (default: `gemma3:1b`)

## Troubleshooting

### Tests Timeout
- Check if dev server started correctly
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Increase timeout in test or config

### Avatar Not Animating
- Check WebGL support in browser
- Verify canvas is rendering
- Look for Three.js errors in console

### Audio Tests Fail
- Check browser permissions
- Verify fake device flags are set
- Look for Web Speech API support

### Flaky Tests
- Add explicit waits before assertions
- Check for race conditions
- Use `page.waitForLoadState('networkidle')`
