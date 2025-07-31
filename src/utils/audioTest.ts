/**
 * Audio Services Test Utilities
 *
 * This file contains test utilities to verify that the audio services
 * are working correctly. These can be run from the browser console.
 */

// Test VAD Service
export const testVAD = async () => {
  console.log('Testing VAD Service...')

  // Check if VAD package is available
  try {
    const { MicVAD } = await import('@ricky0123/vad-web')
    console.log('✅ VAD package loaded successfully')

    // Test VAD initialization
    const vad = await MicVAD.new({
      model: 'v5',
      onSpeechStart: () => console.log('🎤 Speech detected'),
      onSpeechEnd: (audio) => console.log('🔇 Speech ended, audio length:', audio.length)
    })

    console.log('✅ VAD initialized successfully')
    vad.pause() // Clean up
    return true
  } catch (error) {
    console.error('❌ VAD test failed:', error)
    return false
  }
}

// Test Web Speech API availability
export const testSpeechAPI = () => {
  console.log('Testing Web Speech API...')

  const windowWithSpeech = window as Window & {
    webkitSpeechRecognition?: unknown
    SpeechRecognition?: unknown
  }

  const hasSpeechRecognition = !!windowWithSpeech.webkitSpeechRecognition || !!windowWithSpeech.SpeechRecognition
  const hasSpeechSynthesis = !!window.speechSynthesis

  console.log('Speech Recognition available:', hasSpeechRecognition ? '✅' : '❌')
  console.log('Speech Synthesis available:', hasSpeechSynthesis ? '✅' : '❌')

  if (hasSpeechSynthesis) {
    const voices = speechSynthesis.getVoices()
    console.log('Available voices:', voices.length)
    voices.slice(0, 3).forEach((voice) => console.log(`  - ${voice.name} (${voice.lang})`))
  }

  return hasSpeechRecognition && hasSpeechSynthesis
}

// Test TTS
export const testTTS = async (text: string = 'Hello, this is a test of the text to speech system.') => {
  console.log('Testing TTS with text:', text)

  if (!window.speechSynthesis) {
    console.error('❌ Speech synthesis not available')
    return false
  }

  return new Promise<boolean>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)

    utterance.onstart = () => console.log('🔊 TTS started')
    utterance.onend = () => {
      console.log('✅ TTS completed')
      resolve(true)
    }
    utterance.onerror = (error) => {
      console.error('❌ TTS error:', error)
      resolve(false)
    }

    speechSynthesis.speak(utterance)
  })
}

// Run all tests
export const runAllAudioTests = async () => {
  console.log('🧪 Running Audio Services Tests...')
  console.log('='.repeat(50))

  const speechAPITest = testSpeechAPI()
  const vadTest = await testVAD()
  const ttsTest = await testTTS()

  console.log('='.repeat(50))
  console.log('Test Results:')
  console.log('Web Speech API:', speechAPITest ? '✅ PASS' : '❌ FAIL')
  console.log('VAD Service:', vadTest ? '✅ PASS' : '❌ FAIL')
  console.log('TTS Service:', ttsTest ? '✅ PASS' : '❌ FAIL')

  const allPassed = speechAPITest && vadTest && ttsTest
  console.log('Overall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED')

  return allPassed
}

// Make tests available globally for browser console
if (typeof window !== 'undefined') {
  const globalWindow = window as Window & { audioTests?: unknown }
  globalWindow.audioTests = {
    testVAD,
    testSpeechAPI,
    testTTS,
    runAllAudioTests
  }

  console.log('Audio tests available at window.audioTests')
  console.log('Run window.audioTests.runAllAudioTests() to test all services')
}
