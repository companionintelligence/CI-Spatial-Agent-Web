# Avatar Visual Tests — WebP Gallery

**93 animated WebP clips** captured from the real avatar rig via the harness
(`apps/web/harness.html` → `e2e/capture/gen-webp.mjs`) at 10 fps — a faithful
record of the shipping animation / viseme / emote services across **male + female avatars on
GLB and VRM rigs**. GitHub renders these inline. Regenerate: `node e2e/capture/gen-webp.mjs`.

See [`../animation.md`](../animation.md) (mixer + clip catalog) and
[`../avatar.md`](../avatar.md) (rigs + faces).

## Sub-pages

| Page | Clips | What |
|---|---|---|
| 🎞 [**Body Animations**](animations.md) | 63 | The full body-animation catalog played through the real mixer, across male + female avatars on both GLB and VRM rigs. |
| 🎞 [**Faces — Lip-sync & Emotes**](faces.md) | 24 | Viseme lip-sync + emotion expressions — GLB avatars (ARKit-52 morphs) and the expressive VRM avatars (Yuki, Kenji). Realistic VRM imports with empty expression binds are body-only. |
| 🎞 [**Eye Movement**](eyes.md) | 2 | Deterministic gaze — left, right, up, down, wide — plus blinks, driven one pose per frame through the ARKit eye morphs (eyeLook*, eyeBlink*, eyeWide*). |
| 🎞 [**Blend Combos**](blends.md) | 4 | Native crossfade transitions between clips (idle → gesture → idle, gesture → action, …). |

## Highlights

<table>
  <tr>
    <td align="center"><img src="greg-waving.webp" width="190" alt="Waving — Greg (M·GLB)" /><br /><sub>Waving — Greg (M·GLB)</sub></td>
    <td align="center"><img src="cara-dance.webp" width="190" alt="dance — Cara (F·GLB)" /><br /><sub>dance — Cara (F·GLB)</sub></td>
    <td align="center"><img src="greg-lipsync.webp" width="190" alt="Lip-sync — Greg (M·GLB)" /><br /><sub>Lip-sync — Greg (M·GLB)</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="greg-emote-happy.webp" width="190" alt="Emote: happy — Greg (M·GLB)" /><br /><sub>Emote: happy — Greg (M·GLB)</sub></td>
    <td align="center"><img src="erik-dance-move.webp" width="190" alt="dance_move — Erik (M·VRM)" /><br /><sub>dance_move — Erik (M·VRM)</sub></td>
    <td align="center"><img src="greg-eyes.webp" width="190" alt="Eye movement — gaze L/R/up/down + blink (Greg)" /><br /><sub>Eye movement — gaze L/R/up/down + blink (Greg)</sub></td>
  </tr>
</table>

---
_Generated from `manifest.json` by `e2e/capture/gallery-md.mjs`._
