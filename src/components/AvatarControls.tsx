import { useSimpleStore } from '../utils/SimpleStore'
import { AvatarState } from '../xr/AvatarModel'
import { AnimationOptions, AvatarOptions } from '../xr/AvatarOptions'
import { ToggleButton } from './common/ToggleButton'

interface AvatarControlsProps {
  isVisible: boolean
  onToggleVisibility: () => void
}

export const AvatarControls = ({ isVisible, onToggleVisibility }: AvatarControlsProps) => {
  const [state, setState] = useSimpleStore(AvatarState)
  const isMobile = window.innerWidth <= 768

  const handleAvatarChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState((state) => {
      state.selectedModel = event.target.value
      return state
    })
  }

  const handleAnimationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState((state) => {
      state.selectedAnimation = event.target.value
      return state
    })
  }

  return (
    <>
      {/* Enhanced Controls overlay */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? '0.625rem' : '0.9375rem',
          left: isMobile ? '0.625rem' : '0.9375rem',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '0.5rem' : '0.75rem',
          background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
          backdropFilter: 'blur(1.25rem)',
          padding: isMobile ? '0.75rem' : '1.25rem',
          borderRadius: '1rem',
          border: '0.0625rem solid rgba(255,255,255,0.08)',
          width: isVisible ? (isMobile ? '12.5rem' : '17.5rem') : '0',
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isVisible ? 1 : 0
        }}
      >
        <div style={{ 
          marginBottom: isMobile ? '0.75rem' : '1rem', 
          paddingBottom: isMobile ? '0.5rem' : '0.75rem', 
          borderBottom: '0.0625rem solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div style={{
            width: isMobile ? '0.375rem' : '0.5rem',
            height: isMobile ? '0.375rem' : '0.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #4a90e2, #7b68ee)',
            boxShadow: '0 0 0.5rem rgba(74, 144, 226, 0.5)'
          }} />
          <span style={{ 
            color: 'white', 
            fontSize: isMobile ? '0.75rem' : '0.875rem', 
            fontWeight: '600',
            letterSpacing: '0.03125rem'
          }}>
            Avatar Controls
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: '0.6875rem', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem'
          }}>
            Character
          </label>
          <select
            value={state.selectedModel}
            onChange={handleAvatarChange}
            style={{
              padding: isMobile ? '0.375rem 0.5rem' : '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: '0.0625rem solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              color: '#333',
              fontSize: isMobile ? '0.6875rem' : '0.75rem',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
              minWidth: isMobile ? '8.75rem' : '11.25rem',
              backdropFilter: 'blur(1.25rem)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4a90e2'
              e.target.style.boxShadow = '0 0 0 0.125rem rgba(74, 144, 226, 0.2)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.target.style.boxShadow = 'none'
            }}
          >
            {AvatarOptions.map((option) => (
              <option key={option.value} value={option.value} style={{ padding: '0.25rem' }}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Animation Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: '0.6875rem', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem'
          }}>
            Animation
          </label>
          <select
            value={state.selectedAnimation}
            onChange={handleAnimationChange}
            style={{
              padding: isMobile ? '0.375rem 0.5rem' : '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: '0.0625rem solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              color: '#333',
              fontSize: isMobile ? '0.6875rem' : '0.75rem',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
              minWidth: isMobile ? '8.75rem' : '11.25rem',
              backdropFilter: 'blur(1.25rem)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4a90e2'
              e.target.style.boxShadow = '0 0 0 0.125rem rgba(74, 144, 226, 0.2)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.target.style.boxShadow = 'none'
            }}
          >
            {AnimationOptions.map((option) => (
              <option key={option.value} value={option.value} style={{ padding: '0.25rem' }}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(74, 144, 226, 0.08)',
          borderRadius: '0.375rem',
          border: '0.0625rem solid rgba(74, 144, 226, 0.15)',
          marginTop: '0.5rem',
          backdropFilter: 'blur(1.25rem)'
        }}>
          <div style={{
            width: '0.375rem',
            height: '0.375rem',
            borderRadius: '50%',
            background: '#4a90e2',
            boxShadow: '0 0 0.375rem rgba(74, 144, 226, 0.6)'
          }} />
          <span style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '0.6875rem',
            fontWeight: '500'
          }}>
            Scene Active
          </span>
        </div>
      </div>

      {/* Toggle Button */}
      <ToggleButton
        isVisible={isVisible}
        onToggle={onToggleVisibility}
        label="Avatar"
        position="left"
        isMobile={isMobile}
        panelWidth={{ mobile: '13.75rem', desktop: '18.75rem' }}
      />
    </>
  )
} 