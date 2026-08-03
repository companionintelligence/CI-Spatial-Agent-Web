import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { createXRStore, XR, type XRStore } from '@react-three/xr'
import { memo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { SceneConfig } from './sceneTypes'
import type { useAnimationService } from '../../services/animation/useAnimationService'
import type { useEmoteService } from '../../services/emote/useEmoteService'
import type { useVisemeService } from '../../services/visemes/useVisemeService'
import { AvatarModel } from './avatar/AvatarModel'
import { DatacenterDiorama } from './environment/DatacenterDiorama'
import { GraphicsFallback } from './GraphicsFallback'
import { useRendererConfig } from './rendering/useRendererConfig'
import { configureRenderer, createWebGLContext } from './rendering/RendererConfig'
import type { DeviceCapabilities, RenderQuality } from './rendering/RendererConfig'
import { PostProcessing } from './rendering/PostProcessing'
import { XREnhancements } from './rendering/XREnhancements'


interface Scene3DProps {
  sceneConfig: SceneConfig
  visemeService?: ReturnType<typeof useVisemeService>
  emoteService?: ReturnType<typeof useEmoteService>
  animationService?: ReturnType<typeof useAnimationService>
  setXRStore?: (store: XRStore) => void
  onSceneActionsReady?: (actions: SceneActions) => void
  webGPUEnabled: boolean
}

export interface SceneActions {
  recenter: () => void
  scaleBy: (delta: number) => void
  resetScale: () => void
}

const SceneContent = ({
  sceneConfig,
  visemeService,
  emoteService,
  animationService,
  store,
  webGPUEnabled,
  quality,
  capabilities,
  worldGroupRef,
  worldScale,
  setRecenterHandler
}: Scene3DProps & { store: XRStore; quality: RenderQuality; capabilities: DeviceCapabilities; worldGroupRef: React.RefObject<THREE.Group | null>; worldScale: number; setRecenterHandler?: (fn: () => void) => void }) => {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls> | null>(null)
  const { camera, gl } = useThree()
  const [camTarget, setCamTarget] = useState<[number, number, number]>(sceneConfig.cameraTarget)
  const [camPos, setCamPos] = useState<[number, number, number]>(sceneConfig.cameraPosition)

  // Configure renderer on mount with quality settings
  useEffect(() => {
    if (gl && quality) {
      configureRenderer(gl as THREE.WebGLRenderer, {
        isDesktop: !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)),
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isTablet: /iPad|Android/i.test(navigator.userAgent) && window.innerWidth > 768,
        hasWebGPU: webGPUEnabled,
        hasWebGL2: true,
        devicePixelRatio: window.devicePixelRatio || 1,
        maxTextureSize: 2048
      }, quality)
    }
  }, [gl, quality, webGPUEnabled])

  useEffect(() => {
    camera.position.set(camPos[0], camPos[1], camPos[2])
    camera.lookAt(new THREE.Vector3(camTarget[0], camTarget[1], camTarget[2]))
    if (controlsRef.current) {
      controlsRef.current.target.set(camTarget[0], camTarget[1], camTarget[2])
      controlsRef.current.update()
    }
  }, [camPos, camTarget, camera])

  useEffect(() => {
    if (!setRecenterHandler) return
    setRecenterHandler(() => {
      setCamTarget(sceneConfig.cameraTarget)
      setCamPos(sceneConfig.cameraPosition)
      if (worldGroupRef.current) {
        worldGroupRef.current.position.set(0, 0, 0)
        worldGroupRef.current.rotation.set(0, 0, 0)
      }
    })
  }, [sceneConfig.cameraTarget, sceneConfig.cameraPosition, setRecenterHandler, worldGroupRef])

  const handleHeadLocated = (target: [number, number, number], position: [number, number, number]) => {
    setCamTarget(target)
    setCamPos(position)
  }

  // Determine shadow settings based on quality
  const shadowMapSize = quality?.shadowMapSize || 1024
  const useShadows = quality?.useShadows !== false

  return (
    <XR store={store}>
      <OrbitControls
        ref={controlsRef}
        target={camTarget}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={10}
      />

      {/* Enhanced lighting setup with quality-based shadows */}
      <ambientLight intensity={0.5} color={0xffffff} />
      
      {/* Key light - main directional light from front-right */}
      <directionalLight 
        position={[3, 5, 5]} 
        intensity={1.5} 
        color={0xffffff} 
        castShadow={useShadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0001}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      
      {/* Fill light - softer light from left */}
      <directionalLight 
        position={[-3, 3, 2]} 
        intensity={0.6} 
        color={0xeeeeff}
      />
      
      {/* Rim/back light for depth */}
      <directionalLight 
        position={[0, 3, -5]} 
        intensity={0.4} 
        color={0xffeedd}
      />
      
      {/* Bottom fill light to reduce harsh shadows */}
      <directionalLight 
        position={[0, -2, 2]} 
        intensity={0.3} 
        color={0xffffff}
      />

      <Environment preset="studio" background={false} />

      {/* XR enhancements for VR/AR */}
      <XREnhancements enabled={true} showGrid={false} />

      <group ref={worldGroupRef} scale={worldScale}>
        {sceneConfig.environment === 'datacenter-1970s' && <DatacenterDiorama />}
        <AvatarModel
          visemeService={visemeService}
          emoteService={emoteService}
          animationService={animationService}
          onHeadLocated={handleHeadLocated}
          webGPUEnabled={webGPUEnabled}
        />
      </group>

      {/* Post-processing effects for enhanced visuals */}
      <PostProcessing 
        enabled={true}
        quality={quality?.useShadows ? 'high' : quality?.useFXAA ? 'medium' : 'low'}
        isMobile={capabilities ? !capabilities.isDesktop : false}
      />
    </XR>
  )
}

