# Round 4 — Demo evidence and canonical runtime correction

Date: 2026-08-16
Artifact: [`docs/demo/README.md`](../demo/README.md)
Prior status: [`STATUS.md`](STATUS.md)

## What was captured

The repository's real web app was run in deterministic `script` mode and
recorded at 1280×720. The roughly 20-second MP4/WebM includes the activation gate,
demo-only labeling, two text turns, the visible avatar, Chat Log, and Settings
Connection truth surface. Five PNG stills make the key states reviewable without
a media player.

The avatar harness was also run for Greg at 30 fps. It produced PNG stills and
MP4/WebM clips for idle, talking, waving, dance, happy, surprised, and
synthetic lip-sync. The existing multi-avatar WebP matrix remains the broader
rig catalog.

## Runtime correction discovered by capture

The first canonical recording exposed repeated React **Maximum update depth
exceeded** warnings. The cause was the XR store being recreated inside
`Scene3DComponent` on every render; the callback to the parent then caused the
next render to create another store. The fix memoizes the external XR store.

The LLM config/status seam was also stabilized in `useAgent` so the LLM
initialization effect does not restart on every render. A regenerated canonical
demo completed with **zero page or console errors**.

## Evidence boundary

This round improves the demo evidence, not the Being Test score. The recording
is explicitly `script / demo-only` and silent. It does not prove:

- CI-Server memory retrieval, source ids, uncertainty, consent, or delete;
- live TTS or microphone/STT behavior;
- a sustained Quest or Vision Pro session; or
- typed tools and user-confirmed side effects.

The next decisive capture is a selected-browser run against a seeded CI-Server
fixture, with the six-state journey and post-delete follow-up recorded.
