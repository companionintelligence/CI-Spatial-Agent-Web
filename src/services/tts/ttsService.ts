import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { TTSConfigPartial, WhisperData } from '../audioTypes'
import { defaultTTSConfig } from '../audioTypes'
import { cleanText } from './textUtils'
import { approximateWhisperDataFromText } from './whisperDataGenerator'

// Workerized TTS using vits-web library
const createTTSWorker = (): Worker => {
  const ttsWorkerString = `
import * as tts from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'
self.addEventListener('message', async (e) => {
  const id = e.data.id
  const text = e.data.text || 'please supply some text'
  const voiceId = e.data.voice || 'en_US-hfc_female-medium'
  console.log('TTS Worker received message:', { id, text, voiceId })
  tts.predict({text, voiceId}).then(audio => {
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(audio)
    }).then(audio => {
      self.postMessage({ audio, id })
    }).catch(error => {
      console.error('TTS Worker Error:', error)
      self.postMessage({ error: error.message, id })
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

interface QueuedMessage {
  id: number
  text: string
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'completed' | 'error'
  audio?: ArrayBuffer
  whisperData?: WhisperData
  error?: string
}

let globalId = 0

export const useTTSService = (options: TTSServiceOptions = {}) => {
  const { config: configPartial = {}, onSpeechStart, onSpeechEnd } = options
  const config = useMemo(() => ({ ...defaultTTSConfig, ...configPartial }), [configPartial])
  const isProcessing = useRef(false)
  const messageQueue = useRef<QueuedMessage[]>([])
  const nextExpectedId = useRef(0)
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

  // Generate audio using browser speech synthesis
  const generateBrowserAudio = useCallback(async (_message: QueuedMessage) => {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported')
    }

    // For browser mode, we don't pre-generate audio, we play it directly during playback
    // Just mark as ready
    return Promise.resolve()
  }, [])

  // Generate audio using local worker
  const generateLocalAudio = useCallback(
    async (message: QueuedMessage) => {
      return new Promise<void>((resolve, reject) => {
        const worker = getOrCreateWorker()

        const handleWorkerMessage = (event: MessageEvent) => {
          const { audio, id, error } = event.data
          if (error) {
            reject(new Error(error))
            return
          }
          if (id === message.id) {
            message.audio = audio
            worker.removeEventListener('message', handleWorkerMessage)
            worker.removeEventListener('error', handleWorkerError)
            resolve()
          }
        }

        const handleWorkerError = (error: ErrorEvent) => {
          worker.removeEventListener('message', handleWorkerMessage)
          worker.removeEventListener('error', handleWorkerError)
          reject(new Error(`Worker Error: ${error.message}`))
        }

        worker.addEventListener('message', handleWorkerMessage)
        worker.addEventListener('error', handleWorkerError)

        worker.postMessage({
          id: message.id,
          text: message.text,
          voice: config.voice
        })
      })
    },
    [getOrCreateWorker, config.voice]
  )

  // Generate audio using remote API
  const generateRemoteAudio = useCallback(
    async (message: QueuedMessage) => {
      if (!config.apiKey) {
        throw new Error('API key required for remote TTS')
      }

      const url = config.url || 'https://api.openai.com/v1/audio/speech'

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      }

      // OpenAI TTS API payload format
      const requestBody = {
        input: message.text,
        model: config.model || 'tts-1',
        voice: config.voice || 'shimmer',
        response_format: 'mp3',
        speed: config.speed || 1.0
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Remote TTS API error: ${response.status} ${response.statusText}`)
      }

      message.audio = await response.arrayBuffer()
    },
    [config.apiKey, config.url, config.model, config.voice, config.speed]
  )

  // Generate audio for a specific message
  const generateAudioForMessage = useCallback(
    async (message: QueuedMessage) => {
      message.status = 'generating'
      console.log(`Generating audio for message ${message.id}`)

      try {
        if (config.mode === 'remote') {
          await generateRemoteAudio(message)
        } else if (config.mode === 'browser') {
          await generateBrowserAudio(message)
        } else if (config.mode === 'local') {
          await generateLocalAudio(message)
        }
        message.status = 'ready'
      } catch (error) {
        console.error(`Error generating audio for message ${message.id}:`, error)
        message.status = 'error'
        message.error = error instanceof Error ? error.message : 'Unknown error'
      }
    },
    [config.mode, generateRemoteAudio, generateBrowserAudio, generateLocalAudio]
  )

  // Process the queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessing.current) return
    isProcessing.current = true

    try {
      while (true) {
        const nextMessage = messageQueue.current.find((msg) => msg.id === nextExpectedId.current)

        if (!nextMessage) {
          // No more messages to process
          break
        }

        // If message is pending, generate audio
        if (nextMessage.status === 'pending') {
          await generateAudioForMessage(nextMessage)
        }

        // If message is not ready after generation, skip for now
        if (nextMessage.status !== 'ready') {
          if (nextMessage.status === 'error') {
            console.error(`Skipping message ${nextMessage.id} due to error:`, nextMessage.error)
            messageQueue.current = messageQueue.current.filter((msg) => msg.id !== nextMessage.id)
            nextExpectedId.current = nextMessage.id + 1
            continue
          } else if (nextMessage.status === 'generating') {
            // For local mode, wait a bit for generation to complete
            if (config.mode === 'local') {
              await new Promise((resolve) => setTimeout(resolve, 100))
              continue
            }
          }
          // For other cases, exit and let it be handled later
          break
        }

        // Play the message
        nextMessage.status = 'playing'
        console.log(`Playing message ${nextMessage.id}`)

        // Generate whisper data and notify speech start
        const whisperData = approximateWhisperDataFromText(nextMessage.text, config.speed, 0)
        if (onSpeechStart) {
          onSpeechStart(nextMessage.text, whisperData)
        }

        try {
          // Handle different TTS modes for playback
          if (config.mode === 'browser') {
            await new Promise<void>((resolve, reject) => {
              const utterance = new SpeechSynthesisUtterance(nextMessage.text)
              utterance.rate = config.speed
              utterance.pitch = config.pitch
              utterance.volume = config.volume

              utterance.onend = () => resolve()
              utterance.onerror = (event) => reject(new Error(`Browser TTS Error: ${event.error}`))

              speechSynthesis.speak(utterance)
            })
          } else if (nextMessage.audio && nextMessage.audio.byteLength > 0) {
            await playAudioBuffer(nextMessage.audio)
          }
        } catch (playbackError) {
          console.error(`Error playing message ${nextMessage.id}:`, playbackError)
        }

        // Mark as completed and remove from queue
        nextMessage.status = 'completed'
        messageQueue.current = messageQueue.current.filter((msg) => msg.id !== nextMessage.id)
        nextExpectedId.current = nextMessage.id + 1
      }

      // Call onSpeechEnd only when queue is empty
      if (onSpeechEnd && messageQueue.current.length === 0) {
        onSpeechEnd()
      }
    } catch (error) {
      console.error('Queue processing error:', error)
      if (onSpeechEnd) {
        onSpeechEnd()
      }
    } finally {
      isProcessing.current = false
    }
  }, [
    generateAudioForMessage,
    config.speed,
    config.pitch,
    config.volume,
    config.mode,
    onSpeechStart,
    playAudioBuffer,
    onSpeechEnd
  ])

  // Add message to queue and assign ID
  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return null

      const messageId = globalId++
      const cleanedText = cleanText(text)

      if (!cleanedText.trim()) return messageId

      const queuedMessage: QueuedMessage = {
        id: messageId,
        text: cleanedText,
        status: 'pending'
      }

      messageQueue.current.push(queuedMessage)
      console.log(`Queued message ${messageId}:`, cleanedText.substring(0, 50))

      // For local mode, start generating all pending messages immediately
      if (config.mode === 'local') {
        const allPendingMessages = messageQueue.current.filter((msg) => msg.status === 'pending')
        allPendingMessages.forEach((message) => {
          generateAudioForMessage(message) // Don't await - let them generate in parallel
        })
      }

      // Start processing if not already running
      if (!isProcessing.current) {
        processQueue()
      }

      return messageId
    },
    [processQueue, config.mode, generateAudioForMessage]
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

    // Clear the queue
    messageQueue.current = []
    nextExpectedId.current = globalId
    isProcessing.current = false

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

  const getQueueStatus = useCallback(() => {
    return {
      queueLength: messageQueue.current.length,
      isProcessing: isProcessing.current,
      nextExpectedId: nextExpectedId.current,
      messages: messageQueue.current.map((msg) => ({
        id: msg.id,
        status: msg.status,
        text: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '')
      }))
    }
  }, [])

  const actions = useMemo(() => ({
    speak,
    stopSpeaking,
    playAudioBuffer,
    getQueueStatus
  }), [speak, stopSpeaking, playAudioBuffer, getQueueStatus])
  
  return useMemo(() => ({
    isSpeaking: isProcessing,
    audioQueue: messageQueue.current.length,
    actions
  }), [isProcessing, messageQueue.current.length, actions])
  
}
