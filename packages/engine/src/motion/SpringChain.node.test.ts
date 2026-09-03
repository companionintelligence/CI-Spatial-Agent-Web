import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SPRING,
  SpringChain,
  boneNameSegments,
  detectSpringChains,
  isSpringCandidate,
  type SpringBoneLike,
  type Vec3
} from './SpringChain'

/** A test bone that stores a world position and records writes. */
class FakeBone implements SpringBoneLike {
  children: FakeBone[] = []
  constructor(
    public name: string,
    private pos: Vec3 = { x: 0, y: 0, z: 0 }
  ) {}
  getWorldPosition(target: Vec3): Vec3 {
    target.x = this.pos.x
    target.y = this.pos.y
    target.z = this.pos.z
    return target
  }
  setWorldPosition(p: Vec3): void {
    this.pos = { ...p }
  }
  get position(): Vec3 {
    return { ...this.pos }
  }
  add(child: FakeBone): FakeBone {
    this.children.push(child)
    return child
  }
}

/** A vertical hair chain of `n` bones hanging 0.1 m apart from the head. */
function hairChain(n: number, prefix = 'Hair'): FakeBone[] {
  const bones: FakeBone[] = []
  for (let i = 0; i < n; i++) {
    const b = new FakeBone(`${prefix}_${i}`, { x: 0, y: 1.6 - i * 0.1, z: 0 })
    if (i > 0) bones[i - 1].add(b)
    bones.push(b)
  }
  return bones
}

describe('isSpringCandidate', () => {
  it('accepts the usual dangling things', () => {
    for (const n of ['Hair_L', 'ponytail01', 'skirt_front', 'Ribbon.R', 'coatTail'])
      expect(isSpringCandidate(n), n).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isSpringCandidate('HAIR_ROOT')).toBe(true)
  })

  it('accepts the anchor bone rigs actually ship — Hair_Root, SkirtRoot', () => {
    // Substring matching rejected these because they contain "root", which skipped
    // exactly the chains we most want. Segment matching is what fixes it.
    for (const n of ['Hair_Root', 'SkirtRoot', 'HAIR_ROOT', 'hair_root_end'])
      expect(isSpringCandidate(n), n).toBe(true)
  })

  it('refuses limbs and the spine', () => {
    for (const n of ['mixamorigLeftHand', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'J_Bip_L_UpperArm'])
      expect(isSpringCandidate(n), n).toBe(false)
  })

  it('refuses a limb bone even when it carries a dangling word', () => {
    // A strap on the hand is still a hand; springing it flails the arm.
    expect(isSpringCandidate('hand_strap_L')).toBe(false)
  })

  it('splits camelCase as well as separators', () => {
    expect(boneNameSegments('mixamorigLeftHand')).toEqual(['mixamorig', 'left', 'hand'])
    expect(boneNameSegments('J_Bip_C_Hair1')).toEqual(['j', 'bip', 'c', 'hair'])
  })

  it('refuses anything unrecognised — stiff hair beats a flailing arm', () => {
    expect(isSpringCandidate('J_Bip_C_UpperLeg')).toBe(false)
    expect(isSpringCandidate('someRandomBone')).toBe(false)
  })
})

describe('detectSpringChains', () => {
  it('finds a hair chain hanging off the head', () => {
    const head = new FakeBone('Head', { x: 0, y: 1.7, z: 0 })
    const hair = hairChain(4)
    head.add(hair[0])
    const chains = detectSpringChains(head)
    expect(chains).toHaveLength(1)
    expect(chains[0]).toHaveLength(4)
  })

  it('skips a chain that an animation clip is driving', () => {
    // Solving a bone a clip owns makes the limb jitter — the chain must be dropped.
    const head = new FakeBone('Head', { x: 0, y: 1.7, z: 0 })
    const hair = hairChain(4)
    head.add(hair[0])
    expect(detectSpringChains(head, new Set(['Hair_2']))).toHaveLength(0)
  })

  it('ignores a single-bone chain, which cannot swing', () => {
    const head = new FakeBone('Head')
    head.add(new FakeBone('Hair_tip'))
    expect(detectSpringChains(head)).toHaveLength(0)
  })

  it('does not nest a chain inside a chain it already claimed', () => {
    const head = new FakeBone('Head')
    const hair = hairChain(4)
    head.add(hair[0])
    hair[2].add(new FakeBone('Hair_sub_0')).add(new FakeBone('Hair_sub_1'))
    expect(detectSpringChains(head)).toHaveLength(1)
  })

  it('finds several independent chains', () => {
    const head = new FakeBone('Head')
    const left = hairChain(3, 'HairL')
    const right = hairChain(3, 'HairR')
    head.add(left[0])
    head.add(right[0])
    expect(detectSpringChains(head)).toHaveLength(2)
  })

  it('honours maxChains so a dense rig cannot stall the frame', () => {
    const head = new FakeBone('Head')
    for (let i = 0; i < 40; i++) head.add(hairChain(3, `Hair${i}`)[0])
    expect(detectSpringChains(head, new Set(), 8).length).toBeLessThanOrEqual(8)
  })

  it('terminates on a rig with a cycle instead of hanging', () => {
    // A malformed rig must look wrong, never lock the render thread.
    const head = new FakeBone('Head')
    const a = new FakeBone('Hair_a')
    const b = new FakeBone('Hair_b')
    head.add(a)
    a.add(b)
    b.children.push(a)
    const chains = detectSpringChains(head)
    expect(chains[0].length).toBeLessThanOrEqual(33)
  })
})

