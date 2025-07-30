interface ControlButtonProps {
  isActive?: boolean
  onClick: () => void
  children: React.ReactNode
}

export const ControlButton = ({ isActive = false, onClick, children }: ControlButtonProps) => {
  return (
    <button
      style={{
        padding: '10px',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
        backgroundColor: isActive ? '#00A9A7' : '#008997',
        color: '#F6F6F6'
      }}
      onClick={onClick}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#00c9c7'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = isActive ? '#00A9A7' : '#008997'}
    >
      {children}
    </button>
  )
}
