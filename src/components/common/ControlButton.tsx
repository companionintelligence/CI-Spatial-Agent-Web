import React from 'react'
import { Tooltip } from './Tooltip'

interface ControlButtonProps {
  isActive?: boolean
  onClick: () => void
  children: React.ReactNode
  tooltipContent?: string
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
}

export const ControlButton = ({ 
  isActive = false, 
  onClick, 
  children, 
  tooltipContent,
  tooltipPosition = 'top'
}: ControlButtonProps) => {
  const buttonElement = (
    <button
      style={{
        width: '40px',
        height: '40px',
        padding: '0',
        borderRadius: '9999px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        background: isActive 
          ? 'linear-gradient(135deg, rgba(0,131,145,0.25) 0%, rgba(0,131,145,0.12) 100%)'
          : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
        backdropFilter: 'blur(1.25rem)',
        border: isActive 
          ? '0.0625rem solid rgba(0,131,145,0.2)' 
          : '0.0625rem solid rgba(255,255,255,0.08)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        boxShadow: isActive 
          ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' 
          : '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = isActive 
          ? '0 0.125rem 0.5rem rgba(0,131,145,0.2)' 
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