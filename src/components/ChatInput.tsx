import type { AppConfig } from '../services/types'
import { ControlButton } from './ControlButton'

interface ChatInputProps {
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

export const ChatInput = ({
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
}: ChatInputProps) => {
  return (
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
            padding: '12px 60px 12px 20px', // Right padding for send button
            borderRadius: '9999px',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(16px)',
            color: '#FFFFFF',
            overflow: 'auto',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: '1rem',
            lineHeight: '1.5',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            boxSizing: 'border-box',
            ...(vadDetecting && { background: 'rgba(19,196,209,0.30)' }),
            ...(sttListening && !vadDetecting && { background: 'rgba(255,107,53,0.30)' })
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
            right: '8px',
            top: '50%',
            transform: 'translateY(-60%)',
            zIndex: 1
          }}
        >
          <ControlButton onClick={() => onSubmit(message)}>➤</ControlButton>
        </div>
      </div>

      {/* Control Buttons Container */}
      <div
        style={{
          background: 'linear-gradient(355deg,rgba(122, 135, 140, 0) 0%,rgba(133, 145, 150, 0.2) 100%)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.07)',
          display: 'flex',
          justifyContent: 'center',
          padding: '16px 24px',
          gap: '16px',
          flexWrap: 'wrap',
          minHeight: '72px',
          alignItems: 'center',
          width: 'fit-content',
          margin: '0 auto',
          maxWidth: '400px'
        }}
      >
        <ControlButton isActive={isRecording} onClick={onToggleMicrophone}>
          {vadDetecting ? '🟢' : isRecording ? '🔴' : '🎤'}
        </ControlButton>
        <ControlButton isActive={config.cloudMode} onClick={onToggleCloudMode}>
          ☁️
        </ControlButton>
        <ControlButton isActive={config.bargeInEnabled} onClick={onToggleBargeIn}>
          ⚡
        </ControlButton>
        <ControlButton isActive={config.autoSubmitEnabled} onClick={onToggleAutoSubmit}>
          🚀
        </ControlButton>
        <ControlButton isActive={config.agentEnabled} onClick={onToggleAgent}>
          {ttsActive ? '🔊' : '🤖'}
        </ControlButton>
        {onEnterARMode && (
          <ControlButton onClick={onEnterARMode}>
            🥽
          </ControlButton>
        )}
      </div>
    </div>
  )
}
