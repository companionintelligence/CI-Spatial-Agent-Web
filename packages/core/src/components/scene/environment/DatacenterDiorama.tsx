/**
 * DatacenterDiorama — a 1970s research-datacenter environment the avatar stands inside.
 * Real hardware history (RAMAC 305 '56 through the Prologica CP-500 '82), a floor/wall/
 * ceiling shell, and a warm/cool "diegetic warm, chrome cool" lighting accent layered on
 * top of Scene3D's key/fill/rim rig. Opt-in via `sceneConfig.environment` — the default
 * plain-studio viewport is unchanged unless a caller sets `environment: 'datacenter-1970s'`.
 *
 * Each prop is a real Sketchfab-sourced mesh (FBX/.blend originals, re-exported to GLB —
 * see docs/DIORAMA.md), so pivots/scale vary per source; PROP_LAYOUT carries a small
 * per-item correction alongside its placement.
 */
import { ContactShadows, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  DioramaProps,
  PropTargetMaxDim,
  DEFAULT_FINISH,
  PROP_GEOMETRY_CROP,
  PROP_NEEDS_REEXPORT,
  PROP_SCALE_TOLERANCE,
  PROP_SURFACE,
  PROP_TINT,
  SURFACE_FINISH,
  type DioramaPropName
} from './DioramaProps'
import { DETAIL_ROUGHNESS_MEAN, detailMapsFor } from './detailSurface'

interface PropPlacement {
  name: DioramaPropName
  position: [number, number, number]
  rotation?: [number, number, number]
  /** Fine-tune multiplier on top of the GLB's baked real-world scale (see docs/DIORAMA.md
   *  for the per-prop target dimensions used at export time). Default 1 — leave as-is. */
  scale?: number
}

// ── Where things are, and why ────────────────────────────────────────────────────────
//
// EVERY PLACEMENT IS AGAINST THE CAMERA THE APP ACTUALLY USES. `sceneConfig.cameraPosition`
// is never where the camera ends up: AvatarModel finds the head bone on load and Scene3D's
// handleHeadLocated overwrites both position and target with it. Measured off the live
// render the camera parks `cameraDistance` in front of the head bone at about y = 1.64,
// looking down -Z, fov 50. So at depth d the LANDSCAPE frame is +/-0.830*d wide and
// +/-0.466*d high, and the PORTRAIT frame is only +/-0.262*d wide — a third as much.
//
// The previous staging failed the room in three specific ways, all of which this layout
// answers:
//
//   1. EVERYTHING WAS FAR AWAY. The nearest machine was the Alto at z = -2.75 and the whole
//      back wall of iron sat at z = -4.7 to -5.0 against a wall at -5.3. At 2.4 m of camera
//      distance that puts the machines 7.1-7.4 m from the lens, where a 1.2 m cabinet is
//      about a tenth of the frame width. The room read as scattered specks around a lot of
//      dead space. The rows now START at z = -1.45, i.e. 1.45 m behind the avatar.
//
//   2. THERE WERE NO ROWS. Six machines spread across nine metres of wall is a warehouse,
//      not a machine room. A 1970s machine room is RANKS: identical cabinets bolted in
//      parallel lines with an aisle down the middle. That is what MACHINE_ROWS builds, by
//      instancing verified geometry (see InstancedProp) rather than inventing machines.
//
//   3. THE DESK WAS IN THE WRONG PLACE. It sat at x = -2.55, out on the left edge, because
//      of an old HUD constraint (ChatPanel covers the right ~280 px of a 1280-wide frame,
//      so the first pass fled to the far left). Pushed that far out it stopped being the
//      avatar's desk and became another scattered prop. It is now directly behind him at
//      x = 0, which is what the room is supposed to say: this is his workstation, he is
//      standing at it. It is 2.3 m wide against a ~0.5 m avatar, so it reads on BOTH sides
//      of him and the objects on it are placed off-centre to stay out of his silhouette.
const DESK_TOP_Y = 0.74
const DESK_Z = -1.78
const DESK_HALF_WIDTH = 1.15

/** Back wall. Pulled in from -5.3 so the far rank of machines is inside the room. */
const BACK_WALL_Z = -5.75
/**
 * Ceiling height. A real machine room is a LOW lit box, not an open sky — 2.8 m is a
 * period suspended-ceiling height and it is also the composition fix: the machines top out
 * at 1.2-1.7 m, so every centimetre between their tops and the ceiling is dead wall, and in
 * a 9:16 frame that band was most of the upper half. Dropping it from 3.05 closes the gap.
 */
