import { createSimpleStore, useSimpleStore } from '@hexafield/simple-store/react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useMemo, memo } from 'react'
import * as THREE from 'three'

import type { useEmoteService } from '../services/emote/useEmoteService'
import type { useVisemeService } from '../services/visemes/useVisemeService'
import { useAnimationService } from '../services/animation/useAnimationService'
import { ANIMATION_CLIPS } from '../services/animation/animationClips'

const AVATAR_MODEL = '/assets/avatars/heather.glb'

export const AvatarState = createSimpleStore({
  selectedModel: AVATAR_MODEL,
  visemesEnabled: true,
  emotesEnabled: true
})

interface AvatarModelProps {
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
}

// Custom hook to load external animation files
function useExternalAnimations(avatarRef: React.RefObject<THREE.Object3D | undefined | null> | THREE.Object3D) {
  // Load each animation file individually
  const animationGLTFs = ANIMATION_CLIPS.map(clip => {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useGLTF(clip.path)
    } catch (error) {
      console.warn(`Failed to load animation: ${clip.name} from ${clip.path}`, error)
      return null
    }
  }).filter(Boolean)

  // Collect all animations from the loaded GLTFs
  const allAnimations = useMemo(() => {
    const animations: THREE.AnimationClip[] = []
    
    animationGLTFs.forEach((gltf, index) => {
      if (gltf && gltf.animations) {
        gltf.animations.forEach(animation => {
          // Rename animation to match our clip names
          const clip = ANIMATION_CLIPS[index]
          if (clip) {
            animation.name = clip.name
            clip.duration = animation.duration
          }
          animations.push(animation)
        })
      }
    })
    
    return animations
  }, [animationGLTFs])

  // Use the animations with the avatar
  const { actions, mixer } = useAnimations(allAnimations, avatarRef)

  return { actions, mixer, animations: allAnimations }
}

const AvatarModelComponent = ({ visemeService, emoteService , animationService }: AvatarModelProps) => {
  const [state] = useSimpleStore(AvatarState)
  const morphTargetsRef = useRef<THREE.Mesh[]>([])
  const bonesRef = useRef<Record<string, THREE.Bone>>({})

  const { selectedModel, visemesEnabled, emotesEnabled } = state
  const { scene: avatarScene } = useGLTF(selectedModel)  
  const avatarRef = useRef<THREE.Object3D>(null)
  
  // Load external animations from animationClips.ts
  const { actions, mixer } = useExternalAnimations(avatarRef as any)

  // Setup animation service with R3F
  useEffect(() => {
    if (!avatarScene || !animationService || !actions || !mixer) return

    // Setup the animation service with R3F actions and mixer
    // Filter out null actions
    const validActions: Record<string, THREE.AnimationAction> = {}
    Object.entries(actions).forEach(([name, action]) => {
      if (action) {
        validActions[name] = action
      }
    })
    
    animationService.actions.setup(validActions, mixer, avatarRef.current || undefined)
    
    console.log(`Animation service setup with ${Object.keys(actions).length} animations`)
  }, [ animationService, actions, mixer])

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
          if (
            name.includes('eye') ||
            name.includes('brow') ||
            name.includes('mouth') ||
            name.includes('nose') ||
            name.includes('cheek') ||
            name.includes('jaw')
          ) {
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
      emoteService.actions.setupForMorphTargets(morphTargets, emoteDictionary)
    }

    // Provide avatar references for gaze and head control
    emoteService.actions.setAvatarReferences({
      bones,
      node: avatarRef.current,
      scene: { camera: null } // Camera will be set by the scene
    })
  }, [avatarScene, emotesEnabled, emoteService])

  // Animation service will handle its own initialization

  useFrame(() => {
    const currentTime = Date.now()

    // Update animation service using R3F integration
    if (animationService) {
      //animationService.actions.update(delta)
    }

    // Update visemes for lip sync
    if (visemesEnabled && visemeService) {
      visemeService.actions.updateVisemes(currentTime)
      visemeService.actions.applyToRig(currentTime)
    }

    // Update emotes for facial expressions and behaviors
    if (emotesEnabled && emoteService) {
      emoteService.actions.update(currentTime)

      // Apply to morph targets if available
      if (morphTargetsRef.current.length > 0) {
        const dictionary = emoteService.getters.getState().dictionary
        if (dictionary) {
          // Filter to only meshes with morph targets
          const validMorphs = morphTargetsRef.current.filter((mesh) => mesh.morphTargetInfluences !== undefined) as {
            morphTargetInfluences: number[]
          }[]

          if (validMorphs.length > 0) {
            emoteService.actions.applyToMorphTargets(validMorphs, dictionary)
          }
        }
      }
    }
  })

  return <primitive ref={avatarRef} object={avatarScene} />
}

// Memoize the component to prevent re-renders when services don't change
export const AvatarModel = memo(AvatarModelComponent)

useGLTF.preload(AVATAR_MODEL)

// Preload all animation files using a loop over ANIMATION_CLIPS

// Loop through all animation clips and preload them

