import type { CSSProperties } from 'react'

import { debugPanelStyle } from './debugPanelStyle'

/**
 * BlendTimeline — a static SVG of an idle → gesture → idle animation crossfade.
 *
 * The animation service crossfades between an idle loop and a one-shot gesture
 * clip over `blendTime` seconds at each transition. This presentational SVG
 * plots the two weight envelopes so a designer can see how a given `blendTime`
 * shapes the overlap: longer blends = softer, more overlapping handoffs.
 *
 * Pure and prop-driven — it computes the crossfade envelopes from `blendTime`
 * and `gestureDuration` and draws them; no animation service is involved.
 */

export interface BlendTimelineProps {
  /** Crossfade duration in seconds for each idle↔gesture transition. */
  blendTime?: number
  /** How long the gesture clip holds at full weight, in seconds. */
  gestureDuration?: number
  width?: number
  height?: number
}

const VIEW_PAD = 32

export const BlendTimeline = ({
  blendTime = 0.35,
  gestureDuration = 1.2,
  width = 380,
  height = 180
}: BlendTimelineProps) => {
  // Timeline: idle → (blend) → gesture hold → (blend) → idle.
  const lead = 0.4
  const tail = 0.4
  const total = lead + blendTime + gestureDuration + blendTime + tail

  // Keyframe times (seconds).
  const t0 = 0
  const t1 = lead // gesture starts blending in
  const t2 = lead + blendTime // gesture at full weight
  const t3 = lead + blendTime + gestureDuration // gesture starts blending out
  const t4 = t3 + blendTime // back to idle
  const t5 = total

  const plotW = width - VIEW_PAD * 2
  const plotH = height - VIEW_PAD * 2
  const x = (t: number) => VIEW_PAD + (t / total) * plotW
  // y for a weight 0..1 (0 at bottom of plot, 1 at top).
  const y = (w: number) => VIEW_PAD + (1 - w) * plotH

  // Idle weight is the complement of the gesture weight throughout.
  const gesturePts: Array<[number, number]> = [
    [t0, 0],
    [t1, 0],
    [t2, 1],
    [t3, 1],
    [t4, 0],
    [t5, 0]
  ]
  const idlePts: Array<[number, number]> = gesturePts.map(([t, w]) => [t, 1 - w])

  const toPath = (pts: Array<[number, number]>) =>
    pts.map(([t, w], i) => `${i === 0 ? 'M' : 'L'} ${x(t).toFixed(1)} ${y(w).toFixed(1)}`).join(' ')

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fill: 'var(--muted-foreground)',
    fontFamily: "var(--font-sans, 'Manrope', system-ui, sans-serif)"
  }

  return (
    <div style={debugPanelStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.5rem'
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.03em' }}>
          Blend Timeline
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>
          blend {blendTime.toFixed(2)}s
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Idle to gesture to idle crossfade with a ${blendTime.toFixed(2)} second blend`}
        style={{ display: 'block' }}
      >
        {/* Baseline + top axis. */}
        <line x1={VIEW_PAD} y1={y(0)} x2={width - VIEW_PAD} y2={y(0)} stroke="currentColor" strokeOpacity={0.25} />
        <line x1={VIEW_PAD} y1={y(1)} x2={width - VIEW_PAD} y2={y(1)} stroke="currentColor" strokeOpacity={0.1} strokeDasharray="3 3" />

        {/* Blend regions shaded. */}
        <rect x={x(t1)} y={y(1)} width={x(t2) - x(t1)} height={plotH} fill="var(--primary)" opacity={0.08} />
        <rect x={x(t3)} y={y(1)} width={x(t4) - x(t3)} height={plotH} fill="var(--primary)" opacity={0.08} />

        {/* Idle envelope. */}
        <path d={toPath(idlePts)} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeOpacity={0.7} />
        {/* Gesture envelope. */}
        <path d={toPath(gesturePts)} fill="none" stroke="var(--primary)" strokeWidth={2.5} />

        {/* Phase labels. */}
        <text x={x((t0 + t1) / 2)} y={height - 10} textAnchor="middle" style={labelStyle}>
          idle
        </text>
        <text x={x((t2 + t3) / 2)} y={height - 10} textAnchor="middle" style={{ ...labelStyle, fill: 'var(--primary)' }}>
          gesture
        </text>
        <text x={x((t4 + t5) / 2)} y={height - 10} textAnchor="middle" style={labelStyle}>
          idle
        </text>
      </svg>
      {/* Legend. */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.6875rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--muted-foreground)' }}>
          <span style={{ width: 14, height: 3, background: 'var(--muted-foreground)', borderRadius: 2 }} /> idle
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--primary)' }}>
          <span style={{ width: 14, height: 3, background: 'var(--primary)', borderRadius: 2 }} /> gesture
        </span>
      </div>
    </div>
  )
}
