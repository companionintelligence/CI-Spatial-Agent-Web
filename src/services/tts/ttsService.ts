import { useCallback, useMemo, useState } from 'react'
import type { TTSConfigPartial, WhisperData } from '../audioTypes'
import { defaultTTSConfig } from '../audioTypes'
import { approximateWhisperDataFromText } from './whisperDataGenerator'

interface TTSServiceOptions {
  config?: TTSConfigPartial
  onSpeechStart?: (text: string, whisperData: WhisperData) => void
  onSpeechEnd?: () => void
}

export const useTTSService = (options: TTSServiceOptions = {}) => {
  const { config: configPartial = {}, onSpeechStart, onSpeechEnd } = options
  const config = useMemo(() => ({ ...defaultTTSConfig, ...configPartial }), [configPartial])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([])

  const speakLocal = useCallback(
    async (text: string) => {
      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported')
      }

      // Clean up text
      const cleanText = text.replace(/[*<>#%-]/g, '')
      if (!cleanText.trim()) return

      const utterance = new SpeechSynthesisUtterance(cleanText)

      /** @todo for the very first utterance, there appear to be no voices registered. maybe a chrome bug? for now just use system default */
      // const voices = speechSynthesis.getVoices()
      // console.log('Available voices:', voices)
      // const voice = voices.find((v) => v.lang === 'en-US') || voices[0]
      // if (voice) utterance.voice = voice

      utterance.rate = config.speed
      utterance.pitch = config.pitch
      utterance.volume = config.volume

      // Generate whisper data for visemes
      const whisperData = approximateWhisperDataFromText(cleanText, config.speed, 0)

      // Notify speech start with whisper data
      if (onSpeechStart) {
        onSpeechStart(cleanText, whisperData)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }

      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error)
        setIsSpeaking(false)
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }

      speechSynthesis.speak(utterance)
    },
    [config.speed, config.pitch, config.volume, onSpeechStart, onSpeechEnd]
  )

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

        setIsSpeaking(false)
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      } catch (error) {
        console.error('Remote TTS Error:', error)
        setIsSpeaking(false)
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
        setIsSpeaking(true)
        if (config.remote) {
          speakRemote(text)
        } else {
          speakLocal(text)
        }
      } catch (error) {
        console.error('TTS Error:', error)
        setIsSpeaking(false)
        // Call speech end callback if there's an error during speech initiation
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }
    },
    [config.remote, speakLocal, speakRemote, onSpeechEnd]
  )

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    setIsSpeaking(false)

    // Call speech end callback when speech is stopped
    if (onSpeechEnd) {
      onSpeechEnd()
    }
  }, [onSpeechEnd])

  const addToQueue = useCallback((audioBuffer: ArrayBuffer) => {
    setAudioQueue((prev) => [...prev, audioBuffer])
  }, [])

  const processQueue = useCallback(async () => {
    if (audioQueue.length === 0 || isSpeaking) return

    setIsSpeaking(true)

    try {
      while (audioQueue.length > 0) {
        const audioBuffer = audioQueue[0]
        await playAudioBuffer(audioBuffer)
        setAudioQueue((prev) => prev.slice(1))
      }
    } catch (error) {
      console.error('Queue processing error:', error)
    } finally {
      setIsSpeaking(false)
      // Call speech end callback when queue processing is complete
      if (onSpeechEnd) {
        onSpeechEnd()
      }
    }
  }, [audioQueue, isSpeaking, playAudioBuffer, onSpeechEnd])

  return {
    isSpeaking,
    audioQueue: audioQueue.length,
    actions: {
      speak,
      stopSpeaking,
      playAudioBuffer,
      addToQueue,
      processQueue
    }
  }
}
