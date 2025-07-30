export interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  audioData?: ArrayBuffer
  visemeData?: unknown[]
}

export interface AppConfig {
  microphone: boolean
  cloudMode: boolean
  bargeInEnabled: boolean
  autoSubmitEnabled: boolean
  agentEnabled: boolean
}

export interface AppState {
  messages: ChatMessage[]
  currentMessage: string
  isRecording: boolean
  config: AppConfig
}

export const initialState: AppState = {
  messages: [
    {
      id: '1',
      text: 'Welcome to CI-XR-Web! 🎉',
      isUser: false,
      timestamp: Date.now() - 15000
    },
    {
      id: '2',
      text: 'Audio features are now available! Click 🎤 to enable voice input, 🚀 for auto-submit, and 🤖 to hear my responses spoken aloud.',
      isUser: false,
      timestamp: Date.now() - 10000
    },
    {
      id: '3',
      text: 'Hello! Thanks for the audio features overview. I\'ll try speaking to test the voice input.',
      isUser: true,
      timestamp: Date.now() - 5000
    }
  ],
  currentMessage: '',
  isRecording: false,
  config: {
    microphone: false,
    cloudMode: true,
    bargeInEnabled: true,
    autoSubmitEnabled: true,
    agentEnabled: true
  }
}
