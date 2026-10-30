// Whether the visitor has already been through the onboarding overlay (src/App.tsx).
//
// Storage can be unavailable: in a document sandboxed without allow-same-origin, or in a profile
// that blocks site data, merely reading `window.localStorage` throws a SecurityError. That must not
// blank the app, so every access sits inside a try. An unreadable flag means "not yet": the visitor
// sees the onboarding again next time, which beats a page that never starts.

const ONBOARDED_KEY = 'ci_avatar_onboarded'

/** The part of `window` this module touches, so a test can pass a stand-in. */
export interface StorageHost {
  readonly localStorage: Pick<Storage, 'getItem' | 'setItem'>
}

export function wasOnboarded(win: StorageHost = window): boolean {
  try {
    return Boolean(win.localStorage.getItem(ONBOARDED_KEY))
  } catch {
    return false
  }
}

/** Remember it. If storage refuses, the choice still holds for this visit. */
export function rememberOnboarded(win: StorageHost = window): void {
  try {
    win.localStorage.setItem(ONBOARDED_KEY, 'true')
  } catch {
    // See the top of the file.
  }
}
