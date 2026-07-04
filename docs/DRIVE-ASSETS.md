# Owned assets & DCC plugins (Google Drive)

> Inventory of company-owned 3D/DCC plugins and legacy assets on Google Drive
> (`liam@lifescope.io`), for the avatar/animation asset pipeline. Compiled 2026-07-04.
> **Private & Confidential.** IDs are exact so files can be fetched programmatically.

## Owned Blender/DCC plugins — the full avatar pipeline toolchain

Under **Tools - PlugIns → Blender Extensions** (`1T4HPYlPiaM3HXSFdVPq8rGYvXSLxx6I_`). These map
cleanly to a generate → clean → rig/retarget → bake → export flow.

| Plugin | Role in the pipeline | Key file (fileId) |
|---|---|---|
| **HumGen3D v4.0.27** + content packs | **Generate** parametric humans (bodies, clothes, hair, poses, 8K skin) | `HumGen3D_v4_0_27.zip` `1QvR0cPw2QoP9BIWGCbjy79lRGGdYQ9-q` · Base_Humans 705 MB `1NGZbuRA8dpFzYkUEbHgXZIcNXm5UHAd2` · Base_Clothes 1.11 GB `1johLMr0GWNCbCJJeLEdVPLYsZYcTd_ao` · Base_Hair `1IoQqRJEf67cVy68d551qSQWLOV2xaZFb` · Base_Poses `1Q933URQ0enJs7TOmrUkNkDyp0H3cU-dm` · 8K_Textures 2.12 GB `1hEYdll0WZJuguCGB9ftJ3w1-pTG-BL71` |
| **Auto-Rig Pro 3.75.25** (+ rig_tools, AI packs) | **Rig** any mesh + **retarget** external mocap (Mixamo/RPM) onto the rig | `auto_rig_pro_3.75.25.zip` `1_2JTW6lOB7cWo9Z14A3KvWqRnxfJToqw` · `rig_tools_3.75.14.zip` `1XZ56LrbMTOzAFil8zo56vN0MZFsP4fBg` · mac Apple-Silicon AI `AI_mac_1.14.zip` `1FC4wRMoiGLj9hP1j8t68gfzcCcLpsrB6` |
| **Better FBX 6.2.2** | Robust **FBX round-trip** (Mixamo/RPM FBX skeleton+anim import) | `1hb3h9Gbck9zuEDe3ytr7HDnWrX-_zNm1` |
| patched **glTF exporter** | **Export** rigged+animated avatars to `.glb` for web/XR | `io_scene_gltf2.zip` `1YcvNOWEohaB5TPdxi0NMJEnISGwU7KuW` |
| **SimpleBake 2.0.4** | **Bake** HumGen 8K materials → lightweight web-ready atlases | `1jYwh9Q7EZMAcQdFOP5z237rZ7RKFDVd3` |
| **SpeedRetopo** + **UV Packmaster 3** | Clean topology + efficient UVs | `1bUtZlT-LaYWbDyd_TPABXPuqYEKWeahZ` · `1ce3kTOgFTqDy2zGYySfH94FM11Ycm8fm` |

**Note:** the entire plugin tree is **duplicated** under a second "Blender Extensions" parent
(`1JvL42yzeb4yYGd-QrW70vBXm10XEOycO`) with byte-identical files but different IDs — keep one.

## Legacy 3D assets — "Old assets" (`1A9OjKAdCNWpKL2GSt3iyq31IVNxEBR6U`)

- **11 CI GLB avatars** (`25-1-3_CI_model_female_Cara/Brit/Courtney/Ash/Shanee/glasses`,
  `…_male_Greg/Brad/Jack`, `LiamCES`, `LiamCES2`) — same models already bundled in the app; drop-in
  test subjects, re-riggable with Auto-Rig Pro.
- **RPM_assets** (`1n-xb_kwf9YNn3id0bvPhM3MUPCWn4vw8`) — 14 Ready Player Me **clothing textures**
  (t-shirts/hoodies/jackets, templates + colorways). Textures only, no models.
- Avatar reference PNGs.

## Adjacent (current) avatar work — flagged, not in the two folders

- **"AVATAR" → "20250301 - Embodied Avatars Geometry Art"** (`12hhDhpqFtJjcjN2yeDh-DR1E-9cxEztH`) — active.
- **"LowPoly-Avatar"** (`124oYJamPhgAFOu6yTei3k6K2FSQ7kRbx`, 2026) — active.
- `08_realtime_voice_video.md` (`1SbOYU_jPQ0hB-bCfYRYyDfwdrmpNyVMz`) — a realtime voice/video design note.

## Voice — genuine gap

**No voice-cloning models, TTS datasets, or audio assets exist in Drive.** The only voice-labeled
hits are an unrelated decompiled Android app and a design markdown. The voice leg must be sourced
externally (self-hosted CosyVoice2 / Qwen3-TTS — see [docs/VOICE-PIPELINE.md](VOICE-PIPELINE.md)).

## The toolchain, end to end

```
HumGen3D (generate human) → SpeedRetopo / UV Packmaster (clean topo+UV)
  → Auto-Rig Pro (rig + retarget RPM/Mixamo mocap) → SimpleBake (optimize 8K → web atlas)
  → Better FBX / glTF exporter (export .glb) → apps/*/public/assets/avatars (web + XR)
```

See [docs/ASSET-PIPELINE.md](ASSET-PIPELINE.md) for the automated Blender build design.
