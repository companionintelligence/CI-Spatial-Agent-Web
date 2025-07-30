import { ControlButton } from './ControlButton'
import type { AppConfig } from '../services/types'

interface ChatInputProps {
  message: string
  onMessageChange: (message: string) => void
  onSubmit: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  config: AppConfig
  isRecording: boolean
  onToggleMicrophone: () => void
  onToggleCloudMode: () => void
  onToggleBargeIn: () => void
  onToggleAutoSubmit: () => void
  onToggleAgent: () => void
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
  vadDetecting = false,
  sttTranscript = '',
  ttsActive = false,
  sttListening = false
}: ChatInputProps) => {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'linear-gradient(180deg, #303638 0%, #243238 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.10)',
        color: '#FFFFFF',
        borderRadius: '16px',
        margin: '24px 0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div
        style={{
          display: 'flex',
          padding: '20px',
          borderRadius: '16px',
          boxSizing: 'border-box'
        }}
      >
        <textarea
          className="chat-input"
          style={{
            flex: 1,
            padding: '12px 20px',
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
            ...(vadDetecting && { background: 'rgba(19,196,209,0.30)' }),
            ...(sttListening && !vadDetecting && { background: 'rgba(255,107,53,0.30)' })
          }}
          rows={1}
          placeholder={
            isRecording 
              ? (vadDetecting ? '🎤 Listening...' : sttListening ? '🎤 STT Ready - Speak now' : '🎤 Starting...')
              : 'Type your message here...'
          }
          value={isRecording && sttTranscript ? (message + ' ' + sttTranscript).trim() : message}
          onChange={(e) => !isRecording && onMessageChange(e.target.value)}
          onKeyPress={onKeyPress}
          readOnly={isRecording}
        />
      </div>

      {/* Control Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          height: '50px',
          paddingTop: '16px'
        }}
      >
        {/* Left Controls */}
        <div
          style={{
            display: 'flex',
            gap: '12px'
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
        </div>

        {/* Right Controls */}
        <div
          style={{
            display: 'flex',
            gap: '12px'
          }}
        >
          <ControlButton onClick={onSubmit}>
            ➤
          </ControlButton>
        </div>
      </div>
    </div>
  )
}
