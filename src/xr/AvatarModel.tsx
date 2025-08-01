import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { createSimpleStore, useSimpleStore } from '../utils/SimpleStore'

export const AvatarState = createSimpleStore({
  selectedAnimation: '/assets/animations/idle.glb',
  selectedModel: '/assets/avatars/25-1-3_CI_model_female_Shanee.glb'
})

export const AvatarModel = () => {
  const [state] = useSimpleStore(AvatarState)

  const { selectedAnimation, selectedModel } = state
  const { scene: avatarScene } = useGLTF(selectedModel)
  const { animations } = useGLTF(selectedAnimation)

  const { actions, mixer } = useAnimations(animations, avatarScene)

  useEffect(() => {
    if (!actions || !Object.keys(actions).length) return

    const actionNames = Object.keys(actions)
    const actionName = actionNames[0]
    const action = actions[actionName]

    if (!action) return

    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.play()
    return () => {
      action.stop()
    }
  }, [actions, avatarScene])

  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta)
    }
  })

  return <primitive object={avatarScene} />
}

useGLTF.preload('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
useGLTF.preload('/assets/animations/idle.glb')
