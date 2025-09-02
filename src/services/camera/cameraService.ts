/**
 * Camera Service - Webcam Capture and Backend Integration
 *
 * This service provides webcam access and can send camera frames to backend APIs
 * for analysis. It's designed to integrate with the existing service architecture
 * and complement the existing 3D scene camera used for gaze tracking.
 *
 * Features:
 * - Webcam capture with configurable quality settings
 * - Backend API integration for frame analysis
 * - Real-time frame processing and transmission
 * - Privacy controls (background blur, face detection only)
 * - Integration with existing emotion and attention systems
 *
 * Usage:
 * - Initialize camera access
 * - Configure capture settings and backend endpoints
 * - Stream frames to backend for processing
 * - Receive analysis results for avatar interaction
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { CameraConfig } from './cameraConfig'
import type { 
  CameraState, 
  CameraFrame, 
  CameraAnalysisResult, 
  CameraStatusUpdate, 
  CameraBackendResponse,
  CameraEventType 
} from './cameraTypes'

type CameraServiceProps = {
  config?: Partial<CameraConfig>
  onStatusUpdate?: (status: CameraStatusUpdate) => void
  onFrame?: (frame: CameraFrame) => void
  onAnalysis?: (analysis: CameraAnalysisResult) => void
  onBackendResponse?: (response: CameraBackendResponse) => void
}

export const useCameraService = ({ 
  config: configPartial = {}, 
  onStatusUpdate,
  onFrame,
  onAnalysis,
  onBackendResponse
}: CameraServiceProps) => {
  const config = useMemo(() => ({ 
    enabled: false,
    width: 640,
    height: 480,
    frameRate: 15,
    facingMode: 'user' as const,
    backend_enabled: false,
    backend_url: '',
    backend_api_key: '',
    capture_interval: 1000,
    image_format: 'jpeg' as const,
    image_quality: 0.8,
    send_full_frames: true,
    send_analysis_only: false,
    blur_background: false,
    face_detection_only: false,
    ...configPartial 
  }), [configPartial])

  const [state, setState] = useState<CameraState>({
    isInitialized: false,
    isStreaming: false,
    hasPermission: false,
    stream: null,
    videoElement: null,
    error: null,
    deviceInfo: null
  })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureIntervalRef = useRef<number | null>(null)

  // Create canvas for frame capture if it doesn't exist
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
      canvasRef.current.width = config.width || 640
      canvasRef.current.height = config.height || 480
    }
    return canvasRef.current
  }, [config.width, config.height])

  // Initialize camera access
  const initialize = useCallback(async () => {
    if (!config.enabled || state.isInitialized) return

    setState(prev => ({ ...prev, error: null }))
    
    onStatusUpdate?.({
      status: 'initializing',
      message: 'Requesting camera access...'
    })

    try {
      // Check for camera permission
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      if (videoDevices.length === 0) {
        throw new Error('No camera devices found')
      }

      // Request camera stream
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate },
          facingMode: config.facingMode
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Create video element
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.muted = true
      video.playsInline = true

      // Wait for video metadata to load
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve()
      })

      setState(prev => ({
        ...prev,
        isInitialized: true,
        hasPermission: true,
        stream,
        videoElement: video,
        deviceInfo: videoDevices[0]
      }))

      onStatusUpdate?.({
        status: 'ready',
        message: 'Camera initialized successfully'
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize camera'
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        hasPermission: false
      }))

      onStatusUpdate?.({
        status: 'error',
        message: errorMessage
      })
    }
  }, [config, state.isInitialized, onStatusUpdate])

  // Start streaming and capturing frames
  const startStreaming = useCallback(async () => {
    if (!state.isInitialized || !state.videoElement || state.isStreaming) return

    setState(prev => ({ ...prev, isStreaming: true }))

    onStatusUpdate?.({
      status: 'streaming',
      message: 'Camera streaming started'
    })

    // Start periodic frame capture
    if (config.backend_enabled && config.backend_url) {
      captureIntervalRef.current = window.setInterval(() => {
        captureFrame()
      }, config.capture_interval || 1000)
    }

  }, [state.isInitialized, state.videoElement, state.isStreaming, config.backend_enabled, config.backend_url, config.capture_interval])

  // Capture a single frame from video
  const captureFrame = useCallback(async (): Promise<CameraFrame | null> => {
    if (!state.videoElement) return null

    const canvas = getCanvas()
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    try {
      // Draw current video frame to canvas
      ctx.drawImage(state.videoElement, 0, 0, canvas.width, canvas.height)

      // Convert to base64
      const mimeType = `image/${config.image_format}`
      const imageData = canvas.toDataURL(mimeType, config.image_quality)

      const frame: CameraFrame = {
        timestamp: Date.now(),
        imageData,
        width: canvas.width,
        height: canvas.height,
        format: config.image_format || 'jpeg'
      }

      onFrame?.(frame)

      // Send to backend if enabled
      if (config.backend_enabled && config.backend_url) {
        sendFrameToBackend(frame)
      }

      return frame

    } catch (error) {
      console.error('Failed to capture frame:', error)
      return null
    }
  }, [state.videoElement, getCanvas, config.image_format, config.image_quality, config.backend_enabled, config.backend_url, onFrame])

  // Send frame to backend API
  const sendFrameToBackend = useCallback(async (frame: CameraFrame) => {
    if (!config.backend_url) return

    try {
      const payload = {
        timestamp: frame.timestamp,
        image: frame.imageData,
        width: frame.width,
        height: frame.height,
        format: frame.format,
        options: {
          send_full_frames: config.send_full_frames,
          send_analysis_only: config.send_analysis_only,
          blur_background: config.blur_background,
          face_detection_only: config.face_detection_only
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (config.backend_api_key) {
        headers['Authorization'] = `Bearer ${config.backend_api_key}`
      }

      const response = await fetch(config.backend_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
      }

      const result: CameraBackendResponse = await response.json()
      
      onBackendResponse?.(result)

      if (result.analysis) {
        onAnalysis?.(result.analysis)
      }

    } catch (error) {
      console.error('Failed to send frame to backend:', error)
      onBackendResponse?.({
        success: false,
        timestamp: frame.timestamp,
        error: error instanceof Error ? error.message : 'Backend request failed'
      })
    }
  }, [config.backend_url, config.backend_api_key, config.send_full_frames, config.send_analysis_only, config.blur_background, config.face_detection_only, onBackendResponse, onAnalysis])

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }

    setState(prev => ({ ...prev, isStreaming: false }))

    onStatusUpdate?.({
      status: 'stopped',
      message: 'Camera streaming stopped'
    })
  }, [onStatusUpdate])

  // Cleanup resources
  const cleanup = useCallback(() => {
    stopStreaming()

    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop())
    }

    setState({
      isInitialized: false,
      isStreaming: false,
      hasPermission: false,
      stream: null,
      videoElement: null,
      error: null,
      deviceInfo: null
    })
  }, [stopStreaming, state.stream])

  // Auto-initialize when enabled
  useEffect(() => {
    if (config.enabled && !state.isInitialized) {
      initialize()
    }
  }, [config.enabled, state.isInitialized, initialize])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const actions = useMemo(() => ({
    initialize,
    startStreaming,
    stopStreaming,
    captureFrame,
    cleanup
  }), [initialize, startStreaming, stopStreaming, captureFrame, cleanup])

  const getters = useMemo(() => ({
    getState: () => state,
    isReady: () => state.isInitialized && state.hasPermission,
    isStreaming: () => state.isStreaming
  }), [state])

  return {
    state,
    actions,
    getters
  }
}