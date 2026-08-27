import { describe, expect, it } from 'vitest'

import {
  DEFAULT_STEERING,
  angleDelta,
  headingToward,
  respectPersonalSpace,
  stepToward,
  stepTurnTo,
  type SteeringState
} from './steering'

const at = (x: number, z: number, heading = 0): SteeringState => ({ position: { x, z }, heading })
const FRAME = 1 / 60

describe('angleDelta', () => {
  it('takes the short way round', () => {
    // Turning +350° instead of -10° is the classic bug: the avatar spins all the
    // way around to face something just off its shoulder.
    expect(angleDelta(0, (350 * Math.PI) / 180)).toBeCloseTo((-10 * Math.PI) / 180, 5)
  })

  it('is zero for the same heading', () => {
    expect(angleDelta(1.2, 1.2)).toBe(0)
  })
})

describe('headingToward', () => {
  it('agrees with three.js -Z forward', () => {
    // Standing at the origin looking at (0, -1): heading 0.
    expect(Math.abs(angleDelta(0, headingToward({ x: 0, z: 0 }, { x: 0, z: -1 })))).toBeCloseTo(0, 5)
  })
})

describe('respectPersonalSpace', () => {
  it('stops short of the target rather than walking into it', () => {
    const stop = respectPersonalSpace({ x: 0, z: 0 }, { x: 0, z: -4 }, 1)
    expect(Math.hypot(stop.x - 0, stop.z - -4)).toBeCloseTo(1, 5)
  })

  it('does not move at all when already inside personal space', () => {
    const from = { x: 0, z: 0 }
    expect(respectPersonalSpace(from, { x: 0, z: -0.5 }, 1)).toEqual(from)
  })

  it('handles a coincident target without dividing by zero', () => {
    expect(respectPersonalSpace({ x: 1, z: 1 }, { x: 1, z: 1 }, 1)).toEqual({ x: 1, z: 1 })
  })
})

describe('stepToward', () => {
  it('turns before it walks', () => {
    // Facing away from the target: the first frames must be pure rotation, or
    // the avatar strafes sideways like a drone.
    const step = stepToward(at(0, 0, Math.PI), { x: 0, z: -4 }, FRAME)
    expect(step.phase).toBe('turn')
    expect(step.position).toEqual({ x: 0, z: 0 })
  })

  it('walks once roughly aligned', () => {
    const step = stepToward(at(0, 0, 0), { x: 0, z: -4 }, FRAME)
    expect(step.phase).toBe('walk')
    expect(step.position.z).toBeLessThan(0)
  })

  it('reports arrival inside the arrive radius', () => {
    expect(stepToward(at(0, 0, 0), { x: 0, z: -0.05 }, FRAME).phase).toBe('arrived')
  })

  it('never overshoots the destination', () => {
    // A fast walker stepping past the target and turning back each frame is a
    // visible oscillation, not a rounding detail.
    const step = stepToward(at(0, 0, 0), { x: 0, z: -0.2 }, 1, { ...DEFAULT_STEERING, walkSpeed: 100 })
    expect(Math.hypot(step.position.x, step.position.z + 0.2)).toBeLessThan(1e-6)
  })

  it('converges from any starting heading', () => {
    for (const start of [0, 1, 2, 3, -1, -2, -3]) {
      let state = at(2, 2, start)
      for (let i = 0; i < 2000; i++) {
        const step = stepToward(state, { x: -1, z: -3 }, FRAME)
        state = { position: step.position, heading: step.heading }
        if (step.phase === 'arrived') break
      }
      expect(Math.hypot(state.position.x + 1, state.position.z + 3)).toBeLessThan(0.2)
    }
  })
})

describe('stepTurnTo', () => {
  it('reaches the desired heading and reports done', () => {
    const { heading, done } = stepTurnTo(at(0, 0, 0), 0.01, FRAME)
    expect(done).toBe(true)
    expect(heading).toBeCloseTo(0.01)
  })

  it('is not done while still rotating', () => {
    expect(stepTurnTo(at(0, 0, 0), Math.PI, FRAME).done).toBe(false)
  })
})
