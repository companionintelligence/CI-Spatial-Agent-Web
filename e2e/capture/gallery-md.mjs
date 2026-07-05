#!/usr/bin/env node
/**
 * gallery-md.mjs — render docs/visual-tests/manifest.json to a Markdown gallery
 * (README.md) that GitHub shows inline when you open the folder. Animated WebP renders
 * directly in <img> on GitHub, so every clip is viewable without serving the page.
 *
 * Called at the end of gen-webp.mjs, and runnable standalone: node e2e/capture/gallery-md.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'visual-tests')

// Section order + labels; face groups render as squares. Anything unlisted falls through.
const SECTIONS = [
  ['viseme', 'Visemes / lip-sync', true],
  ['emote', 'Expression / emote', true],
  ['idle', 'Body — idle', false],
  ['communication', 'Body — communication', false],
  ['gesture', 'Body — gesture', false],
  ['expression', 'Body — expression / reaction', false],
  ['action', 'Body — action', false],
  ['movement', 'Body — movement', false],
  ['vrma', 'VRM body animation (VRMA)', false],
  ['blend', 'Blend / crossfade', false]
]
const COLS = 3

export function writeGalleryReadme(outDir = OUT) {
  const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'))
  const ok = manifest.clips.filter((c) => c.ok)
  const byGroup = {}
  for (const c of ok) (byGroup[c.group] ||= []).push(c)

  const w = (c, face) =>
    `<img src="${c.file}" width="${face ? 200 : 190}" alt="${(c.caption || c.name).replace(/"/g, "'")}" /><br /><sub>${c.caption || c.clip || c.name}</sub>`

  const grid = (items, face) => {
    let md = '<table>\n'
    for (let i = 0; i < items.length; i += COLS) {
      md += '  <tr>\n'
      for (const c of items.slice(i, i + COLS)) md += `    <td align="center">${w(c, face)}</td>\n`
      md += '  </tr>\n'
    }
    return md + '</table>\n'
  }

  let body = ''
  const seen = new Set()
  for (const [g, label, face] of SECTIONS) {
    const items = byGroup[g]
    if (!items?.length) continue
    seen.add(g)
    body += `\n## ${label} · ${items.length}\n\n${grid(items, face)}`
  }
  for (const g of Object.keys(byGroup)) {
    if (seen.has(g)) continue
    body += `\n## ${g} · ${byGroup[g].length}\n\n${grid(byGroup[g], false)}`
  }

  const md = `# Avatar Visual Tests — WebP Gallery

**${ok.length} animated WebP clips** captured from the real avatar rig via the capture
harness (\`apps/web/harness.html\` → \`e2e/capture/gen-webp.mjs\`) at ${manifest.fps} fps — a
faithful record of the shipping animation / viseme / emote services across the full mixer
catalog. GitHub renders these inline; regenerate with \`node e2e/capture/gen-webp.mjs\`.

See [\`../animation.md\`](../animation.md) for the clip catalog + how the LLM triggers
animations, and [\`../TESTING-PIPELINE.md\`](../TESTING-PIPELINE.md) (layer L3) for how these
are produced.
${body}
---
_Generated from \`manifest.json\` by \`e2e/capture/gallery-md.mjs\`._
`
  writeFileSync(join(outDir, 'README.md'), md)
  return ok.length
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = writeGalleryReadme()
  console.log(`wrote docs/visual-tests/README.md (${n} clips)`)
}
