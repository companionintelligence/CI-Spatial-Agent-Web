import { describe, expect, it } from 'vitest'

import { rememberOnboarded, wasOnboarded, type StorageHost } from './onboardingFlag'

function workingWindow(): StorageHost {
  const items = new Map<string, string>()
  return {
    localStorage: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value)
      }
    }
  }
}

/** Like a document sandboxed without allow-same-origin: reading `localStorage` itself throws. */
function sandboxedWindow(): StorageHost {
  return {
    get localStorage(): StorageHost['localStorage'] {
      throw new DOMException(
        "Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.",
        'SecurityError'
      )
    }
  }
}

/** Storage that is there but refuses every call: a full quota, or a profile that blocks site data. */
function refusingWindow(): StorageHost {
  const refuse = () => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  }
  return { localStorage: { getItem: refuse, setItem: refuse } }
}

describe('the onboarding flag', () => {
  it('is not set for a first-time visitor, and stays set once remembered', () => {
    const win = workingWindow()

    expect(wasOnboarded(win)).toBe(false)
    rememberOnboarded(win)
    expect(wasOnboarded(win)).toBe(true)
  })

  it('reads as "not yet" and does not throw when reading localStorage itself throws', () => {
    expect(() => wasOnboarded(sandboxedWindow())).not.toThrow()
    expect(wasOnboarded(sandboxedWindow())).toBe(false)
  })

  it('does not throw when remembering it is impossible', () => {
    expect(() => rememberOnboarded(sandboxedWindow())).not.toThrow()
    expect(() => rememberOnboarded(refusingWindow())).not.toThrow()
    expect(wasOnboarded(refusingWindow())).toBe(false)
  })
})
