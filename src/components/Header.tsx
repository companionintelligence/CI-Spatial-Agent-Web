interface HeaderProps {
  logoSrc?: string
}

export const Header = ({ logoSrc = '/assets/2024_CI__Logo_Banner_Color.svg' }: HeaderProps) => {
  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center'
      }}
    >
      <img 
        style={{ width: '200px' }} 
        src={logoSrc} 
        alt="Logo"
      />
    </div>
  )
}
