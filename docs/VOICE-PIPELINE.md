# Voice Pipeline

> How speech in/out and lip-sync work today, and the plan to add self-hosted
> voice cloning behind the BFF. Drafted 2026-07-04.

## 1. Data flow

```
mic → VAD (@ricky0123/vad-web) → STT (Web Speech API) → LLM (breath-chunked, via BFF /api/chat)
    → TTS (queued per breath) → audio playback
                              ↘ WhisperData (word timings) → visemes → avatar mouth (lip-sync)
barge-in: new speech while TTS is playing interrupts it (bargeInEnabled)
```

Orchestrated in `services/useAgent.ts`; the LLM breath-chunking that paces TTS lives in the
`llm*` models (`llmProxy.ts` / `llmOllama.ts`).

## 2. Current components

- **STT** (`services/stt/`) — browser **Web Speech API** (`SpeechRecognition`), `en-US`, continuous.
  Optional `remote` flag exists but no remote STT is wired.
- **VAD** (`services/vad/`) — `@ricky0123/vad-web`, gates STT so it only listens when you're speaking;
  also the barge-in trigger.
- **TTS** (`services/tts/`) — four selectable modes (`TTSConfig.mode`):
  - `browser` — `speechSynthesis`.
  - `local` — a Web Worker running **vits-web** (Piper VITS models) loaded from a CDN.
  - `remote` — an **OpenAI-compatible** `/v1/audio/speech` endpoint (`tts-1`).
  - `pocket` — **Pocket TTS** server (default; `localhost:8000`; voices marius/javert/jean/…).
  Messages are queued and played in order; a network-dead Pocket server degrades to silent text chat.
- **Visemes / lip-sync** (`services/visemes/`) — mouth shapes are driven by **`WhisperData`**
  (`words` + `wtimes` + `wdurations`). Because the local TTS engines don't emit timings,
  `tts/whisperDataGenerator.approximateWhisperDataFromText()` synthesizes approximate word timings
  from the text; `Xenova/whisper-tiny` is available for real alignment.
- **Barge-in** — `bargeInEnabled` (Settings › Behavior); interrupts in-flight TTS when the user speaks.

**Gaps:** no **voice cloning** (fixed Piper/Pocket voices); no per-avatar voice identity; viseme
timing is approximate; TTS runs client-side or against an ad-hoc Pocket server, not through the BFF.

## 3. Research — self-hostable cloning TTS (mid-2026)

Neither VibeVoice nor Qwen-Omni is the right pick; the practical choice is CosyVoice2.

| Option | Clone from ref audio? | Streaming | First-audio | License | Server |
|---|---|---|---|---|---|
| **CosyVoice2-0.5B** ✅ recommended | yes (few sec) | bidirectional | **~150 ms** | **Apache-2.0** | official FastAPI+gRPC+Docker; OpenAI `/v1/audio/speech` wrappers exist |
| Qwen3-TTS Base (0.6B/1.7B) | yes (~3 s) | yes | **~97 ms** | Apache-2.0 | Gradio demo only — roll your own server |
| Chatterbox (Resemble) | yes | yes | low | MIT | community |
| VibeVoice 7B/Large | yes (5–30 s) | weak (batch) | ≥ realtime | MIT* (MS pulled code; mirrors only) | community FastAPI |
| Qwen2.5/3-Omni | **no** (fixed voices) | yes | — | "other" | heavy (24 GB+) |

Notes: VibeVoice's realtime 0.5B variant **can't clone** (fixed presets); the cloning 7B needs ~24 GB
VRAM and depends on community mirrors of weights Microsoft removed. **None of these emit word/phoneme
timestamps** — lip-sync needs a forced-alignment pass (WhisperX) on the output, or the existing
text-approximation timings.

**Recommendation: CosyVoice2-0.5B** — the only option that is Apache-2.0 (commercial-safe), genuinely
streaming (~150 ms), clones from a few seconds of reference audio, runs on a single GPU, and already
ships a Docker server with an OpenAI-compatible `/v1/audio/speech` shim. Qwen3-TTS Base is the
runner-up to prototype in parallel if we want the lowest latency.

## 4. Integration plan

1. **BFF TTS route** — add `POST /api/tts` to `apps/proxy` (analogous to `/api/chat`): streams audio
   from a runtime-configured upstream (CosyVoice2 OpenAI-compat server by default; env
   `APP_TTS_URL` / `APP_TTS_UPSTREAM`). Keep it a same-origin streaming endpoint so the browser needs
   no CORS/keys and the appliance keeps everything local.
2. **Client `remote` TTS via BFF** — point the existing `remote` TTS mode at `/api/tts` (a thin
   `ttsRemote` path) alongside `browser`/`local`/`pocket`. Selectable in Settings.
3. **Per-avatar voice profiles** — a voice profile = a reference-audio clip (5–30 s) → cloned voice.
   Attach a `voiceProfile` to each `AvatarOptions` entry so a given avatar speaks in a consistent
   cloned voice. The BFF forwards the reference to CosyVoice2's cloning input.
4. **Lip-sync timings** — keep `approximateWhisperDataFromText` as the default (works with any
   engine); optionally add a forced-alignment pass (WhisperX / VibeVoice-ASR) over generated audio
   for tighter visemes when latency budget allows.
5. **Marketplace** — CosyVoice2 as a sibling GPU container (or a shared CI-Server voice service);
   the appliance's GPU story gates this (document the CPU-fallback = existing Piper/Pocket).

Concrete files: `apps/proxy/src/routes/tts.ts` + `upstreams/cosyvoice.ts`; a `ttsRemote` path in
`services/tts/ttsService.ts`; `voiceProfile` on `AvatarOptions`; env in `apps/proxy/src/config.ts`.

## 5. Risks

- **GPU on the appliance** — CosyVoice2 (and any cloning TTS) wants a GPU; the appliance may not have
  one. Keep the client-side Piper/`pocket` path as the CPU fallback.
- **Latency** — even ~150 ms first-audio stacks on top of LLM + network; tune against the existing
  breath cadence so speech starts as breaths arrive, not after the full reply.
- **No native timestamps** — visemes rely on approximate or post-hoc alignment; perfect lip-sync
  needs the forced-alignment pass.
- **Licensing/ethics of cloning** — voice cloning needs consent controls; VibeVoice's takedown is a
  cautionary tale. Prefer Apache-2.0 CosyVoice2 and gate cloning behind explicit consent.
