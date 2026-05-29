# CLAUDE.md — CI-Spatial-Companion-WebXR

> **Private & Confidential — Property of Lifescope Inc. Do not distribute.**

## Platform role

**CI-Spatial-Companion-WebXR** sits in the **Client** layer of the Companion Intelligence platform.

Architecture: `CI-Engineering/architecture/architecture.md`
Roadmap: `CI-Engineering/architecture/roadmap.md`
Issues: <https://github.com/companionintelligence/CI-Engineering/issues>

## What this repo does

WebXR spatial companion — immersive XR interface for CI-Server with spatial audio and gesture interaction.

## Stack

- Three.js / WebXR
- TypeScript / JavaScript
- npm

## Key commands

```bash
# Install dependencies
npm install

# Start development server / service
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Package manager

**npm** — use exclusively; do not mix with npm/yarn/pnpm/bun unless the repo explicitly requires it.

## Cross-repo connections

- Connects to CI-Server for memory data and LLM chat



## Multi-agent safety

Multiple AI agents work these repos in parallel. Never use `git reset --hard`, `git clean -f`, or any destructive git command without explicit confirmation from the user.

## Confidentiality

Private & Confidential — Property of Lifescope Inc. Do not distribute.
