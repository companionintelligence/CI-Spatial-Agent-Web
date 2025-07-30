import { useState, useCallback } from 'react'
import type { TTSConfig } from './audioTypes'
import { defaultTTSConfig } from './audioTypes'

export const useTTSService = () => {
  const [config, setConfig] = useState<TTSConfig>(defaultTTSConfig)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([])

  const speakLocal = useCallback(async (text: string): Promise<void> => {
    // Use Web Speech API for local TTS
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      
      // Configure voice
      const voices = speechSynthesis.getVoices()
      const voice = voices.find(v => v.name.includes('en')) || voices[0]
      if (voice) utterance.voice = voice

      utterance.rate = config.speed
      utterance.pitch = config.pitch
      utterance.volume = config.volume

      utterance.onend = () => {
        console.log('TTS: Finished speaking')
        resolve()
      }

      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error)
        reject(new Error(event.error))
      }

      speechSynthesis.speak(utterance)
    })
  }, [config.speed, config.pitch, config.volume])

  const speakRemote = useCallback(async (text: string): Promise<void> => {
    // Placeholder for remote TTS implementation
    // This would integrate with OpenAI TTS, ElevenLabs, etc.
    console.log('Remote TTS not implemented yet, falling back to local')
    return speakLocal(text)
  }, [speakLocal])

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return

    try {
      setIsSpeaking(true)
      console.log('TTS: Speaking text:', text)

      if (config.remote) {
        // Use remote TTS service (OpenAI, ElevenLabs, etc.)
        await speakRemote(text)
      } else {
        // Use local TTS (Web Speech API or local service)
        await speakLocal(text)
      }
    } catch (error) {
      console.error('TTS Error:', error)
    } finally {
      setIsSpeaking(false)
    }
  }, [config.remote, speakLocal, speakRemote])

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    setIsSpeaking(false)
    console.log('TTS: Stopped speaking')
  }, [])

  const playAudioBuffer = useCallback(async (audioBuffer: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audioContext = new AudioContext()
      
      audioContext.decodeAudioData(audioBuffer.slice(0))
        .then(decodedAudio => {
          const source = audioContext.createBufferSource()
          source.buffer = decodedAudio
          source.connect(audioContext.destination)
          
          source.onended = () => {
            console.log('Audio playback finished')
            resolve()
          }
          
          source.start(0)
        })
        .catch(error => {
          console.error('Audio decode error:', error)
          reject(error)
        })
    })
  }, [])

  const addToQueue = useCallback((audioBuffer: ArrayBuffer) => {
    setAudioQueue(prev => [...prev, audioBuffer])
  }, [])

  const processQueue = useCallback(async () => {
    if (audioQueue.length === 0 || isSpeaking) return

    setIsSpeaking(true)
    
    try {
      while (audioQueue.length > 0) {
        const audioBuffer = audioQueue[0]
        await playAudioBuffer(audioBuffer)
        setAudioQueue(prev => prev.slice(1))
      }
    } catch (error) {
      console.error('Queue processing error:', error)
    } finally {
      setIsSpeaking(false)
    }
  }, [audioQueue, isSpeaking, playAudioBuffer])

  const updateConfig = useCallback((newConfig: Partial<TTSConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
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
