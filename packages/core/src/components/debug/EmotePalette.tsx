import type { CSSProperties } from 'react'

import type { EmotionType } from '../../services/emote/emoteTypes'

/**
 * EmotePalette — a swatch grid of the avatar's expressive states.
 *
 * The emote service drives one of nine `EmotionType`s (see
 * services/emote/emoteTypes.ts). This presentational grid renders one swatch per
 * emotion so design can review the palette and highlight a selected mood. Each
 * swatch is a real button, so the same component doubles as a debug picker when
 * `onSelect` is provided.
 */

/** Canonical order of the emote palette (matches the EmotionType union). */
// Part of the package's public API (re-exported from src/index.ts) and deliberately
// colocated with the palette it orders; splitting it out purely to satisfy Fast Refresh
// would churn the library surface.
// eslint-disable-next-line react-refresh/only-export-components
export const EMOTIONS: EmotionType[] = [
  'neutral',
  'happy',
  'angry',
  'sad',
  'fear',
  'disgust',
  'love',
  'sleep',
  'alert'
]

/**
 * A representative accent per emotion, expressed as an oklch hue drift off the
 * teal `--primary` so the whole palette stays inside the CI token family rather
 * than introducing raw brand-foreign colors.
 */
const EMOTION_TINT: Record<EmotionType, string> = {
  neutral: 'var(--muted-foreground)',
  happy: 'oklch(82% 0.14 95)',
  angry: 'oklch(63% 0.2 25)',
  sad: 'oklch(62% 0.12 255)',
  fear: 'oklch(70% 0.13 300)',
  disgust: 'oklch(70% 0.15 140)',
  love: 'oklch(72% 0.16 5)',
  sleep: 'oklch(60% 0.06 265)',
  alert: 'var(--primary)'
}

export interface EmotePaletteProps {
  /** The currently selected emotion (highlighted). */
  selected?: EmotionType
  /** When provided, each swatch becomes a button that reports the picked emotion. */
  onSelect?: (emotion: EmotionType) => void
  title?: string
}

export const EmotePalette = ({ selected, onSelect, title = 'Emotes' }: EmotePaletteProps) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--xr-glass-bg)',
    backdropFilter: 'blur(var(--xr-glass-blur))',
    border: '0.0625rem solid var(--xr-glass-border)',
    color: 'var(--card-foreground)',
    fontFamily: "var(--font-sans, 'Manrope', system-ui, sans-serif)"
  }

  return (
    <div style={containerStyle} role="group" aria-label={title}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.03em' }}>{title}</span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem'
        }}
      >
        {EMOTIONS.map((emotion) => {
          const isSelected = emotion === selected
          const tint = EMOTION_TINT[emotion]
          return (
            <button
              key={emotion}
              type="button"
              aria-label={emotion}
              aria-pressed={isSelected}
              disabled={!onSelect}
              onClick={() => onSelect?.(emotion)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.625rem 0.25rem',
                borderRadius: 'var(--radius-md)',
                cursor: onSelect ? 'pointer' : 'default',
                background: isSelected
                  ? 'color-mix(in srgb, var(--primary) 18%, transparent)'
                  : 'color-mix(in srgb, var(--card) 40%, transparent)',
                border: isSelected
                  ? '0.0625rem solid var(--primary)'
                  : '0.0625rem solid var(--xr-glass-border)',
                color: 'var(--card-foreground)',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit'
              }}
            >
              <span
                aria-hidden
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '50%',
                  background: tint,
                  boxShadow: isSelected ? '0 0 0.5rem var(--primary)' : 'none',
                  border: '0.0625rem solid rgba(255,255,255,0.15)'
                }}
              />
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)',
                  textTransform: 'capitalize'
                }}
              >
                {emotion}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
