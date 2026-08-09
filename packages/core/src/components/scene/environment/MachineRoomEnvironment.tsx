/**
 * MachineRoomEnvironment — the diorama's image-based light.
 *
 * WHY THE STUDIO PRESET WAS THE WRONG SOURCE
 *
 * Scene3D lit this room with drei's `studio` HDRI at environmentIntensity 0.22. That preset is
 * a white product-shot lightbox, and it is the right key for the default viewport, where the
 * avatar is a bust floating on a dark HUD. Inside a room it is wrong twice over. First, every
 * reflective surface in frame — the cabinets, the drive windows, the floor — reflects a white
 * void, which is the flattest thing a surface can reflect and reads as unlit plastic. Second,
 * it is fetched from a CDN at runtime, which this scene should not depend on.
 *
 * So the environment is GENERATED from the room the props are actually standing in: a dark
 * shell with four long cool ceiling strips overhead, a warm patch where the desk practical is,
 * and the teal rim. Painted steel now has something true to reflect, and the strips rake across
 * the cabinet tops and down their sides — which is the gradient that makes a flat face read as
 * a face rather than as a fill colour.
 *
 * COST: one cube render at mount (`frames={1}`), then a PMREM prefilter, then nothing. It is
 * not re-rendered per frame and it does not scale with the number of props. Resolution is 128
 * because the only thing this map has to resolve is four soft strips and a couple of washes;
 * 256 measured identical in frame and doubles the one-time prefilter.
 *
 * The positions below are DIRECTIONS, not places. A cube camera at the origin only records
 * solid angle, so what matters is that the strips subtend roughly the angle the real ceiling
 * strips do from a machine standing in the aisle.
 */
import { Environment, Lightformer } from '@react-three/drei'

export interface MachineRoomEnvironmentProps {
  /** scene.environmentIntensity — how much of this map reaches the materials. */
  intensity: number
}

export function MachineRoomEnvironment({ intensity }: MachineRoomEnvironmentProps) {
  return (
    <Environment frames={1} resolution={128} background={false} environmentIntensity={intensity}>
      {/* The room itself. Not black: a machine room has walls, and a cabinet's shadow side
          picking up a dark blue-grey is the difference between "in shadow" and "cut out". */}
      <color attach="background" args={['#0e181d']} />

      {/* The four ceiling troffers, matched to CeilingLights' strip positions and to the
          fluorescent white it uses. Long and narrow, because that shape is what makes a
          recognisable smeared highlight down a cabinet's top edge. */}
      {[-3.18, -1.15, 1.15, 3.18].map((x) => (
        <Lightformer
          key={x}
          form="rect"
          intensity={2.6}
          color="#dceef2"
          position={[x, 2.7, -2.4]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.45, 9.4, 1]}
        />
      ))}

      {/* Ceiling itself, faintly lit between the strips, so the top hemisphere is not four
          bright bars on a void. */}
      <Lightformer
        form="rect"
        intensity={0.22}
        color="#5d7d88"
        position={[0, 2.9, -2.2]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[10, 11, 1]}
      />

      {/* The tungsten practical over the desk, and the back-rank practical. These are why the
          machines have a warm side at all — the IBL is otherwise entirely cool and the room's
          "diegetic warm, chrome cool" rule (docs/DIORAMA.md) would only exist in the direct
          lights and not in anything's reflection. */}
      <Lightformer
        form="circle"
        intensity={1.5}
        color="#e8a24a"
        position={[0.4, 1.9, -1.4]}
        scale={[1.6, 1.6, 1]}
      />
      <Lightformer
        form="circle"
        intensity={1.1}
        color="#f0a95c"
        position={[1.6, 2.4, -4.2]}
        scale={[1.8, 1.8, 1]}
      />

      {/* CI teal rim, high and to the left, matching the AimedLight in DatacenterDiorama. */}
      <Lightformer
        form="rect"
        intensity={0.85}
        color="#00a9a7"
        position={[-4.4, 2.6, -1.0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[5, 2.4, 1]}
      />

      {/* Floor bounce. A raised computer-room floor is dark and matte, so this is nearly
          nothing — but without it the underside of every cabinet and the avatar's jaw take
          their fill from pure black and go to a hard edge. */}
      <Lightformer
        form="rect"
        intensity={0.16}
        color="#22333b"
        position={[0, -1.2, -2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[12, 12, 1]}
      />
    </Environment>
  )
}
