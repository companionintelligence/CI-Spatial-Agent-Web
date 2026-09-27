import type { CSSProperties } from 'react'

/**
 * Shared "glass panel" container style used by the debug/presentational
 * components in this directory (BlendTimeline, EmotePalette, VisemeMeter).
 *
 * Individual components spread this and add their own layout-specific
 * properties (e.g. `display`, `flexDirection`, `gap`, `width`) on top.
 */
export const debugPanelStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--xr-glass-bg)',
  backdropFilter: 'blur(var(--xr-glass-blur))',
  border: '0.0625rem solid var(--xr-glass-border)',
  color: 'var(--card-foreground)',
  fontFamily: "var(--font-sans, 'Manrope', system-ui, sans-serif)"
}
