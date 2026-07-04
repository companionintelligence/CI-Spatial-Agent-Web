# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — Design system

Adopted the Companion Intelligence canonical design system across the web and
Vision Pro apps and the shared `@ci-avatar/core` package. This is a theme/token
refactor only — no behavioural or API changes.

- **Canonical teal primary.** `--primary` is now the CI brand teal in every theme:
  `#0f717a` (light) / `#abd4d8` (dark), authored in oklch. Bespoke cyan accents
  were replaced with the canon teal.
- **Montserrat type.** `--font-sans` is now `"Montserrat", …` for both apps.
- **Enriched palette v0.2.0 tokens** in `packages/core/src/styles/globals.css`
  (mirrored from the CI-Common / CI-Hub `globals.css` canon; framework-agnostic
  CSS custom properties consumed by both the plain-CSS web app and the Tailwind
  Vision Pro app):
  - full `--teal-50 … --teal-950` brand ramp;
  - aqua / aqua-light / mint accent hues (`--aqua`, `--aqua-light`, `--mint`,
    `--teal-accent`, `--teal-mid`);
  - semantic status colors with light/dark variants (`--success`, `--warning`,
    `--info` and their `-foreground` pairs);
  - brand gradients (`--gradient-brand`, `--gradient-hero`, `--gradient-aurora`);
  - a radius scale (`--radius-sm … --radius-2xl`) derived from `--radius`;
  - elevation shadows (`--shadow-sm/md/lg`).
- **Dark-only XR shell.** The app shell keeps the canon dark background
  (`--teal-950` `#041620`) even under a light OS preference — it is an XR HUD, not
  a light-themable document surface.

### Added

- **Design-canon lint gate.** `scripts/lint-canon.mjs` (zero-dependency, Node
  built-ins only) fails the build if any resolvable `--primary` custom property is
  not the CI teal, in any color notation (hex, rgb, hsl, bare hsl triplet, oklch,
  oklab); hardcoded hex in component source is reported as a non-blocking warning.
  Wired into CI via `.github/workflows/style-canon-lint.yml` (runs on push and
  pull_request).
- **Refreshed light/dark UI screenshots** in `docs/ui/` (real UI rendered
  headlessly via WebGL), surfaced in the README.

[Unreleased]: https://github.com/companionintelligence/CI-Spatial-Companion-WebXR/commits/main
