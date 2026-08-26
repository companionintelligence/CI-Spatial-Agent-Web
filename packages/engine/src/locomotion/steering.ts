/**
 * steering.ts — the maths behind walking to a place in a real room.
 *
 * Absorbed from CI-Spatial-Agent-Web-2's Locomotion controller and reduced to
 * pure functions, so the behaviour can be reasoned about and tested without a
 * scene graph, an XR session, or a floor.
 *
 * The model is steer-then-move: turn toward the destination first, then advance.
 * Walking and turning at once looks like a drone strafing; humans point
 * themselves where they are going and then go.
 */

export interface Vec2 {
  x: number
  z: number
}

export interface SteeringConfig {
  /** Metres per second. */
  walkSpeed: number
  /** Radians per second. */
  turnSpeed: number
  /** How close the companion is willing to get to a person, in metres. */
  personalSpace: number
  /** Radians of heading error tolerated before it starts moving. */
  headingTolerance: number
  /** Distance from the destination that counts as arrived, in metres. */
  arriveRadius: number
}

export const DEFAULT_STEERING: SteeringConfig = {
  walkSpeed: 0.9,
  turnSpeed: 2.4,
  personalSpace: 0.9,
  headingTolerance: 0.25,
  arriveRadius: 0.12
}

export type LocomotionPhase = 'idle' | 'turn' | 'walk' | 'arrived'

export interface SteeringState {
  position: Vec2
  /** Radians. 0 faces -Z, matching three.js' forward convention. */
  heading: number
}

export interface SteeringStep {
  position: Vec2
  heading: number
  phase: LocomotionPhase
}

const TAU = Math.PI * 2

/** Shortest signed angle from `from` to `to`, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % TAU
  if (delta > Math.PI) delta -= TAU
  if (delta <= -Math.PI) delta += TAU
  return delta
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** Heading that points from `a` to `b`, in three.js' -Z-forward convention. */
export function headingToward(a: Vec2, b: Vec2): number {
  return Math.atan2(b.x - a.x, b.z - a.z) + Math.PI
}

/**
 * Pull a destination back so the companion stops a polite distance short.
 *
 * Walking to a person's exact coordinates means walking INTO them. This is the
 * difference between "comes over to you" and "stands unnervingly close", and it
 * is the first thing anyone notices.
 */
export function respectPersonalSpace(from: Vec2, target: Vec2, personalSpace: number): Vec2 {
  const d = distance(from, target)
  if (d <= 1e-4 || d <= personalSpace) return { ...from }
  const t = (d - personalSpace) / d
  return { x: from.x + (target.x - from.x) * t, z: from.z + (target.z - from.z) * t }
}

/**
 * Advance one frame toward `target`.
 *
 * Pure: same inputs, same output. `delta` is seconds.
 */
export function stepToward(
  state: SteeringState,
  target: Vec2,
  delta: number,
  config: SteeringConfig = DEFAULT_STEERING
): SteeringStep {
  const remaining = distance(state.position, target)
  if (remaining <= config.arriveRadius) {
    return { position: { ...state.position }, heading: state.heading, phase: 'arrived' }
  }

  const desired = headingToward(state.position, target)
  const error = angleDelta(state.heading, desired)
  const maxTurn = config.turnSpeed * delta
  const heading = Math.abs(error) <= maxTurn ? desired : state.heading + Math.sign(error) * maxTurn

  // Steer first. Advancing while still badly misaligned reads as strafing.
  if (Math.abs(error) > config.headingTolerance) {
    return { position: { ...state.position }, heading, phase: 'turn' }
  }

  // Never overshoot: clamping to the remaining distance stops the oscillation
  // you get when a fast walker steps past the target and turns back each frame.
  const advance = Math.min(config.walkSpeed * delta, remaining)
  return {
    position: {
      x: state.position.x - Math.sin(heading) * advance,
      z: state.position.z - Math.cos(heading) * advance
    },
    heading,
    phase: 'walk'
  }
}

/** Turn in place toward a heading — used to face the user on arrival. */
export function stepTurnTo(
  state: SteeringState,
  desired: number,
  delta: number,
  config: SteeringConfig = DEFAULT_STEERING
): { heading: number; done: boolean } {
  const error = angleDelta(state.heading, desired)
  const maxTurn = config.turnSpeed * delta
  if (Math.abs(error) <= maxTurn) return { heading: desired, done: true }
  return { heading: state.heading + Math.sign(error) * maxTurn, done: false }
}
