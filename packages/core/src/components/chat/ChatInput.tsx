import { useMemo, memo, useCallback } from "react"
import { useXRLayout } from '../../utils/useXRLayout'

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

export const ChatInput = memo(({
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
  const { isXR } = useXRLayout()

  const displayValue = useMemo(() => {
    return isRecording && sttTranscript ? (message + ' ' + sttTranscript).trim() : message
  }, [isRecording, sttTranscript, message])

  const placeholder = useMemo(() => {
    if (!isRecording) return 'Type your message here...'
    if (vadDetecting) return '🎤 Listening...'
    if (sttListening) return '🎤 STT Ready - Speak now'
    return '🎤 Starting...'
  }, [isRecording, vadDetecting, sttListening])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isRecording) onMessageChange(e.target.value)
  }, [isRecording, onMessageChange])

  const handleSubmit = useCallback(() => {
    onSubmit(message)
  }, [message, onSubmit])
  return (
    <div
      style={{
        position: 'absolute',
        bottom: isXR ? '9rem' : '7.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: isXR ? '30rem' : isMobile ? '18.75rem' : '25rem',
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
                padding: isXR ? '0.9rem 3.5rem 0.9rem 1.5rem' : '0.75rem 3.125rem 0.75rem 1.25rem',
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
                fontSize: isXR ? '1.1rem' : '1rem',
                lineHeight: isXR ? '1.6' : '1.5',
                boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.03)',
                boxSizing: 'border-box',
                ...(vadDetecting && { background: 'rgba(19,196,209,0.15)' }),
                ...(sttListening && !vadDetecting && { background: 'rgba(255,107,53,0.15)' })
              }}
              rows={1}
              placeholder={placeholder}
              value={displayValue}
              onChange={handleInputChange}
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
                onClick={handleSubmit}
                style={{
                  background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
                  border: '0.0625rem solid rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                  width: isXR ? '2.5rem' : '2rem',
                  height: isXR ? '2.5rem' : '2rem',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: isXR ? '1rem' : '0.875rem',
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
})

ChatInput.displayName = 'ChatInput'
