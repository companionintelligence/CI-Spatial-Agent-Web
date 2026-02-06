interface ToggleButtonProps {
  isVisible: boolean
  onToggle: () => void
  label: string
  position: 'left' | 'right' | 'bottom-left'
  isMobile?: boolean
  panelWidth?: { mobile: string; desktop: string }
  size?: number
}

export const ToggleButton = ({
  isVisible,
  onToggle,
  label,
  position,
  isMobile = false,
  panelWidth = { mobile: '0.625rem', desktop: '1.25rem' },
  size = 32
}: ToggleButtonProps) => {
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
        const buttonWidth = '2rem'
        return { right: `calc(${basePosition} - ${buttonWidth})` }
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
      style={{
        position: 'absolute',
        top: position === 'bottom-left' ? 'auto' : '3%',
        ...getPosition(),
        transform: getTransform(),
        zIndex: 1000,
        background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
        backdropFilter: 'blur(1.25rem)',
        border: '0.0625rem solid rgba(255,255,255,0.08)',
        borderRadius: '0.375rem',
        padding: `${Math.max(6, Math.round(size * 0.25))}px ${Math.max(10, Math.round(size * 0.35))}px`,
        cursor: 'pointer',
        color: 'white',
        fontSize: `${Math.max(12, Math.round(size * 0.35))}px`,
        fontWeight: '600',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        minWidth: `${Math.max(32, size)}px`,
        height: `${Math.max(32, size)}px`,
        boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(16,25,30,0.8) 0%, rgba(17,43,48,0.8) 100%)'
        e.currentTarget.style.transform = position === 'bottom-left' ? 'scale(1.05)' : 'translateY(-50%) scale(1.05)'
        e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)'
        e.currentTarget.style.transform = position === 'bottom-left' ? 'scale(1)' : 'translateY(-50%) scale(1)'
        e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
    >
      {getIcon()}
      {!isVisible && <span style={{ marginLeft: '0.25rem' }}>{label}</span>}
    </button>
  )
}
