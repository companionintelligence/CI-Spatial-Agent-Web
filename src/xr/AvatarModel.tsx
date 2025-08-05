import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import { createSimpleStore, useSimpleStore } from '../utils/SimpleStore'

export const AvatarState = createSimpleStore({
  selectedAnimation: '/assets/animations/idle.glb',
  selectedModel: '/assets/avatars/25-1-3_CI_model_female_Shanee.glb',
  visemesEnabled: true
})

interface AvatarModelProps {
  visemeService?: ReturnType<typeof useVisemeService>
}

export const AvatarModel = ({ visemeService }: AvatarModelProps) => {
  const [state] = useSimpleStore(AvatarState)
  const morphTargetsRef = useRef<THREE.Mesh[]>([])

  const { selectedAnimation, selectedModel, visemesEnabled } = state
  const { scene: avatarScene } = useGLTF(selectedModel)
  const { animations } = useGLTF(selectedAnimation)

  const avatarRef = useRef<THREE.Object3D>(null)
  const { actions, mixer } = useAnimations(animations, avatarRef)

  useEffect(() => {
    if (!avatarScene || !visemesEnabled || !visemeService) return

    const morphTargets: { morphTargetInfluences: number[] }[] = []
    const dictionary: Record<string, number[]> = {}

    avatarScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        const meshWithMorphTargets = child as THREE.Mesh & { morphTargetInfluences: number[] }
        morphTargets.push(meshWithMorphTargets)

        Object.entries(child.morphTargetDictionary).forEach(([name, index]) => {
          if (name.startsWith('viseme_')) {
            if (!dictionary[name]) {
              dictionary[name] = []
            }
            dictionary[name].push(index)
          }
        })
      }
    })

    morphTargetsRef.current = morphTargets as THREE.Mesh[]

    if (morphTargets.length > 0 && Object.keys(dictionary).length > 0) {
      visemeService.actions.setupForMorphTargets(morphTargets, dictionary)
    }
  }, [avatarScene, visemesEnabled, visemeService])

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

    if (visemesEnabled && visemeService) {
      const currentTime = Date.now()
      visemeService.actions.updateVisemes(currentTime)
      visemeService.actions.applyToRig(currentTime)
    }
  })

  return <primitive ref={avatarRef} object={avatarScene} />
}

useGLTF.preload('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
useGLTF.preload('/assets/animations/idle.glb')
