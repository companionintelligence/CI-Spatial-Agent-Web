interface LogoOverlayProps {
  logoSrc?: string
}

export const LogoOverlay = ({ logoSrc = '/assets/2024_CI__Logo_Banner_Color.svg' }: LogoOverlayProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1002,
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '12px 24px',
          pointerEvents: 'auto'
        }}
      >
        <img 
          style={{ 
            width: '180px',
            height: 'auto',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
          }} 
          src={logoSrc} 
          alt="Logo" 
        />
      </div>
    </div>
  )
} 