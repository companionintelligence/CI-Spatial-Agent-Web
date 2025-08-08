import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { TTSConfigPartial, WhisperData } from '../audioTypes'
import { defaultTTSConfig } from '../audioTypes'
import { cleanText } from './textUtils'
import { approximateWhisperDataFromText } from './whisperDataGenerator'

// Workerized TTS using vits-web library
const createTTSWorker = (): Worker => {
  const ttsWorkerString = `
import * as tts from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'

let processing = null

self.addEventListener('message', async (e) => {
  const id = e.data.id
  const text = e.data.text || 'please supply some text'
  const voiceId = e.data.voice || 'en_US-hfc_female-medium'
  if (processing) {
    await processing
  }
  console.log('TTS Worker received message:', { id, text, voiceId })
  processing = tts.predict({text, voiceId}).then(audio => {
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(audio)
    }).then(audio => {
      self.postMessage({ audio, id })
      processing = null
    }).catch(error => {
      console.error('TTS Worker Error:', error)
      self.postMessage({ error: error.message, id })
      processing = null
    })
  })
})
`
  return new Worker(URL.createObjectURL(new Blob([ttsWorkerString], { type: 'text/javascript' })), { type: 'module' })
}

interface TTSServiceOptions {
  config?: TTSConfigPartial
  onSpeechStart?: (text: string, whisperData: WhisperData) => void
  onSpeechEnd?: () => void
}

let id = 0

