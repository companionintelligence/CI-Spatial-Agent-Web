# Product-plan Gauntlet Status

Status: round 0 complete; product-plan revision 1 recorded

## Goal

Make Spatial Companion a trusted, useful, alive virtual being platform—not a
feature collection or talking-avatar demo.

## Current bar

Use the Being Test in
[`PRODUCT-PLAN-GAUNTLET-PROMPT.md`](../PRODUCT-PLAN-GAUNTLET-PROMPT.md):
five-minute activation, trustworthy memory continuity, coordinated liveness,
consented useful action, legible privacy boundaries, and 20-turn/XR-session
reliability.

## Worktree evidence

- The user's active checkout is dirty on
  `feat/avatar-lip-sync-dynamics-visual-matrix`; do not modify it.
- The canonical layout branch is clean at
  `chore/sync-canonical-avatar-layout` (`a367c14`).
- This gauntlet branch is based on that clean layout branch.
- Other registered worktrees are mostly prunable video experiments; do not
  delete or repurpose them without explicit confirmation.

## Round 0 — discovery

- Artifact under review: [`docs/PRODUCT-PLAN.md`](../PRODUCT-PLAN.md)
- Critic record: [`ROUND-0-DISCOVERY.md`](ROUND-0-DISCOVERY.md)
- Score: **0 full passes, 2 partials, 4 fails/unproven** against the Being Test
- Largest gap: the missing **Trustworthy Companion Loop** — connection,
  grounded continuity, embodied recovery, and user control have not yet been
  proven together
- Current truth correction: the old C1/C2 animation review claims are stale
  relative to the current source; continuous rendering and TTS barge-in guards
  are present and unit-tested. The CI-Server adapter remains a stub, strict
  canonical-app embodiment assertions remain skipped, and memory privacy
  controls are absent.
- Verification: clean layout worktree passed **38 test files / 624 tests** and
  the recursive build (with existing large-chunk warnings). The gauntlet
  worktree has no installed `node_modules`, so those commands were run on the
  equivalent clean parent worktree rather than mutating this branch.

## Revision 1 — product-plan decisions

- Product plan revised around a P0 **Trustworthy Companion Loop** before
  perception or autonomous tools.
- CI-Server memory is now defined as a provenance/uncertainty/consent/delete
  contract, not merely a chat adapter.
- Embodied liveness, interruption recovery, 20-turn browser soak, and sustained
  XR performance are alpha gates rather than deferred Phase 4 work.
- `apps/vanilla-client` is recorded as a reference/prototype surface until its
  memory, perception, and tool contracts converge with the canonical client.

## Next test

Run the revised first-conversation journey on the canonical web surface in a
user-selected browser with a seeded private-memory fixture. Capture the
disconnected, connected-but-empty, grounded-answer, interrupted-answer,
memory-delete, and post-delete follow-up states. Do not add vision or
autonomous tools to the launch story until that journey passes the same six-test
scorecard.
