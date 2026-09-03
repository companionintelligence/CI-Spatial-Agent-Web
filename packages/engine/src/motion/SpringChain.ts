/**
 * SpringChain — secondary motion for rigs that carry dangling bones but no solver.
 *
 * WHAT THIS IS AND IS NOT FOR
 * ---------------------------
 * Secondary motion — hair lagging a head turn, a coat tail settling a beat late —
 * is much of what separates a mannequin from a person. VRM avatars get it free
 * from `vrm.springBoneManager`. Nothing else did.
 *
 * I built this believing the GLB half of the roster had rigid hair. It does not.
 * Measured on the shipped assets via the harness's `listBones()`:
 *
 *   Greg / Ash / Jack (GLB, RPM-derived)   67 bones,   0 dangling
 *   Kenji (VRM)                            78 bones,   3 dangling
 *   Maya  (VRM)                            87 bones,   2 dangling
 *   Yuki  (VRM)                           259 bones, 170 dangling
 *
 * The GLB avatars have no hair or cloth bones AT ALL — the hair is a static mesh
 * welded to the head — so no solver can do anything for them. That is an asset
 * gap, not an engine gap, and it wants authored bones (or cloth sim on the mesh),
 * not code. Every rig in the roster that HAS dangling bones is a VRM and is
 * already handled.
 *
 * So this is inert on today's roster, deliberately. It exists because Phase 3
 * made "load any avatar from a URL" a headline feature, and the wider world of
 * .glb rigs — VRoid and MMD exports, Mixamo characters with hair joints, VRMs
 * shipped without spring-bone config — very much does have chains and no solver.
 * When such a rig loads, this runs; when none is found it costs exactly nothing,
 * because `detectSpringChains` returns an empty array and the per-frame loop has
 * nothing to iterate.
 *
 * A dangling bone chain under gravity with stiffness and damping is a Verlet
 * spring chain: ~100 lines of vector math, no dependencies, deterministic. It is
 * what VRM spring bones are underneath. The comparison system (DLP3D) solves the
 * same problem with Havok 6DOF constraints — a physics engine and a WASM blob,
 * far more machinery than this needs.
 *
 * THE INTEGRATION SUBTLETY
 * ------------------------
 * This runs AFTER the animation mixer has posed the skeleton and writes bone
 * world positions directly. It must therefore be the last thing to touch those
 * bones in a frame, and it must never be applied to bones an animation clip is
 * driving — otherwise it fights the clip and the limb jitters. `detectSpringChains`
 * only returns chains whose bones are NOT animated (see `animatedBoneNames`).
 */

/** Minimal structural type for a bone, so this stays renderer-agnostic and testable. */
export interface SpringBoneLike {
  name: string
  /** World-space position, read and written by the solver. */
  getWorldPosition(target: Vec3): Vec3
  setWorldPosition(p: Vec3): void
  children: SpringBoneLike[]
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface SpringSettings {
  /** How strongly a bone returns to its animated rest position. 0..1 per frame. */
  stiffness: number
  /** Velocity retained each frame. 0..1; higher swings longer. */
  damping: number
  /** World-space gravity, in metres per second squared. */
  gravity: Vec3
  /** Upper bound on how far a bone may stray from rest, in metres. Prevents blow-ups. */
  maxDisplacement: number
}

export const DEFAULT_SPRING: SpringSettings = {
  stiffness: 0.28,
  damping: 0.72,
  gravity: { x: 0, y: -0.55, z: 0 },
  maxDisplacement: 0.09
}

/**
 * Bone-name segments that indicate a chain which should dangle.
 *
 * Deliberately conservative. A false positive here means an ARM gets spring
 * physics and the avatar flails, which is far worse than hair that stays stiff.
 */
const SPRING_NAME_HINTS = [
  'hair', 'ponytail', 'tail', 'bang', 'bangs', 'fringe', 'braid',
  'skirt', 'coat', 'cloth', 'ribbon', 'scarf', 'tie', 'cape',
  'antenna', 'strap', 'tassel'
]

/** Anatomical bones that must never be sprung, whatever else the name says. */
const SPRING_NAME_BLOCKLIST = [
  'hand', 'finger', 'thumb', 'index', 'middle', 'pinky',
  'arm', 'forearm', 'leg', 'thigh', 'shin', 'foot', 'toe',
  'spine', 'neck', 'head', 'eye', 'jaw', 'shoulder', 'clavicle', 'hips', 'pelvis'
]

/**
 * Split a bone name into lowercase segments.
 *
 * Matching on raw substrings is wrong in both directions. `Hair_Root` contains
 * "root" and `mixamorigLeftHand` contains "hand"; only the second should be
 * rejected, and a substring test cannot tell them apart — it rejected both, which
 * skipped exactly the chains we most want (rigs overwhelmingly name the anchor
 * bone `Hair_Root` / `SkirtRoot`). Splitting on separators and camelCase makes
 * "root" a segment of its own, so it simply is not an anatomical term and never
 * blocks anything.
 */
export function boneNameSegments(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z]+/)
    .map((s) => s.toLowerCase())
    .filter(Boolean)
}

export function isSpringCandidate(name: string): boolean {
  const segments = boneNameSegments(name)
  if (segments.some((s) => SPRING_NAME_BLOCKLIST.includes(s))) return false
  return segments.some((s) => SPRING_NAME_HINTS.includes(s))
}

/**
 * Find dangling chains worth simulating.
 *
 * A chain is a run of bones descending from a spring candidate. The ROOT of the
 * chain is pinned (it is where the hair attaches to the head) and every bone
 * below it is simulated.
 *
 * `animatedBoneNames` are bones some clip is driving. A chain containing one is
 * skipped entirely — the solver would fight the animation.
 */
