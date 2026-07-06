#!/usr/bin/env node
/**
 * gallery-md.mjs — render docs/visual-tests/manifest.json into a Markdown gallery with
 * SUB-PAGES that GitHub shows inline (animated WebP renders directly in <img>):
 *   README.md   — index + links to the sub-pages + a small hero row
 *   animations.md — body clips per avatar (male + female, GLB + VRM)
 *   faces.md    — lip-sync + emotes per avatar
 *   eyes.md     — eye movement (blink + gaze)
 *   blends.md   — crossfade combinations
 *
 * Called at the end of gen-webp.mjs; runnable standalone: node e2e/capture/gallery-md.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'visual-tests')
const COLS = 3

const PAGES = [
  { key: 'animations', file: 'animations.md', title: 'Body Animations', groupBy: 'avatar', face: false,
    blurb: 'The full body-animation catalog played through the real mixer, across male + female avatars on both GLB and VRM rigs. Female GLB avatars use the **feminine motion set** (female-actor mocap: F_ idle/talking/dance from the RPM animation library) — masculine and feminine avatars move differently.' },
  { key: 'faces', file: 'faces.md', title: 'Faces — Lip-sync & Emotes', groupBy: 'avatar', face: true,
    blurb: 'Viseme lip-sync + emotion expressions — GLB avatars (ARKit-52 morphs) and the expressive VRM avatars (Yuki, Kenji). Realistic VRM imports with empty expression binds are body-only.' },
  { key: 'eyes', file: 'eyes.md', title: 'Eye Movement', groupBy: null, face: true,
    blurb: 'Deterministic gaze — left, right, up, down, wide — plus blinks, driven one pose per frame through the ARKit eye morphs (eyeLook*, eyeBlink*, eyeWide*).' },
  { key: 'blends', file: 'blends.md', title: 'Blend Combos', groupBy: null, face: false,
    blurb: 'Native crossfade transitions between clips (idle → gesture → idle, gesture → action, …).' }
]

const img = (c, face) =>
  `<img src="${c.file}" width="${face ? 200 : 190}" alt="${(c.caption || c.name).replace(/"/g, "'")}" /><br /><sub>${c.caption || c.clip || c.name}</sub>`

function grid(items, face) {
  let md = '<table>\n'
  for (let i = 0; i < items.length; i += COLS) {
    md += '  <tr>\n'
    for (const c of items.slice(i, i + COLS)) md += `    <td align="center">${img(c, face)}</td>\n`
    md += '  </tr>\n'
  }
  return md + '</table>\n'
}

const CATEGORY_ORDER = ['feminine', 'idle', 'communication', 'gesture', 'expression', 'action', 'movement', 'vrma', 'lipsync', 'emote']

function section(items, groupBy, face) {
  if (!groupBy) return grid(items, face)
  // group by avatar, then by category within each avatar
  const byAvatar = {}
  for (const c of items) (byAvatar[c.avatar] ||= []).push(c)
  let md = ''
  for (const av of Object.keys(byAvatar)) {
    const sub = byAvatar[av]
    const rig = sub[0]?.rig ? ` · ${sub[0].sex || ''}·${sub[0].rig}` : ''
    md += `\n### ${av}${rig} · ${sub.length}\n\n`
    const byCat = {}
    for (const c of sub) (byCat[c.group] ||= []).push(c)
    const cats = Object.keys(byCat).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
    if (cats.length > 1) {
      for (const cat of cats) md += `**${cat}**\n\n${grid(byCat[cat], face)}\n`
    } else {
      md += grid(sub, face)
    }
  }
  return md
}

export function writeGalleryReadme(outDir = OUT) {
  const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'))
  const ok = manifest.clips.filter((c) => c.ok)
  const byPage = {}
  for (const c of ok) (byPage[c.page || 'other'] ||= []).push(c)

  // --- sub-pages ---
  for (const p of PAGES) {
    const items = byPage[p.key] || []
    if (!items.length) continue
    const body = `# ${p.title} · ${items.length}\n\n${p.blurb}\n\n← [back to gallery index](README.md)\n${section(items, p.groupBy, p.face)}\n---\n_Generated from \`manifest.json\` by \`e2e/capture/gallery-md.mjs\` at ${manifest.fps} fps._\n`
    writeFileSync(join(outDir, p.file), body)
  }

  // --- index README ---
  const rows = PAGES.filter((p) => (byPage[p.key] || []).length).map(
    (p) => `| 🎞 [**${p.title}**](${p.file}) | ${(byPage[p.key] || []).length} | ${p.blurb} |`
  )
  const hero = ['greg-waving', 'cara-f-dances-001', 'greg-lipsync', 'yuki-emote-happy', 'erik-dance-move', 'greg-eyes']
    .map((n) => ok.find((c) => c.name === n))
    .filter(Boolean)

  const md = `# Avatar Visual Tests — WebP Gallery

**${ok.length} animated WebP clips** captured from the real avatar rig via the harness
(\`apps/web/harness.html\` → \`e2e/capture/gen-webp.mjs\`) at ${manifest.fps} fps — a faithful
record of the shipping animation / viseme / emote services across **male + female avatars on
GLB and VRM rigs**. GitHub renders these inline. Regenerate: \`node e2e/capture/gen-webp.mjs\`.

See [\`../animation.md\`](../animation.md) (mixer + clip catalog) and
[\`../avatar.md\`](../avatar.md) (rigs + faces).

## Sub-pages

| Page | Clips | What |
|---|---|---|
${rows.join('\n')}
${hero.length ? `\n## Highlights\n\n${grid(hero, false)}` : ''}
---
_Generated from \`manifest.json\` by \`e2e/capture/gallery-md.mjs\`._
`
  writeFileSync(join(outDir, 'README.md'), md)
  return ok.length
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = writeGalleryReadme()
  console.log(`wrote gallery sub-pages (${n} clips)`)
}
