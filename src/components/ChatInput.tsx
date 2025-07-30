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
        backgroundColor: '#095D72',
        color: '#F6F6F6',
        borderRadius: '10px',
        marginTop: '10px',
        marginBottom: '10px'
      }}
    >
      <div
        style={{
          display: 'flex',
          padding: '10px',
          backgroundColor: '#008997',
          borderRadius: '5px',
          boxSizing: 'border-box'
        }}
      >
        <textarea
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '5px',
            resize: 'none',
            border: 'none',
            outline: 'none',
            backgroundColor: '#095D72',
            filter: 'brightness(1.2)',
            color: '#F6F6F6',
            overflow: 'auto',
            fontFamily: 'inherit',
            ...(vadDetecting && { backgroundColor: '#00A651', filter: 'brightness(1.3)' }),
            ...(sttListening && !vadDetecting && { backgroundColor: '#FF6B35', filter: 'brightness(1.1)' })
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
          paddingTop: '10px'
        }}
      >
        {/* Left Controls */}
        <div
          style={{
            display: 'flex',
            gap: '10px'
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
            gap: '10px'
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
