# Control-bar button audit

> Audit of the button row under the avatar (`packages/core/src/components/control/ControlPanel.tsx`).
> Drafted 2026-07-04.

## Problem

The control bar packs **13 emoji-only buttons** into one flat row, mixing four unrelated
concerns — conversation, engine/mode, XR session, and app settings — with no labels or grouping.
Two of the toggles are **wired to nothing**. This is why the bar "doesn't make sense."

## Findings (grounded in the code)

Each toggle sets a field on `AppConfig`; the question is whether anything *reads* it.

| Button | Sets | Read anywhere? | Verdict |
|---|---|---|---|
| 🎤 / 🔴 / 🟢 Mic | `microphone` | ✅ 9 refs (STT/VAD, onboarding) | **Keep** — the primary interaction |
| ☁️ Cloud mode | `cloudMode` | ❌ **0 refs** | **Dead — remove** |
| ⚡ Barge-in | `bargeInEnabled` | ✅ 8 refs (`useAgent`) | Keep behavior, **move to Settings** |
| 🚀 Auto-submit | `autoSubmitEnabled` | ✅ 4 refs (`useAgent`) | Keep behavior, **move to Settings** |
| 🔊 / 🤖 Agent mode | `agentEnabled` | ❌ **0 refs** | **Dead — remove** |
| 🕸️ / 🎮 WebGPU | `webGPUEnabled` | ✅ 13 refs (renderer) | Keep behavior, **move to Settings (Graphics)** |
| 🥽 Enter VR | — | ✅ XR session | **Keep** |
| 📱 Enter AR | — | ✅ XR session | **Keep** |
| ⏹️ Exit XR | — | ✅ (only meaningful in-session) | **Keep, gate to in-session** |
| 🎯 Recenter | — | ✅ (only meaningful in-session) | **Keep, gate to in-session** |
| ➖ / ➕ Scale | — | ✅ (only meaningful in-session) | **Keep, gate to in-session** |
| ⚙️ Settings | opens panel | ✅ | **Keep** |

Also dead in `AppConfig` (0 real refs): `cloudMode`, `agentEnabled`, `directedMode`, `llmLocal`.

### Why it reads as broken
1. **Two buttons do nothing** (☁️, 🔊/🤖) — pure confusion.
2. **Emoji-only, no labels** — ⚡/🚀/🕸️ are unguessable.
3. **Advanced preferences sit next to primary actions** — barge-in, auto-submit, and WebGPU are
   settings, not things you toggle mid-conversation.
4. **XR-transform controls (recenter/scale/exit) always show**, even outside an XR session.
5. Emoji violate the CI canon (`lucide-react` is the only sanctioned icon set).

## Recommended scheme

A focused, adaptive bar. Everything that isn't a primary action moves into the **Settings**
panel (renamed from "Connection settings"), organized into sections.

**Primary bar (flat / desktop / mobile):**
`🎙️ Mic` · `Enter VR` / `Enter AR` (only when supported) · `⚙️ Settings`

**In an XR session, additionally:** `Recenter` · `Scale −/+` · `Exit XR` (grouped, session-only).

**Settings panel sections:**
- **Connection** — LLM provider / URL / model (existing).
- **Behavior** — Barge-in, Auto-submit (labeled switches).
- **Graphics** — WebGPU / WebGL (labeled switch, disabled if unsupported).

## Changes implemented in this pass

- **Removed** the two dead buttons (☁️ cloud, 🔊/🤖 agent) and the dead `AppConfig` fields
  (`cloudMode`, `agentEnabled`, `directedMode`, `llmLocal`).
- **Moved** barge-in, auto-submit, and WebGPU into the Settings panel as labeled switches
  (new **Behavior** + **Graphics** sections).
- **Slimmed** the bar to Mic · XR-enter · Settings, with the XR-transform cluster gated to
  in-session.

## Deferred (folds into the WebXR-flexibility work)

- Replace emoji with **lucide-react** icons + short labels (canon).
- An **in-world XR control panel** (spatial), separate from the flat DOM bar.
- Per-surface layouts (mobile vs desktop vs headset) driven by `useXRLayout`.
