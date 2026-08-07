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
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  DioramaProps,
  PropTargetMaxDim,
  PROP_NEEDS_REEXPORT,
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
// `scale` is a rare fine-tune, not a correction.
//
// EVERY PLACEMENT IS AGAINST THE CAMERA THE APP ACTUALLY USES, which is not the one the
// original comment here named. Measured off the live render: [0, 1.64, +2.41] looking down
// -Z, fov 50, aspect 1.78 — so at depth d the frame is +/-0.830*d wide and +/-0.466*d high
// about the camera's own height. The back wall row was inside that; the old "terminal row"
// was not. It ran from x = 2.7 out to x = 3.7 while curving TOWARD the camera to z = +0.5,
// which is the worst possible direction, because the nearer a prop gets the narrower the
// frame is where it sits. Measured at the old positions the Commodore PET landed at NDC x
// 0.84..1.15 and the CP-500 at 1.27..1.74, against a right-hand frame edge of 1.0 — the row
// was a bright sliver clipping the corner, not a desk.
//
// The desk-height artifacts moved for a second reason: they were authored at y = 0.74,
// "the side desk's 0.74 m top", and there has never been a side desk — nothing in
// DioramaProps is furniture. At the old 0.5 m bust framing they were off-frustum so it
// never showed. At a framing that can see the room they are a mouse and a plugboard
// hovering in mid-air. They now sit on ResidentDesk, which is real geometry.
//
// THE WORKSTATION IS ON THE LEFT, AND THAT IS A HUD CONSTRAINT, NOT A TASTE CALL.
// This shot is filmed with the product's own chrome over it, and ChatPanel occupies the
// right ~280 px of the 1280-wide frame at full height. The first pass put the desk in the
// right third; measured against that render, every object on it — CP-500, plugboard, mouse,
// Alto — landed at screen x 970-1270, i.e. behind the chat log. The desk was there and
// could not be seen. The left third is the only region no HUD element covers, so that is
// where the second read has to live.
const DESK_TOP_Y = 0.74

const PROP_LAYOUT: PropPlacement[] = [
  // --- back wall: big iron, oldest-to-newest left to right. Spread wider than before:
  //     the avatar occludes the middle of the wall at this framing, so the row is spaced
  //     to put a machine either side of it rather than directly behind it. ---
  { name: 'IBM RAMAC 305 (1956)', position: [-3.5, 0, -4.7], rotation: [0, 0.35, 0] },
  { name: 'IBM 1401 Mainframe (1959)', position: [-1.3, 0, -4.95], rotation: [0, 0.12, 0] },
  { name: 'IBM 1401 CPU', position: [1.3, 0, -4.95], rotation: [0, -0.1, 0] },
  { name: 'IBM 3350 Disk (1975)', position: [3.4, 0, -4.7], rotation: [0, -0.3, 0] },
  { name: 'IBM 2401 Tape', position: [-0.2, 0, -5.0], rotation: [0, 0.05, 0] },

  // --- the resident's workstation, left foreground ---
  // The Alto stands on the floor because it is a floor-standing machine: the GLB is the
  // whole unit, disk pedestal included, 1.30 m tall. It is the anchor of the second read.
  { name: 'Xerox Alto (1973)', position: [-1.35, 0, -2.75], rotation: [0, -0.35, 0] },

  // --- on the desk ---
  { name: 'Prologica CP-500 (1982)', position: [-2.3, DESK_TOP_Y, -2.3], rotation: [0, 0.4, 0] },
  { name: 'IBM 3178 Terminal (1979)', position: [-2.65, DESK_TOP_Y, -2.5], rotation: [0, 0.45, 0] },
  { name: 'Plugboard', position: [-3.05, DESK_TOP_Y, -2.45], rotation: [0, 0.3, 0] },
  { name: 'Engelbart Mouse (1963)', position: [-1.95, DESK_TOP_Y, -2.05], rotation: [0, 0.15, 0] },
  { name: 'KENBAK-1 (1971)', position: [-3.3, DESK_TOP_Y, -2.2], rotation: [0, 0.5, 0] },

  // --- ON THE FLOOR, DELIBERATELY, BECAUSE OF WHAT THE ASSET ACTUALLY IS ---
  // commodore-pet.glb is not a Commodore PET. Rendered on its own it is a stack of five
  // retail cartons, texture and all: "PET 2001 Series / personal computer" printed on the
  // side of each box. It was previously placed at desk height among working machines,
  // where it read as a mystery pile of blue-and-white boxes balanced on a desk edge.
  // As floor stock against the wall it is exactly what it is and needs no excuse — a
  // shipment nobody has unpacked is a true thing to find in this room.
  { name: 'Commodore PET (1977)', position: [-4.3, 0, -3.9], rotation: [0, 0.45, 0] }
]

