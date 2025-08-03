interface ControlButtonProps {
  isActive?: boolean
  onClick: () => void
  children: React.ReactNode
}

export const ControlButton = ({ isActive = false, onClick, children }: ControlButtonProps) => {
  return (
    <button
      style={{
        width: '40px',
        height: '40px',
        padding: '0',
        border: 'none',
        borderRadius: '9999px',
        cursor: 'pointer',
        transition: 'background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        background: isActive ? 'rgba(19,196,209,0.30)' : 'rgba(255,255,255,0.06)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem'
      }}
      onClick={onClick}
      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(19,196,209,0.18)')}
      onMouseOut={(e) =>
        (e.currentTarget.style.background = isActive ? 'rgba(19,196,209,0.30)' : 'rgba(255,255,255,0.06)')
      }
    >
      {children}
    </button>
  )
}
