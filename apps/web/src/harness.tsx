import { createRoot } from 'react-dom/client'

import { AvatarHarness } from './harness/AvatarHarness'

// No StrictMode: double-invoked effects would double-register window.__harness and
// re-run the avatar startup, which hurts capture determinism.
createRoot(document.getElementById('root')!).render(<AvatarHarness />)
