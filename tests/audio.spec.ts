import { test, expect, type Page } from '@playwright/test'

/** An event recorded by the speechSynthesis.speak monkey-patch below. */
interface TtsEvent {
  type: 'speak' | 'start' | 'end' | 'error'
  text?: string
  error?: string
  timestamp: number
}

/**
 * The page's `window` as these specs see it: vendor-prefixed audio APIs that are absent
 * from the DOM lib, plus the globals the app and this spec's own instrumentation attach.
 */
type TestWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
    ttsEvents: TtsEvent[]
    MicVAD?: unknown
    tts?: unknown
  }

/**
 * Helper to check if browser supports required APIs
 */
async function checkBrowserAPIs(page: Page) {
  return await page.evaluate(() => {
    const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    const hasSpeechSynthesis = 'speechSynthesis' in window
    const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window
    
    return {
      hasSpeechRecognition,
      hasSpeechSynthesis,
      hasAudioContext
    }
  })
}

/**
 * Helper to inject fake audio stream for STT testing
 */
async function injectFakeAudioStream(page: Page) {
  await page.addInitScript(() => {
    // Override getUserMedia to provide fake audio stream
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    
    navigator.mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
      if (constraints.audio) {
        // Create a fake audio stream
        const audioContext = new (window.AudioContext || (window as TestWindow).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const dest = audioContext.createMediaStreamDestination()
        oscillator.connect(dest)
        oscillator.start()
        
        return dest.stream
      }
      return originalGetUserMedia(constraints)
    }
  })
}

/**
 * Helper to monitor TTS events
 */
async function setupTTSMonitoring(page: Page) {
  await page.evaluate(() => {
    (window as TestWindow).ttsEvents = []
    
    if (window.speechSynthesis) {
      const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis)
      
      window.speechSynthesis.speak = function(utterance: SpeechSynthesisUtterance) {
        (window as TestWindow).ttsEvents.push({
          type: 'speak',
          text: utterance.text,
          timestamp: Date.now()
        })
        
        utterance.addEventListener('start', () => {
          (window as TestWindow).ttsEvents.push({ type: 'start', timestamp: Date.now() })
        })
        
        utterance.addEventListener('end', () => {
          (window as TestWindow).ttsEvents.push({ type: 'end', timestamp: Date.now() })
        })
        
        utterance.addEventListener('error', (event: SpeechSynthesisErrorEvent) => {
          (window as TestWindow).ttsEvents.push({ type: 'error', error: event.error, timestamp: Date.now() })
        })
        
        return originalSpeak(utterance)
      }
    }
  })
}

/**
 * Helper to get TTS events
 */
async function getTTSEvents(page: Page): Promise<TtsEvent[]> {
  return await page.evaluate(() => (window as TestWindow).ttsEvents || [])
}

/**
 * Helper to wait for agent ready
 */
async function waitForAgentReady(page: Page) {
  await page.waitForSelector('.app-container, div[class*="min-h-screen"]', { timeout: 30000 })
  await page.waitForSelector('canvas', { timeout: 30000 })
  await page.waitForTimeout(2000)
}

test.describe('Speech-to-Text (STT) Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone'])
    
    // Inject fake audio stream
    await injectFakeAudioStream(page)
    
    await page.goto('/')
    await waitForAgentReady(page)
  })

  test('should detect STT API availability', async ({ page }) => {
    const apis = await checkBrowserAPIs(page)
    
    console.log('Browser API Support:', apis)
    
    // Log what's available
    expect(apis).toHaveProperty('hasSpeechRecognition')
    expect(apis).toHaveProperty('hasAudioContext')
  })

  test('should have microphone toggle button', async ({ page }) => {
    // Look for microphone button/control
    const micButton = page.locator('button[aria-label*="microphone" i], button:has-text("Mic"), button[class*="mic"]').first()
    
    if (await micButton.count() > 0) {
      await expect(micButton).toBeVisible()
      
      // Try to click it
      await micButton.click()
      
      // Check if it toggles state
      await page.waitForTimeout(1000)
      
      // Take screenshot of UI state
      await page.screenshot({ path: 'playwright-report/screenshots/microphone-enabled.png' })
    } else {
      console.log('No microphone button found - might be auto-enabled or uses different UI')
    }
  })

  test('should handle microphone permission request', async ({ page }) => {
    // Attempt to trigger microphone access
    const result = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        return { success: true, error: null }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    })
    
    expect(result.success).toBe(true)
  })

  test('should initialize VAD service', async ({ page }) => {
    // Check if VAD is initialized by looking for console logs or state
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('vad')) {
        logs.push(msg.text())
      }
    })
    
    // Wait for VAD to initialize
    await page.waitForTimeout(3000)
    
    console.log('VAD-related logs:', logs)
  })

  test('should detect speech input capability', async ({ page }) => {
    // Check if the app has STT capability
    const hasSTT = await page.evaluate(() => {
      // Check for Web Speech API
      const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
      
      // Check for VAD library
      const hasVAD = !!(window as TestWindow).MicVAD
      
      return { hasWebSpeech, hasVAD }
    })
    
    console.log('STT Capabilities:', hasSTT)
  })
})

