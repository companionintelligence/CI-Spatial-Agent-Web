# Playwright Testing Summary for CI-XR-Web

## Overview
Successfully created comprehensive end-to-end testing infrastructure using Playwright to test the AI avatar web application.

## Test Coverage

### ✅ 1. Agent Conversation Tests (`tests/agent.spec.ts`)
**Total Tests: 19**

#### Question Bank Categories:
- **Greetings** (5 tests): Hello, Hi there, Good morning, How are you?, What's up?
- **Information** (3 tests): Questions about agent capabilities
- **Technical** (2 tests): AI/ML questions  
- **Conversational** (2 tests): Casual questions
- **Math & Logic** (3 tests): Math problems

#### Advanced Tests:
- Rapid consecutive message handling
- Conversation context maintenance
- Avatar animation during conversation
- Response pattern validation

### ✅ 2. Speech & Audio Tests (`tests/audio.spec.ts`)
**Total Tests: 16**

#### STT (Speech-to-Text):
- Browser API detection (Web Speech API, AudioContext)
- Microphone permission handling
- VAD (Voice Activity Detection) initialization
- Fake audio stream injection for testing
- Microphone toggle UI verification

#### TTS (Text-to-Speech):
- Speech Synthesis API availability
- Voice enumeration and configuration
- TTS event monitoring (speak, start, end, error)
- Viseme generation for lip synchronization
- TTS queue management
- Multi-message handling

#### Integration:
- Audio context management
- Permission graceful degradation
- Half-duplex communication verification

### ✅ 3. Animation Tests (`tests/animation.spec.ts`)
**Total Tests: 14**

#### Core Animation:
- Canvas rendering verification
- Three.js & WebGL context
- Idle animation activity
- Frame rate monitoring (target 60 FPS, min 30 FPS)
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

## Infrastructure

### Configuration (`playwright.config.ts`)
- **Base URL**: http://localhost:5174
- **Timeouts**: 60s per test, 120s for server startup
- **Browser**: Chromium (Chrome for Testing)
- **Permissions**: Microphone, speaker auto-granted
- **Media**: Fake devices for consistent testing
- **Reports**: HTML, JSON, screenshots, videos
- **Auto Server**: Starts dev server with Ollama config

### Test Data (`tests/data/questionBank.ts`)
- 50+ test questions across 8 categories
- Expected response patterns for validation
- Helper functions for random/category selection
- Edge cases (empty, long, emoji, caps, etc.)

## npm Scripts

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific suites
pnpm test:agent       # Agent conversation tests
pnpm test:audio       # STT/TTS tests
pnpm test:animation   # Avatar animation tests

# Interactive modes
pnpm test:e2e:ui      # UI mode (recommended)
pnpm test:e2e:headed  # See browser
pnpm test:e2e:debug   # Debug mode

# View reports
pnpm test:report      # Open HTML report
```

## Test Results Location

```
playwright-report/
├── index.html              # Main HTML report
├── results.json            # JSON test results
├── screenshots/
│   ├── initial-state.png
│   ├── avatar-idle-animation.png
│   ├── avatar-talking.png
│   ├── avatar-lip-sync.png
│   └── microphone-enabled.png
├── videos/                 # Test run videos (on failure)
└── traces/                 # Detailed traces (on retry)
```

## Key Testing Capabilities

### 1. Question Bank Testing
- Automated testing of 50+ questions
- Response validation with regex patterns
- Category-based organization
- Edge case handling

### 2. STT Testing Approach
```typescript
// Inject fake audio stream for consistent testing
await injectFakeAudioStream(page)

// Monitor microphone state
const micButton = page.locator('button[aria-label*="microphone"]')
await micButton.click()

// Verify VAD initialization
// Check for console logs indicating VAD is active
```

### 3. TTS Testing Approach
```typescript
// Monitor TTS events
await setupTTSMonitoring(page)

// Trigger speech
await sendMessage(page, 'Hello')

// Get events
const events = await getTTSEvents(page)
// events: [{ type: 'speak', text: '...', timestamp: ... }]
```

### 4. Animation Verification
```typescript
// Compare screenshots to detect animation
const screenshot1 = await canvas.screenshot()
await page.waitForTimeout(500)
const screenshot2 = await canvas.screenshot()

// If different, avatar is animating
const isAnimating = Buffer.compare(screenshot1, screenshot2) !== 0

// Estimate FPS
const fps = await estimateFPS(page, 2000)
expect(fps).toBeGreaterThan(30)
```

## Test Execution Flow

1. **Setup**: Playwright config starts dev server with Ollama
2. **Browser Launch**: Chromium with fake media devices
3. **Navigation**: Load http://localhost:5174
4. **Wait**: Agent initialization (canvas render + 2s)
5. **Execute**: Run test interactions
6. **Assert**: Verify expected outcomes
7. **Capture**: Screenshots/videos on failure
8. **Report**: Generate HTML/JSON reports

## Requirements

### System Dependencies
- Node.js >=20
- pnpm 10.28.2
- Ollama 0.15.2 (running locally)
- Chromium browser (auto-installed by Playwright)

### Environment Variables
```bash
VITE_LLM_PROVIDER=ollama
VITE_LLM_OLLAMA_API_URL=http://localhost:11434
VITE_LLM_OLLAMA_MODEL=gemma3:1b
```

## Known Limitations

1. **STT Testing**: Uses fake audio streams, doesn't test actual speech recognition
2. **TTS Verification**: Browser policies may prevent audio in headless mode
3. **Animation Comparison**: Timing-sensitive, may produce false positives
4. **Ollama Dependency**: Tests require local Ollama server running

## Best Practices

### For Agent Tests:
- Use question bank categories for organization
- Add expected patterns for response validation
- Test context maintenance with follow-ups
- Include edge cases (empty, long, special chars)

### For Audio Tests:
- Always grant permissions in beforeEach
- Use fake devices for consistency
- Monitor console logs for service initialization
- Test both browser APIs and custom services

### For Animation Tests:
- Compare multiple screenshots for reliability
- Set reasonable FPS thresholds (30-60)
- Test state transitions and performance
- Verify animations during different agent states

## Debugging

```bash
# Run with UI (best for development)
pnpm test:e2e:ui

# Run single test
pnpm test:e2e --grep "should load the application"

# Show browser
pnpm test:e2e:headed

# Debug mode (step through)
pnpm test:e2e:debug

# View last report
pnpm test:report
```

## Next Steps

1. **CI/CD Integration**: Add tests to GitHub Actions
2. **Visual Regression**: Add Percy or Chromatic for screenshot comparison
3. **Performance Benchmarks**: Track FPS/memory over time
4. **Accessibility**: Add axe-core tests
5. **Real STT/TTS**: Test with actual audio files
6. **Load Testing**: Multiple concurrent sessions

## Success Metrics

- ✅ **49 total tests** across 3 test suites
- ✅ Tests cover **agent conversation, audio, and animation**
- ✅ **Automated test execution** with reports
- ✅ **Question bank** with 50+ test questions
- ✅ **STT/TTS testing** with event monitoring
- ✅ **Animation verification** with FPS tracking
- ✅ **Screenshot/video capture** on failures
- ✅ **Interactive debugging** with Playwright UI

## Conclusion

A comprehensive E2E testing framework is now in place for the CI-XR-Web application. The tests cover the three critical areas requested:
1. ✅ **Question bank testing** - Automated testing of agent responses
2. ✅ **STT/TTS testing** - Speech input/output verification
3. ✅ **Animation verification** - Avatar animation monitoring

All tests are runnable with `pnpm test:e2e` and provide detailed reports for debugging and validation.
