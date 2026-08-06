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
 * shipped WITHOUT that normalization step having run: measured from the files on
 * disk, `ibm-1401-mainframe` is 88 m across, `ibm-3178-terminal` 40 m and
 * `kenbak-1` 46 m — 50x to 300x their real machines. A 90-metre mainframe parked
 * 5 m from the camera is not a mainframe, it is a wall, and it is exactly what
 * filled the committed diorama screenshot edge to edge. DatacenterDiorama uses
 * these numbers to repair a prop whose baked scale is obviously wrong, and
 * DioramaProps.node.test.ts asserts against them so a bad re-export is caught in
 * CI rather than in a product screenshot.
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
 * failed export rather than as modelling slack. Nine of the twelve props land
 * within ~25% of target (bbox measurement ignores per-node rotation, so some
 * wobble is expected and harmless); the three broken ones are out by 50x or
 * more. A factor of 2 separates those two populations with room to spare.
 */
export const PROP_SCALE_TOLERANCE = 2
