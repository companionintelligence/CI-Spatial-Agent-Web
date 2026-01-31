import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultSTTConfig, type STTConfig } from './sttConfig'


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
  config?: Partial<STTConfig>
  onPerform?: (result: STTPerformResult) => void
  onInterimTranscript?: (text: string) => void
}

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

interface ExtendedSpeechRecognition extends BaseSpeechRecognition {
  start2: () => void
  stop2: () => void
  kick: (event?: Event) => void
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: { new (): BaseSpeechRecognition }
  webkitSpeechRecognition?: { new (): BaseSpeechRecognition }
}

export const useSTTService = ({
  config: configPartial = {},
  onPerform,
  onInterimTranscript
}: UseSTTServiceProps = {}) => {
  const config = { ...defaultSTTConfig, ...configPartial }
  const [isListening, setIsListening] = useState(false)
  const [allowed, setAllowed] = useState(true)
  const [desired, setDesired] = useState(false)

  const recognitionRef = useRef<ExtendedSpeechRecognition | null>(null)
  const rcounterRef = useRef(1)
  const bcounterRef = useRef(1)
  const activeRef = useRef(false)
  const retryRef = useRef({ count: 0, timerId: 0 as number | undefined })

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

    recognition.lang = config.language
    recognition.continuous = config.continuous
    recognition.interimResults = true

    const start2 = () => {
      if (activeRef.current) return
      try {
        recognition.start()
      } catch {
        console.error('STT: recognizer started but with error')
      }
      activeRef.current = true
    }

    const stop2 = () => {
      if (!activeRef.current) return
      try {
        recognition.stop()
      } catch {
        console.error('STT: recognizer stopped but with error')
      }
      activeRef.current = false
    }

    const kick = (event?: Event) => {
      const anyEvent = event as unknown as { error?: string; message?: string }
      const errorType = anyEvent?.error

      if (event) {
        console.error('STT: speech recognition error, restarting', { error: errorType, event })
      }

      // Stop current session safely
      try {
        recognition.stop()
      } catch {
        // ignore stop errors
      }

      // Decide backoff based on error type
      let delayMs = 200
      let shouldRestart = desired && allowed

      switch (errorType) {
        case 'not-allowed':
        case 'service-not-allowed':
          // Permission denied or service not allowed – do not loop
          setAllowed(false)
          activeRef.current = false
          shouldRestart = false
          break
        case 'audio-capture':
          // No microphone available
          setAllowed(false)
          activeRef.current = false
          shouldRestart = false
          break
        case 'network':
          // Exponential backoff for transient network failures
          retryRef.current.count = Math.min(retryRef.current.count + 1, 6)
          delayMs = Math.min(200 * Math.pow(2, retryRef.current.count), 10000)
          // If offline, wait for connectivity
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            shouldRestart = false
            window.addEventListener(
              'online',
              () => {
                if (desired && allowed) {
                  recognition.start2()
                }
              },
              { once: true }
            )
          }
          break
        case 'no-speech':
        case 'aborted':
        default:
          // Quick restart for benign/transient issues
          retryRef.current.count = 0
          delayMs = 200
          break
      }

      // Clear any pending restart
      if (retryRef.current.timerId) {
        clearTimeout(retryRef.current.timerId)
        retryRef.current.timerId = undefined
      }

      if (!shouldRestart) return

      // Schedule restart guarded by desired/allowed flags
      retryRef.current.timerId = window.setTimeout(() => {
        if (desired && allowed) {
          recognition.start2?.()
        }
      }, delayMs)
    }

    recognition.onerror = kick

    recognition.onstart = () => {
      setIsListening(true)
      activeRef.current = true
      // Reset backoff on successful start
      retryRef.current.count = 0
    }

    recognition.onend = () => {
      setIsListening(false)
      activeRef.current = false
    }

    recognition.onresult = (event: SpeechRecognitionEventType) => {
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

        onPerform?.(performResult)

        if (!final) {
          onInterimTranscript?.(text.trim())
          bcounterRef.current++
        } else {
          onInterimTranscript?.('')
          rcounterRef.current++
          bcounterRef.current = 1
          kick()
        }
      }
    }

    recognition.start2 = start2
    recognition.stop2 = stop2
    recognition.kick = kick

    recognitionRef.current = recognition
  }, [desired, allowed, onPerform, onInterimTranscript, config.continuous, config.language])

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

  const setDesiredState = useCallback(
    (state: boolean) => {
      setDesired(state)
      if (state) {
        initRecognition()
      }
    },
    [initRecognition]
  )

  useEffect(() => {
    updateListening()
  }, [updateListening])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop2?.()
      }
    }
  }, [])


  const state = useMemo(() => ({
    isListening,
    allowed,
    desired
  }), [isListening, allowed, desired])

  const actions = useMemo(
    () => ({
      setAllowed: setAllowedState,
      setDesired: setDesiredState,
      startListening: () => setDesiredState(true),
      stopListening: () => setDesiredState(false)
    }),
    [setAllowedState, setDesiredState]
  )

  return useMemo(
    () => ({
      state,
      actions
    }),
    [state, actions]
  )
}
