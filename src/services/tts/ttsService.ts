import { useCallback, useState } from 'react'
import type { TTSConfig, WhisperData } from '../audioTypes'
import { defaultTTSConfig } from '../audioTypes'
import { approximateWhisperDataFromText } from './whisperDataGenerator'

interface TTSServiceOptions {
  onSpeechStart?: (text: string, whisperData: WhisperData) => void
  onSpeechEnd?: () => void
}

export const useTTSService = (options: TTSServiceOptions = {}) => {
  const [config, setConfig] = useState<TTSConfig>(defaultTTSConfig)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([])

  const { onSpeechStart, onSpeechEnd } = options

  const speakLocal = useCallback(
    async (text: string) => {
      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported')
      }

      const utterance = new SpeechSynthesisUtterance(text)

      /** @todo for the very first utterance, there appear to be no voices registered. maybe a chrome bug? for now just use system default */
      // const voices = speechSynthesis.getVoices()
      // console.log('Available voices:', voices)
      // const voice = voices.find((v) => v.lang === 'en-US') || voices[0]
      // if (voice) utterance.voice = voice

      utterance.rate = config.speed
      utterance.pitch = config.pitch
      utterance.volume = config.volume

      // Generate whisper data for visemes
      const whisperData = approximateWhisperDataFromText(text, config.speed, 0)

      // Notify speech start with whisper data
      if (onSpeechStart) {
        onSpeechStart(text, whisperData)
      }

      utterance.onend = () => {
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }

      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error)
        if (onSpeechEnd) {
          onSpeechEnd()
        }
      }

      speechSynthesis.speak(utterance)
    },
    [config.speed, config.pitch, config.volume, onSpeechStart, onSpeechEnd]
  )

  const speakRemote = useCallback(async (_text: string) => {
    console.warn('Remote TTS not implemented yet')
  }, [])

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
      } finally {
        setIsSpeaking(false)
      }
    },
    [config.remote, speakLocal, speakRemote]
  )

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    setIsSpeaking(false)
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
            console.log('Audio playback finished')
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
    }
  }, [audioQueue, isSpeaking, playAudioBuffer])

  const updateConfig = useCallback((newConfig: Partial<TTSConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }))
  }, [])

  return {
    config,
    isSpeaking,
    audioQueue: audioQueue.length,
    actions: {
      speak,
      stopSpeaking,
      playAudioBuffer,
      addToQueue,
      processQueue,
      updateConfig
    }
  }
}