/**
 * The layout minus the props whose GLBs are not usable as shipped
 * (PROP_NEEDS_REEXPORT — currently the KENBAK-1 and the IBM 3178, both measured
 * and explained there). PROP_LAYOUT itself keeps all twelve authored placements,
 * so a good re-export drops back into the room by deleting one line in
 * DioramaProps.ts and nothing else.
 *
 * Removing the 3178 would leave a hole in the middle of the desk, so the CP-500
 * takes its slot: the desk then reads PET -> CP-500 -> plugboard across its width
 * instead of two machines and a gap where the centre one should be. The KENBAK-1's
 * slot is simply left empty — it is at the far left of the desk, so its absence
 * shortens the run rather than punching a hole in it.
 */
const VISIBLE_LAYOUT: PropPlacement[] = (() => {
  const absent = new Set<DioramaPropName>(PROP_NEEDS_REEXPORT)
  const slotOf = (name: DioramaPropName) => PROP_LAYOUT.find((p) => p.name === name)
  const terminalSlot = slotOf('IBM 3178 Terminal (1979)')
  return PROP_LAYOUT.filter((p) => !absent.has(p.name)).map((p) =>
    p.name === 'Prologica CP-500 (1982)' && absent.has('IBM 3178 Terminal (1979)') && terminalSlot
      ? { ...p, position: terminalSlot.position, rotation: terminalSlot.rotation }
      : p
  )
})()

/**
 * Last-resort guard against a GLB that arrives at the wrong scale.
 *
 * docs/DIORAMA.md promises every prop is scaled to its real machine's dimensions,
 * "so placements need no per-prop correction". Trusting that promise once put the
 * camera inside a 184-metre asset. If a future export lands more than
 * PROP_SCALE_TOLERANCE off target, rescale it rather than let it swallow the
 * frame; within tolerance the shipped scale is used untouched.
 *
 * Every prop the diorama currently places is within tolerance, so this returns 1
 * for all of them — it is a tripwire, not a load-bearing correction. It is
 * deliberately NOT the answer to the two props in PROP_NEEDS_REEXPORT: their
 * measured boxes are not their machines, so scaling those boxes to target
 * produces a confidently wrong shape rather than a right one. Those are left out
 * of the room instead.
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

/**
 * A soft, aimed spot. `<spotLight>` in R3F points at the origin unless it is given a
 * target object, so the target is mounted as a real child and wired up in an effect —
 * setting `target-position` alone does nothing, because the default target is never added
 * to the scene and so never gets a world matrix.
 */
