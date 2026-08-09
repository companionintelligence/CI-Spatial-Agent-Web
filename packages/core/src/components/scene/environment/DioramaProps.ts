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
 *   ibm-1401-mainframe.glb  0.59 x 0.93 x 1.03 m, floor at 0 — the box is right, and
 *     there is no 1401 inside it. Rendered on its own against a neutral background
 *     (three lights, no HUD, bounding box drawn) the entire visible contents are a
 *     white rounded slab, three floating flat blue plates stacked above it, and a
 *     scatter of loose dots. No cabinet, no tape frames, no control panel — none of
 *     the 268 meshes the file carries put geometry where the machine should be.
 *
 *     This entry was REMOVED from this list once already, on the grounds that the
 *     1401's problem was "a backdrop set the pipeline failed to drop, which is a
 *     scene-graph edit, not a re-export", and `scripts/prop-glb.mjs` still reports it
 *     as "already repaired". The repair dropped the backdrop and the machine with it.
 *     Nobody caught it because at the diorama's old 0.5 m bust framing the prop was
 *     outside the frustum; the first frame wide enough to contain it shows two blue
 *     plates hanging in mid-air beside the avatar. It goes back on the list, with the
 *     render as the evidence rather than the script's verdict.
 *
 * The fix is a proper re-export (docs/DIORAMA.md "Export pipeline"). Until then these
 * three are measured, named and left out.
 */
export const PROP_NEEDS_REEXPORT: readonly DioramaPropName[] = [
  'KENBAK-1 (1971)',
  'IBM 3178 Terminal (1979)',
  'IBM 1401 Mainframe (1959)'
]

/**
 * Props that are usable but carry a lump of DETACHED geometry the source scene left
 * behind — junk inside the file's bounding box that is not attached to the machine.
 *
 * This is a third failure mode, distinct from the two above. It is not a scale error
 * (PROP_SCALE_TOLERANCE passes it) and it is not an empty box (PROP_NEEDS_REEXPORT would
 * be too blunt — the machine really is in there). It is a real machine with something
 * floating next to it.
 *
 *   ibm-ramac-305.glb  MEASURED per child mesh, and rendered alone on a neutral
 *     background from four angles: the cabinet body ends at x = +0.32 m (Mesh_1 max 0.31,
 *     Mesh_5 max 0.32). Three of the file's nine primitives run well past it — Mesh_6 to
 *     +0.78, Mesh_7 and Mesh_8 to +0.87. In the render that far cluster is a yellow tape
 *     reel and its grey hub hanging in the air about half a metre off the machine's right
 *     face at chest height, nothing under it and nothing joining it to the cabinet.
 *
 *     THIS IS THE FLOATING DISC in the product frames. The RAMAC sits at the left of the
 *     back wall, so the reel hangs in open space beside it and reads as a bug, which it is.
 *
 *     It cannot be fixed by dropping nodes. The file is ONE node with nine primitives, and
 *     Mesh_6/7/8 each ALSO carry geometry inside the cabinet — the RAMAC's own disk stack,
 *     the yellow spiral visible through the front window, lives in Mesh_7/Mesh_8. Verified
 *     by rendering with those children hidden: the floating reel goes, the window goes
 *     empty, and a bare grey ring is still left outside. Hiding children costs the machine
 *     its best feature and does not even finish the job.
 *
 *     So the cut is per-triangle, on the one axis that separates the two populations
 *     cleanly: keep every triangle whose centroid sits at or below x = +0.36 m in the
 *     prop's own space — 0.04 m outboard of the real side panel, 0.04 m inboard of the
 *     nearest floating vertex. DatacenterDiorama applies it at load.
 *
 * Like PROP_NEEDS_REEXPORT this is a stopgap on top of a bad export, not a licence to
 * reshape assets to taste. The threshold is a measured seam between attached and detached
 * geometry, and the real fix is a re-export that never ships the reel.
 */
export interface PropGeometryCrop {
  /** Axis, in the prop's own (pre-placement) space. */
  axis: 'x' | 'y' | 'z'
  /** Triangles whose centroid exceeds this coordinate are dropped. */
  keepBelow: number
  why: string
}

export const PROP_GEOMETRY_CROP: Partial<Record<DioramaPropName, PropGeometryCrop>> = {
  'IBM RAMAC 305 (1956)': {
    axis: 'x',
    keepBelow: 0.36,
    why: "detached tape reel floating 0.4-0.87 m off the cabinet's right face"
  }
}