const CEILING_Y = 2.8
const SIDE_WALL_X = 5.0

// ── The ranks ────────────────────────────────────────────────────────────────────────
//
// Two rows either side of a 4.6 m aisle the avatar stands in, plus an outer pair, plus a
// back rank across the wall. Cabinet fronts face INTO the aisle (rotation +/-PI/2), which
// is how they were actually installed — service clearance front and back, cables under the
// raised floor. From a camera on the aisle centreline the fronts are foreshortened but
// fully visible (the camera is on the +X side of the left row's front normal and the -X
// side of the right row's), and the receding row is what sells the depth.
//
// Row pitch is 1.28 m: a 1.20 m cabinet plus an 0.08 m gap, so they read as bolted
// together rather than parked.
const ROW_PITCH = 1.28
const INNER_ROW_X = 2.3
const OUTER_ROW_X = 4.05

type Transform = { position: [number, number, number]; rotation?: [number, number, number] }

const rank = (
  x: number,
  zStart: number,
  count: number,
  rotY: number,
  pitch = ROW_PITCH
): Transform[] =>
  Array.from({ length: count }, (_, i) => ({
    position: [x, 0, zStart - i * pitch] as [number, number, number],
    rotation: [0, rotY, 0] as [number, number, number]
  }))

/**
 * Every instance of the workhorse cabinet. ibm-1401-cpu.glb is the right geometry for this:
 * MEASURED 1.20 x 1.20 x 0.73 m, ONE mesh, ONE material, 2872 triangles, floor-aligned and
 * centred — a plain grey IBM cabinet with a louvred front and a small panel top-left. Sixteen
 * of them is one draw call (see InstancedProp) and about 46k triangles.
 *
 * Repeating one verified cabinet is not a shortcut around the asset problem, it is what the
 * room looked like: a 1401 installation WAS a line of identical boxes.
 */
const CABINET_RANKS: Transform[] = [
  // The inner ranks start BEHIND the desk (z = -1.78), not in front of it. At -1.45 the
  // first cabinet of each row stood between the avatar's desk and the camera, so the
  // nearest machine cut across the desk it was supposed to sit behind. Reading order out
  // from the avatar is now: desk, ranks, back rank, wall.
  ...rank(-INNER_ROW_X, -2.2, 3, Math.PI / 2),
  ...rank(INNER_ROW_X, -2.2, 3, -Math.PI / 2),
  ...rank(-OUTER_ROW_X, -2.85, 3, Math.PI / 2),
  ...rank(OUTER_ROW_X, -2.85, 3, -Math.PI / 2),
  // Back rank, fronts to camera, filling the wall either side of the hero machines.
  { position: [-3.95, 0, -5.4], rotation: [0, 0.1, 0] },
  { position: [3.95, 0, -5.4], rotation: [0, -0.1, 0] }
]

/**
 * Tape frames, instanced for height variation. ibm-2401-tape.glb is MEASURED
 * 0.77 x 1.70 x 0.78 m, 4 meshes, 3575 triangles — a tall narrow cabinet, half a metre
 * taller than the 1401 boxes. Capping each aisle row with one breaks the flat skyline that
 * sixteen identical 1.2 m cabinets would otherwise give.
 */
const TAPE_RANKS: Transform[] = [
  { position: [-INNER_ROW_X, 0, -2.2 - 3 * ROW_PITCH], rotation: [0, Math.PI / 2, 0] },
  { position: [INNER_ROW_X, 0, -2.2 - 3 * ROW_PITCH], rotation: [0, -Math.PI / 2, 0] },
  { position: [-OUTER_ROW_X, 0, -2.85 - 3 * ROW_PITCH], rotation: [0, Math.PI / 2, 0] },
  { position: [OUTER_ROW_X, 0, -2.85 - 3 * ROW_PITCH], rotation: [0, -Math.PI / 2, 0] }
]