export function detectSpringChains(
  root: SpringBoneLike,
  animatedBoneNames: ReadonlySet<string> = new Set(),
  maxChains = 24
): SpringBoneLike[][] {
  const chains: SpringBoneLike[][] = []

  const walk = (bone: SpringBoneLike, insideChain: boolean): void => {
    if (chains.length >= maxChains) return

    const starts = !insideChain && isSpringCandidate(bone.name)
    if (starts) {
      const chain = collectDescendants(bone)
      // The root is pinned, so a chain needs at least one child to be worth solving.
      if (chain.length > 1 && !chain.some((b) => animatedBoneNames.has(b.name))) {
        chains.push(chain)
      }
      // Do not descend again into a chain we already claimed.
      return
    }

    for (const child of bone.children) walk(child, insideChain)
  }

  walk(root, false)
  return chains
}

/** A bone and its single-file descendants, deepest last. Branches take the first child. */
function collectDescendants(bone: SpringBoneLike): SpringBoneLike[] {
  const out: SpringBoneLike[] = [bone]
  let cursor = bone
  // Cap the walk: a malformed rig can contain a cycle, and an unbounded walk
  // would hang the render thread rather than merely look wrong.
  for (let depth = 0; depth < 32 && cursor.children.length > 0; depth++) {
    cursor = cursor.children[0]
    out.push(cursor)
  }
  return out
}

interface Particle {
  bone: SpringBoneLike
  /** Previous simulated world position, for Verlet integration. */
  prev: Vec3
  /** Current simulated world position. */
  curr: Vec3
  /** Distance to the parent bone at bind time — the constraint length. */
  restLength: number
}

/**
 * Solves one chain. Construct once per chain when the avatar binds; call
 * `update(delta)` after the mixer has posed the skeleton.
 */
export class SpringChain {
  private readonly particles: Particle[] = []
  private readonly settings: SpringSettings
  private initialized = false

  constructor(chain: readonly SpringBoneLike[], settings: Partial<SpringSettings> = {}) {
    this.settings = { ...DEFAULT_SPRING, ...settings }
    // Index 0 is the pinned root; it is stored so children can read its position
    // but is never integrated.
    for (const bone of chain) {
      const p = bone.getWorldPosition({ x: 0, y: 0, z: 0 })
      this.particles.push({ bone, prev: { ...p }, curr: { ...p }, restLength: 0 })
    }
    for (let i = 1; i < this.particles.length; i++) {
      this.particles[i].restLength = distance(this.particles[i - 1].curr, this.particles[i].curr)
    }
    this.initialized = this.particles.length > 1
  }

  get length(): number {
    return this.particles.length
  }

  /**
   * Advance the simulation and write the result back to the bones.
   *
   * `delta` is clamped: a tab that was backgrounded returns a delta of several
   * seconds, and integrating that in one step throws the chain to infinity. The
   * visible symptom is hair that vanishes when you switch tabs and come back.
   */
  update(delta: number): void {
    if (!this.initialized) return
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 20)
    const { stiffness, damping, gravity, maxDisplacement } = this.settings

    // The root follows the animated skeleton exactly — it is the anchor.
    const root = this.particles[0]
    root.bone.getWorldPosition(root.curr)

    for (let i = 1; i < this.particles.length; i++) {
      const p = this.particles[i]
      const parent = this.particles[i - 1]

      // Where the animation says this bone should be.
      const rest = p.bone.getWorldPosition({ x: 0, y: 0, z: 0 })

      // Verlet: implicit velocity is (curr - prev), scaled by damping.
      const vx = (p.curr.x - p.prev.x) * damping
      const vy = (p.curr.y - p.prev.y) * damping
      const vz = (p.curr.z - p.prev.z) * damping

      p.prev = { ...p.curr }

      let nx = p.curr.x + vx + gravity.x * dt * dt
      let ny = p.curr.y + vy + gravity.y * dt * dt
      let nz = p.curr.z + vz + gravity.z * dt * dt

      // Pull back toward the animated rest pose.
      nx += (rest.x - nx) * stiffness
      ny += (rest.y - ny) * stiffness
      nz += (rest.z - nz) * stiffness

      // Keep the bone at its bind-time distance from its parent, so the chain
      // neither stretches nor collapses.
      const dx = nx - parent.curr.x
      const dy = ny - parent.curr.y
      const dz = nz - parent.curr.z
      const len = Math.hypot(dx, dy, dz)
      if (len > 1e-6) {
        const scale = p.restLength / len
        nx = parent.curr.x + dx * scale
        ny = parent.curr.y + dy * scale
        nz = parent.curr.z + dz * scale
      }

      // Hard clamp against the rest pose. Belt and braces: without this a bad
      // rig or a physics spike detaches hair from the head permanently.
      const ox = nx - rest.x
      const oy = ny - rest.y
      const oz = nz - rest.z
      const off = Math.hypot(ox, oy, oz)
      if (off > maxDisplacement) {
        const k = maxDisplacement / off
        nx = rest.x + ox * k
        ny = rest.y + oy * k
        nz = rest.z + oz * k
      }

      p.curr = { x: nx, y: ny, z: nz }
      p.bone.setWorldPosition(p.curr)
    }
  }

  /** Snap the simulation back onto the animated pose, e.g. after a teleport. */
  reset(): void {
    for (const p of this.particles) {
      p.bone.getWorldPosition(p.curr)
      p.prev = { ...p.curr }
    }
  }
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}
