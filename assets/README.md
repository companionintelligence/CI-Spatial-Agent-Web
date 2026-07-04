# `assets/` — shared avatar media (single source of truth)

Heavy binary media served under `/assets/*` lives **here, once**, and is packed into
each app's `public/` at build time. This is the only committed copy.

```
assets/
├── avatars/      # .glb (RPM/CI/HumGen) + vrm/*.vrm (VRoid/Reallusion/Mixamo)
└── animations/   # shared body-animation clips (.glb / .vrma)
```

## How it gets into a build

Each app runs [`scripts/pack-assets.mjs`](../scripts/pack-assets.mjs) on `predev`,
`prebuild`, and `prepreview` (wired in each `apps/*/package.json`). The script:

1. **Gates the build** — every avatar referenced by
   [`AvatarOptions.ts`](../packages/core/src/components/scene/avatar/AvatarOptions.ts)
   must resolve to a file here, or the build fails before Vite runs. The marketplace
   image can never ship a catalog that 404s.
2. Copies `assets/{avatars,animations}` → `apps/<app>/public/assets/{avatars,animations}`.
3. Warns about orphans (files here not referenced by the catalog).

The per-app `public/assets/{avatars,animations}` dirs are **gitignored** — regenerated,
never committed, so there is zero duplication or drift across `web` / `vision-pro`, and
`pnpm --filter @ci-avatar/web build` (the marketplace container build) always packages
the full, current set.

## Adding an avatar

1. Drop the `.glb` (or `vrm/*.vrm`) into `assets/avatars/`.
2. Add an entry to `AvatarOptions.ts`.

That's it — `pack-assets` validates and packages it on the next build. New avatars from
the Blender/HumGen pipeline (`pipeline/`) land here automatically.
