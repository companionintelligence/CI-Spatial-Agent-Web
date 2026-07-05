/**
 * AvatarHarness — a deterministic capture surface for visual tests.
 *
 * Renders ONLY the avatar (no chat/control UI) and exposes `window.__harness` so a
 * Playwright driver can select any avatar, play any body animation, fire any facial
 * emote, and drive lip-sync — then capture frames that are encoded to animated WebP
 * (see e2e/capture/). It reuses the real viseme/emote/animation services and the real
 * AvatarModel, so what it captures is exactly what ships.
 *
 * Served as a separate Vite entry at /harness.html. Query params:
 *   ?avatar=Greg   initial avatar (AvatarOptions key)
 *   ?shot=body|upper|face   camera framing (default body)
 *   ?bg=transparent|dark    background (default dark)
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  AvatarModel,
  AvatarState,
  AvatarOptions,
  getAvatarCatalog,
  getRandomClip,
  useAnimationService,
  useEmoteService,
  useVisemeService,
  type WhisperData
} from '@ci-avatar/core'

type Shot = 'face' | 'upper' | 'body'

const params = new URLSearchParams(location.search)
const initialAvatar = params.get('avatar')
const transparent = params.get('bg') === 'transparent'

const SHOTS: Record<Shot, { d: number; ty: number; cy: number; fov: number }> = {
  face: { d: 1.15, ty: -0.02, cy: 0.05, fov: 26 },
  upper: { d: 1.55, ty: -0.4, cy: 0.05, fov: 27 },
  body: { d: 3.4, ty: -0.72, cy: 0.18, fov: 32 }
}

/** Shared frame state written by onHeadLocated / setShot, read by the camera rig. */
interface FrameState {
  head: THREE.Vector3
  forward: THREE.Vector3
  shot: Shot
  ready: boolean
}

function isVRMSelected() {
  return AvatarState.get().selectedModel.toLowerCase().endsWith('.vrm')
}

/** Build evenly-timed whisper data from text so lip-sync plays without a real TTS. */
function buildWhisper(text: string, msPerWord = 340): WhisperData {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const wtimes = words.map((_, i) => i * msPerWord)
  const wdurations = words.map(() => Math.round(msPerWord * 0.85))
  return { words, wtimes, wdurations }
}

