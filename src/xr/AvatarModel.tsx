import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import type { useEmoteService } from '../services/emote/useEmoteService'
import { createSimpleStore, useSimpleStore } from '../utils/SimpleStore'

export const AvatarState = createSimpleStore({
  selectedAnimation: '/assets/animations/idle.glb',
  selectedModel: '/assets/avatars/25-1-3_CI_model_female_Shanee.glb',
  visemesEnabled: true,
  emotesEnabled: true
})

interface AvatarModelProps {
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
}

export const AvatarModel = ({ visemeService, emoteService }: AvatarModelProps) => {
  const [state] = useSimpleStore(AvatarState)
  const morphTargetsRef = useRef<THREE.Mesh[]>([])
  const bonesRef = useRef<Record<string, THREE.Bone>>({})

  const { selectedAnimation, selectedModel, visemesEnabled, emotesEnabled } = state
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

  // Setup emote service integration
  useEffect(() => {
    if (!avatarScene || !emotesEnabled || !emoteService) return

    const morphTargets: { morphTargetInfluences: number[] }[] = []
    const emoteDictionary: Record<string, number[]> = {}
    const bones: Record<string, THREE.Bone> = {}

    // Collect morphable meshes for facial expressions
    avatarScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        const meshWithMorphTargets = child as THREE.Mesh & { morphTargetInfluences: number[] }
        morphTargets.push(meshWithMorphTargets)

        // Map morph targets for emotional expressions
        Object.entries(child.morphTargetDictionary).forEach(([name, index]) => {
          // Include all relevant facial expression morph targets
          if (name.includes('eye') || name.includes('brow') || name.includes('mouth') || 
              name.includes('nose') || name.includes('cheek') || name.includes('jaw')) {
            if (!emoteDictionary[name]) {
              emoteDictionary[name] = []
            }
            emoteDictionary[name].push(index)
          }
        })
      }

      // Collect bones for head/gaze control
      if (child instanceof THREE.Bone) {
        bones[child.name] = child
      }
    })

    bonesRef.current = bones

    // Setup emote service with morph targets and bones
    if (morphTargets.length > 0 && Object.keys(emoteDictionary).length > 0) {
      emoteService.setupForMorphTargets(morphTargets, emoteDictionary)
    }

    // Provide avatar references for gaze and head control
    emoteService.setAvatarReferences({
      bones,
      node: avatarRef.current,
      scene: { camera: null } // Camera will be set by the scene
    })
  }, [avatarScene, emotesEnabled, emoteService])

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

    const currentTime = Date.now()

    // Update visemes for lip sync
    if (visemesEnabled && visemeService) {
      visemeService.actions.updateVisemes(currentTime)
      visemeService.actions.applyToRig(currentTime)
    }

    // Update emotes for facial expressions and behaviors
    if (emotesEnabled && emoteService) {
      emoteService.update(currentTime)
      
      // Apply to morph targets if available
      if (morphTargetsRef.current.length > 0) {
        const dictionary = emoteService.getState().dictionary
        if (dictionary) {
          // Filter to only meshes with morph targets
          const validMorphs = morphTargetsRef.current.filter(
            mesh => mesh.morphTargetInfluences !== undefined
          ) as { morphTargetInfluences: number[] }[]
          
          if (validMorphs.length > 0) {
            emoteService.applyToMorphTargets(validMorphs, dictionary)
          }
        }
      }
    }
  })

  return <primitive ref={avatarRef} object={avatarScene} />
}

useGLTF.preload('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
useGLTF.preload('/assets/animations/idle.glb')
