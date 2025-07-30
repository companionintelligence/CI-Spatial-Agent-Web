import { useState, useCallback, useRef, useEffect } from 'react'
import type { STTConfig } from './audioTypes'
import { defaultSTTConfig } from './audioTypes'

interface STTPerformResult {
  text: string
  interrupt: number
  confidence: number
  spoken: boolean
  human: boolean
  comment: string
  rcounter: number
  bcounter: number
  final: boolean
  bargein: boolean
}

interface UseSTTServiceProps {
  onPerform?: (result: STTPerformResult) => void
  onInterimTranscript?: (text: string) => void
}

// Define SpeechRecognition types since they might not be available globally
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
  length: number
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
}

interface SpeechRecognitionEventType {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface BaseSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEventType) => void) | null
}

// Extended SpeechRecognition interface with our custom methods
interface ExtendedSpeechRecognition extends BaseSpeechRecognition {
  start2: () => void
  stop2: () => void
  kick: (event?: Event) => void
}

// Window interface for SpeechRecognition
interface WindowWithSpeech extends Window {
  SpeechRecognition?: { new(): BaseSpeechRecognition }
  webkitSpeechRecognition?: { new(): BaseSpeechRecognition }
}

export const useSTTService = ({ onPerform, onInterimTranscript }: UseSTTServiceProps = {}) => {
  const [config, setConfig] = useState<STTConfig>(defaultSTTConfig)
  const [isListening, setIsListening] = useState(false)
  const [allowed, setAllowed] = useState(true) // corresponds to noisy config (inverted)
  const [desired, setDesired] = useState(false) // corresponds to microphone config
  
  const recognitionRef = useRef<ExtendedSpeechRecognition | null>(null)
  const rcounterRef = useRef(1)
  const bcounterRef = useRef(1)
  const activeRef = useRef(false)

  const initRecognition = useCallback(() => {
    if (recognitionRef.current) return

    const windowWithSpeech = window as WindowWithSpeech

    if (!windowWithSpeech.webkitSpeechRecognition && !windowWithSpeech.SpeechRecognition) {
      console.error('STT: Speech recognition not supported in this browser')
      return
    }

    const SpeechRecognitionClass = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      console.error('STT: Speech recognition constructor not found')
      return
    }
    
    const recognition = new SpeechRecognitionClass() as ExtendedSpeechRecognition

    // Configure recognition exactly like the archive
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    // Add custom start2 method
    const start2 = () => {
      if (activeRef.current) return
      try {
        recognition.start()
        // console.log('STT: recognizer start')
      } catch {
        console.error('STT: recognizer started but with error')
      }
      activeRef.current = true
    }

    // Add custom stop2 method  
    const stop2 = () => {
      if (!activeRef.current) return
      try {
        recognition.stop()
        // console.log('STT: recognizer stopped')
      } catch {
        console.error('STT: recognizer stopped but with error')
      }
      activeRef.current = false
    }

    // Add kick method for auto-restart
    const kick = (event?: Event) => {
      if (event) {
        console.error('STT: speech recognition error, restarting', event)
      }
      recognition.stop()
      setTimeout(() => { 
        if (desired && allowed) {
          recognition.start() 
        }
      }, 200)
    }

    // Set up event handlers exactly like archive
    recognition.onerror = kick

    recognition.onstart = () => {
      setIsListening(true)
      activeRef.current = true
    }

    recognition.onend = () => {
      setIsListening(false)
      activeRef.current = false
    }

    // Handle results exactly like the archive
    recognition.onresult = (event: SpeechRecognitionEventType) => {
    console.log('STT: onresult event:', event)
      // Only process the first result like the archive (i < 1 condition)
      for (let i = event.resultIndex; i < 1 && i < event.results.length; ++i) {
        const data = event.results[i]
        const text = data[0].transcript
        const confidence = data[0].confidence || 1
        const final = data.isFinal
        const comment = `User vocalization ${bcounterRef.current} final ${final}`

        const performResult: STTPerformResult = {
          text: text.trim(),
          interrupt: performance.now(),
          confidence,
          spoken: true,
          human: true,
          comment,
          rcounter: rcounterRef.current,
          bcounter: bcounterRef.current,
          final,
          bargein: true
        }

        // Call the perform callback
        onPerform?.(performResult)

        // Call interim transcript callback for non-final results
        if (!final) {
          onInterimTranscript?.(text.trim())
          bcounterRef.current++
        } else {
          onInterimTranscript?.('')
          rcounterRef.current++
          bcounterRef.current = 1
          kick() // restart recognition after final result
        }
      }
    }

    // Store methods on the recognition object like the archive
    recognition.start2 = start2
    recognition.stop2 = stop2
    recognition.kick = kick

    recognitionRef.current = recognition
  }, [desired, allowed, onPerform, onInterimTranscript])

  const updateListening = useCallback(() => {
    if (!recognitionRef.current) return
    
    if (allowed && desired) {
      recognitionRef.current.start2()
    } else {
      recognitionRef.current.stop2()
    }
  }, [allowed, desired])

  const setAllowedState = useCallback((state: boolean) => {
    setAllowed(state)
  }, [])

  const setDesiredState = useCallback((state: boolean) => {
    setDesired(state)
    if (state) {
      initRecognition()
    }
  }, [initRecognition])

  // Update listening state when allowed/desired changes
  useEffect(() => {
    updateListening()
  }, [updateListening])

  const updateConfig = useCallback((newConfig: Partial<STTConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop2?.()
      }
    }
  }, [])

  return {
    config,
    isListening,
    allowed,
    desired,
    actions: {
      setAllowed: setAllowedState,
      setDesired: setDesiredState,
      updateConfig,
      // Legacy methods for compatibility
      startListening: () => setDesiredState(true),
      stopListening: () => setDesiredState(false),
    }
  }
}
