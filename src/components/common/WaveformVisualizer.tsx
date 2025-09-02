import { useEffect, useRef, useCallback } from 'react'

interface WaveformVisualizerProps {
  isActive: boolean
  isDetecting: boolean
  canvasId?: string
  width?: number
  height?: number
}

export const WaveformVisualizer = ({
  isActive,
  isDetecting,
  canvasId = 'waveform-canvas',
  width = 200,
  height = 60
}: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current
    
    if (!canvas || !analyser || !dataArray) {
      return
    }

    const canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    animationIdRef.current = requestAnimationFrame(draw)

    if (isActive && isDetecting) {
      analyser.getByteFrequencyData(dataArray)
    } else {
      // Fade out the waveform when not detecting
      for (let i = 0; i < dataArray.length; i++) {
        dataArray[i] = Math.max(0, dataArray[i] * 0.95)
      }
    }

    // Clear canvas with background
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw waveform
    const barWidth = canvas.width / dataArray.length
    let x = 0

    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height * 0.8
      
      // Color based on detection state
      const intensity = dataArray[i] + 50
      if (isDetecting) {
        canvasCtx.fillStyle = `rgb(19, 196, 209, ${Math.min(1, intensity / 255)})`
      } else {
        canvasCtx.fillStyle = `rgb(${Math.min(255, intensity)}, ${Math.min(255, intensity * 0.7)}, ${Math.min(255, intensity * 0.5)}, 0.6)`
      }
      
      const y = canvas.height / 2
      // Draw bars from center outwards
      canvasCtx.fillRect(x, y - barHeight / 2, barWidth * 0.8, barHeight)
      
      x += barWidth
    }
  }, [isActive, isDetecting])

  const initializeAudioContext = useCallback(async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream

      // Create audio context and analyser
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      
      source.connect(analyser)
      
      analyser.fftSize = 256
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      sourceRef.current = source
      dataArrayRef.current = dataArray
      
      // Start drawing
      draw()
      
    } catch (error) {
      console.error('Failed to initialize audio context for waveform:', error)
    }
  }, [draw])

  const cleanup = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current)
      animationIdRef.current = null
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    analyserRef.current = null
    dataArrayRef.current = null
  }, [])

  // Initialize/cleanup based on isActive state
  useEffect(() => {
    if (isActive) {
      initializeAudioContext()
    } else {
      cleanup()
    }

    return cleanup
  }, [isActive, initializeAudioContext, cleanup])

  // Clean up on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  if (!isActive) {
    return null
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '0.5rem'
      }}
    >
      <canvas
        ref={canvasRef}
        id={canvasId}
        width={width}
        height={height}
        style={{
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          opacity: isActive ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      />
    </div>
  )
}