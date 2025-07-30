import type { ChatMessage } from '../services/types'

interface ChatHistoryProps {
  messages: ChatMessage[]
}

export const ChatHistory = ({ messages }: ChatHistoryProps) => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #10191E 0%, #112B30 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          color: '#FFFFFF',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              margin: '16px 0',
              padding: message.isUser ? '12px 16px' : '0 12px',
              borderRadius: '16px',
              background: message.isUser 
                ? 'linear-gradient(135deg, rgba(0,131,145,0.35) 0%, rgba(0,131,145,0.18) 100%)'
                : 'transparent',
              border: message.isUser ? '1px solid rgba(255,255,255,0.12)' : 'none',
              maxWidth: message.isUser ? '90%' : 'auto',
              width: message.isUser ? 'fit-content' : 'auto',
              marginLeft: message.isUser ? 'auto' : '0',
              textAlign: message.isUser ? 'right' : 'left',
              boxShadow: message.isUser ? '0 2px 4px rgba(0,0,0,0.07)' : 'none',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}
          >
            {message.text}
          </div>
        ))}
      </div>
    </div>
  )
}
