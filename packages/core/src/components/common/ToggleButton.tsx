interface ToggleButtonProps {
  isVisible: boolean
  onToggle: () => void
  label: string
  position: 'left' | 'right' | 'bottom-left'
  isMobile?: boolean
  panelWidth?: { mobile: string; desktop: string }
  size?: number
}

// Keep toggle buttons at a minimum 32px touch target even when a smaller size is requested.
const MIN_BUTTON_SIZE = 32

export const ToggleButton = ({
  isVisible,
  onToggle,
  label,
  position,
  isMobile = false,
  panelWidth = { mobile: '0.625rem', desktop: '1.25rem' },
  size = MIN_BUTTON_SIZE
}: ToggleButtonProps) => {
  const resolvedButtonSize = Math.max(MIN_BUTTON_SIZE, size)

  const getPosition = () => {
    if (position === 'bottom-left') {
      return { bottom: '1.25rem', left: '1.25rem' }
    }

    const basePosition = isVisible
      ? isMobile
        ? panelWidth.mobile
        : panelWidth.desktop
      : isMobile
      ? '0.625rem'
      : '1.25rem'

    if (position === 'left') {
      return { left: basePosition }
    } else {
      // For right position, only subtract button width when maximized
      if (isVisible) {
        return { right: `calc(${basePosition} - ${resolvedButtonSize}px)` }
      } else {
        return { right: basePosition }
      }
    }
  }

  const getIcon = () => {
    if (position === 'bottom-left') {
      return isVisible ? '▼' : '▲'
    }

    return isVisible ? (position === 'left' ? '◀' : '▶') : position === 'left' ? '▶' : '◀'
  }

  const getTransform = () => {
    if (position === 'bottom-left') {
      return 'none'
    }
    return 'translateY(-50%)'
  }

  return (
    <button
      onClick={onToggle}
      aria-label={`${isVisible ? 'Hide' : 'Show'} ${label}`}
      style={{
        position: 'absolute',
        top: position === 'bottom-left' ? 'auto' : '3%',
        ...getPosition(),
        transform: getTransform(),
        zIndex: 1000,
        background: 'var(--xr-glass-bg)',
        backdropFilter: 'blur(var(--xr-glass-blur))',
        border: '0.0625rem solid var(--xr-glass-border)',
        borderRadius: 'var(--radius-md)',
        padding: `${Math.max(6, Math.round(size * 0.25))}px ${Math.max(10, Math.round(size * 0.35))}px`,
        cursor: 'pointer',
        color: 'var(--card-foreground)',
        fontSize: `${Math.max(12, Math.round(size * 0.35))}px`,
        fontWeight: '600',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        minWidth: `${resolvedButtonSize}px`,
        height: `${resolvedButtonSize}px`,
        boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)'
        e.currentTarget.style.transform = position === 'bottom-left' ? 'scale(1.05)' : 'translateY(-50%) scale(1.05)'
        e.currentTarget.style.boxShadow = 'var(--xr-elevation)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--xr-glass-border)'
        e.currentTarget.style.transform = position === 'bottom-left' ? 'scale(1)' : 'translateY(-50%) scale(1)'
        e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
    >
      {getIcon()}
      {!isVisible && <span style={{ marginLeft: '0.25rem' }}>{label}</span>}
    </button>
  )
}