const PROP_LAYOUT: PropPlacement[] = [
  // --- hero machines, centre-back: the ones with texture and silhouette worth reading.
  //     Brought in from z = -4.7..-5.0 to -5.0..-5.35 against a wall that itself moved from
  //     -5.3 to -5.75 — the ABSOLUTE z barely changes, but the rows now run from 1.45 m
  //     behind the avatar all the way to them, so nothing is stranded in open floor. ---
  { name: 'IBM RAMAC 305 (1956)', position: [-1.45, 0, -5.05], rotation: [0, 0.22, 0] },
  { name: 'IBM 3350 Disk (1975)', position: [1.35, 0, -5.0], rotation: [0, -0.22, 0] },
  { name: 'IBM 2401 Tape', position: [0.0, 0, -5.35], rotation: [0, 0, 0] },

  // --- the workstation, DIRECTLY BEHIND THE AVATAR ---
  // The Alto stands on the floor because it is a floor-standing machine: the GLB is the
  // whole unit, disk pedestal included, 1.30 m tall. It anchors the left end of the desk.
  { name: 'Xerox Alto (1973)', position: [-1.62, 0, -1.92], rotation: [0, 0.34, 0] },

  // --- on the desk, kept off the centreline so the avatar does not eclipse them ---
  { name: 'Prologica CP-500 (1982)', position: [0.74, DESK_TOP_Y, -1.66], rotation: [0, -0.38, 0] },
  { name: 'IBM 3178 Terminal (1979)', position: [0.3, DESK_TOP_Y, -1.9], rotation: [0, -0.2, 0] },
  { name: 'Plugboard', position: [-0.66, DESK_TOP_Y, -1.74], rotation: [0, 0.28, 0] },
  { name: 'Engelbart Mouse (1963)', position: [0.34, DESK_TOP_Y, -1.44], rotation: [0, 0.18, 0] },
  { name: 'KENBAK-1 (1971)', position: [-0.2, DESK_TOP_Y, -1.62], rotation: [0, 0.3, 0] },

  // --- ON THE FLOOR, DELIBERATELY, BECAUSE OF WHAT THE ASSET ACTUALLY IS ---
  // commodore-pet.glb is not a Commodore PET. Rendered on its own it is a stack of five
  // retail cartons, texture and all: "PET 2001 Series / personal computer" printed on the
  // side of each box. As floor stock it is exactly what it is and needs no excuse — a
  // shipment nobody has unpacked is a true thing to find in this room. It now sits in the
  // gap between the left inner and outer ranks, where it is seen THROUGH the row and does
  // the useful job of proving there is space back there.
  { name: 'Commodore PET (1977)', position: [-3.18, 0, -2.15], rotation: [0, 0.45, 0] }
]

/**
 * The layout minus the props whose GLBs are not usable as shipped
 * (PROP_NEEDS_REEXPORT — the KENBAK-1, the IBM 3178 and the 1401 mainframe, all measured
 * and explained there). PROP_LAYOUT keeps all twelve authored placements, so a good
 * re-export drops back into the room by deleting one line in DioramaProps.ts.
 *
 * Removing the 3178 would leave a hole in the middle of the desk, so the CP-500 takes its
 * slot. The KENBAK-1's slot is simply left empty.
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
 * PROP_SCALE_TOLERANCE off target, rescale it rather than let it swallow the frame;
 * within tolerance the shipped scale is used untouched.
 *
 * Every prop the diorama places is within tolerance, so this returns 1 for all of them —
 * it is a tripwire, not a load-bearing correction, and it is deliberately NOT the answer
 * to the props in PROP_NEEDS_REEXPORT.
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

/**
 * Drop the detached geometry named in PROP_GEOMETRY_CROP — for the RAMAC, the tape reel
 * that floats half a metre off its right-hand face (see the long note there).
 *
 * Per TRIANGLE, not per node, because the offending primitives also carry the machine's own
 * internals; the seam between "attached" and "floating" is a plane, not a scene-graph edge.
 * Each triangle's centroid is taken to the PROP ROOT's space (the mesh's own matrix chain,
 * which is where PROP_GEOMETRY_CROP's numbers were measured) and compared against the
 * threshold. Geometry is rebuilt as a fresh index on the same attribute buffers, so nothing
 * is copied and the vertex data is shared with the cached GLTF.
 *
 * Returns the number of triangles removed, so a silently-ineffective crop (wrong axis, a
 * re-export that moved the seam) is visible rather than a no-op nobody notices.
 */