/**
 * Per-prop base-colour multiplier, applied to every material in the GLB at load.
 *
 * Six of these assets ship with a base colour at or very near white (#f0f0f0 to #ffffff).
 *
 * WHY THEY ARE WHITE was mis-diagnosed here, and the wrong diagnosis is worth keeping because
 * it is a trap anyone re-reading these numbers will fall into. The note used to say they "were
 * authored to be lit by a bright product-shot rig on a white background, which is how Sketchfab
 * presents them". They were not. Four of them have NO TEXTURE AT ALL — the export dropped every
 * image and left the material on a bare 0.8 grey factor (see PROP_TEXTURES_LOST for the
 * measurement and the cause). Nothing about that value was an authoring decision, so there is
 * no authored intent to respect: it is a fallback, and grading it is the only thing that can be
 * done with it until the maps come back.
 *
 * That also sets the target. The real IBM 1401 CPU cover — visible in the source model, which
 * still has its texture upstream — is a charcoal cabinet in a pale blue-grey frame, i.e. a good
 * deal DARKER than a mid grey, not lighter. The grades below moved down accordingly. They are
 * still one flat value across a machine that should have two, which is a compromise these files
 * force: one mesh, one material, no way to tell frame from panel without the map.
 *
 * MEASURED on the first frame of the restaged room: 13.1% of a 3840x2160 landscape frame
 * was pure (255,255,255), and every one of those pixels was a machine. The ranks had no
 * visible edges at all — sixteen cabinets read as one white mass, so the row rhythm that is
 * the entire point of building rows was invisible. Sampling individual machines returned
 * (255,255,255) for the inner rank, the right rank and the far rank alike.
 *
 * The fix is NOT more exposure tuning. Dropping the lights far enough to stop white
 * clipping takes the walls, the floor and the avatar down with them and the room goes
 * black again — which is exactly the trap the previous staging fell into when it set
 * iblIntensity to 0.14. The albedo is wrong, so the albedo is what to correct.
 *
 * Values are a multiplier on the material's existing base colour, so texture detail is
 * preserved and only the level moves. They are pitched at real machine-room paint: IBM's
 * covers of this era were a pale warm grey, not a lightbox white, and the very slightly
 * cool bias on the rank cabinets keeps them behind the warm practicals over the desk.
 */
export const PROP_TINT: Partial<Record<DioramaPropName, [number, number, number]>> = {
  // The sixteen instanced rank cabinets. The darkest grade of the set, because there are
  // more of them than anything else and they are what was flaring. Taken down from 0.40 once
  // the room stopped being lit by a white lightbox: with MachineRoomEnvironment supplying the
  // fill, 0.40 still measured 200+/255 across a whole cabinet face and the rank read as one
  // pale mass, which is the same failure the original 0.40 was written to fix.
  'IBM 1401 CPU': [0.27, 0.3, 0.33],
  // Tape frames — a shade lighter so they separate from the cabinets they cap.
  'IBM 2401 Tape': [0.34, 0.36, 0.39],
  // Hero machines, graded less: they are meant to be the ones you can read. The 3350 sits
  // full-front to camera under a ceiling strip, which is why it is the one that clipped.
  'IBM 3350 Disk (1975)': [0.33, 0.36, 0.39],
  'IBM RAMAC 305 (1956)': [0.66, 0.67, 0.68],
  'Xerox Alto (1973)': [0.82, 0.82, 0.82]
}

/**
 * Props whose GLB shipped with EVERY texture stripped, and the reason it happened.
 *
 * Read the shipped files' JSON chunks and the four here carry `images: []` — no baseColour,
 * nothing. Their materials fall back to a flat 0.8 grey, which is the entire explanation for
 * "the machines are near-white plastic boxes": there is no albedo in the file to be anything
 * else. PROP_TINT is a grade on top of that fallback, not on top of any authored colour.
 *
 * The maps are NOT missing upstream. Checked against the source collection's public metadata
 * (sketchfab.com/hegemonbill, collection `metahuman`, `api.sketchfab.com/v3/models/<uid>`),
 * which reports a texture count per model:
 *
 *   prop                     source textures    shipped images
 *   IBM 1401 CPU                    1                 0
 *   IBM 2401 Tape                   4                 0
 *   IBM 3178 Terminal               4                 0
 *   IBM 3350 Disk                   4                 0
 *   ...every other prop           1-6               1-6   (kept)
 *
 * The four that lost everything are EXACTLY the four whose source is a `.blend` in
 * docs/DIORAMA.md's catalog table; all eight FBX-sourced props kept their textures. The
 * export step that does this is named in that doc: fbx2glb.py "relinks each image to the
 * texture files actually shipped with the asset (matched by basename)". A basename relink
 * finds loose files next to an FBX and finds nothing for a `.blend`, whose images are packed
 * inside the file or referenced by an absolute path that no longer exists — so the image
 * datablock stays unresolved and the GLB exports with no texture at all, silently.
 *
 * What is lost is worth naming, because it is most of the room: the 1401 CPU's one texture is
 * its whole identity — a charcoal cabinet in a pale blue-grey frame with blue accent bands and
 * the machine's control panel — and that prop is instanced SIXTEEN times. The 2401's is a grey
 * frame with a red front panel.
 *
 * NOTHING IN THE SET HAS A NORMAL, METALLIC-ROUGHNESS OR OCCLUSION MAP, upstream or here. All
 * eight props that kept their textures kept baseColour only, and the source models report no
 * PBR material configuration. So a correct re-export restores ALBEDO on four props; it does
 * not supply surface relief, and PROP_SURFACE below is not a workaround for it — the two are
 * separate jobs.
 *
 * The fix is a re-export of the four `.blend` sources with the images resolved (open the
 * `.blend` directly, `bpy.ops.file.unpack_all()` / `image.filepath` repointed, and FAIL the
 * export when any material's image is unresolved rather than exporting a blank). The source
 * archive (`llm-metahuman/scene/`) is not in this workspace and the Sketchfab download API
 * needs an account, so this is an owner task, not a code change.
 *
 * DioramaProps.node.test.ts pins the four at zero images. A good re-export makes that test
 * fail, which is the instruction to delete the entry here and re-grade PROP_TINT against a
 * prop that finally has an albedo.
 */
