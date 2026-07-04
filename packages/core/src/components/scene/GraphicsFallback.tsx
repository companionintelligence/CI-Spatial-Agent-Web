import { memo } from 'react'

export const GraphicsFallback = memo(() => {
  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--background) 0%, var(--card) 100%)',
      color: '#f5f5f5',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
    }}>
      <div style={{
        margin: '0 16px',
        maxWidth: '512px',
        width: '100%',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '32px',
        textAlign: 'center'
      }}>
        <div style={{
          margin: '0 auto 16px',
          height: '48px',
          width: '48px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '20px'
        }}>
          ⚠️
        </div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          marginBottom: '8px',
          color: '#f5f5f5'
        }}>
          Graphics Unavailable
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#d4d4d8',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          Your browser does not support WebGPU/WebGL or hardware acceleration is disabled.
        </p>
        <div style={{
          fontSize: '12px',
          color: '#a3a3a3',
          lineHeight: '1.6'
        }}>
          <p style={{ margin: '4px 0' }}>• Enable hardware acceleration in your browser settings</p>
          <p style={{ margin: '4px 0' }}>• Update to the latest browser version</p>
          <p style={{ margin: '4px 0' }}>• Try a different browser or device</p>
        </div>
      </div>
    </div>
  )
})


