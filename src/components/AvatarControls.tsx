import { useState } from 'react'
import { useSimpleStore } from '../utils/SimpleStore'
import { AvatarState } from '../xr/AvatarModel'
import { AnimationOptions, AvatarOptions } from '../xr/AvatarOptions'

interface AvatarControlsProps {
  isVisible: boolean
  onToggleVisibility: () => void
}

export const AvatarControls = ({ isVisible, onToggleVisibility }: AvatarControlsProps) => {
  const [state, setState] = useSimpleStore(AvatarState)

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
          top: 15,
          left: 15,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'linear-gradient(180deg, #10191E 0%, #112B30 100%)',
          backdropFilter: 'blur(16px)',
          padding: '20px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.10)',
          width: isVisible ? '280px' : '0px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.07)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isVisible ? 1 : 0
        }}
      >
        <div style={{ 
          marginBottom: '16px', 
          paddingBottom: '12px', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #4a90e2, #7b68ee)',
            boxShadow: '0 0 8px rgba(74, 144, 226, 0.5)'
          }} />
          <span style={{ 
            color: 'white', 
            fontSize: '14px', 
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            Avatar Controls
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: '11px', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Character
          </label>
          <select
            value={state.selectedModel}
            onChange={handleAvatarChange}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#333',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
              minWidth: '180px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4a90e2'
              e.target.style.boxShadow = '0 0 0 2px rgba(74, 144, 226, 0.2)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.target.style.boxShadow = 'none'
            }}
          >
            {AvatarOptions.map((option) => (
              <option key={option.value} value={option.value} style={{ padding: '4px' }}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Animation Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: '11px', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Animation
          </label>
          <select
            value={state.selectedAnimation}
            onChange={handleAnimationChange}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#333',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
              minWidth: '180px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4a90e2'
              e.target.style.boxShadow = '0 0 0 2px rgba(74, 144, 226, 0.2)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.target.style.boxShadow = 'none'
            }}
          >
            {AnimationOptions.map((option) => (
              <option key={option.value} value={option.value} style={{ padding: '4px' }}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(74, 144, 226, 0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(74, 144, 226, 0.2)',
          marginTop: '8px'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#4a90e2',
            boxShadow: '0 0 6px rgba(74, 144, 226, 0.6)'
          }} />
          <span style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '11px',
            fontWeight: '500'
          }}>
            Scene Active
          </span>
        </div>
      </div>

      {/* Toggle button for controls */}
      <button
        onClick={onToggleVisibility}
        style={{
          position: 'absolute',
          top: '1%',
          left: isVisible ? '300px' : '20px',
          transform: 'translateY(-50%)',
          zIndex: 1001,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'white',
          fontSize: '12px',
          fontWeight: '600',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: '32px',
          height: '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        {isVisible ? '◀' : '▶'}
        {!isVisible && <span style={{ marginLeft: '4px' }}>Avatar</span>}
      </button>
    </>
  )
} 