export const PROP_TEXTURES_LOST: readonly DioramaPropName[] = [
  'IBM 1401 CPU',
  'IBM 2401 Tape',
  'IBM 3178 Terminal (1979)',
  'IBM 3350 Disk (1975)'
]

/**
 * Surface finish — the metalness/roughness/reflectivity half of "what is this thing made of".
 *
 * Every material in every prop ships at metalness 0 and roughness 0.4-0.55, which is one
 * plastic. That single value is doing all twelve machines, their glass windows, their chrome
 * and their paper, and it is most of the "toy" read: a painted steel cabinet and a tape-drive
 * window cannot share a specular response. Correcting it costs nothing at runtime — these are
 * scalars on a material that is already being cloned for PROP_TINT.
 *
 * `envMapIntensity` matters more here than anywhere else in the app. Painted metal is legible
 * because of what it reflects, and the diorama's environment map (MachineRoomEnvironment) is a
 * dark room with four bright ceiling strips in it — so the strips rake down the cabinet tops
 * and sides and give the flat faces a gradient they otherwise cannot have. At 0 these props go
 * back to flat.
 *
 * The detail fields drive the shared procedural map (detailSurface.ts): a tiling normal and a
 * roughness break-up applied over the prop's own TEXCOORD_0. It is SURFACE ONLY — grain,
 * orange peel, a slight unevenness in the paint. It deliberately carries no markings of any
 * kind. Inventing a logo or a model number on a real IBM machine would be the same lie as
 * inventing the machine.
 *
 * Two tiling rates, because paint has two scales and they are an octave and a half apart:
 *
 *   `detailRepeat`  — the NORMAL map. Tight, so it reads as grain. Set this loose and the
 *                     cabinets render as cast concrete; that is measured, not theoretical.
 *   `mottleRepeat`  — the ROUGHNESS map. Coarse, so the specular from the ceiling strips
 *                     wanders across a large flat face instead of sitting on it evenly. This
 *                     is the field that actually stops a 1.2 m panel reading as a fill colour.
 *
 * Both are in tiles across the prop's 0..1 UV atlas, not in metres — the assets have no
 * consistent texel density and there is no honest way to convert. Zero disables that map.
 */
export interface SurfaceFinish {
  metalness: number
  roughness: number
  envMapIntensity: number
  detailRepeat: number
  detailStrength: number
  mottleRepeat: number
}

