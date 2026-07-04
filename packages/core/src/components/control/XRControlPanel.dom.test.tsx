import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// The panel only paints inside an immersive session. Drive `useXR`'s session
// selector from the test so we can exercise both branches without a real
// WebXR device or a live <Canvas> host.
let sessionValue: unknown = null
vi.mock('@react-three/xr', () => ({
  useXR: (selector: (s: { session: unknown }) => unknown) => selector({ session: sessionValue })
}))
// drei primitives assume a react-three-fiber reconciler host; stub them so the
// component can mount under jsdom. We only assert on the null/non-null branch.
vi.mock('@react-three/drei', () => ({
  RoundedBox: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Text: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}))

import { XRControlPanel } from './XRControlPanel'

describe('XRControlPanel (scaffold)', () => {
  it('renders nothing when there is no active immersive session', () => {
    sessionValue = null
    const { container } = render(<XRControlPanel onExitXR={() => {}} onRecenter={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders its actions once an immersive session is active', () => {
    sessionValue = {}
    const { container } = render(
      <XRControlPanel onToggleMic={() => {}} onRecenter={() => {}} onExitXR={() => {}} />
    )
    // The derived action labels are painted as <Text> children (stubbed to spans).
    expect(container.textContent).toContain('Recenter')
    expect(container.textContent).toContain('Exit')
  })
})
