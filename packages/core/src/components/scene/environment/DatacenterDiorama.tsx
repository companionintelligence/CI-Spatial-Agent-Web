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
import {
  DioramaProps,
  PropTargetMaxDim,
  PROP_SCALE_TOLERANCE,
  type DioramaPropName
} from './DioramaProps'

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

/**
 * Repair factor for a GLB whose export skipped normalization.
 *
 * docs/DIORAMA.md promises every prop arrives scaled to its real machine's
 * dimensions, "so placements need no per-prop correction". Three of the twelve
 * do not: measured off the shipped files, the IBM 1401 mainframe is 88 m across,
 * the 3178 terminal 40 m and the KENBAK-1 46 m. Trusting the promise put the
 * camera inside a 90-metre cabinet.
 *
 * Rather than paper over it with three magic numbers in PROP_LAYOUT, measure
 * what actually loaded and rescale it to the documented target when it is out by
 * more than PROP_SCALE_TOLERANCE. Within tolerance the shipped scale is used
 * untouched, so the nine correct props render exactly as before — and a future
 * bad re-export self-corrects instead of swallowing the frame.
 */
function normalizationFactor(name: DioramaPropName, object: THREE.Object3D): number {
  const target = PropTargetMaxDim[name]
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
  const measured = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(measured) || measured <= 0) return 1
  const ratio = measured / target
  if (ratio <= PROP_SCALE_TOLERANCE && ratio >= 1 / PROP_SCALE_TOLERANCE) return 1
  return target / measured
}

function DioramaProp({ placement }: { placement: PropPlacement }) {
  const { scene } = useGLTF(DioramaProps[placement.name])
  const cloned = useMemo(() => scene.clone(true), [scene])
  const scale = useMemo(
    () => (placement.scale ?? 1) * normalizationFactor(placement.name, cloned),
    [cloned, placement.name, placement.scale]
  )
  return (
    <primitive
      object={cloned}
      position={placement.position}
      rotation={placement.rotation ?? [0, 0, 0]}
      scale={scale}
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
      {/* Raised computer-room floor tile: matte, not chrome.
          At `metalness: 0.4` this 14 m plane, seen at the grazing angle a 1.8 m
          eye height gives it, turned into one enormous specular mirror for the
          studio IBL and the cool CI rim light — the frame came back as a sheet
          of saturated cyan with the room somewhere behind it. Perforated steel
          tile with 40 years of chair castors on it is closer to 0.05/0.85, and
          the room reads as a room again. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0a1418" metalness={0.05} roughness={0.85} />
      </mesh>
      <mesh position={[0, 5, -5.3]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#081319" metalness={0.15} roughness={0.95} />
      </mesh>
      <mesh position={[-5.3, 5, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#081319" metalness={0.15} roughness={0.95} />
      </mesh>
      {/* The mirrored side wall. With only one, the half of frame the camera
          actually looks at was open void, so the "room" had no far corner to
          sit in. */}
      <mesh position={[5.3, 5, -1.5]} rotation={[0, -Math.PI / 2, 0]}>
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
    // Face the room at the camera the app actually uses.
    //
    // PROP_LAYOUT is authored around "camera at [0, 1.6, 3] looking toward the
    // origin" — the <Canvas camera> default. But Scene3D immediately overrides
    // it from `sceneConfig.cameraPosition`, which is [0, 1.8, -2]: the opposite
    // side of the avatar. Every prop sits at negative z, so the camera stood
    // BEHIND all of them, inside the shell, looking out at bare floor. The only
    // thing that ever made it into frame was the Prologica CP-500 at z = +0.5,
    // which is exactly the lone cream-coloured cabinet corner visible at the
    // bottom-right of the committed diorama screenshot.
    //
    // A half-turn is the whole fix: the layout is a rigid body, so the room is
    // identical from the other side, and it also swings the cool rim light from
    // 3.6 m in front of the camera (where it was scorching the near floor) to
    // behind the avatar, where a rim light belongs.
    <group name="datacenter-diorama" rotation={[0, Math.PI, 0]}>
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