function cropDetachedGeometry(
  root: THREE.Object3D,
  axis: 'x' | 'y' | 'z',
  keepBelow: number
): number {
  root.updateWorldMatrix(true, true)
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const toRoot = new THREE.Matrix4()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let dropped = 0

  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry as THREE.BufferGeometry
    const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!position) return

    toRoot.multiplyMatrices(inverseRoot, mesh.matrixWorld)
    const index = geometry.getIndex()
    const triangles = index ? index.count / 3 : position.count / 3
    const at = (i: number) => (index ? index.getX(i) : i)

    const kept: number[] = []
    for (let t = 0; t < triangles; t++) {
      const i0 = at(t * 3)
      const i1 = at(t * 3 + 1)
      const i2 = at(t * 3 + 2)
      a.fromBufferAttribute(position, i0).applyMatrix4(toRoot)
      b.fromBufferAttribute(position, i1).applyMatrix4(toRoot)
      c.fromBufferAttribute(position, i2).applyMatrix4(toRoot)
      const centroid = (a[axis] + b[axis] + c[axis]) / 3
      if (centroid <= keepBelow) kept.push(i0, i1, i2)
      else dropped++
    }

    if (kept.length === triangles * 3) return
    geometry.setIndex(kept)
    geometry.clearGroups()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  })

  return dropped
}

/**
 * Clone a loaded GLB for placement: `useGLTF` hands back a shared, cached scene, so anything
 * that mutates geometry (the crop) must work on a copy or it poisons every other user of the
 * same URL — including the instanced ranks.
 *
 * `scene.clone(true)` shares BufferGeometry between the clone and the cache, so the crop has
 * to deep-clone the geometry of any mesh it is about to re-index.
 */
/**
 * Restate a prop's materials: base-colour grade (PROP_TINT) and surface finish (PROP_SURFACE
 * / SURFACE_FINISH), in one pass over one clone.
 *
 * Materials are cloned first for the same reason geometry is: useGLTF's cache is shared, and
 * multiplying a cached material's colour would re-grade it on every reload, compounding the
 * tint until the prop went black. The clone is also what makes it safe to hang a per-prop
 * detail map off the material at all.
 *
 * The finish half is where most of the "these are not plastic" comes from — see the long note
 * on SURFACE_FINISH. Two details in here that are not obvious:
 *
 *   `envMapIntensity` does nothing until the scene has an environment worth reflecting.
 *   Scene3D used to light this room with the studio HDRI, a white lightbox, and an earlier
 *   pass concluded from that that envMapIntensity was a no-op knob. It was a no-op because
 *   the map was featureless, not because the knob is dead. With MachineRoomEnvironment it is
 *   the strongest single control on how metal these cabinets read.
 *
 *   `roughness` is divided by DETAIL_ROUGHNESS_MEAN when the detail roughness map is applied,
 *   because three MULTIPLIES the scalar by the map's green channel. Without the division every
 *   number in SURFACE_FINISH would silently mean something ~14% smoother than it says.
 */
function applyMaterials(root: THREE.Object3D, name: DioramaPropName) {
  const tint = PROP_TINT[name]
  const multiplier = tint ? new THREE.Color(tint[0], tint[1], tint[2]) : null
  const surface = PROP_SURFACE[name]

  const restate = (material: THREE.Material) => {
    const next = material.clone() as THREE.MeshStandardMaterial
    if (multiplier) next.color?.multiply(multiplier)
    if (!next.isMeshStandardMaterial) return next

    const finishName = surface?.byMaterial?.[material.name] ?? surface?.finish ?? DEFAULT_FINISH
    const finish = SURFACE_FINISH[finishName]
    next.metalness = finish.metalness
    next.roughness = finish.roughness
    next.envMapIntensity = finish.envMapIntensity

    const grain = detailMapsFor(finish.detailRepeat)
    if (grain && finish.detailStrength > 0) {
      next.normalMap = grain.normal
      next.normalScale = new THREE.Vector2(finish.detailStrength, finish.detailStrength)
    }
    // The slow gloss unevenness, at its own much coarser tiling rate. Only where the material
    // has no authored roughness map to overwrite.
    const mottle = detailMapsFor(finish.mottleRepeat)
    if (mottle && !next.roughnessMap) {
      next.roughnessMap = mottle.roughness
      next.roughness = Math.min(1, finish.roughness / DETAIL_ROUGHNESS_MEAN)
    }
    next.needsUpdate = true
    return next
  }

  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(restate)
      : restate(mesh.material)
  })
}

