import { useSimpleStore } from "../../utils/SimpleStore"

interface TooltipProps {
  children: React.ReactNode
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export const Tooltip = ({ children, content, position = 'top', delay = 500 }: TooltipProps) => {
  const [isVisible, setIsVisible] = useSimpleStore(() => false)
  const [timeoutId, setTimeoutId] = useSimpleStore<NodeJS.Timeout | null>(() => null)

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    setIsVisible(false)
  }

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      zIndex: 10000,
      pointerEvents: 'none' as const,
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'scale(1)' : 'scale(0.95)',
      whiteSpace: 'nowrap' as const,
      fontSize: '0.75rem',
      fontWeight: '500',
      color: '#FFFFFF',
      background: 'linear-gradient(180deg, rgba(16,25,30,0.9) 0%, rgba(17,43,48,0.9) 100%)',
      backdropFilter: 'blur(1.25rem)',
      border: '0.0625rem solid rgba(255,255,255,0.12)',
      borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem',
      boxShadow: '0 0.25rem 0.5rem rgba(0,0,0,0.3)',
      maxWidth: '12.5rem',
      textAlign: 'center' as const
    }

    switch (position) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '100%',
          left: '50%',
          transform: isVisible
            ? 'translateX(-50%) translateY(-0.5rem) scale(1)'
            : 'translateX(-50%) translateY(-0.5rem) scale(0.95)',
          marginBottom: '0.5rem'
        }
      case 'bottom':
        return {
          ...baseStyles,
          top: '100%',
          left: '50%',
          transform: isVisible
            ? 'translateX(-50%) translateY(0.5rem) scale(1)'
            : 'translateX(-50%) translateY(0.5rem) scale(0.95)',
          marginTop: '0.5rem'
        }
      case 'left':
        return {
          ...baseStyles,
          right: '100%',
          top: '50%',
          transform: isVisible
            ? 'translateX(-0.5rem) translateY(-50%) scale(1)'
            : 'translateX(-0.5rem) translateY(-50%) scale(0.95)',
          marginRight: '0.5rem'
        }
      case 'right':
        return {
          ...baseStyles,
          left: '100%',
          top: '50%',
          transform: isVisible
            ? 'translateX(0.5rem) translateY(-50%) scale(1)'
            : 'translateX(0.5rem) translateY(-50%) scale(0.95)',
          marginLeft: '0.5rem'
        }
      default:
        return baseStyles
    }
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div style={getPositionStyles()}>{content}</div>
    </div>
  )
}
