import { describe, expect, it, vi } from 'vitest'

import { SERVICE_WORKER_URL, registerServiceWorker, type RegistrationHost } from './registerServiceWorker'

interface FakeOptions {
  readyState?: DocumentReadyState
  /** `null`: a browser with no `navigator.serviceWorker` at all (plain http, an old WebView). */
  serviceWorker?: RegistrationHost['navigator']['serviceWorker'] | null
  capacitor?: RegistrationHost['Capacitor']
  /** Fire the `load` listener as soon as it is added, as if the page had finished loading. */
  fireLoad?: boolean
}

function fakeWindow({ readyState = 'complete', serviceWorker, capacitor, fireLoad = true }: FakeOptions = {}) {
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration))
  const addEventListener = vi.fn((_type: 'load', listener: () => void, _options: { once: boolean }) => {
    if (fireLoad) listener()
  })
  const win: RegistrationHost = {
    navigator: serviceWorker === null ? {} : { serviceWorker: serviceWorker ?? { register } },
    document: { readyState },
    addEventListener,
    Capacitor: capacitor
  }
  return { win, register, addEventListener }
}

describe('registerServiceWorker', () => {
  it('registers /sw.js with the whole origin as its scope', () => {
    const { win, register } = fakeWindow()

    expect(registerServiceWorker({ production: true, win })).toBe(true)
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: '/' })
    expect(SERVICE_WORKER_URL).toBe('/sw.js')
  })

  it('waits for the page to load, so the worker never competes with the first render', () => {
    const { win, register, addEventListener } = fakeWindow({ readyState: 'loading', fireLoad: false })

    registerServiceWorker({ production: true, win })
    expect(register).not.toHaveBeenCalled()

    const [type, listener, options] = addEventListener.mock.calls[0]
    expect(type).toBe('load')
    expect(options).toEqual({ once: true })
    listener()
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('does nothing outside a production build (the default under the test runner)', () => {
    const { win, register } = fakeWindow()

    expect(registerServiceWorker({ win })).toBe(false)
    expect(registerServiceWorker({ production: false, win })).toBe(false)
    expect(register).not.toHaveBeenCalled()
  })

  it('does nothing where the browser has no service workers (plain http, old WebViews)', () => {
    const { win } = fakeWindow({ serviceWorker: null })

    expect(registerServiceWorker({ production: true, win })).toBe(false)
  })

  it('does nothing inside a Capacitor shell, which would load this bundle from the app itself', () => {
    const { win, register } = fakeWindow({ capacitor: { isNativePlatform: () => true } })

    expect(registerServiceWorker({ production: true, win })).toBe(false)
    expect(register).not.toHaveBeenCalled()
  })

  it('still registers in a browser that happens to define window.Capacitor', () => {
    const { win } = fakeWindow({ capacitor: { isNativePlatform: () => false } })

    expect(registerServiceWorker({ production: true, win })).toBe(true)
  })

  it('logs a failed registration and does not throw, because the app works without the worker', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { win } = fakeWindow({ serviceWorker: { register: vi.fn(() => Promise.reject(new Error('blocked'))) } })

    registerServiceWorker({ production: true, win })
    await Promise.resolve()
    await Promise.resolve()

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
