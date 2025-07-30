import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

interface SimpleAvatarProps {
  position: [number, number, number]
}

export const SimpleAvatar = ({ position }: SimpleAvatarProps) => {
  const group = useRef<THREE.Group>(null)
  
  // Try loading an avatar that has built-in animations
  const { scene, animations } = useGLTF('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
  const { actions, mixer } = useAnimations(animations, group)

  useEffect(() => {
    console.log('Avatar animations:', animations?.map(anim => anim.name))
    console.log('Avatar actions:', Object.keys(actions))
    
    // If avatar has built-in animations, use those
    if (animations && animations.length > 0) {
      const firstAnimation = animations[0]
      const action = mixer?.clipAction(firstAnimation)
      if (action) {
        action.play()
        action.setLoop(THREE.LoopRepeat, Infinity)
        console.log('Playing built-in animation:', firstAnimation.name)
      }
    }
  }, [animations, actions, mixer])

  useFrame((_, delta) => {
    if (mixer) mixer.update(delta)
  })

  return (
    <group ref={group} position={position}>
      <primitive object={scene.clone()} />
    </group>
  )
}

useGLTF.preload('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
