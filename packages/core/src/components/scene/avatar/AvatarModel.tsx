import { createSimpleStore, useSimpleStore } from '@hexafield/simple-store/react'
import { VRM, VRMCore, VRMLoaderPlugin, VRMUtils, MToonMaterialLoaderPlugin } from '@pixiv/three-vrm'
import { MToonNodeMaterial } from '@pixiv/three-vrm/nodes'
import { createVRMAnimationClip, VRMAnimation, VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import type { GLTFParser } from 'three/examples/jsm/Addons.js'


import { AvatarOptions } from './AvatarOptions'
import { Vector3 } from 'three'
import {
  VRMA_CLIPS,
  GLB_ALL_CLIPS,
  getAvatarCatalog,
  getIdleClip,
  getGreetClip,
  getRandomClip,
  updateAnimationDurations
} from '../../../services/animation/config/animationClips'
import type { useAnimationService } from '../../../services/animation/useAnimationService'
import type { useEmoteService } from '../../../services/emote/useEmoteService'
import type { useVisemeService } from '../../../services/visemes/useVisemeService'
import type { useTTSService } from '../../../services/tts/ttsService'
import type { AnimationClip } from '../../../services/animation/animationTypes'
import { AudioLipSync } from '../../../services/visemes/audioLipSync'
import { PhonemeTimingEngine, blendAudioAndText } from '../../../services/visemes/phonemeTiming'
import { ARKIT_LIP_SYNC_TARGETS, type VisemeWeights } from '../../../services/visemes/visemeTable'
import { AvatarDynamicsEngine } from '../../../services/emote/avatarDynamics'

// Default to a fully-rigged RPM pro model (visemes + ARKit morphs) so the default
// companion lip-syncs and shows facial emotion. 'Liam' (LiamCES2) is a bare mesh with
// no morph targets — body-animation only — so it's no longer the default.
const AVATAR_MODEL = AvatarOptions.Greg

export const AvatarState = createSimpleStore({
  selectedModel: AVATAR_MODEL,
  visemesEnabled: true,
  selectedAnimation: "",
  emotesEnabled: true,
  animationsEnabled: true
})

interface AvatarModelProps {
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  ttsService?: ReturnType<typeof useTTSService>
  onHeadLocated?: (target: [number, number, number], position: [number, number, number]) => void
  /** Metres to park the camera in front of the located head bone. Default 0.5 — the bust
   *  framing the studio viewport has always used. Environments that need the room in shot
   *  pass a wider value; see the comment at the call site. */
  cameraDistance?: number
  /** Metres to lower the look-at below the head bone. Default 0 — dead on the eyeline,
   *  which is right for a bust. A wider shot uses it to pitch the camera down a little,
   *  which lifts the room UP the frame and cuts the dead wall above it. */
  cameraTargetDrop?: number
  webGPUEnabled?: boolean
}

// Custom hook to load external animation files, including VRMA animations.
// Exported alongside AvatarModel because it is the loader for exactly that component;
// the app harness also imports it directly.
// eslint-disable-next-line react-refresh/only-export-components
export const useExternalAnimations = (avatarRef: React.RefObject<THREE.Object3D | null>, vrm?: VRMCore) => {
  // Load BOTH catalogs every render (stable hook order); collect only the set that
  // matches the active avatar's skeleton below. VRMA → VRM avatars, GLB → GLB avatars.
  // GLB_ALL_CLIPS includes the feminine (F_*) set so female avatars can use it.
  const vrmaClips = Object.values(VRMA_CLIPS)
  const gltfClips = Object.values(GLB_ALL_CLIPS)

  // These two `.map`s call hooks in a callback, which rules-of-hooks flags. It is safe
  // here — and load-bearing: VRMA_CLIPS and GLB_ALL_CLIPS are module-level literals with
  // a fixed key set (updateAnimationDurations only rewrites `duration` on existing
  // entries), so both arrays have the same length on every render and hook order is
  // stable. Loading each catalog unconditionally is what keeps it stable; making the
  // loads conditional on avatar type is what would actually break the rule.

  // Load VRMA animations
  const vrmaGLTFs = vrmaClips.map((clip) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length catalog, see above
    useLoader(GLTFLoader, clip.path, (loader) => {
      loader.register((parser: GLTFParser) => new VRMAnimationLoaderPlugin(parser))
    })
  )

  // Load GLTF/GLB animations
  // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length catalog, see above
  const gltfGLTFs = gltfClips.map((clip) => useGLTF(clip.path))

  // Collect all animations
  const allAnimations = useMemo(() => {
    const animations: THREE.AnimationClip[] = []

    if (vrm) {
      // Process VRMA
      vrmaGLTFs.forEach((gltf, index) => {
        const vrmAnimation: VRMAnimation | undefined = (gltf as { userData?: { vrmAnimations?: VRMAnimation[] } })
          .userData?.vrmAnimations?.[0]

        if (vrmAnimation && vrm) {
          const clip = createVRMAnimationClip(vrmAnimation, vrm)
          clip.name = vrmaClips[index].name
          // Remove "Normalized_" prefix from track names
          clip.tracks = clip.tracks.filter((track) => {
            // Remove "Normalized_" prefix from track names
            if (track.name.startsWith('Normalized_')) {
              track.name = track.name.replace(/^Normalized_/, '')

            }
            const lower = track.name.toLowerCase()
            if (lower.includes('neck') || lower.includes('head')) {
              return false
            }
            return true
          })

          animations.push(clip)
        }
      })
    } else {
      // Process GLTF/GLB
      gltfGLTFs.forEach((gltf, index) => {
        if (gltf.animations && gltf.animations.length > 0) {
          gltf.animations.forEach((animation) => {
            animation.name = gltfClips[index].name
            // RPM-library clips (F_*/M_*) are authored against RPM's stock rest pose,
            // whose head orientation differs slightly from the CI models — drop their
            // head/neck tracks (as the VRMA path does) and let the gaze service own
            // the head.
            if (/^[FM]_/.test(animation.name)) {
              animation.tracks = animation.tracks.filter((t) => !/head|neck/i.test(t.name))
            }
            animations.push(animation)
          })
        }
      })
    }

    // Update animation clip durations from the actual loaded animations
    updateAnimationDurations(animations)

    return animations
  }, [vrmaGLTFs, gltfGLTFs, vrm])

  // Hook into R3F's animation system

  const { actions, mixer } = useAnimations(allAnimations, avatarRef)
  return { actions, mixer, animations: allAnimations }
}

const AvatarModelComponent = ({
  visemeService,
  emoteService,
  animationService,
  ttsService,
  onHeadLocated,
  cameraDistance = 0.5,
  cameraTargetDrop = 0,
  webGPUEnabled
}: AvatarModelProps) => {
  const { camera: viewerCamera } = useThree()

  const [state] = useSimpleStore(AvatarState)
  const morphTargetsRef = useRef<THREE.Mesh[]>([])
  const bonesRef = useRef<Record<string, THREE.Bone>>({})
  const startupPlayedRef = useRef<boolean>(false)
  const [isAvatarVisible, setIsAvatarVisible] = useState<boolean>(false)

  // Real-time Audio Lip Sync and Autonomous Dynamics engines
  const lipSyncRef = useRef<AudioLipSync | null>(null)
  const phonemeEngineRef = useRef<PhonemeTimingEngine>(new PhonemeTimingEngine())
  const dynamicsEngineRef = useRef<AvatarDynamicsEngine>(new AvatarDynamicsEngine())
  const prevWeightsRef = useRef<VisemeWeights | null>(null)
  const lastTextRef = useRef<string>('')

  const { selectedModel, visemesEnabled, emotesEnabled, animationsEnabled } = state

  const gltf = useLoader(GLTFLoader, selectedModel, (loader) => {
    loader.register((parser: GLTFParser) => {
      const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
        materialType: MToonNodeMaterial
      })

      return new VRMLoaderPlugin(parser, webGPUEnabled ? { mtoonMaterialPlugin } : undefined)
    })
  })

  const isVRM = selectedModel.toLowerCase().endsWith('.vrm')
  const vrm = isVRM ? (gltf.userData.vrm as VRM) : undefined

  const isFeminine = /female|woman/i.test(selectedModel)
  const avatarCatalog = getAvatarCatalog(isVRM, isFeminine)
  const idleClip = getIdleClip(avatarCatalog)
  const greetClip = getGreetClip(avatarCatalog)
  const avatarScene = isVRM ? vrm?.scene : gltf.scene
  const avatarRef = useRef<THREE.Object3D>(null)

  // Position camera on head
  useEffect(() => {
    if (!avatarRef.current || !viewerCamera) return
    let head: THREE.Object3D | null = null

    if (isVRM && vrm?.humanoid) {
      const normalizedBone = vrm.humanoid.getRawBone('head')
      head = normalizedBone?.node ?? null
      VRMUtils.rotateVRM0(vrm)
    } else {
      avatarRef.current?.traverse((child) => {
        if (
          !head &&
          (child as THREE.Bone).isBone &&
          typeof child.name === 'string' &&
          child.name.toLowerCase().includes('head')
        ) {
          head = child
        }
      })
    }

    if (head && avatarRef.current) {
      const headWorldPos = new Vector3()
      head.getWorldPosition(headWorldPos)
      const avatarWorldQuat = new THREE.Quaternion()
      avatarRef.current.getWorldQuaternion(avatarWorldQuat)
      const avatarForward = new Vector3(0, 0, isVRM ? -1 : 1).applyQuaternion(avatarWorldQuat).normalize()

      const cameraTarget = headWorldPos
        .clone()
        .add(new Vector3(0, -cameraTargetDrop, 0))
        .toArray() as [number, number, number]

      const cameraPos = headWorldPos.clone().add(avatarForward.multiplyScalar(cameraDistance))
      const cameraPosition = cameraPos.toArray() as [number, number, number]

      onHeadLocated?.(cameraTarget, cameraPosition)
      if (isVRM) avatarRef.current.position.x += 0.2
    }
  }, [avatarRef.current])

  // Load external animations from animationClips.ts
  const { actions, mixer } = useExternalAnimations(avatarRef, vrm)

  // Setup animation service with R3F
  useEffect(() => {
    if (!avatarScene || !animationService || !actions || !mixer || !animationsEnabled) return

    const validActions: Record<string, THREE.AnimationAction> = {}
    Object.entries(actions).forEach(([name, action]) => {
      if (action) {
        validActions[name] = action
      }
    })

    animationService.actions.setup(validActions, mixer, avatarRef.current || undefined, idleClip, avatarCatalog)

    let raf = 0
    const startedAt = performance.now()
    const REVEAL_TIMEOUT_MS = 6000

    const revealWhenAnimating = () => {
      const driving = Object.values(validActions).some((a) => a.isRunning() && a.time > 0)
      if (driving || performance.now() - startedAt > REVEAL_TIMEOUT_MS) {
        setIsAvatarVisible(true)
        return
      }
      raf = requestAnimationFrame(revealWhenAnimating)
    }
    raf = requestAnimationFrame(revealWhenAnimating)

    return () => cancelAnimationFrame(raf)
  }, [animationsEnabled, animationService, actions, mixer])

  // Discover all morph targets (ARKit 52, Oculus Visemes, Emotes)
  useEffect(() => {
    if (!avatarScene) return

    const morphTargets: THREE.Mesh[] = []
    const visemeDict: Record<string, number[]> = {}
    const emoteDict: Record<string, number[]> = {}
    const bones: Record<string, THREE.Bone> = {}

    avatarScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        morphTargets.push(child)
        Object.entries(child.morphTargetDictionary).forEach(([name, index]) => {
          if (name.startsWith('viseme_') || ARKIT_LIP_SYNC_TARGETS.includes(name as any) || name === 'jawOpen' || name === 'mouthOpen') {
            if (!visemeDict[name]) visemeDict[name] = []
            visemeDict[name].push(index)
          }

          if (
            name.includes('eye') ||
            name.includes('brow') ||
            name.includes('mouth') ||
            name.includes('nose') ||
            name.includes('cheek') ||
            name.includes('jaw') ||
            name.includes('Blink')
          ) {
            if (!emoteDict[name]) emoteDict[name] = []
            emoteDict[name].push(index)
          }
        })
      }

      if (child instanceof THREE.Bone) {
        bones[child.name] = child
      }
    })

    morphTargetsRef.current = morphTargets
    bonesRef.current = bones

    if (isVRM && vrm) {
      if (visemesEnabled && visemeService) {
        visemeService.actions.setupForVRM(vrm)
      }
      if (emotesEnabled && emoteService) {
        emoteService.actions.setupForVRM(vrm)
      }
    } else {
      if (visemesEnabled && visemeService && morphTargets.length > 0) {
        visemeService.actions.setupForMorphTargets(
          morphTargets as unknown as { morphTargetInfluences: number[] }[],
          visemeDict
        )
      }
      if (emotesEnabled && emoteService && morphTargets.length > 0) {
        emoteService.actions.setupForMorphTargets(
          morphTargets as unknown as { morphTargetInfluences: number[] }[],
          emoteDict
        )
      }
    }

    if (emotesEnabled && emoteService) {
      const findBone = (...names: string[]): THREE.Bone | undefined => {
        for (const n of names) {
          if (bones[n]) return bones[n]
          const lc = n.toLowerCase()
          const hit = Object.keys(bones).find((k) => k.toLowerCase() === lc || k.toLowerCase() === 'mixamorig' + lc)
          if (hit) return bones[hit]
        }
        return undefined
      }
      const alias = (canonical: string, ...cands: string[]) => {
        const b = findBone(canonical, ...cands)
        if (b) bones[canonical] = b
      }
      alias('neck', 'Neck')
      alias('spine2', 'Spine2', 'chest', 'upperChest', 'Chest', 'UpperChest')
      alias('spine', 'Spine')
      alias('head', 'Head')
      alias('leftEye', 'LeftEye', 'eye_L')
      alias('rightEye', 'RightEye', 'eye_R')
      if (bones.head && !bones.Head) bones.Head = bones.head

      emoteService.actions.setAvatarReferences({
        bones,
        node: avatarRef.current ?? undefined,
        camera: viewerCamera
      })
    }
  }, [avatarScene, visemesEnabled, emotesEnabled, visemeService, emoteService, isVRM, vrm, viewerCamera])

  // Startup animation sequence
  useEffect(() => {
    if (!animationsEnabled || !emotesEnabled) return
    if (!avatarScene || !actions || !mixer) return
    if (!emoteService || !animationService) return
    if (startupPlayedRef.current) return
    if (!isAvatarVisible) return

    const startupTimer = setTimeout(() => {
      emoteService.actions.performAction({ emotion: 'happy', relaxTime: greetClip.duration })

      animationService.actions.performAction({
        clip: greetClip,
        immediate: true,
        loopCount: 1,
        blendTime: 300
      })

      animationService.actions.performAction({
        clip: idleClip,
        loopCount: Infinity,
        blendTime: 2000
      })
      startupPlayedRef.current = true
    }, 500)

    return () => clearTimeout(startupTimer)
  }, [animationsEnabled, animationService, actions, mixer, emoteService, isAvatarVisible, greetClip, idleClip])

  // 60 FPS Render & Animation Loop: Lip-sync + Autonomous Vitality + Animations
  useFrame((threeState, delta) => {
    if (typeof document !== 'undefined' && document.hidden) return
    if (isVRM && vrm) vrm.expressionManager?.update()

    // 1. Audio-Driven Lip Sync
    const analyser = ttsService?.actions.getAnalyser()
    if (analyser && (!lipSyncRef.current || (lipSyncRef.current as unknown as { analyser: AnalyserNode }).analyser !== analyser)) {
      lipSyncRef.current = new AudioLipSync(analyser)
    }

    const audioState = lipSyncRef.current?.update() ?? null

    // 2. Phoneme / Text Viseme Schedule
    const speechInfo = ttsService?.actions.getCurrentSpeechInfo()
    const currentText = speechInfo?.text ?? ''
    if (currentText !== lastTextRef.current) {
      lastTextRef.current = currentText
      if (currentText.length > 0) {
        phonemeEngineRef.current.setUtterance(currentText, speechInfo?.duration)
      } else {
        phonemeEngineRef.current.clear()
      }
    }

    let timedViseme: VisemeWeights | null = null
    if (speechInfo && currentText.length > 0 && speechInfo.startTime > 0) {
      const ctx = speechInfo.audioContext
      const currentTime = ctx ? ctx.currentTime : performance.now() / 1000
      const playbackTime = currentTime - speechInfo.startTime
      timedViseme = phonemeEngineRef.current.getActiveViseme(playbackTime)
    }

    // 3. Blend Audio & Text into Viseme Weights
    if (audioState || timedViseme) {
      const weights = blendAudioAndText(
        audioState || { energy: 0, lowBand: 0, midBand: 0, highBand: 0, isSpeaking: false },
        timedViseme,
        prevWeightsRef.current,
        0.35
      )
      prevWeightsRef.current = weights

      if (isVRM && vrm?.expressionManager) {
        const vrmMap: Record<string, number> = {
          aa: Math.max(weights.jawOpen, 0),
          ee: Math.max(weights.mouthSmileLeft, weights.mouthStretchLeft, 0),
          ih: Math.max(weights.mouthShrugUpper, weights.mouthStretchRight, 0),
          oh: Math.max(weights.mouthFunnel, 0),
          ou: Math.max(weights.mouthPucker, weights.mouthRollLower, 0)
        }
        for (const [exp, val] of Object.entries(vrmMap)) {
          try {
            vrm.expressionManager.setValue(exp, Math.min(1, Math.max(0, val)))
          } catch {}
        }
      } else if (morphTargetsRef.current.length > 0) {
        for (const mesh of morphTargetsRef.current) {
          if (!mesh.morphTargetInfluences || !mesh.morphTargetDictionary) continue
          for (const key of ARKIT_LIP_SYNC_TARGETS) {
            const idx = mesh.morphTargetDictionary[key]
            if (idx !== undefined) {
              mesh.morphTargetInfluences[idx] = weights[key]
            }
          }
          if (mesh.morphTargetDictionary['viseme_aa'] !== undefined) {
            const oculusMap: Record<string, number> = {
              viseme_aa: weights.jawOpen,
              viseme_E: weights.mouthSmileLeft,
              viseme_I: weights.mouthStretchLeft,
              viseme_O: weights.mouthFunnel,
              viseme_U: weights.mouthPucker,
              viseme_PP: weights.mouthClose,
              viseme_FF: weights.mouthRollLower,
              viseme_TH: weights.tongueOut,
              viseme_DD: weights.mouthShrugUpper,
              viseme_kk: weights.mouthShrugLower,
              viseme_CH: weights.mouthFunnel * 0.5,
              viseme_SS: weights.mouthSmileRight,
              viseme_nn: weights.mouthPressLeft,
              viseme_RR: weights.mouthFunnel * 0.3
            }
            for (const [oKey, val] of Object.entries(oculusMap)) {
              const oIdx = mesh.morphTargetDictionary[oKey]
              if (oIdx !== undefined) {
                mesh.morphTargetInfluences[oIdx] = val
              }
            }
          }
          if (mesh.morphTargetDictionary['jawOpen'] !== undefined) {
            mesh.morphTargetInfluences[mesh.morphTargetDictionary['jawOpen']] = weights.jawOpen
          }
          if (mesh.morphTargetDictionary['mouthOpen'] !== undefined) {
            mesh.morphTargetInfluences[mesh.morphTargetDictionary['mouthOpen']] = weights.jawOpen
          }
        }
      }
    }

    // 4. Autonomous Facial Vitality Dynamics (Blinking, Saccades, Acoustic Brows)
    const isSpeaking = audioState?.isSpeaking ?? false
    const dynamics = dynamicsEngineRef.current.update({
      elapsedTime: threeState.clock.getElapsedTime(),
      delta,
      pointerX: threeState.pointer.x,
      pointerY: threeState.pointer.y,
      audioState,
      conversationState: isSpeaking ? 'speaking' : 'idle'
    })

    if (morphTargetsRef.current.length > 0) {
      for (const mesh of morphTargetsRef.current) {
        if (!mesh.morphTargetInfluences || !mesh.morphTargetDictionary) continue
        for (const [key, val] of Object.entries(dynamics.blendshapes)) {
          const idx = mesh.morphTargetDictionary[key]
          if (idx !== undefined) {
            mesh.morphTargetInfluences[idx] = val
          }
        }
        if (dynamics.blendshapes.eyeBlinkLeft > 0) {
          if (mesh.morphTargetDictionary['Blink'] !== undefined) {
            mesh.morphTargetInfluences[mesh.morphTargetDictionary['Blink']] = dynamics.blendshapes.eyeBlinkLeft
          }
          if (mesh.morphTargetDictionary['eyesClosed'] !== undefined) {
            mesh.morphTargetInfluences[mesh.morphTargetDictionary['eyesClosed']] = dynamics.blendshapes.eyeBlinkLeft
          }
        }
      }
    }

    if (isVRM && vrm?.expressionManager) {
      if (dynamics.blendshapes.eyeBlinkLeft > 0) {
        try {
          vrm.expressionManager.setValue('blink', dynamics.blendshapes.eyeBlinkLeft)
        } catch {}
      }
    }

    // 5. Update animation service
    if (animationsEnabled && animationService) {
      animationService.actions.update(delta)
    }

    // 6. Update viseme service (Whisper/legacy)
    if (visemesEnabled && visemeService) {
      visemeService.actions.update(delta)
      visemeService.actions.applyToRig(delta)
    }

    // 7. Update emote service
    if (emotesEnabled && emoteService) {
      emoteService.actions.update(delta)
      if (isVRM && vrm) {
        emoteService.actions.applyToVRM(vrm)
      } else if (morphTargetsRef.current.length > 0) {
        const dictionary = emoteService.state.emote.dictionary
        if (dictionary) {
          const validMorphs = morphTargetsRef.current.filter((mesh) => mesh.morphTargetInfluences !== undefined) as {
            morphTargetInfluences: number[]
          }[]
          if (validMorphs.length > 0) {
            emoteService.actions.applyToMorphTargets(validMorphs, dictionary)
          }
        }
      }
    }

    // 8. VRM spring bones
    if (isVRM && vrm) vrm.springBoneManager?.update(delta)
  })

  const handleAvatarClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (animationService && emoteService) {
        const randomAction = getRandomClip('action', avatarCatalog) as AnimationClip
        emoteService.actions.performAction({
          emotion: 'happy',
          relaxTime: Math.max(0, randomAction.duration - 1000)
        })

        animationService.actions.performAction({
          clip: randomAction,
          immediate: true,
          loopCount: 1,
          blendTime: 1000
        })

        animationService.actions.performAction({
          clip: idleClip,
          loopCount: Infinity,
          blendTime: 1000
        })
      }
    },
    [animationService, emoteService, avatarCatalog, idleClip]
  )

  return (
    <primitive
      ref={avatarRef}
      object={avatarScene as THREE.Object3D}
      onClick={handleAvatarClick}
      visible={isAvatarVisible}
    />
  )
}

// Memoize so unrelated parent re-renders don't churn the (expensive) avatar.
const AvatarModelMemo = memo(AvatarModelComponent)

// Remount the whole avatar when the selected model changes: a new mesh means new
// morph targets, a new skeleton family (GLB vs VRM), and a fresh startup greet, so
// keying by selectedModel re-initializes every ref/effect cleanly instead of trying
// to mutate a live rig in place.
export const AvatarModel = (props: AvatarModelProps) => {
  const [state] = useSimpleStore(AvatarState)
  return <AvatarModelMemo key={state.selectedModel} {...props} />
}

useGLTF.preload(AVATAR_MODEL)

// Preload all animation files using a loop over ANIMATION_CLIPS

// Loop through all animation clips and preload them
