/**
 * WebXR Scene Understanding Services
 * Main exports for WebXR scene understanding functionality
 */

export { WebXRSceneUnderstanding } from './sceneUnderstanding'
export type { SceneAnchor, SceneLocation } from './sceneUnderstanding'

export { XRLocationDatabase } from './locationDatabase'

export { CIServerIntegration } from './ciServerIntegration'
export type { ImageAnalysisRequest, ImageAnalysisResponse } from './ciServerIntegration'

export { useWebXRSceneUnderstanding } from './useWebXRSceneUnderstanding'
export type { 
  UseWebXRSceneUnderstandingOptions, 
  WebXRSceneUnderstandingState 
} from './useWebXRSceneUnderstanding'