interface ChatInputProps {
  message: string
  onMessageChange: (message: string) => void
  onSubmit: (message: string) => void
  onKeyPress: (e: React.KeyboardEvent) => void
  isRecording: boolean
  vadDetecting?: boolean
  sttTranscript?: string
  sttListening?: boolean
}

export const ChatInput = ({
  message,
  onMessageChange,
  onSubmit,
  onKeyPress,
  isRecording,
  vadDetecting = false,
  sttTranscript = '',
  sttListening = false
}: ChatInputProps) => {
  const isMobile = window.innerWidth <= 768

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '7.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: isMobile ? '18.75rem' : '25rem',
        maxWidth: '90%',
        pointerEvents: 'none'
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          {/* Text Input Container */}
          <div
            style={{
              position: 'relative',
              width: '100%'
            }}
          >
            <textarea
              className="chat-input"
              style={{
                width: '100%',
                padding: '0.75rem 3.125rem 0.75rem 1.25rem',
                borderRadius: '9999px',
                resize: 'none',
                border: 'none',
                outline: 'none',
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(1.25rem)',
                color: '#FFFFFF',
                overflow: 'auto',
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                fontSize: '1rem',
                lineHeight: '1.5',
                boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.03)',
                boxSizing: 'border-box',
                ...(vadDetecting && { background: 'rgba(19,196,209,0.15)' }),
                ...(sttListening && !vadDetecting && { background: 'rgba(255,107,53,0.15)' })
              }}
              rows={1}
              placeholder={
                isRecording
                  ? vadDetecting
                    ? '🎤 Listening...'
                    : sttListening
                    ? '🎤 STT Ready - Speak now'
                    : '🎤 Starting...'
                  : 'Type your message here...'
              }
              value={isRecording && sttTranscript ? (message + ' ' + sttTranscript).trim() : message}
              onChange={(e) => !isRecording && onMessageChange(e.target.value)}
              onKeyPress={onKeyPress}
              readOnly={isRecording}
            />

            {/* Send Button - positioned inside the text field */}
            <div
              style={{
                position: 'absolute',
                right: '0.375rem',
                top: '45%',
                transform: 'translateY(-50%)',
                zIndex: 1
              }}
            >
              <button
                onClick={() => onSubmit(message)}
                style={{
                  background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
                  border: '0.0625rem solid rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                  width: '2rem',
                  height: '2rem',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(1.25rem)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)'
                  e.currentTarget.style.boxShadow = '0 0.25rem 0.5rem rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0,0,0,0.04)'
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