function AimedLight({
  position,
  target,
  color,
  intensity,
  angle = 0.95
}: {
  position: [number, number, number]
  target: [number, number, number]
  color: string
  intensity: number
  angle?: number
}) {
  const light = useRef<THREE.SpotLight>(null)
  const aim = useRef<THREE.Object3D>(null)
  useEffect(() => {
    if (light.current && aim.current) light.current.target = aim.current
  }, [])
  return (
    <group>
      <object3D ref={aim} position={target} />
      <spotLight
        ref={light}
        position={position}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={1}
        distance={12}
        decay={2}
      />
    </group>
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
      {/* Raised computer-room floor tile: matte, not chrome, and no longer the
          brightest thing in the picture.
          #138 took metalness 0.4 -> 0.05 to stop this 14 m plane mirroring the
          studio IBL. It barely helped, and the reason is worth writing down:
          metalness is not the lever at a grazing angle. A camera at 1.6 m sees
          almost the whole plane near-edge-on, and at grazing incidence the
          Fresnel term goes to 1 for a dielectric too — so the floor kept
          reflecting the environment at close to full strength however low
          metalness went. MEASURED before this change: a #0a1418 floor rendering
          at (169,182,195), the brightest pixels in frame, sitting directly
          behind the chat input and the control dock.
          What actually moves it is (a) killing the studio IBL that was being
          mirrored — Scene3D's iblIntensity, see ENVIRONMENT_LOOK — and (b)
          roughness 1, which scatters what little is left. Same pixel after:
          (35,40,44). Metalness goes to 0 because a perforated steel tile with
          forty years of chair castors on it is not a metal mirror. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0b1519" metalness={0} roughness={1} />
      </mesh>
      <mesh position={[0, 5, -5.3]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#0d1b21" metalness={0} roughness={1} />
      </mesh>
      <mesh position={[-5.3, 5, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#0a1620" metalness={0} roughness={1} />
      </mesh>
      {/* The mirrored side wall. With only one, the half of frame the camera
          actually looks at was open void, so the "room" had no far corner to
          sit in. */}
      <mesh position={[5.3, 5, -1.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#0a1620" metalness={0} roughness={1} />
      </mesh>
    </group>
  )
}

/**
 * The resident's desk. Plain painted-steel furniture, not a catalog prop — nothing in
 * DioramaProps is furniture, and PROP_LAYOUT has always talked about "the side desk's
 * 0.74 m top" as though one existed. It did not, so the desk-height artifacts hovered.
 *
 * Kept deliberately dumb: a top and two end panels. It is a surface for real hardware to
 * sit on and a place for the practical above it to land, not a modelled object competing
 * with the machines for attention.
 */
function ResidentDesk() {
  const top = 0.06
  return (
    <group position={[-2.55, 0, -2.35]}>
      <mesh position={[0, DESK_TOP_Y - top / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.8, top, 0.85]} />
        <meshStandardMaterial color="#2b3238" metalness={0.2} roughness={0.75} />
      </mesh>
      {[-0.83, 0.83].map((x) => (
        <mesh key={x} position={[x, (DESK_TOP_Y - top) / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.05, DESK_TOP_Y - top, 0.78]} />
          <meshStandardMaterial color="#232a2f" metalness={0.2} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export interface DatacenterDioramaProps {
  /** Include the floor/wall shell. Off for compositing over an existing room. */
  showShell?: boolean
}

export function DatacenterDiorama({ showShell = true }: DatacenterDioramaProps) {
  return (
    // NO half-turn. The room faces -Z, which is where the camera looks.
    //
    // #138 added `rotation={[0, Math.PI, 0]}` on the reasoning that Scene3D
    // overrides the camera from `sceneConfig.cameraPosition` = [0, 1.8, -2], so
    // the camera stood behind the props. That premise is wrong, and the half-turn
    // it justified is what emptied the frame.
    //
    // sceneConfig.cameraPosition is never where the camera ends up. AvatarModel
    // locates the head bone on load and calls onHeadLocated, and Scene3D's
    // handleHeadLocated overwrites BOTH camPos and camTarget with it. MEASURED by
    // wrapping WebGLRenderer#render and reading the camera it is handed: the
    // camera sits at [0, 1.638, +1.008] with forward [0, 0, -1] — the same side,
    // and the same direction, PROP_LAYOUT was authored for.
    //
    // So the props were already facing the camera, and the half-turn swung all of
    // them behind it. Same measurement, per object: all five back-wall machines
    // came back with 0 of 8 AABB corners in front of the camera plane and aim
    // (dot with camera forward) between -0.68 and -0.96; the back wall itself 0/8;
    // both side walls off-screen at |NDC x| = 2.12. 0 of 11 props and 0 of 3 walls
    // were in frame. That is why raising the exposure revealed nothing — there was
    // nothing in the frustum to reveal.
    <group name="datacenter-diorama">
      {showShell && <RoomShell />}
      <ResidentDesk />

      {/* ── the room's own light ────────────────────────────────────────────
          Placed against the camera the app actually uses — [0, 1.64, +2.41]
          looking down -Z — not against sceneConfig.cameraPosition, which is
          never where the camera ends up. See the note on the group below.

          INTENSITIES ARE ~10x THE OLD ONES AND THAT IS THE FIX, NOT A TASTE
          CALL. These are `decay={2}` point lights, i.e. inverse-square in
          physical units: irradiance is intensity / d². The previous warm key
          was intensity 1.1 sitting 3-4 m from the machines it was supposed to
          be lighting, which is 1.1/12 ≈ 0.09 — an order of magnitude below the
          studio IBL that was drowning the room anyway. It was not a dim
          practical, it was an invisible one. `distance` is the hard cutoff and
          has to clear the throw or the light stops before it arrives. */}

      {/* Tungsten practical over the back wall of big iron. Off-centre so the
          row is raked rather than flatly front-lit. */}
      <pointLight position={[1.1, 2.8, -3.5]} color="#f0a95c" intensity={17} distance={11} decay={2} />

      {/* The practical the resident actually works under. This is the shot's
          SECOND read after the avatar: it puts a warm pool on the terminal row
          in the right third, so the eye goes avatar -> desk -> back wall. */}
      <pointLight position={[-2.45, 1.8, -2.25]} color="#e8a24a" intensity={8} distance={6} decay={2} />

      {/* Cool CI rim, high and behind, off the back wall's chrome. Separates the
          cabinet tops and the avatar's shoulders from the wall — "diegetic warm,
          chrome cool" (docs/DIORAMA.md). */}
      <AimedLight position={[-4.5, 3.6, -1.4]} target={[-0.6, 1.3, -4.9]} color="#00a9a7" intensity={34} angle={0.7} />

      {/* Back-wall bounce, so the wall reads as a lit surface the machines
          silhouette against instead of the black void that made "no wall detail"
          indistinguishable from "no wall".
          SPOT lights, from well out in the room, NOT point lights parked against
          the wall. Tried that first and it looked exactly like what it was: a
          point light 0.4 m off a flat plane falls off so fast across that plane
          that it renders as a hard bright disc, and the frame came back with
          three obvious glowing circles floating on the back wall. Pulling the
          source back to 2.5 m and using a wide cone with full penumbra spreads
          the same energy into a gradient. Aimed high and angled down so the wash
          dies before it reaches the floor, which keeps the bottom of frame dark
          under the chat input and the control dock. */}
      <AimedLight position={[-2.8, 3.9, -1.4]} target={[-2.4, 1.4, -5.3]} color="#4a7f92" intensity={40} />
      <AimedLight position={[2.8, 3.9, -1.4]} target={[2.4, 1.4, -5.3]} color="#3f7285" intensity={34} />

      <IndicatorLamp position={[-3.4, 1.35, -4.35]} color="#e8a24a" />
      <IndicatorLamp position={[-0.2, 1.3, -4.65]} color="#58ebbf" />
      <IndicatorLamp position={[1.3, 1.25, -4.6]} color="#e8a24a" />
      <IndicatorLamp position={[3.3, 1.35, -4.35]} color="#58ebbf" />

      {VISIBLE_LAYOUT.map((p) => (
        <DioramaProp key={p.name} placement={p} />
      ))}
    </group>
  )
}

// Preload every catalog prop so the diorama pops in without a per-item Suspense stutter.
Object.values(DioramaProps).forEach((url) => useGLTF.preload(url))