function usePreparedProp(name: DioramaPropName) {
  const { scene } = useGLTF(DioramaProps[name])
  return useMemo(() => {
    const cloned = scene.clone(true)
    const crop = PROP_GEOMETRY_CROP[name]
    if (crop) {
      cloned.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) mesh.geometry = mesh.geometry.clone()
      })
      cropDetachedGeometry(cloned, crop.axis, crop.keepBelow)
    }
    applyMaterials(cloned, name)
    return cloned
  }, [scene, name])
}

function DioramaProp({ placement }: { placement: PropPlacement }) {
  const cloned = usePreparedProp(placement.name)
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
 * One prop, drawn N times in ONE draw call per source mesh.
 *
 * The rows are the single biggest thing added to this scene — twenty machines where there
 * were six — and drawing them as twenty `<primitive>` clones would be twenty scene-graph
 * subtrees, twenty world-matrix chains and twenty draw calls, at a capture resolution of
 * 3840x2160. As InstancedMesh it is one draw call for the sixteen cabinets and four for the
 * tape frames, because cost scales with the SOURCE mesh count, not the instance count.
 *
 * The GLB's own node transforms have to be baked into each instance matrix: these props keep
 * their source scale (~0.002) and pivot offsets on the nodes, so an instance matrix built
 * from the placement alone would render the mesh at raw source units in the wrong place.
 * Each instance is therefore `placement * meshWorldMatrix`, with meshWorldMatrix taken
 * relative to the GLB root.
 */
function InstancedProp({
  name,
  transforms
}: {
  name: DioramaPropName
  transforms: Transform[]
}) {
  const source = usePreparedProp(name)

  const batches = useMemo(() => {
    source.updateWorldMatrix(true, true)
    const inverseRoot = new THREE.Matrix4().copy(source.matrixWorld).invert()
    const normalize = normalizationFactor(name, source)

    const meshes: THREE.Mesh[] = []
    source.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && mesh.geometry.getAttribute('position')) meshes.push(mesh)
    })

    const placement = new THREE.Matrix4()
    const meshLocal = new THREE.Matrix4()
    const instance = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scaleVector = new THREE.Vector3(normalize, normalize, normalize)

    return meshes.map((mesh) => {
      const instanced = new THREE.InstancedMesh(mesh.geometry, mesh.material, transforms.length)
      instanced.castShadow = false
      instanced.receiveShadow = false
      meshLocal.multiplyMatrices(inverseRoot, mesh.matrixWorld)
      transforms.forEach((t, i) => {
        euler.set(...(t.rotation ?? [0, 0, 0]))
        quaternion.setFromEuler(euler)
        placement.compose(new THREE.Vector3(...t.position), quaternion, scaleVector)
        instance.multiplyMatrices(placement, meshLocal)
        instanced.setMatrixAt(i, instance)
      })
      instanced.instanceMatrix.needsUpdate = true
      instanced.frustumCulled = false
      return instanced
    })
  }, [source, name, transforms])

  useEffect(() => () => batches.forEach((b) => b.dispose()), [batches])

  return (
    <group>
      {batches.map((b, i) => (
        <primitive key={i} object={b} />
      ))}
    </group>
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
        distance={16}
        decay={2}
      />
    </group>
  )
}

/**
 * Warm tungsten-amber practical on a cabinet face — the era's indicator glow.
 *
 * Intensity and distance are both a third of what they were, because at the old numbers
 * these stopped being indicators and became the brightest thing in the room: a point light
 * 0.3 m off a flat cabinet front falls off so steeply across that front that it renders as
 * a hard white disc, and the frame came back with what looked like a small sun stuck to the
 * RAMAC. Same failure mode the back-wall wash note below describes, at a smaller scale.
 * Dimmer and shorter-throw, it reads as a lit panel instead.
 */
function IndicatorLamp({ position, color = '#e8a24a' }: { position: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.PointLight>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.intensity = 0.12 + 0.09 * Math.abs(Math.sin(clock.getElapsedTime() * 1.3 + phase))
  })
  return <pointLight ref={ref} position={position} color={color} intensity={0.14} distance={1.5} decay={2} />
}

/**
 * The ceiling fluorescents, and the reason the room now reads as a room.
 *
 * A 1970s machine room is a LOW LIT BOX. The single most recognisable thing about one is the
 * grid of recessed troffers overhead and the fact that you can see where the ceiling is. The
 * previous shell had no ceiling at all, so above the 2 m mark the frame went to void and the
 * "room" had no top — which is most of why it read as props on a black stage.
 *
 * The strips are emissive quads (no lighting cost) plus ONE point light each (cheap, no
 * shadow). They run along -Z over each aisle, so they also give the ranks their top light
 * and lay a receding line of highlights down the frame, which is free perspective.
 */