describe('SpringChain', () => {
  it('leaves the pinned root exactly where the animation put it', () => {
    const bones = hairChain(3)
    const before = bones[0].position
    new SpringChain(bones).update(1 / 60)
    expect(bones[0].position).toEqual(before)
  })

  it('is at rest on the first frame — no spurious pop when an avatar binds', () => {
    const bones = hairChain(3)
    const before = bones.map((b) => b.position)
    new SpringChain(bones, { gravity: { x: 0, y: 0, z: 0 } }).update(1 / 60)
    bones.forEach((b, i) => {
      expect(b.position.x).toBeCloseTo(before[i].x, 5)
      expect(b.position.y).toBeCloseTo(before[i].y, 5)
    })
  })

  it('lags behind the head, then settles back onto the rest pose', () => {
    const bones = hairChain(4)
    const chain = new SpringChain(bones)
    const restTip = bones[3].position

    // Yank the anchor sideways, as a head turn would.
    bones[0].setWorldPosition({ x: 0.3, y: 1.6, z: 0 })
    chain.update(1 / 60)
    const lagged = bones[3].position
    expect(Math.abs(lagged.x - 0.3), 'the tip must NOT teleport with the root').toBeGreaterThan(0.05)

    // Hold still; the chain should converge toward the animated pose.
    for (let i = 0; i < 400; i++) chain.update(1 / 60)
    const settled = bones[3].position
    expect(Math.abs(settled.x - restTip.x)).toBeLessThan(DEFAULT_SPRING.maxDisplacement + 1e-6)
  })

  it('never stretches the chain beyond its bind length', () => {
    const bones = hairChain(4)
    const chain = new SpringChain(bones)
    bones[0].setWorldPosition({ x: 2, y: 4, z: -3 })
    for (let i = 0; i < 50; i++) chain.update(1 / 60)
    for (let i = 1; i < bones.length; i++) {
      const a = bones[i - 1].position
      const b = bones[i].position
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeCloseTo(0.1, 3)
    }
  })

  it('clamps how far a bone may stray from its animated position', () => {
    const bones = hairChain(3)
    const chain = new SpringChain(bones, { maxDisplacement: 0.02, gravity: { x: 0, y: -50, z: 0 } })
    for (let i = 0; i < 200; i++) chain.update(1 / 60)
    for (let i = 1; i < bones.length; i++) {
      const rest = { x: 0, y: 1.6 - i * 0.1, z: 0 }
      const p = bones[i].position
      expect(Math.hypot(p.x - rest.x, p.y - rest.y, p.z - rest.z)).toBeLessThan(0.021)
    }
  })

  it('survives a backgrounded tab returning a multi-second delta', () => {
    // Integrating a 5 s step in one go throws the chain to infinity; the visible
    // symptom is hair that disappears when you switch tabs and come back.
    const bones = hairChain(4)
    const chain = new SpringChain(bones)
    chain.update(5)
    for (const b of bones) {
      expect(Number.isFinite(b.position.x)).toBe(true)
      expect(Number.isFinite(b.position.y)).toBe(true)
    }
  })

  it('stays finite over a long run under gravity', () => {
    const bones = hairChain(5)
    const chain = new SpringChain(bones)
    for (let i = 0; i < 5000; i++) chain.update(1 / 60)
    expect(bones.every((b) => Number.isFinite(b.position.y))).toBe(true)
  })

  it('does nothing for a degenerate one-bone chain', () => {
    const only = new FakeBone('Hair_0', { x: 1, y: 2, z: 3 })
    const chain = new SpringChain([only])
    chain.update(1 / 60)
    expect(only.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(chain.length).toBe(1)
  })

  it('reset() snaps the simulation back onto the animated pose', () => {
    const bones = hairChain(3)
    const chain = new SpringChain(bones)
    bones[0].setWorldPosition({ x: 1, y: 1.6, z: 0 })
    for (let i = 0; i < 10; i++) chain.update(1 / 60)
    bones.forEach((b, i) => b.setWorldPosition({ x: 0, y: 1.6 - i * 0.1, z: 0 }))
    chain.reset()
    chain.update(1 / 60)
    expect(bones[2].position.x).toBeCloseTo(0, 2)
  })
})
