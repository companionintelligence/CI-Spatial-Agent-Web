export interface SceneConfig {
  near: number
  far: number
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  background?: number
  enableAxes?: boolean
  roomLighting?: boolean
}

export interface AvatarConfig {
  uuid: string
  modelUrl: string
  position: [number, number, number]
  animationUrl?: string
  visible: boolean
}

export interface LightConfig {
  type: 'directional' | 'ambient' | 'point'
  intensity: number
  color: number
  position?: [number, number, number]
}

export const defaultSceneConfig: SceneConfig = {
  near: 0.1,
  far: 100,
  cameraPosition: [0, 1.5, 1],
  cameraTarget: [0, 1.5, 0],
  background: 0x1a1a1a,
  roomLighting: true
}

export const defaultAvatarConfig: AvatarConfig = {
  uuid: 'alexandria',
  modelUrl: '/assets/avatars/25-1-3_CI_model_female_Shanee.glb',
  position: [0, 0, 0],
  animationUrl: '/assets/animations/basic-idle.glb',
  visible: true
}