function CeilingLights() {
  const strips = [-3.18, -1.15, 1.15, 3.18]
  return (
    <group>
      {/* The ceiling plane itself, just dark enough to be a surface rather than a hole. */}
      <mesh position={[0, CEILING_Y, -2.2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2 * SIDE_WALL_X, 11]} />
        <meshStandardMaterial color="#141d22" metalness={0} roughness={1} />
      </mesh>
      {strips.map((x) => (
        <group key={x}>
          <mesh position={[x, CEILING_Y - 0.03, -2.4]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.44, 9.4]} />
            {/* emissiveIntensity is above 1 ON PURPOSE and it is not a brightness control.
                These quads already render clipped at 255 and going higher cannot make a white
                pixel whiter — what it does is raise the value the bloom pass sees, so the
                troffers get the halo a real fluorescent has behind a diffuser instead of
                reading as white stickers on the ceiling. Bloom's threshold stays where it is,
                which keeps the cabinets out of it.

                1.25 and not higher because of the PORTRAIT frame. At 1.7 the halo is right in
                landscape, where the ceiling is a thin band across the top; in 9:16 the ceiling
                fills the whole top third and the same halo washed it to a single white block
                behind the chat log. The 16:9 cut can afford a brighter practical than the 9:16
                one can, and this is the value that works in both. */}
            <meshStandardMaterial
              color="#0c1417"
              emissive="#cfe4ea"
              emissiveIntensity={1.25}
              toneMapped={false}
            />
          </mesh>
          {/* Two sources per strip so the throw follows the strip instead of hot-spotting
              at its middle. distance has to clear the drop to the floor or the light dies
              before it arrives. */}
          <pointLight position={[x, CEILING_Y - 0.25, -1.1]} color="#dceef2" intensity={5.5} distance={9} decay={2} />
          <pointLight position={[x, CEILING_Y - 0.25, -4.4]} color="#dceef2" intensity={5.5} distance={9} decay={2} />
        </group>
      ))}
    </group>
  )
}

