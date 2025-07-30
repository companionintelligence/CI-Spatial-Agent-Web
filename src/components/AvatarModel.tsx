import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

interface AvatarModelProps {
  modelUrl: string
  animationUrl?: string
  position: [number, number, number]
  visible: boolean
}

export const AvatarModel = ({ modelUrl, animationUrl, position, visible }: AvatarModelProps) => {
  const group = useRef<THREE.Group>(null)
  
  // Load the main avatar model
  const { scene: avatarScene } = useGLTF(modelUrl)
  
  // Load animations separately
  const animUrl = animationUrl || '/assets/animations/basic-idle.glb'
  const { animations } = useGLTF(animUrl)
  
  // Use animations with the avatar group
  const { actions, mixer } = useAnimations(animations, group)

  // Debug and play animations
  useEffect(() => {
    console.log('Loaded animations:', animations?.map(anim => anim.name))
    console.log('Available actions:', Object.keys(actions))
    
    if (actions && Object.keys(actions).length > 0) {
      // Try to play the first available animation
      const actionNames = Object.keys(actions)
      const actionName = actionNames[0]
      const action = actions[actionName]
      
      if (action) {
        console.log(`Playing animation: ${actionName}`)
        action.reset()
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.clampWhenFinished = false
        action.play()
      }
    }
  }, [actions, animations])

  // Update animation mixer each frame
  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta)
    }
  })

  // Clone the scene to avoid issues with multiple instances
  const clonedScene = avatarScene.clone()

  return (
    <group ref={group} position={position} visible={visible}>
      <primitive object={clonedScene} />
    </group>
  )
}

// Preload assets
useGLTF.preload('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
useGLTF.preload('/assets/animations/basic-idle.glb')
