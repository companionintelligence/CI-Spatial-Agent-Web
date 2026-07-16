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
