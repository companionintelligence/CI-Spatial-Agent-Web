import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {  defaultVadConfig, type VADConfig, type VADResult } from './vadConfig'
import { MicVAD } from '@ricky0123/vad-web'

// Type for VAD instance
interface VADInstance {
  start: () => void
  pause: () => void
  destroy?: () => void
}

interface VADProbs {
  isSpeech: number
}

interface UseVADServiceProps {
  config?: Partial<VADConfig>
  onVADResult?: (result: VADResult) => void
  onSpeechStart?: () => void
  onSpeechEnd?: (audio: ArrayBuffer) => void
}

export const useVADService = ({
  config: configPartial = {},
  onVADResult,
  onSpeechStart,
  onSpeechEnd
}: UseVADServiceProps = {}) => {
  const config = useMemo(() => ({ ...defaultVadConfig, ...configPartial }), [configPartial])

  const [isListening, setIsListening] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const vadRef = useRef<VADInstance | null>(null)
  const [vadInstance, setVadInstance] = useState<VADInstance | null>(null)


  useEffect(()=>{console.log("set listening" , isListening)},[isListening])
  const handleVADResult = useCallback(
    (result: VADResult) => {
      // console.log('VAD Result:', result)
      setIsDetecting(result.isSpeech)

      // Call callback if provided
      onVADResult?.(result)
    },
    [onVADResult]
  )

  const initializeVAD = useCallback(async () => {
    try {
      const originalWarn = console.warn
      console.warn = (...args) => {
        if (args[0]?.includes?.('onnxruntime') || 
            args[0]?.includes?.('Removing initializer')) {
          return // Suppress these warnings
        }
        originalWarn(...args)
      }

      const vad = await MicVAD.new({
        positiveSpeechThreshold: config.vadThreshold,
        minSpeechFrames: 5,
        preSpeechPadFrames: 10,
        model: 'v5',
        onFrameProcessed: (probs: VADProbs) => {
          if (probs.isSpeech && probs.isSpeech > config.vadThreshold) {
            handleVADResult({
              isSpeech: true,
              confidence: probs.isSpeech
            })
          }
        },
        onSpeechStart: () => {
          console.log('Speech started')
          setIsDetecting(true)
          onSpeechStart?.()
        },
        onSpeechEnd: (audio: Float32Array) => {
          //   console.log('Speech ended', audio)
          setIsDetecting(false)

          // Convert Float32Array to ArrayBuffer for compatibility
          const buffer = new ArrayBuffer(audio.length * 4)
          const view = new Float32Array(buffer)
          view.set(audio)

          handleVADResult({
            isSpeech: false,
            confidence: 1.0,
            audio: buffer
          })

          onSpeechEnd?.(buffer)
        }
      })
      console.warn = originalWarn
      vadRef.current = vad
      setVadInstance(vad)
    } catch (error) {
      console.error('Failed to initialize VAD:', error)
    }
  }, [config.vadThreshold, handleVADResult, onSpeechStart, onSpeechEnd])

  const startListening = useCallback(async () => {
    if (!vadInstance) {
      await initializeVAD()
    }

    if (vadRef.current) {
      try {
        vadRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Failed to start VAD:', error)
      }
    }
  }, [vadInstance, initializeVAD])

  const stopListening = useCallback(() => {
    if (vadRef.current) {
      try {
        vadRef.current.pause()
        setIsListening(false)
        setIsDetecting(false)
        console.log('VAD stopped listening')
      } catch (error) {
        console.error('Failed to stop VAD:', error)
      }
    }
  }, [])

  // Auto-start/stop based on microphone enabled setting
  useEffect(() => {
    if (config.microphoneEnabled && config.vadEnabled) {
      startListening()
    } else {
      stopListening()
    }
  }, [config.microphoneEnabled, config.vadEnabled, startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadRef.current) {
        vadRef.current.pause()
      }
    }
  }, [])

  const actions = useMemo(
    () => ({
      startListening,
      stopListening,
      initializeVAD
    }),
    [startListening, stopListening, initializeVAD]
  )

  const state = useMemo(() => ({
    isListening,
    isDetecting
  }), [isListening, isDetecting])

  return useMemo(
    () => ({
      state,
      actions
    }),
    [state, actions]
  )
}