function CameraRig({ frameRef }: { frameRef: React.MutableRefObject<FrameState> }) {
  const { camera } = useThree()
  useFrame(() => {
    const f = frameRef.current
    if (!f.ready) return
    const cfg = SHOTS[f.shot]
    const forwardH = f.forward.clone()
    forwardH.y = 0
    if (forwardH.lengthSq() < 1e-6) forwardH.set(0, 0, 1)
    forwardH.normalize()

    const lookTarget = f.head.clone()
    lookTarget.y += cfg.ty
    const camPos = lookTarget.clone().add(forwardH.multiplyScalar(cfg.d))
    camPos.y += cfg.cy

    camera.position.copy(camPos)
    camera.lookAt(lookTarget)
    if ((camera as THREE.PerspectiveCamera).fov !== cfg.fov) {
      ;(camera as THREE.PerspectiveCamera).fov = cfg.fov
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function HarnessScene() {
  const visemes = useVisemeService()
  const emotes = useEmoteService()
  const animations = useAnimationService()
  const three = useThree()

  const frameRef = useRef<FrameState>({
    head: new THREE.Vector3(0, 1.5, 0),
    forward: new THREE.Vector3(0, 0, 1),
    shot: (params.get('shot') as Shot) || 'body',
    ready: false
  })

  useEffect(() => {
    if (initialAvatar && AvatarOptions[initialAvatar as keyof typeof AvatarOptions]) {
      AvatarState.set((s) => ({ ...s, selectedModel: AvatarOptions[initialAvatar as keyof typeof AvatarOptions] }))
    }

    const w = window as any
    w.__harness = {
      listAvatars: () => Object.keys(AvatarOptions),
      listClips: () => Object.keys(getAvatarCatalog(isVRMSelected())),
      currentAvatar: () => AvatarState.get().selectedModel,

      selectAvatar(name: string) {
        const url = AvatarOptions[name as keyof typeof AvatarOptions] ?? name
        w.__avatarLoaded = false
        frameRef.current.ready = false
        AvatarState.set((s) => ({ ...s, selectedModel: url }))
        return url
      },

      setShot(shot: Shot) {
        frameRef.current.shot = shot
      },

      /** Play a named clip (catalog key or clip.name) as a one-shot over idle. */
      playAnimation(clip: string, opts?: { loopCount?: number; blendTime?: number; speed?: number }) {
        const catalog = getAvatarCatalog(isVRMSelected())
        const found = catalog[clip] ?? Object.values(catalog).find((c) => c.name === clip)
        if (!found) return false
        animations.actions.performAction({
          clip: found,
          immediate: true,
          loopCount: opts?.loopCount ?? 1,
          blendTime: opts?.blendTime ?? 350,
          speed: opts?.speed
        })
        return true
      },

      /** Play a random clip of a category (idle|gesture|expression|action|...). */
      playCategory(category: string, opts?: { loopCount?: number; blendTime?: number }) {
        const clip = getRandomClip(category as any, getAvatarCatalog(isVRMSelected()))
        if (!clip) return false
        animations.actions.performAction({
          clip,
          immediate: true,
          loopCount: opts?.loopCount ?? 1,
          blendTime: opts?.blendTime ?? 350
        })
        return clip.name
      },

      setEmote(emotion: string, relaxTime = 4000) {
        emotes.actions.performAction({ emotion: emotion as any, relaxTime })
        return true
      },

      /** Drive lip-sync from text (synthetic whisper timing). */
      speak(text: string) {
        visemes.actions.generateSequence(buildWhisper(text))
        return true
      },

      /** Introspect the live animation mixer (for mixing/crossfade QA). */
      debugActions() {
        const s: any = animations.state
        const acts: Record<string, any> = s.actions || {}
        const live = Object.entries(acts)
          .map(([name, a]) => ({
            name,
            w: Number((a.getEffectiveWeight?.() ?? a.weight ?? 0).toFixed(3)),
            t: Number((a.time ?? 0).toFixed(2)),
            run: !!a.isRunning?.()
          }))
          .filter((x) => x.w > 0.001 || x.run)
        return {
          current: s.currentClip?.name ?? null,
          transitioning: !!s.isTransitioning,
          queue: s.queue?.length ?? 0,
          live
        }
      },

      // ---- direct rig control (for crisp, deterministic FACE tests) ----
      // Toggle the per-frame services so direct morph writes aren't overwritten.
      setServices(flags: { visemes?: boolean; emotes?: boolean; animations?: boolean }) {
        AvatarState.set((s) => ({
          ...s,
          visemesEnabled: flags.visemes ?? s.visemesEnabled,
          emotesEnabled: flags.emotes ?? s.emotesEnabled,
          animationsEnabled: flags.animations ?? s.animationsEnabled
        }))
      },

      /** Every morph-target name on the avatar (visemes + ARKit) — diagnostic. */
      faceMorphs() {
        const names = new Set<string>()
        three.scene.traverse((o: any) => {
          if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach((n) => names.add(n))
        })
        return [...names].sort()
      },

      /** Directly set GLB morph influences: {morphName: value}. Returns #applied. */
      setMorph(entries: Record<string, number>) {
        let n = 0
        three.scene.traverse((o: any) => {
          if (!o.morphTargetDictionary || !o.morphTargetInfluences) return
          for (const [name, val] of Object.entries(entries)) {
            const idx = o.morphTargetDictionary[name]
            if (idx !== undefined) {
              o.morphTargetInfluences[idx] = val
              n++
            }
          }
        })
        return n
      },

      /** Zero all morph influences (reset the face). */
      clearMorphs() {
        three.scene.traverse((o: any) => {
          if (o.morphTargetInfluences) o.morphTargetInfluences.fill(0)
        })
      }
    }
    w.__harnessReady = true
    return () => {
      delete w.__harness
      w.__harnessReady = false
    }
  }, [visemes, emotes, animations, three])

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.25} />
      <directionalLight position={[-2, 1, -2]} intensity={0.35} />
      <Environment preset="studio" background={false} />
      <CameraRig frameRef={frameRef} />
      <Suspense fallback={null}>
        <AvatarModel
          visemeService={visemes}
          emoteService={emotes}
          animationService={animations}
          onHeadLocated={(target, position) => {
            const head = new THREE.Vector3(...target)
            const forward = new THREE.Vector3(...position).sub(head)
            frameRef.current.head = head
            frameRef.current.forward = forward
            frameRef.current.ready = true
            ;(window as any).__avatarLoaded = true
          }}
        />
      </Suspense>
    </>
  )
}

export function AvatarHarness() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: transparent ? 'transparent' : '#0a1416' }}>
      <Canvas
        gl={{ alpha: transparent, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 1.5, 2.5], fov: 30 }}
        dpr={[1, 2]}
      >
        <HarnessScene />
      </Canvas>
    </div>
  )
}