const Scene3DComponent = ({ sceneConfig, visemeService, emoteService, animationService, setXRStore, onSceneActionsReady, webGPUEnabled }: Scene3DProps) => {
  const store = createXRStore()
  const { capabilities, quality, isLoading } = useRendererConfig()
  const worldGroupRef = useRef<THREE.Group>(null)
  const recenterSceneRef = useRef<(() => void) | undefined>(undefined)
  const [worldScale, setWorldScale] = useState(1)

  useEffect(() => {
    if (setXRStore) {
      setXRStore(store)
    }
  }, [setXRStore, store])

  useEffect(() => {
    if (!onSceneActionsReady) return
    const actions: SceneActions = {
      recenter: () => {
        recenterSceneRef.current?.()
        const origin = store.getState().origin
        if (origin) {
          origin.position.set(0, 0, 0)
          origin.rotation.set(0, 0, 0)
        }
        setWorldScale(1)
      },
      scaleBy: (delta: number) => {
        setWorldScale((prev) => {
          const next = Math.min(2, Math.max(0.5, prev + delta))
          return next
        })
      },
      resetScale: () => {
        setWorldScale(1)
      }
    }
    onSceneActionsReady(actions)
  }, [onSceneActionsReady, store])

  // Show loading state while detecting capabilities
  if (isLoading || !capabilities || !quality) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <GraphicsFallback />
      </div>
    )
  }

  // Create context based on capabilities
  const glConfig = createWebGLContext(capabilities, quality)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas        
        camera={{ position: [0, 1.6, 3], fov: 50 }}
        style={{ background: 'transparent' }}
        shadows={quality.useShadows}
        dpr={quality.pixelRatio}
        gl={glConfig}
        onCreated={(state) => {
          // `firstHitOnly` is a three-mesh-bvh extension, not part of three's Raycaster type.
          ;(state.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true
          // Additional optimizations for mobile
          if (capabilities.isMobile) {
            state.gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
          }
        }}
        fallback={<GraphicsFallback />}
        // NOTE: frameloop must stay "always" (the default). The avatar pipeline animates every
        // frame — mixer, blink, gaze, lip-sync, spring bones — none of which call invalidate().
        // Under frameloop="demand" the whole avatar froze at rest and only ticked while the
        // camera was being dragged. (Review: docs/ANIMATION-SYSTEM-REVIEW.md, C2.)
        performance={{
          min: capabilities.isMobile ? 0.5 : 0.75, // Lower threshold on mobile
          max: 1,
        }}
      >
        <SceneContent
          sceneConfig={sceneConfig}
          visemeService={visemeService}
          emoteService={emoteService}
          animationService={animationService}
          store={store}
          webGPUEnabled={webGPUEnabled}
          quality={quality}
          capabilities={capabilities}
          worldGroupRef={worldGroupRef}
          worldScale={worldScale}
          setRecenterHandler={(fn) => {
            recenterSceneRef.current = fn
          }}
        />
      </Canvas>
    </div>
  )
}

// Memoize the component to prevent re-renders when services don't change
export const Scene3D = memo(Scene3DComponent)
