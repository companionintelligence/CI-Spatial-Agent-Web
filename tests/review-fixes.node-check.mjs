import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const repoRoot = '/home/runner/work/CI-Spatial-Companion-WebXR/CI-Spatial-Companion-WebXR'

test('onboarding mic enable relies on config state instead of directly initializing VAD', async () => {
  const appSource = await readFile(`${repoRoot}/apps/web/src/App.tsx`, 'utf8')

  const handleEnableMicMatch = appSource.match(/const handleEnableMic = useCallback\(\(\) => \{([\s\S]*?)\n\s*\}, \[\]\)/)

  assert.ok(handleEnableMicMatch, 'expected to find handleEnableMic callback')
  assert.match(handleEnableMicMatch[1], /AppConfigState\.set\(\(prev\) => \(\{ \.\.\.prev, microphone: true \}\)\)/)
  assert.doesNotMatch(handleEnableMicMatch[1], /initializeVAD/)
})