export const SURFACE_FINISH = {
  /**
   * IBM machine-room enamel. Semi-gloss over sheet steel, service-worn: rough enough that the
   * ceiling strips smear rather than mirror, smooth enough to still have a sheen. Metalness is
   * a hair above 0 rather than at it — paint over steel is a dielectric, but these panels have
   * bare edges and fixings, and a trace of metalness keeps them from going chalky in shadow.
   */
  paintedSteel: {
    metalness: 0.05,
    roughness: 0.5,
    envMapIntensity: 1.2,
    detailRepeat: 14,
    detailStrength: 0.22,
    mottleRepeat: 2.5
  },
  /**
   * The same enamel on a cabinet that has been in the rank for fifteen years. Rougher and more
   * broken up, which is what stops sixteen identical instances reading as one extruded mass.
   *
   * Not as rough as it first was. At 0.72 the ceiling strips' reflection spread so wide across
   * a cabinet's top and flank that it went back to being a constant — and a flat value on a
   * flat face is the whole complaint. 0.58 keeps the strips readable as a broad sweep that
   * moves as the machine turns away from the aisle, which is the only gradient a blank steel
   * panel has.
   */
  paintedSteelWorn: {
    metalness: 0.04,
    roughness: 0.58,
    envMapIntensity: 1.25,
    detailRepeat: 16,
    detailStrength: 0.3,
    mottleRepeat: 3
  },
  /** Front panels and consoles — kept smoother, because they are the parts you read. */
  consolePanel: {
    metalness: 0.06,
    roughness: 0.45,
    envMapIntensity: 1.15,
    detailRepeat: 12,
    detailStrength: 0.16,
    mottleRepeat: 2
  },
  /**
   * Tape-drive and disk-drive windows. Near-mirror and unlit from inside, so they read as dark
   * holes that catch the ceiling strips — the single most machine-like thing in the ranks.
   */
  glass: {
    metalness: 0,
    roughness: 0.07,
    envMapIntensity: 2.2,
    detailRepeat: 0,
    detailStrength: 0,
    mottleRepeat: 0
  },
  /** Chrome, castors, screws, tape hubs. Actual metal, so actual metalness. */
  bareMetal: {
    metalness: 0.85,
    roughness: 0.34,
    envMapIntensity: 1.4,
    detailRepeat: 18,
    detailStrength: 0.22,
    mottleRepeat: 4
  },
  /** Keycaps, moulded covers, the PET's cartons. */
  plastic: {
    metalness: 0,
    roughness: 0.42,
    envMapIntensity: 0.7,
    detailRepeat: 16,
    detailStrength: 0.12,
    mottleRepeat: 3
  },
  /** Fanfold listing paper, punched cards, the plugboard's card stock. */
  paper: {
    metalness: 0,
    roughness: 0.94,
    envMapIntensity: 0.3,
    detailRepeat: 20,
    detailStrength: 0.2,
    mottleRepeat: 5
  }
} as const satisfies Record<string, SurfaceFinish>

export type SurfaceFinishName = keyof typeof SURFACE_FINISH

/**
 * Which finish each prop gets, and per-material overrides where the GLB names a part that is
 * plainly not made of the same thing as the body.
 *
 * `byMaterial` keys are the GLB's own material names, read off the files — the test asserts
 * every one of them still exists, so a re-export that renames a material fails here instead of
 * silently dropping the override and leaving a glass window rendered as paint.
 *
 * Props not listed take DEFAULT_FINISH.
 */
export interface PropSurface {
  finish: SurfaceFinishName
  byMaterial?: Record<string, SurfaceFinishName>
}

export const DEFAULT_FINISH: SurfaceFinishName = 'paintedSteel'

export const PROP_SURFACE: Partial<Record<DioramaPropName, PropSurface>> = {
  // The sixteen rank cabinets — one mesh, one material, the most-repeated surface in frame.
  'IBM 1401 CPU': { finish: 'paintedSteelWorn' },
  'IBM 2401 Tape': {
    finish: 'paintedSteelWorn',
    byMaterial: {
      // The 729's window. Was rendering as another painted panel, which is why the tape frames
      // read as blank cabinets rather than as drives.
      ibm_729_glass: 'glass',
      // Reels and the transport behind the window.
      ibm_2401_tape: 'bareMetal',
      tape: 'plastic'
    }
  },
  'IBM 3350 Disk (1975)': {
    finish: 'paintedSteel',
    byMaterial: { ibm_3350_glass: 'glass' }
  },
  'IBM RAMAC 305 (1956)': {
    finish: 'paintedSteel',
    byMaterial: {
      // Mat.5 is the near-black front bezel, Mat.1 the yellow disk stack seen through the
      // window, Mat.2 the loose ironwork — measured off the file, not guessed.
      'Mat.5': 'consolePanel',
      'Mat.1': 'bareMetal',
      'Mat.2': 'bareMetal'
    }
  },
  'Xerox Alto (1973)': { finish: 'consolePanel' },
  'Prologica CP-500 (1982)': { finish: 'plastic' },
  'Commodore PET (1977)': { finish: 'paper' },
  Plugboard: {
    finish: 'consolePanel',
    byMaterial: {
      'Mat.1': 'bareMetal',
      'Mat.2': 'paper',
      'Mat.3': 'paper'
    }
  },
  'Engelbart Mouse (1963)': {
    finish: 'plastic',
    byMaterial: {
      IronScrew: 'bareMetal',
      IronButton: 'bareMetal',
      IronBottom: 'bareMetal',
      Iron_Wheels: 'bareMetal'
    }
  }
}
