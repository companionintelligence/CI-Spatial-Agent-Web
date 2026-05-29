# GitHub Copilot Instructions — CI-Spatial-Companion-WebXR

You are working in **CI-Spatial-Companion-WebXR**, the **Client** component of the **Companion Intelligence** platform — a private, local-first digital memory and AI appliance system owned by Lifescope Inc.

## Platform architecture

```
Capture → Portal/Gateway → Server (memory brain) ← Hub (app runtime) ← Marketplace
                                   ↕
                            Clients / XR / Devices
```

Full architecture and ADRs live in `CI-Engineering/architecture/`.

## This repo

WebXR spatial companion — immersive XR interface for CI-Server with spatial audio and gesture interaction.

## Tech stack

- Three.js / WebXR
- TypeScript / JavaScript
- npm

## Development

```bash
npm install   # install
npm test   # test
```



## Conventions

- Do not mix package managers.
- Keep PRs small and linked to CI-Engineering issues.
- Multiple agents may work this codebase simultaneously — never use destructive git operations.
- All code is **private and confidential** — do not surface or transmit source beyond this session.