function RoomShell() {
  return (
    <group>
      {/* Raised computer-room floor tile: matte, not chrome, and no longer the
          brightest thing in the picture.
          #138 took metalness 0.4 -> 0.05 to stop this plane mirroring the studio IBL.
          It barely helped, and the reason is worth writing down: metalness is not the
          lever at a grazing angle. A camera at 1.6 m sees almost the whole plane
          near-edge-on, and at grazing incidence the Fresnel term goes to 1 for a
          dielectric too — so the floor kept reflecting the environment at close to full
          strength however low metalness went. What actually moves it is (a) keeping the
          studio IBL down (Scene3D's iblIntensity) and (b) roughness 1, which scatters
          what little is left. Metalness is 0 because a perforated steel tile with forty
          years of chair castors on it is not a metal mirror.

          ROUGHNESS IS NO LONGER 1, and the reason is that the thing being reflected changed.
          The argument above is exactly right about grazing incidence — the floor does reflect
          the environment at nearly full strength however low metalness goes — but its
          conclusion depended on the environment being drei's `studio` HDRI, a featureless
          white box, where "reflects the environment strongly" means "is uniformly bright".
          The environment is now MachineRoomEnvironment: a dark room with four narrow ceiling
          strips in it. Reflecting that strongly at a grazing angle does not wash the floor
          out, it lays four long specular streaks down the aisle, which is the single most
          recognisable thing about a real machine-room floor. 0.8 rather than lower keeps them
          as smears rather than mirror images. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#111c21" metalness={0} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.6, BACK_WALL_Z]}>
        <planeGeometry args={[2 * SIDE_WALL_X, 6.6]} />
        <meshStandardMaterial color="#16262d" metalness={0} roughness={1} />
      </mesh>
      <mesh position={[-SIDE_WALL_X, 2.6, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[9, 6.6]} />
        <meshStandardMaterial color="#132229" metalness={0} roughness={1} />
      </mesh>
      {/* The mirrored side wall. With only one, the half of frame the camera actually
          looks at was open void, so the "room" had no far corner to sit in. */}
      <mesh position={[SIDE_WALL_X, 2.6, -1.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[9, 6.6]} />
        <meshStandardMaterial color="#132229" metalness={0} roughness={1} />
      </mesh>
      <CeilingLights />
    </group>
  )
}

/**
 * The resident's desk. Plain painted-steel furniture, not a catalog prop — nothing in
 * DioramaProps is furniture, and PROP_LAYOUT used to talk about "the side desk's 0.74 m
 * top" as though one existed. It did not, so the desk-height artifacts hovered.
 *
 * Now directly behind the avatar (see the note on PROP_LAYOUT), wider than before at 2.3 m
 * so it reads either side of him, and with a modesty panel across the back so the gap under
 * the top does not become a bright slot straight through to the lit aisle behind.
 *
 * Kept deliberately dumb: a top, two end panels and a back. It is a surface for real
 * hardware to sit on, not a modelled object competing with the machines for attention.
 */
function ResidentDesk() {
  const top = 0.06
  return (
    <group position={[0, 0, DESK_Z]}>
      <mesh position={[0, DESK_TOP_Y - top / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[2 * DESK_HALF_WIDTH, top, 0.85]} />
        <meshStandardMaterial color="#2f3a41" metalness={0.2} roughness={0.72} />
      </mesh>
      {[-(DESK_HALF_WIDTH - 0.03), DESK_HALF_WIDTH - 0.03].map((x) => (
        <mesh key={x} position={[x, (DESK_TOP_Y - top) / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.05, DESK_TOP_Y - top, 0.78]} />
          <meshStandardMaterial color="#232d33" metalness={0.2} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, (DESK_TOP_Y - top) / 2 + 0.08, -0.36]} receiveShadow>
        <boxGeometry args={[2 * DESK_HALF_WIDTH - 0.1, DESK_TOP_Y - top - 0.16, 0.04]} />
        <meshStandardMaterial color="#1d262b" metalness={0.15} roughness={0.85} />
      </mesh>
    </group>
  )
}

export interface DatacenterDioramaProps {
  /** Include the floor/wall/ceiling shell. Off for compositing over an existing room. */
  showShell?: boolean
}

export function DatacenterDiorama({ showShell = true }: DatacenterDioramaProps) {
  return (
    // NO half-turn. The room faces -Z, which is where the camera looks.
    //
    // #138 added `rotation={[0, Math.PI, 0]}` on the reasoning that Scene3D overrides the
    // camera from `sceneConfig.cameraPosition` = [0, 1.8, -2], so the camera stood behind
    // the props. That premise is wrong, and the half-turn it justified is what emptied the
    // frame. sceneConfig.cameraPosition is never where the camera ends up: AvatarModel
    // locates the head bone on load and Scene3D's handleHeadLocated overwrites BOTH camPos
    // and camTarget with it. MEASURED by wrapping WebGLRenderer#render and reading the
    // camera it is handed: the camera sits at [0, 1.638, +1.008] with forward [0, 0, -1] —
    // the same side, and the same direction, PROP_LAYOUT was authored for.
    <group name="datacenter-diorama">
      {showShell && <RoomShell />}
      <ResidentDesk />

      {/* ── the room's own light ────────────────────────────────────────────────────
          Placed against the camera the app actually uses — roughly [0, 1.64, +2.4]
          looking down -Z — not against sceneConfig.cameraPosition, which is never where
          the camera ends up.

          INTENSITIES ARE LARGE AND THAT IS PHYSICS, NOT TASTE. These are `decay={2}`
          lights, i.e. inverse-square: irradiance is intensity / d^2. A source 3-4 m from
          what it lights delivers a twelfth to a sixteenth of its number. `distance` is a
          hard cutoff and has to clear the throw or the light stops before it arrives.

          The overhead fluorescents in CeilingLights are now the room's base layer, so
          these are accents on top of it rather than the entire lighting model. */}

      {/* Tungsten practical raking the back rank, off-centre so the row is not flatly
          front-lit. */}
      <pointLight position={[1.3, 2.6, -4.1]} color="#f0a95c" intensity={16} distance={10} decay={2} />

      {/* The practical the resident works under. This is the shot's SECOND read after the
          avatar: a warm pool on the desk directly behind him, so the eye goes
          avatar -> desk -> ranks -> back wall. */}
      <pointLight position={[0.15, 1.95, -1.6]} color="#e8a24a" intensity={9} distance={5.5} decay={2} />

      {/* Cool CI rim, high and behind, to separate the avatar's shoulders and the cabinet
          tops from the wall — "diegetic warm, chrome cool" (docs/DIORAMA.md). */}
      <AimedLight position={[-4.2, 3.0, -0.4]} target={[-0.4, 1.4, -4.6]} color="#00a9a7" intensity={30} angle={0.75} />

      {/* Back-wall bounce, so the wall reads as a lit surface the machines silhouette
          against instead of the black void that made "no wall detail" indistinguishable
          from "no wall".
          SPOT lights from out in the room, NOT point lights parked against the wall. Tried
          that first and it looked exactly like what it was: a point light 0.4 m off a flat
          plane falls off so fast across that plane that it renders as a hard bright disc,
          and the frame came back with three glowing circles floating on the back wall.
          Pulling the source back and using a wide cone with full penumbra spreads the same
          energy into a gradient.

          Aimed at y = 2.2 rather than 1.5: the machines only reach 1.2-1.7 m, so everything
          the wash used to hit was behind a cabinet, and the band of wall ABOVE the ranks —
          which is a big share of a 9:16 frame — stayed dead flat. */}
      <AimedLight position={[-2.6, 3.4, -1.2]} target={[-2.2, 2.2, -5.7]} color="#4a7f92" intensity={52} />
      <AimedLight position={[2.6, 3.4, -1.2]} target={[2.2, 2.2, -5.7]} color="#3f7285" intensity={46} />

      {/* Indicator glow on the hero machines' faces. Kept to the back rank so it reads as
          machine panels rather than as loose fireflies in the aisle. */}
      <IndicatorLamp position={[-1.5, 1.15, -4.75]} color="#e8a24a" />
      <IndicatorLamp position={[0.0, 1.35, -5.05]} color="#58ebbf" />
      <IndicatorLamp position={[1.4, 1.15, -4.7]} color="#58ebbf" />

      {/* ── contact shadows: what seats the machines on the floor ────────────────────
          Every machine in the room was floating. Not by a measurable amount — the GLBs are
          floor-aligned and the test asserts it — but visually, because nothing under them was
          any darker than the aisle beside them. A cabinet with no occlusion at its base reads
          as pasted onto the floor rather than standing on it, and twenty of them read as a
          collage.

          This is drei's ContactShadows rather than shadow-mapping the ranks, for two reasons.
          The room's key is four overhead fluorescents, so the true shadow here is a soft
          ambient occlusion pool directly under each machine, not the hard directional shadow
          Scene3D's studio key light would cast from [3, 5, 5] — which would rake across the
          floor at 45 degrees and contradict the ceiling. And it is far cheaper: SSAO would run
          a depth+normal pass every frame at capture resolution, where this runs a low-res depth
          pass for the first `frames` and then never again.

          `frames` is not 1 — the avatar takes a moment to settle into its idle and a
          single-frame capture catches it mid-T-pose — but it is not large either, and the
          reason is MEASURED. Each of those frames re-renders the whole scene into the shadow
          buffer, so while the counter is running the frame costs about twice what it settles
          at. At 90 frames on an unloaded machine that is a second and a half; on a loaded one
          the frame rate drops, the 90 frames stretch to thirteen seconds, and the capture rig
          films inside the warm-up. Caught exactly that: one run came back at 6.8 fps and 187
          draw calls per frame where the settled figures are ~40 and 108. 45 frames at
          resolution 512 halves both the length of that window and its cost.

          `far` is 2.2 so the pass sees the machines (1.2-1.7 m) and the desk but not the
          2.8 m ceiling, which would otherwise occlude the entire floor. */}
      <ContactShadows
        position={[0, 0.008, -2.6]}
        width={13}
        height={11}
        scale={1}
        far={2.2}
        blur={2.6}
        opacity={0.72}
        resolution={512}
        frames={45}
        color="#04090c"
      />

      {/* ── the ranks ─────────────────────────────────────────────────────────────── */}
      <InstancedProp name="IBM 1401 CPU" transforms={CABINET_RANKS} />
      <InstancedProp name="IBM 2401 Tape" transforms={TAPE_RANKS} />

      {VISIBLE_LAYOUT.map((p) => (
        <DioramaProp key={p.name} placement={p} />
      ))}
    </group>
  )
}

// Preload every catalog prop so the diorama pops in without a per-item Suspense stutter.
Object.values(DioramaProps).forEach((url) => useGLTF.preload(url))
