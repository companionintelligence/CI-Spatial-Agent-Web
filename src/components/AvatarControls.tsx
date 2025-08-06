import { useSimpleStore } from '../utils/SimpleStore'
import { AvatarState } from '../xr/AvatarModel'
import { AnimationOptions, AvatarOptions } from '../xr/AvatarOptions'
import { ToggleButton } from './common/ToggleButton'
import { useState, useRef, useEffect } from 'react'

interface AvatarControlsProps {
  isVisible: boolean
  onToggleVisibility: () => void
}

interface DropdownProps {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
  placeholder?: string
  searchable?: boolean
}

const Dropdown = ({ label, value, options, onChange, placeholder = "Select option", searchable = false }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = window.innerWidth <= 768

  const selectedOption = options.find(option => option.value === value)

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ 
        color: 'rgba(255, 255, 255, 0.9)', 
        fontSize: '0.6875rem', 
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.03125rem'
      }}>
        {label}
      </label>
      
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: '0.0625rem solid rgba(255, 255, 255, 0.15)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            fontSize: isMobile ? '0.75rem' : '0.8125rem',
            fontWeight: '500',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(1.25rem)',
            minHeight: isMobile ? '2.5rem' : '2.75rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
          }}
        >
          <span style={{ 
            color: selectedOption ? 'white' : 'rgba(255, 255, 255, 0.6)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span style={{ 
            fontSize: '0.75rem',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </button>

        {isOpen && (
          <div style={{
            width: '100%',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'linear-gradient(180deg, rgba(16,25,30,0.95) 0%, rgba(17,43,48,0.95) 100%)',
            backdropFilter: 'blur(1.25rem)',
            border: '0.0625rem solid rgba(255, 255, 255, 0.15)',
            borderRadius: '0.5rem',
            boxShadow: '0 0.5rem 1rem rgba(0,0,0,0.3)',
            marginTop: '0.25rem',
            maxHeight: '12.5rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {searchable && (
              <div style={{
                padding: '0.75rem',
                borderBottom: '0.0625rem solid rgba(255, 255, 255, 0.1)'
              }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '0.0625rem solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    fontSize: '0.75rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4a90e2'
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                  }}
                />
              </div>
            )}
            
            <div style={{
              maxHeight: '10rem',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
            }}>
              {filteredOptions.length === 0 ? (
                <div style={{
                  padding: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}>
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background: 'transparent',
                      color: 'white',
                      fontSize: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderBottom: '0.0625rem solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    {option.value === value && (
                      <span style={{ color: '#4a90e2', fontSize: '0.875rem' }}>✓</span>
                    )}
                    <span style={{ 
                      flex: 1,
                      color: option.value === value ? '#4a90e2' : 'white'
                    }}>
                      {option.label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const AvatarControls = ({ isVisible, onToggleVisibility }: AvatarControlsProps) => {
  const [state, setState] = useSimpleStore(AvatarState)
  const isMobile = window.innerWidth <= 768

  const handleAvatarChange = (value: string) => {
    setState((state) => {
      state.selectedModel = value
      return state
    })
  }

  const handleAnimationChange = (value: string) => {
    setState((state) => {
      state.selectedAnimation = value
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
          gap: isMobile ? '0.75rem' : '1rem',
          background: 'linear-gradient(180deg, rgba(16,25,30,0.8) 0%, rgba(17,43,48,0.8) 100%)',
          backdropFilter: 'blur(1.25rem)',
          padding: isMobile ? '1rem' : '1.5rem',
          borderRadius: '1rem',
          border: '0.0625rem solid rgba(255,255,255,0.12)',
          width: isVisible ? (isMobile ? '15rem' : '20rem') : '0',
          boxShadow: '0 0.25rem 0.5rem rgba(0,0,0,0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isVisible ? 1 : 0
        }}
      >
        {/* Header */}
        <div style={{ 
          marginBottom: isMobile ? '0.75rem' : '1rem', 
          paddingBottom: isMobile ? '0.75rem' : '1rem', 
          borderBottom: '0.0625rem solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: isMobile ? '0.5rem' : '0.625rem',
            height: isMobile ? '0.5rem' : '0.625rem',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #4a90e2, #7b68ee)',
            boxShadow: '0 0 0.5rem rgba(74, 144, 226, 0.5)'
          }} />
          <span style={{ 
            color: 'white', 
            fontSize: isMobile ? '0.875rem' : '1rem', 
            fontWeight: '600',
            letterSpacing: '0.03125rem'
          }}>
            Avatar Controls
          </span>
        </div>

        {/* Character Selection */}
        <Dropdown
          label="Character"
          value={state.selectedModel}
          options={AvatarOptions}
          onChange={handleAvatarChange}
          placeholder="Select character"
          searchable={true}
        />

        {/* Animation Selection */}
        <Dropdown
          label="Animation"
          value={state.selectedAnimation}
          options={AnimationOptions}
          onChange={handleAnimationChange}
          placeholder="Select animation"
          searchable={true}
        />
      </div>

      {/* Toggle Button */}
      <ToggleButton
        isVisible={isVisible}
        onToggle={onToggleVisibility}
        label="Avatar"
        position="left"
        isMobile={isMobile}
        panelWidth={{ mobile: '15rem', desktop: '20rem' }}
      />
    </>
  )
} 