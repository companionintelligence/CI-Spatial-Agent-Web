# The 1970s Research-Datacenter Diorama

An opt-in environment the companion stands inside: a quarter-century of computing history
(1956–1982) arranged as the room of a mind that grew up among these machines. Design
source: the Metahermit GDD (`ci-metahermit/Docs/GDD.md`, §2 "The Set") — this is the
web-native realization of that set.

## Using it

- **URL:** append `?env=datacenter-1970s` to the web app.
- **Code:** pass `sceneConfig` with `environment: 'datacenter-1970s'` to `Viewport3D`/`Scene3D`,
  or render `<DatacenterDiorama />` directly inside any R3F scene (set `showShell={false}`
  to composite over your own room).
- Default remains the plain studio viewport (`environment: 'none'` / unset) — no existing
  caller changes behavior.

## The catalog

GLBs live in `/assets/props/` (single source of truth; packed into each app's
`public/assets/props/` by `scripts/pack-assets.mjs`, which fails the build if any
`DioramaProps.ts` entry has no file). Each GLB is exported pre-normalized: floor-aligned
at its own origin, centered in X/Y, and scaled so its largest dimension equals the
real machine's, so placements in `DatacenterDiorama.tsx` need no per-prop correction.

| Prop | Year | Target max dim | Source |
|---|---|---|---|
| IBM RAMAC 305 | 1956 | 1.70 m | `ibm-ramac-305-first-hard-drive-1956` (FBX) |
| IBM 1401 Mainframe | 1959 | 1.70 m | `ibm-1401-mainframe-date-1959` (FBX) |
| IBM 1401 CPU | 1959 | 1.70 m | `ibm-1401-central-processing-unit` (.blend) |
| Engelbart Mouse | 1963 | 0.15 m | `first-mouse-douglas-engelbart-date1963` (FBX) |
| Plugboard | — | 0.90 m | `plugboard-ancient-coding` (FBX) |
| KENBAK-1 | 1971 | 0.48 m | `kenbak-1-first-personal-computer` (FBX) |
| Xerox Alto | 1973 | 1.20 m | `xerox-alto-son-of-douglas-engelbart-1973` (FBX) |
| IBM 3350 Disk | 1975 | 1.50 m | `ibm-3350-madrid` (.blend) |
| Commodore PET | 1977 | 0.50 m | `commodore-pet` (FBX) |
| IBM 3178 Terminal | 1979 | 0.50 m | `ibm-3178` (.blend) |
| IBM 2401 Tape | — | 1.83 m | `ibm-2401` (.blend) |
| Prológica CP-500 | 1982 | 0.55 m | `cp-500-prologica-trs-80-model-iii-clone` (FBX) |

## Export pipeline

Headless Blender (5.1) script (`fbx2glb.py`, kept with the source asset archive at
`llm-metahuman/scene/`): imports the FBX or opens the `.blend` directly, relinks each
image to the texture files actually shipped with the asset (matched by basename — many
Sketchfab exports carry dead absolute paths), drops orphaned non-mesh backdrop objects,
normalizes to the real-world target dimension above, floor-aligns, exports GLB
(Y-up, no Draco). Re-run it if a source asset is replaced; then update the table here.

## Layout rationale (from the GDD)

- **Back wall — big iron**, oldest→newest left to right (RAMAC → 1401 → 1401 CPU →
  3350 → 2401): the machines "the resident never had room to throw out."
- **Side desk — small artifacts** (KENBAK-1, Engelbart mouse, plugboard) at desk height
  (+0.74 m), within the resident's arm's reach.
- **Terminal row** (Alto, PET, 3178, CP-500) angled toward the camera: where the
  resident actually works.
- Nothing occludes the default camera framing (camera `[0, 1.6, 3]` → origin); the
  avatar spawns at the origin inside the set.
- Lighting follows the GDD's **"diegetic warm, chrome cool"** rule: tungsten-amber
  practicals (`#e8a24a`) on the hardware, CI teal/aqua (`#00a9a7`) rim off the metal,
  mint (`#58ebbf`) reserved for "live" indicator lamps.

## Licensing note (before any commercial ship)

The props are Sketchfab-sourced models of real, trademarked hardware. Per the GDD's
legal-clearance gate (§9.4): audit each model's Sketchfab license (CC-BY needs visible
attribution; NC/editorial-only licenses are disqualifying and must be replaced) and keep
the depiction nominative/historical. Tracked as a release blocker, not a code TODO.
