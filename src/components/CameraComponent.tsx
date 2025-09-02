/**
 * Camera Component - UI for camera feed and controls
 * 
 * Provides a UI interface for the camera service with preview and controls
 */

import { useCallback, useState, useEffect } from 'react'
import type { CameraConfig } from '../../services/camera/cameraConfig'
import type { CameraStatusUpdate, CameraAnalysisResult, CameraBackendResponse } from '../../services/camera/cameraTypes'
import { useCameraService } from '../../services/camera/cameraService'

interface CameraComponentProps {
  config: Partial<CameraConfig>
  onConfigChange?: (config: Partial<CameraConfig>) => void
  className?: string
  showPreview?: boolean
  showControls?: boolean
}

export const CameraComponent = ({ 
  config, 
  onConfigChange, 
  className = '',
  showPreview = true,
  showControls = true
}: CameraComponentProps) => {
  const [status, setStatus] = useState<CameraStatusUpdate | null>(null)
  const [lastAnalysis, setLastAnalysis] = useState<CameraAnalysisResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleStatusUpdate = useCallback((statusUpdate: CameraStatusUpdate) => {
    setStatus(statusUpdate)
  }, [])

  const handleAnalysis = useCallback((analysis: CameraAnalysisResult) => {
    setLastAnalysis(analysis)
  }, [])

  const handleBackendResponse = useCallback((response: CameraBackendResponse) => {
    console.log('Camera backend response:', response)
  }, [])

  const camera = useCameraService({
    config,
    onStatusUpdate: handleStatusUpdate,
    onAnalysis: handleAnalysis,
    onBackendResponse: handleBackendResponse
  })

  const handleToggleCamera = useCallback(() => {
    if (camera.getters.isStreaming()) {
      camera.actions.stopStreaming()
    } else if (camera.getters.isReady()) {
      camera.actions.startStreaming()
    } else {
      camera.actions.initialize()
    }
  }, [camera])

  const handleConfigToggle = useCallback((key: keyof CameraConfig) => {
    const newValue = !config[key]
    onConfigChange?.({ ...config, [key]: newValue })
  }, [config, onConfigChange])

  const getStatusColor = () => {
    switch (status?.status) {
      case 'ready':
      case 'streaming':
        return '#4ade80' // green
      case 'initializing':
      case 'processing':
        return '#fbbf24' // yellow
      case 'error':
        return '#f87171' // red
      default:
        return '#9ca3af' // gray
    }
  }

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'streaming':
        return '🎥'
      case 'ready':
        return '📷'
      case 'initializing':
        return '⏳'
      case 'processing':
        return '🔄'
      case 'error':
        return '❌'
      default:
        return '📷'
    }
  }

  return (
    <div className={`camera-component ${className}`} style={{
      background: 'rgba(15, 17, 19, 0.9)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '16px',
      color: '#ffffff',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: showControls || showPreview ? '12px' : '0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
          <span style={{ fontWeight: 500 }}>Camera</span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor()
          }} />
        </div>

        {showControls && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleToggleCamera}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: camera.getters.isStreaming() ? '#dc2626' : '#059669',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {camera.getters.isStreaming() ? 'Stop' : 'Start'}
            </button>
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'transparent',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      {status && (
        <div style={{
          padding: '8px',
          borderRadius: '6px',
          background: 'rgba(0, 0, 0, 0.3)',
          marginBottom: '12px',
          fontSize: '12px'
        }}>
          <div style={{ color: getStatusColor(), fontWeight: 500 }}>
            {status.status.toUpperCase()}
          </div>
          <div style={{ color: '#d1d5db', marginTop: '2px' }}>
            {status.message}
          </div>
        </div>
      )}

      {/* Video Preview */}
      {showPreview && camera.state.videoElement && camera.getters.isStreaming() && (
        <div style={{
          marginBottom: '12px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#000'
        }}>
          <video
            ref={(video) => {
              if (video && camera.state.videoElement) {
                // Mirror the video element content
                video.srcObject = camera.state.videoElement.srcObject
                video.autoplay = true
                video.muted = true
                video.playsInline = true
              }
            }}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '120px',
              objectFit: 'cover'
            }}
          />
        </div>
      )}

      {/* Expanded Controls */}
      {isExpanded && showControls && (
        <div style={{ marginTop: '12px' }}>
          {/* Configuration toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.backend_enabled || false}
                onChange={() => handleConfigToggle('backend_enabled')}
                style={{ margin: 0 }}
              />
              <span>Send to backend</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.blur_background || false}
                onChange={() => handleConfigToggle('blur_background')}
                style={{ margin: 0 }}
              />
              <span>Blur background</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.face_detection_only || false}
                onChange={() => handleConfigToggle('face_detection_only')}
                style={{ margin: 0 }}
              />
              <span>Face detection only</span>
            </label>
          </div>

          {/* Backend URL input */}
          {config.backend_enabled && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                Backend URL:
              </label>
              <input
                type="text"
                value={config.backend_url || ''}
                onChange={(e) => onConfigChange?.({ ...config, backend_url: e.target.value })}
                placeholder="https://api.example.com/camera"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: 'white',
                  fontSize: '12px'
                }}
              />
            </div>
          )}

          {/* Analysis results */}
          {lastAnalysis && (
            <div style={{
              marginTop: '12px',
              padding: '8px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.3)',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>Last Analysis:</div>
              {lastAnalysis.faces && lastAnalysis.faces.length > 0 && (
                <div>👤 {lastAnalysis.faces.length} face(s) detected</div>
              )}
              {lastAnalysis.emotions && lastAnalysis.emotions.length > 0 && (
                <div>😊 {lastAnalysis.emotions[0].emotion} ({(lastAnalysis.emotions[0].confidence * 100).toFixed(1)}%)</div>
              )}
              {lastAnalysis.attention && (
                <div>👁️ Attention: {(lastAnalysis.attention.attentionScore * 100).toFixed(1)}%</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}