import { useState } from 'react'

import type { AppConfig } from '../../services/types'
import { ToggleButton } from '../common/ToggleButton'
import { ChatInput } from './ChatInput'
import { ControlButtons } from './ControlButtons'

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
      {/* Chat Input */}
      <ChatInput
        message={message}
        onMessageChange={onMessageChange}
        onSubmit={onSubmit}
        onKeyPress={onKeyPress}
        isRecording={isRecording}
        vadDetecting={vadDetecting}
        sttTranscript={sttTranscript}
        sttListening={sttListening}
      />

      {/* Control Buttons */}
      <ControlButtons
        config={config}
        isRecording={isRecording}
        onToggleMicrophone={onToggleMicrophone}
        onToggleCloudMode={onToggleCloudMode}
        onToggleBargeIn={onToggleBargeIn}
        onToggleAutoSubmit={onToggleAutoSubmit}
        onToggleAgent={onToggleAgent}
        onEnterARMode={onEnterARMode}
        vadDetecting={vadDetecting}
        ttsActive={ttsActive}
        isVisible={isButtonsVisible}
      />

      {/* Controls Toggle Button */}
      <ToggleButton
        isVisible={isButtonsVisible}
        onToggle={() => setIsButtonsVisible(!isButtonsVisible)}
        label="Controls"
        position="bottom-left"
      />
    </>
  )
}
