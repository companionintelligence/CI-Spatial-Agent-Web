import React from 'react'

import { Tooltip } from './Tooltip'

interface ControlButtonProps {
  isActive?: boolean
  onClick: () => void
  children: React.ReactNode
  tooltipContent?: string
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
  size?: number
}

export const ControlButton = ({
  isActive = false,
  onClick,
  children,
  tooltipContent,
  tooltipPosition = 'top',
  disabled = false,
  size = 40
}: ControlButtonProps) => {
  const buttonElement = (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        padding: '0',
        borderRadius: '9999px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.5 : 1,
        background: isActive
          ? 'color-mix(in srgb, var(--primary) 22%, transparent)'
          : 'var(--xr-glass-bg)',
        backdropFilter: 'blur(var(--xr-glass-blur))',
        border: isActive
          ? '0.0625rem solid var(--primary)'
          : '0.0625rem solid var(--xr-glass-border)',
        color: 'var(--card-foreground)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(14, Math.round(size * 0.4))}px`,
        boxShadow: isActive
          ? '0 0.125rem 0.5rem color-mix(in srgb, var(--primary) 30%, transparent)'
          : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = isActive
          ? '0 0.125rem 0.5rem color-mix(in srgb, var(--primary) 30%, transparent)'
          : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
    >
      {children}
    </button>
  )

  // If tooltip content is provided, wrap the button with tooltip
  if (tooltipContent) {
    return (
      <Tooltip content={tooltipContent} position={tooltipPosition}>
        {buttonElement}
      </Tooltip>
    )
  }

  // Otherwise return just the button
  return buttonElement
}
