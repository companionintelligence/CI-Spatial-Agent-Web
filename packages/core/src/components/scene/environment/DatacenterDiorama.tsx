/**
 * DatacenterDiorama — a 1970s research-datacenter environment the avatar stands inside.
 * Real hardware history (RAMAC 305 '56 through the Prologica CP-500 '82), a floor/wall
 * shell, and a warm/cool "diegetic warm, chrome cool" lighting accent layered on top of
 * Scene3D's existing key/fill/rim rig. Opt-in via `sceneConfig.environment` — the default
 * plain-studio viewport is unchanged unless a caller sets `environment: 'datacenter-1970s'`.
 *
 * Each prop is a real Sketchfab-sourced mesh (FBX/.blend originals, re-exported to GLB —
 * see docs/DIORAMA.md), so pivots/scale vary per source; PROP_LAYOUT carries a small
 * per-item correction alongside its placement.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DioramaProps, type DioramaPropName } from './DioramaProps'

interface PropPlacement {
  name: DioramaPropName
  position: [number, number, number]
  rotation?: [number, number, number]
  /** Fine-tune multiplier on top of the GLB's baked real-world scale (see docs/DIORAMA.md
   *  for the per-prop target dimensions used at export time). Default 1 — leave as-is. */
  scale?: number
}

// Every prop GLB is pre-normalized to a real-world target size and floor-aligned at its
// own origin (docs/DIORAMA.md), so `position` here is just where its base sits and
// `scale` is a rare fine-tune, not a correction. Desk-height items (KENBAK-1, mouse,
// plugboard) get a Y lift to sit on the side desk's 0.74m top.
//
// Back wall = "big iron" the resident never had room to throw out. Side desk = the
// small artifacts. Terminal row = where the resident actually sits and works. All
// placed behind/beside the avatar's origin spawn so nothing occludes the camera's
// default framing (camera at [0, 1.6, 3] looking toward the origin).
const PROP_LAYOUT: PropPlacement[] = [
  // --- back wall: big iron, oldest-to-newest left to right ---
  { name: 'IBM RAMAC 305 (1956)', position: [-3.6, 0, -4.6], rotation: [0, 0.35, 0] },
  { name: 'IBM 1401 Mainframe (1959)', position: [-1.6, 0, -4.9], rotation: [0, 0.12, 0] },
  { name: 'IBM 1401 CPU', position: [0.3, 0, -4.9], rotation: [0, 0, 0] },
  { name: 'IBM 3350 Disk (1975)', position: [2.1, 0, -4.9], rotation: [0, -0.12, 0] },
  { name: 'IBM 2401 Tape', position: [3.7, 0, -4.6], rotation: [0, -0.35, 0] },

  // --- side desk: small artifacts, within arm's reach of the hero desk ---
  { name: 'KENBAK-1 (1971)', position: [-3.3, 0.74, -1.1], rotation: [0, 0.5, 0] },
  { name: 'Engelbart Mouse (1963)', position: [-2.85, 0.74, -0.85], rotation: [0, 0.2, 0] },
  { name: 'Plugboard', position: [-3.55, 0.74, -1.55], rotation: [0, 0.6, 0] },

  // --- terminal row: where the resident works, angled toward the camera/avatar ---
  { name: 'Xerox Alto (1973)', position: [2.7, 0, -2.6], rotation: [0, -0.7, 0] },
  { name: 'Commodore PET (1977)', position: [3.35, 0, -1.7], rotation: [0, -0.85, 0] },
  { name: 'IBM 3178 Terminal (1979)', position: [3.7, 0, -0.6], rotation: [0, -1.05, 0] },
  { name: 'Prologica CP-500 (1982)', position: [3.55, 0, 0.5], rotation: [0, -1.2, 0] }
]

function DioramaProp({ placement }: { placement: PropPlacement }) {
  const { scene } = useGLTF(DioramaProps[placement.name])
  const cloned = useMemo(() => scene.clone(true), [scene])
  return (
    <primitive
      object={cloned}
      position={placement.position}
      rotation={placement.rotation ?? [0, 0, 0]}
      scale={placement.scale ?? 1}
    />
  )
}

/** Warm tungsten-amber practical lamp on a cabinet face — the era's indicator glow. */
function IndicatorLamp({ position, color = '#e8a24a' }: { position: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.PointLight>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.intensity = 0.35 + 0.25 * Math.abs(Math.sin(clock.getElapsedTime() * 1.3 + phase))
  })
  return <pointLight ref={ref} position={position} color={color} intensity={0.4} distance={2.2} decay={2} />
}

function RoomShell() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0a1418" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 5, -5.3]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#081319" metalness={0.15} roughness={0.95} />
      </mesh>
      <mesh position={[-5.3, 5, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#081319" metalness={0.15} roughness={0.95} />
      </mesh>
    </group>
  )
}

export interface DatacenterDioramaProps {
  /** Include the floor/wall shell. Off for compositing over an existing room. */
  showShell?: boolean
}

export function DatacenterDiorama({ showShell = true }: DatacenterDioramaProps) {
  return (
    <group name="datacenter-diorama">
      {showShell && <RoomShell />}

      {/* diegetic warm key: tungsten desk-lamp glow the avatar's own key/fill doesn't cover */}
      <pointLight position={[2.6, 2.2, -0.5]} color="#e8a24a" intensity={1.1} distance={6} decay={2} />
      {/* cool CI rim off the back wall's "chrome" */}
      <pointLight position={[-3, 3, -4.5]} color="#00a9a7" intensity={0.9} distance={7} decay={2} />

      <IndicatorLamp position={[-1.6, 1.4, -4.6]} color="#e8a24a" />
      <IndicatorLamp position={[0.3, 1.3, -4.6]} color="#58ebbf" />
      <IndicatorLamp position={[2.1, 1.4, -4.6]} color="#e8a24a" />

      {PROP_LAYOUT.map((p) => (
        <DioramaProp key={p.name} placement={p} />
      ))}
    </group>
  )
}

// Preload every catalog prop so the diorama pops in without a per-item Suspense stutter.
Object.values(DioramaProps).forEach((url) => useGLTF.preload(url))
