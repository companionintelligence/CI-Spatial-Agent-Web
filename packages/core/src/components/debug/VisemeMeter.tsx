import type { CSSProperties } from 'react'

import { debugPanelStyle } from './debugPanelStyle'

/**
 * VisemeMeter — a presentational bar meter for lip-sync viseme weights.
 *
 * The avatar pipeline drives one of two viseme sets depending on the model:
 *   - GLB rigs expose the 14 ARKit-style `viseme_*` targets (see
 *     `VisemeTarget` in services/visemes/visemeTypes.ts).
 *   - VRM rigs expose the 5 coarse mouth shapes (`aa|ee|ih|oh|ou`).
 *
 * This component takes a plain record of `{ name: weight }` (weights 0..1) and
 * renders a labelled bar per viseme so a designer can eyeball which mouth shapes
 * a given frame is firing. It is pure and prop-driven — no services, no VRM.
 */

export interface VisemeMeterProps {
  /** Map of viseme name → weight in the range 0..1. */
  values: Record<string, number>
  /** Optional heading shown above the bars. */
  title?: string
  /** Strip a common prefix (e.g. `viseme_`) from displayed labels. */
  stripPrefix?: string
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

export const VisemeMeter = ({ values, title = 'Visemes', stripPrefix = 'viseme_' }: VisemeMeterProps) => {
  const entries = Object.entries(values)

  const containerStyle: CSSProperties = {
    ...debugPanelStyle,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%'
  }

  return (
    <div style={containerStyle} role="group" aria-label={title}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.03em' }}>{title}</span>
      {entries.length === 0 && (
        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>No viseme data</span>
      )}
      {entries.map(([name, raw]) => {
        const weight = clamp01(raw)
        const pct = Math.round(weight * 100)
        const label = stripPrefix && name.startsWith(stripPrefix) ? name.slice(stripPrefix.length) : name
        return (
          <div
            key={name}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem' }}
          >
            <span
              style={{
                width: '3rem',
                flexShrink: 0,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--muted-foreground)'
              }}
            >
              {label}
            </span>
            <div
              role="meter"
              aria-label={label}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                position: 'relative',
                flex: 1,
                height: '0.5rem',
                borderRadius: '9999px',
                background: 'color-mix(in srgb, var(--muted-foreground) 20%, transparent)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${pct}%`,
                  borderRadius: '9999px',
                  background: 'linear-gradient(90deg, var(--primary), var(--ring))',
                  transition: 'width 0.15s ease'
                }}
              />
            </div>
            <span
              style={{
                width: '2.25rem',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
                color: weight > 0.02 ? 'var(--primary)' : 'var(--muted-foreground)'
              }}
            >
              {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
