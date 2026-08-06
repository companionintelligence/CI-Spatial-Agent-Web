// The "1970s research datacenter" diorama's real-hardware catalog. Sourced from a
// Sketchfab-style prop set (source FBX/.blend originals) and re-exported to GLB via a
// headless Blender pipeline (see docs/DIORAMA.md). A quarter-century of computing
// history (1956-1982), in the order the resident would have acquired it.
export const DioramaProps = {
  'IBM RAMAC 305 (1956)': '/assets/props/ibm-ramac-305.glb',
  'IBM 1401 Mainframe (1959)': '/assets/props/ibm-1401-mainframe.glb',
  'IBM 1401 CPU': '/assets/props/ibm-1401-cpu.glb',
  'Engelbart Mouse (1963)': '/assets/props/engelbart-mouse.glb',
  Plugboard: '/assets/props/plugboard.glb',
  'KENBAK-1 (1971)': '/assets/props/kenbak-1.glb',
  'Xerox Alto (1973)': '/assets/props/xerox-alto.glb',
  'IBM 3350 Disk (1975)': '/assets/props/ibm-3350-disk.glb',
  'Commodore PET (1977)': '/assets/props/commodore-pet.glb',
  'IBM 3178 Terminal (1979)': '/assets/props/ibm-3178-terminal.glb',
  'IBM 2401 Tape': '/assets/props/ibm-2401-tape.glb',
  'Prologica CP-500 (1982)': '/assets/props/prologica-cp500.glb'
} as const

export type DioramaPropName = keyof typeof DioramaProps

/**
 * Real-world maximum dimension, in metres, for each prop — the figure the export
 * pipeline is supposed to normalize its GLB to (docs/DIORAMA.md, "Target max dim").
 *
 * This lives in code, not only in the doc, because three of the twelve GLBs
 * shipped without the pipeline having finished with them. DatacenterDiorama uses
 * these numbers as a last-resort guard against a bad re-export, and
 * DioramaProps.node.test.ts measures the shipped files against them so the next
 * one is caught in CI rather than in a product screenshot.
 *
 * A guard is all it is. Rescaling a whole-room asset down to 1.7 m does not
 * produce a mainframe, it produces a 1.7 m room — see PROP_NEEDS_REEXPORT.
 */
export const PropTargetMaxDim: Record<DioramaPropName, number> = {
  'IBM RAMAC 305 (1956)': 1.7,
  'IBM 1401 Mainframe (1959)': 1.7,
  'IBM 1401 CPU': 1.7,
  'Engelbart Mouse (1963)': 0.15,
  Plugboard: 0.9,
  'KENBAK-1 (1971)': 0.48,
  'Xerox Alto (1973)': 1.2,
  'IBM 3350 Disk (1975)': 1.5,
  'Commodore PET (1977)': 0.5,
  'IBM 3178 Terminal (1979)': 0.5,
  'IBM 2401 Tape': 1.83,
  'Prologica CP-500 (1982)': 0.55
}

/**
 * How far a GLB's baked size may drift from its target before we treat it as a
 * failed export rather than as modelling slack. Ten of the twelve props land
 * within ~65% of target; the two still-broken ones are out by 50x or more. A
 * factor of 2 separates those two populations with room to spare.
 */
export const PROP_SCALE_TOLERANCE = 2

/**
 * Props whose GLB is not usable as shipped and which the diorama therefore does
 * not place. Measured off the files with `node scripts/prop-glb.mjs` (full TRS
 * chain, eight transformed corners per accessor box — a scale-only walk reports
 * the wrong extent for these, and they are nothing but rotated children):
 *
 *   kenbak-1.glb  47.16 x 54.89 x 21.88 units, floor at -11.37. Three PowerCord*
 *     nodes float 25 units above the machine's top face and account for most of
 *     the Y extent; the body underneath is ~36 x 28 x 14, an aspect of 2.6 : 2 : 1
 *     against a real KENBAK-1's 2.6 : 1 : 1.5. Dropping the cords would not make
 *     it the right shape.
 *
 *   ibm-3178-terminal.glb  three mesh nodes at two different scales in one file:
 *     `ibm_3178` at 0.27 x 0.25 x 0.30 m, and `ibm_3178_col` (29 x 22 x 40 units)
 *     plus `display` (18 x 13 x 2 units). Which of the two is the authoritative
 *     terminal is a question for whoever holds the source archive.
 *
 * Why not just rescale them, as a uniform "normalization" would? Because the
 * measured box is not the machine. Scaling kenbak-1 so its largest dimension hits
 * 0.48 m yields 0.41 x 0.48 x 0.19 m — a KENBAK-1 standing on its end, 2.5x too
 * tall, on a desk. Scaling the 3178 to 0.5 m yields a 0.29 m-tall slab half a
 * metre deep. A wrong-shaped machine in frame is worse than an absent one: the
 * diorama's whole claim is that this is real hardware.
 *
 * The fix is a proper re-export (docs/DIORAMA.md "Export pipeline"). Until then
 * these two are measured, named and left out. `ibm-1401-mainframe` used to be on
 * this list and was repaired at source instead — its problem was a backdrop set
 * the pipeline failed to drop, which is a scene-graph edit, not a re-export.
 */
export const PROP_NEEDS_REEXPORT: readonly DioramaPropName[] = [
  'KENBAK-1 (1971)',
  'IBM 3178 Terminal (1979)'
]