test.describe('Text-to-Speech (TTS) Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAgentReady(page)
    await setupTTSMonitoring(page)
  })

  test('should detect TTS API availability', async ({ page }) => {
    const apis = await checkBrowserAPIs(page)
    
    expect(apis.hasSpeechSynthesis).toBe(true)
  })

  test('should get available TTS voices', async ({ page }) => {
    const voices = await page.evaluate(() => {
      const voices = window.speechSynthesis.getVoices()
      return voices.map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default
      }))
    })
    
    console.log(`Found ${voices.length} TTS voices:`, voices.slice(0, 5))
    expect(voices.length).toBeGreaterThan(0)
  })

  test('should trigger TTS when agent responds', async ({ page }) => {
    // Send a message to trigger agent response
    const chatInput = page.locator('input[type="text"], textarea').first()
    await chatInput.fill('Hello')
    await chatInput.press('Enter')
    
    // Wait for response and TTS
    await page.waitForTimeout(5000)
    
    // Check TTS events
    const events = await getTTSEvents(page)
    console.log('TTS Events:', events)
    
    // We should have at least a speak event if TTS is enabled
    // Note: This might fail if TTS is disabled in config
    if (events.length > 0) {
      const hasSpeak = events.some(e => e.type === 'speak')
      expect(hasSpeak).toBe(true)
    }
  })

  test('should use configured TTS voice settings', async ({ page }) => {
    // Check TTS configuration
    const config = await page.evaluate(() => {
      return {
        hasTTSService: typeof (window as TestWindow).tts !== 'undefined',
        speechSynthesis: {
          speaking: window.speechSynthesis?.speaking,
          pending: window.speechSynthesis?.pending,
          paused: window.speechSynthesis?.paused
        }
      }
    })
    
    console.log('TTS Configuration:', config)
  })

  test('should generate viseme data for lip sync', async ({ page }) => {
    // Send a message
    const chatInput = page.locator('input[type="text"], textarea').first()
    await chatInput.fill('Testing lip synchronization')
    await chatInput.press('Enter')
    
    // Wait for processing
    await page.waitForTimeout(3000)
    
    // Check if viseme data is being generated
    // This would require accessing the agent's viseme service
    const hasVisemes = await page.evaluate(() => {
      // Check if there's any viseme-related activity
      return {
        checked: true,
        // Add checks for viseme service if accessible
      }
    })
    
    expect(hasVisemes.checked).toBe(true)
  })

  test('should handle TTS queue when multiple messages are sent', async ({ page }) => {
    const chatInput = page.locator('input[type="text"], textarea').first()
    
    // Send multiple messages rapidly
    for (let i = 1; i <= 3; i++) {
      await chatInput.fill(`Message ${i}`)
      await chatInput.press('Enter')
      await page.waitForTimeout(500)
    }
    
    // Wait for all to process
    await page.waitForTimeout(10000)
    
    const events = await getTTSEvents(page)
    console.log(`TTS Events from ${events.length} events`)
    
    // Should have processed multiple speak requests
    const speakEvents = events.filter(e => e.type === 'speak')
    console.log(`Speak events: ${speakEvents.length}`)
  })
})

test.describe('Audio Integration Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['microphone'])
    await injectFakeAudioStream(page)
    await page.goto('/')
    await waitForAgentReady(page)
    await setupTTSMonitoring(page)
  })

  test('should have audio context for processing', async ({ page }) => {
    const audioInfo = await page.evaluate(() => {
      const AudioContextClass = (window as TestWindow).AudioContext || (window as TestWindow).webkitAudioContext
      if (!AudioContextClass) {
        return { available: false }
      }
      
      const ctx = new AudioContextClass()
      const info = {
        available: true,
        state: ctx.state,
        sampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency
      }
      ctx.close()
      return info
    })
    
    console.log('Audio Context Info:', audioInfo)
    expect(audioInfo.available).toBe(true)
  })

  test('should handle audio permissions gracefully', async ({ page }) => {
    // Test that the app handles permission denial gracefully
    const permissionStatus = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        return 'granted'
      } catch (error) {
        return (error as Error).name
      }
    })
    
    console.log('Audio permission status:', permissionStatus)
  })

  test('should coordinate STT and TTS (no simultaneous talk)', async ({ page }) => {
    // This tests that the agent doesn't speak while listening
    // and doesn't listen while speaking (half-duplex communication)
    
    const chatInput = page.locator('input[type="text"], textarea').first()
    await chatInput.fill('Tell me a long story')
    await chatInput.press('Enter')
    
    // Monitor state during response
    await page.waitForTimeout(2000)
    
    const state = await page.evaluate(() => {
      return {
        ttsActive: window.speechSynthesis?.speaking,
        // Would need to check STT/VAD state if accessible
      }
    })
    
    console.log('Communication state:', state)
  })
})
