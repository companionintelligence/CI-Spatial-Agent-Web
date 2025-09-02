/**
 * Camera Service Types
 * 
 * Type definitions for camera service functionality
 */

export interface CameraState {
  isInitialized: boolean
  isStreaming: boolean
  hasPermission: boolean
  stream: MediaStream | null
  videoElement: HTMLVideoElement | null
  error: string | null
  deviceInfo: MediaDeviceInfo | null
}

export interface CameraFrame {
  timestamp: number
  imageData: string  // base64 encoded image
  width: number
  height: number
  format: string
}

export interface CameraAnalysisResult {
  timestamp: number
  faces?: FaceDetectionResult[]
  emotions?: EmotionResult[]
  gestures?: GestureResult[]
  attention?: AttentionResult
}

export interface FaceDetectionResult {
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
  landmarks?: FaceLandmark[]
}

export interface FaceLandmark {
  type: 'eye' | 'nose' | 'mouth' | 'eyebrow' | 'cheek'
  position: { x: number; y: number }
  confidence: number
}

export interface EmotionResult {
  emotion: 'happy' | 'sad' | 'angry' | 'surprised' | 'fear' | 'disgust' | 'neutral'
  confidence: number
}

export interface GestureResult {
  gesture: string
  confidence: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface AttentionResult {
  isLooking: boolean
  gazeDirection?: { x: number; y: number }
  headPose?: { yaw: number; pitch: number; roll: number }
  attentionScore: number  // 0-1 how focused on camera
}

export interface CameraStatusUpdate {
  status: 'initializing' | 'ready' | 'streaming' | 'processing' | 'error' | 'stopped'
  message: string
}

export interface CameraBackendResponse {
  success: boolean
  timestamp: number
  analysis?: CameraAnalysisResult
  error?: string
  processedFrameUrl?: string
}

export type CameraEventType = 
  | 'frame_captured'
  | 'analysis_received' 
  | 'backend_response'
  | 'permission_granted'
  | 'permission_denied'
  | 'stream_started'
  | 'stream_stopped'
  | 'error'