import type { AppConfig } from '../services/types'
import { ChatInput } from './ChatInput'
import { useState } from 'react'

interface ChatOverlayProps {
  message: string
  onMessageChange: (message: string) => void
  onSubmit: (message: string) => void
  onKeyPress: (e: React.KeyboardEvent) => void
  config: AppConfig
  isRecording: boolean
  onToggleMicrophone: () => void
  onToggleCloudMode: () => void
  onToggleBargeIn: () => void
  onToggleAutoSubmit: () => void
  onToggleAgent: () => void
  onEnterARMode?: () => void
  vadDetecting?: boolean
  sttTranscript?: string
  ttsActive?: boolean
  sttListening?: boolean
}

export const ChatOverlay = ({
  message,
  onMessageChange,
  onSubmit,
  onKeyPress,
  config,
  isRecording,
  onToggleMicrophone,
  onToggleCloudMode,
  onToggleBargeIn,
  onToggleAutoSubmit,
  onToggleAgent,
  onEnterARMode,
  vadDetecting = false,
  sttTranscript = '',
  ttsActive = false,
  sttListening = false
}: ChatOverlayProps) => {
  const [isButtonsVisible, setIsButtonsVisible] = useState(true)

  return (
    <>
      {/* Always Visible Text Input */}
      <div
        style={{
          position: 'absolute',
          bottom: '120px', // Moved even higher from bottom
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          width: '400px', // Fixed width instead of stretching
          maxWidth: '90%', // Responsive max width
          pointerEvents: 'none'
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
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
                    padding: '12px 50px 12px 20px', // Reduced right padding for smaller send button
                    borderRadius: '9999px',
                    resize: 'none',
                    border: 'none',
                    outline: 'none',
                    background: 'rgba(255,255,255,0.02)',
                    backdropFilter: 'blur(20px)',
                    color: '#FFFFFF',
                    overflow: 'auto',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    fontSize: '1rem',
                    lineHeight: '1.5',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
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
                  right: '6px',
                  top: '45%',
                  transform: 'translateY(-50%)',
                  zIndex: 1
                }}
              >
                <button
                  onClick={() => onSubmit(message)}
                  style={{
                    background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '50%',
                    width: '32px', // Smaller size
                    height: '32px', // Smaller size
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '14px', // Smaller font
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(20px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.07)'
                  }}
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Minimizable Control Buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          zIndex: 1000,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isButtonsVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          opacity: isButtonsVisible ? 1 : 0
        }}
      >
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 20px', // Reduced padding
            gap: '12px', // Reduced gap
            flexWrap: 'wrap',
            minHeight: '56px', // Reduced height
            alignItems: 'center',
            width: 'fit-content',
            margin: '0 auto',
            maxWidth: '400px'
          }}
        >
          <button
            style={{
              background: isRecording ? 'linear-gradient(135deg, rgba(255,107,53,0.8) 0%, rgba(247,147,30,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
              border: isRecording ? '1px solid rgba(255,107,53,0.2)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              backdropFilter: 'blur(20px)',
              boxShadow: isRecording ? '0 2px 8px rgba(255,107,53,0.2)' : '0 2px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onToggleMicrophone}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {vadDetecting ? '🟢' : isRecording ? '🔴' : '🎤'}
          </button>
          <button
            style={{
              background: config.cloudMode ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
              border: config.cloudMode ? '1px solid rgba(0,131,145,0.2)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              backdropFilter: 'blur(20px)',
              boxShadow: config.cloudMode ? '0 2px 8px rgba(0,131,145,0.2)' : '0 2px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onToggleCloudMode}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            ☁️
          </button>
          <button
            style={{
              background: config.bargeInEnabled ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
              border: config.bargeInEnabled ? '1px solid rgba(0,131,145,0.2)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              backdropFilter: 'blur(20px)',
              boxShadow: config.bargeInEnabled ? '0 2px 8px rgba(0,131,145,0.2)' : '0 2px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onToggleBargeIn}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            ⚡
          </button>
          <button
            style={{
              background: config.autoSubmitEnabled ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
              border: config.autoSubmitEnabled ? '1px solid rgba(0,131,145,0.2)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              backdropFilter: 'blur(20px)',
              boxShadow: config.autoSubmitEnabled ? '0 2px 8px rgba(0,131,145,0.2)' : '0 2px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onToggleAutoSubmit}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            🚀
          </button>
          <button
            style={{
              background: config.agentEnabled ? 'linear-gradient(135deg, rgba(0,131,145,0.8) 0%, rgba(0,163,179,0.8) 100%)' : 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
              border: config.agentEnabled ? '1px solid rgba(0,131,145,0.2)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              backdropFilter: 'blur(20px)',
              boxShadow: config.agentEnabled ? '0 2px 8px rgba(0,131,145,0.2)' : '0 2px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onToggleAgent}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {ttsActive ? '🔊' : '🤖'}
          </button>
          {onEnterARMode && (
            <button
              style={{
                background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
                minWidth: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={onEnterARMode}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              🥽
            </button>
          )}
        </div>
      </div>

      {/* Toggle Button for Control Buttons */}
      <button
        onClick={() => setIsButtonsVisible(!isButtonsVisible)}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1001,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'white',
          fontSize: '12px',
          fontWeight: '600',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: '32px',
          height: '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        {isButtonsVisible ? '▼' : '▲'}
        {!isButtonsVisible && <span style={{ marginLeft: '4px' }}>Controls</span>}
      </button>
    </>
  )
} 