import type { AppConfig } from '../services/types'
import { ChatInput } from './ChatInput'

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
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '20px',
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
        pointerEvents: 'none'
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <ChatInput
          message={message}
          onMessageChange={onMessageChange}
          onSubmit={onSubmit}
          onKeyPress={onKeyPress}
          config={config}
          isRecording={isRecording}
          onToggleMicrophone={onToggleMicrophone}
          onToggleCloudMode={onToggleCloudMode}
          onToggleBargeIn={onToggleBargeIn}
          onToggleAutoSubmit={onToggleAutoSubmit}
          onToggleAgent={onToggleAgent}
          onEnterARMode={onEnterARMode}
          vadDetecting={vadDetecting}
          sttTranscript={sttTranscript}
          ttsActive={ttsActive}
          sttListening={sttListening}
        />
      </div>
    </div>
  )
} 