export const useTTSService = (options: TTSServiceOptions = {}) => {
  const { config: configPartial = {}, onSpeechStart, onSpeechEnd } = options
  const config = useMemo(() => ({ ...defaultTTSConfig, ...configPartial }), [configPartial])
  const isSpeaking = useRef(false)
  const audioQueue = useRef<{ id: number; audio: ArrayBuffer }[]>([])
  const workerRef = useRef<Worker | null>(null)

  // Initialize worker for local TTS
  const getOrCreateWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = createTTSWorker()
    }
    return workerRef.current
  }, [])

  const playAudioBuffer = useCallback(async (audioBuffer: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audioContext = new AudioContext()

      audioContext
        .decodeAudioData(audioBuffer.slice(0))
        .then((decodedAudio) => {
          const source = audioContext.createBufferSource()
          source.buffer = decodedAudio
          source.connect(audioContext.destination)

          source.onended = () => {
            resolve()
          }

          source.start(0)
        })
        .catch((error) => {
          console.error('Audio decode error:', error)
          reject(error)
        })
    })
  }, [])

  const speakBrowser = useCallback(
    async (text: string) => {
      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported')
      }

      // Clean up text
      const cleanedText = cleanText(text)
      if (!cleanedText.trim()) return

      const utterance = new SpeechSynthesisUtterance(cleanedText)

      /** @todo for the very first utterance, there appear to be no voices registered. maybe a chrome bug? for now just use system default */
      // const voices = speechSynthesis.getVoices()
      // console.log('Available voices:', voices)
      // const voice = voices.find((v) => v.lang === 'en-US') || voices[0]
      // if (voice) utterance.voice = voice

      utterance.rate = config.speed
      utterance.pitch = config.pitch
      utterance.volume = config.volume

      // Generate whisper data for visemes
      const whisperData = approximateWhisperDataFromText(cleanedText, config.speed, 0)

      // Notify speech start with whisper data
      if (onSpeechStart) {
        onSpeechStart(cleanedText, whisperData)
      }

      utterance.onend = () => {
        isSpeaking.current = false
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }

      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error)
        isSpeaking.current = false
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }

      speechSynthesis.speak(utterance)
    },
    [config.speed, config.pitch, config.volume, onSpeechStart, onSpeechEnd]
  )

  const speakLocalWorker = useCallback(
    async (text: string) => {
      // Clean up text
      const cleanedText = cleanText(text)
      if (!cleanedText.trim()) return

      return new Promise<void>((resolve, reject) => {
        const worker = getOrCreateWorker()

        // Generate whisper data for visemes
        const whisperData = approximateWhisperDataFromText(cleanedText, config.speed, 0)

        // Notify speech start with whisper data
        if (onSpeechStart) {
          onSpeechStart(cleanedText, whisperData)
        }

        worker.onmessage = (event) => {
          try {
            const { audio, id } = event.data
            addToQueue(audio, id)
            isSpeaking.current = false
            if (onSpeechEnd) {
              onSpeechEnd()
            }
            resolve()
          } catch (error) {
            console.error('Local TTS Error:', error)
            isSpeaking.current = false
            if (onSpeechEnd) {
              onSpeechEnd()
            }
            reject(error)
          }
        }

        worker.onerror = (error) => {
          console.error('TTS Worker Error:', error)
          isSpeaking.current = false
          if (onSpeechEnd) {
            onSpeechEnd()
          }
          reject(error)
        }

        for (const chunk of text.match(/[^.!?]+[.!?]?/g) || []) {
          worker.postMessage({
            id: id++,
            text: chunk,
            voice: config.voice
          })
        }
      })
    },
    [getOrCreateWorker, config.speed, config.voice, onSpeechStart, onSpeechEnd]
  )

  const speakRemote = useCallback(
    async (text: string) => {
      if (!config.apiKey) {
        throw new Error('API key required for remote TTS')
      }

      // Clean up text
      const cleanText = text.replace(/[*<>#%-]/g, '')
      if (!cleanText || !cleanText.length) {
        return
      }

      const url = config.url || 'https://api.openai.com/v1/audio/speech'

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      }

      // Set appropriate authorization header based on URL
      if (url.includes('elevenlabs')) {
        headers['xi-api-key'] = config.apiKey
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      const requestBody: Record<string, unknown> = {
        text: cleanText,
        input: cleanText
      }

      // Set model and voice based on service
      if (url.includes('elevenlabs')) {
        requestBody.model_id = config.model || 'eleven_monolingual_v1'
        requestBody.voice_settings = {
          stability: config.voiceSettings?.stability || 0.5,
          similarity_boost: config.voiceSettings?.similarity_boost || 0.8
        }
      } else {
        // OpenAI format
        requestBody.model = config.model || 'tts-1'
        requestBody.voice = config.voice || 'shimmer'
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(`Remote TTS API error: ${response.status} ${response.statusText}`)
        }

        const audioBuffer = await response.arrayBuffer()

        // Generate whisper data for visemes (approximate timing)
        const whisperData = approximateWhisperDataFromText(cleanText, config.speed, 0)

        // Notify speech start with whisper data
        if (onSpeechStart) {
          onSpeechStart(cleanText, whisperData)
        }

        // Play the audio buffer
        await playAudioBuffer(audioBuffer)

        isSpeaking.current = false
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      } catch (error) {
        console.error('Remote TTS Error:', error)
        isSpeaking.current = false
        if (onSpeechEnd) {
          onSpeechEnd()
        }
        throw error
      }
    },
    [
      config.apiKey,
      config.url,
      config.model,
      config.voiceSettings?.stability,
      config.voiceSettings?.similarity_boost,
      config.voice,
      config.speed,
      onSpeechStart,
      playAudioBuffer,
      onSpeechEnd
    ]
  )

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return null

      try {
        isSpeaking.current = true
        console.log(config)
        if (config.mode === 'remote') {
          await speakRemote(text)
        } else if (config.mode === 'browser') {
          await speakBrowser(text)
        } else if (config.mode === 'local') {
          await speakLocalWorker(text)
        }
      } catch (error) {
        console.error('TTS Error:', error)
        isSpeaking.current = false
        // Call speech end callback if there's an error during speech initiation
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }
    },
    [config, speakRemote, speakBrowser, speakLocalWorker, onSpeechEnd]
  )

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }

    // Terminate worker if it exists
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    isSpeaking.current = false

    // Call speech end callback when speech is stopped
    if (onSpeechEnd) {
      onSpeechEnd()
    }
  }, [onSpeechEnd])

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const processQueue = useCallback(() => {
    if (audioQueue.current.length === 0 || isSpeaking.current) return

    isSpeaking.current = true

    const processQueue = async () => {
      console.log('Processing TTS queue:', audioQueue.current.length, 'items')
      try {
        while (audioQueue.current.length > 0) {
          const { audio, id } = audioQueue.current[0]
          console.log('Processing TTS queue item:', audioQueue.current[0].id)
          await playAudioBuffer(audio)
          audioQueue.current = audioQueue.current.filter((item) => item.id !== id)
        }
      } catch (error) {
        console.error('Queue processing error:', error)
      } finally {
        isSpeaking.current = false
        // Call speech end callback when queue processing is complete
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }
    }
    processQueue()
  }, [playAudioBuffer, onSpeechEnd])

  const addToQueue = (audio: ArrayBuffer, id: number) => {
    audioQueue.current = [...audioQueue.current, { id, audio }].sort((a, b) => a.id - b.id)
    console.log('Added', id, 'to TTS queue:', audioQueue.current.length, 'items')
    processQueue()
  }

  return {
    isSpeaking,
    audioQueue: audioQueue.current.length,
    actions: {
      speak,
      stopSpeaking,
      playAudioBuffer,
      addToQueue
    }
  }
}
