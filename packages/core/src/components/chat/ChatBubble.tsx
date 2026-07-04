interface ChatBubbleProps {
  message: {
    id: string
    text: string
    isUser: boolean
  }
}

export const ChatBubble = ({ message }: ChatBubbleProps) => {
  return (
    <div
      style={{
        margin: '0.5rem 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        flexDirection: message.isUser ? 'row-reverse' : 'row'
      }}
    >
      {/* Profile Picture Placeholder */}
      <div
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          background: message.isUser
            ? 'linear-gradient(135deg, #4a90e2, #7b68ee)'
            : 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: 'white',
          flexShrink: 0,
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)'
        }}
      >
        {message.isUser ? 'U' : 'A'}
      </div>

      {/* Message Content */}
      <div
        style={{
          maxWidth: '70%',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.75rem',
          background: message.isUser
            ? 'color-mix(in srgb, var(--primary) 22%, transparent)'
            : 'color-mix(in srgb, var(--card) 85%, transparent)',
          border: message.isUser
            ? '0.0625rem solid var(--xr-glass-border)'
            : '0.0625rem solid var(--border)',
          color: 'var(--card-foreground)',
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.07)',
          fontSize: '1em',
          lineHeight: '1.4'
        }}
      >
        <div style={{ marginBottom: '0.125rem', fontSize: '0.75em', opacity: 0.7 }}>
          {message.isUser ? 'You' : 'Assistant'}
        </div>
        <div>{message.text}</div>
      </div>
    </div>
  )
}
