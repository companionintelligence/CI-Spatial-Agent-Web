/**
 * Camera Service Configuration
 * 
 * Configuration for webcam capture and backend API integration.
 * Supports various backends and video quality settings.
 */

export interface CameraConfig {
  // Camera capture settings
  enabled?: boolean
  width?: number
  height?: number
  frameRate?: number
  facingMode?: 'user' | 'environment'
  
  // Backend API settings
  backend_enabled?: boolean
  backend_url?: string
  backend_api_key?: string
  
  // Frame processing settings
  capture_interval?: number  // milliseconds between captures
  image_format?: 'jpeg' | 'png' | 'webp'
  image_quality?: number     // 0.0 to 1.0 for compression
  
  // Processing options
  send_full_frames?: boolean
  send_analysis_only?: boolean
  
  // Privacy settings
  blur_background?: boolean
  face_detection_only?: boolean
}

export const defaultCameraConfig: CameraConfig = {
  enabled: import.meta.env.VITE_CAMERA_ENABLED === 'true' || false,
  width: parseInt(import.meta.env.VITE_CAMERA_WIDTH || '640'),
  height: parseInt(import.meta.env.VITE_CAMERA_HEIGHT || '480'),
  frameRate: parseInt(import.meta.env.VITE_CAMERA_FRAMERATE || '15'),
  facingMode: 'user',
  
  backend_enabled: import.meta.env.VITE_CAMERA_BACKEND_ENABLED === 'true' || false,
  backend_url: import.meta.env.VITE_CAMERA_BACKEND_URL || '',
  backend_api_key: import.meta.env.VITE_CAMERA_BACKEND_API_KEY || '',
  
  capture_interval: parseInt(import.meta.env.VITE_CAMERA_CAPTURE_INTERVAL || '1000'), // 1 second
  image_format: (import.meta.env.VITE_CAMERA_IMAGE_FORMAT as 'jpeg' | 'png' | 'webp') || 'jpeg',
  image_quality: parseFloat(import.meta.env.VITE_CAMERA_IMAGE_QUALITY || '0.8'),
  
  send_full_frames: import.meta.env.VITE_CAMERA_SEND_FULL_FRAMES === 'true' || true,
  send_analysis_only: import.meta.env.VITE_CAMERA_SEND_ANALYSIS_ONLY === 'true' || false,
  
  blur_background: import.meta.env.VITE_CAMERA_BLUR_BACKGROUND === 'true' || false,
  face_detection_only: import.meta.env.VITE_CAMERA_FACE_DETECTION_ONLY === 'true' || false
}