// Registers public/sw.js, the service worker that makes Avatar Companion installable and
// gives a page load with no network the /offline/ page. What the worker does and does not
// do is written at the top of that file.
//
// It is registered from here, in the bundle, rather than from a script in index.html, so
// the page stays free of inline script and the registration ships with the app it belongs to.

/** Where the worker is served from: the site root, so its scope is the whole origin. */
export const SERVICE_WORKER_URL = '/sw.js'

/** The parts of `window` this module touches, so a test can pass a stand-in. */
export interface RegistrationHost {
  navigator: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> }
  document: Pick<Document, 'readyState'>
  addEventListener: (type: 'load', listener: () => void, options: { once: boolean }) => void
  /** Injected by the Capacitor native shells before any page script runs. */
  Capacitor?: { isNativePlatform?: () => boolean }
}

/** Not worth interrupting the visitor for: the app is an ordinary web page without the worker. */
function warn(err: unknown) {
  console.warn('Avatar Companion: could not register the service worker', err)
}

/**
 * Register the service worker once the page has loaded, so it never competes with the
 * app's first render. Returns whether a registration was started.
 *
 * It does nothing:
 *   - outside a production build, where the dev server would otherwise be served from a
 *     worker's idea of the page;
 *   - without `navigator.serviceWorker`, which browsers expose only on https or
 *     localhost, so a plain-http LAN address quietly stays an ordinary web page;
 *   - inside a Capacitor shell. None exists for this app today; the guard keeps a future
 *     one, which would load this same bundle from the app itself, from getting a worker
 *     between its WebView and its own files.
 *
 * It never throws. main.tsx calls it before the app renders, and the app works without a
 * worker, so nothing here may be able to stop the render: merely reading
 * `navigator.serviceWorker` raises a SecurityError in some contexts (a sandboxed iframe
 * without allow-same-origin, for one), so every access sits inside the try.
 */
export function registerServiceWorker({
  production = import.meta.env.PROD,
  win = globalThis as unknown as RegistrationHost
}: { production?: boolean; win?: RegistrationHost } = {}): boolean {
  if (!production) return false

  try {
    const serviceWorker = win.navigator.serviceWorker
    if (!serviceWorker) return false
    if (win.Capacitor?.isNativePlatform?.()) return false

    const register = () => {
      try {
        serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' }).catch(warn)
      } catch (err) {
        // A register() that throws instead of rejecting, from the load listener below.
        warn(err)
      }
    }

    if (win.document.readyState === 'complete') register()
    else win.addEventListener('load', register, { once: true })
    return true
  } catch (err) {
    warn(err)
    return false
  }
}
