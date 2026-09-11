import * as Sentry from '@sentry/browser'

const DSN = import.meta.env.VITE_SENTRY_DSN

function scrub(value, depth = 0) {
  if (depth > 6) return '[Truncated]'
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi, '[Filtered]')
      .replace(/(?:api[-_ ]?key|token|password|secret|authorization|cookie)[\s=:"']+[^\s"',}]+/gi, '[Filtered]')
      .replace(/[?#].*$/, '')
      .slice(0, 4000)
  }
  if (Array.isArray(value)) return value.map((entry) => scrub(entry, depth + 1))
  if (!value || typeof value !== 'object') return value
  const output = {}
  for (const [key, nested] of Object.entries(value)) {
    output[key] = /prompt|completion|transcript|utterance|token|password|secret|authorization|cookie|url|user|email/i.test(key)
      ? '[Filtered]'
      : scrub(nested, depth + 1)
  }
  return output
}

export function initTelemetry() {
  if (!DSN) return

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    enableMetrics: import.meta.env.VITE_SENTRY_ENABLE_METRICS !== 'false',
    enableLogs: import.meta.env.VITE_SENTRY_ENABLE_LOGS !== 'false',
    sendDefaultPii: false,
    beforeSend(event) {
      event.request = undefined
      event.breadcrumbs = undefined
      return scrub(event)
    },
  })
  Sentry.setTag('component', 'ci-spatial-companion-web')
}

export { Sentry }
