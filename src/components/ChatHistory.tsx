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
        flexDirection: 'column',
        backgroundColor: '#095D72',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          backgroundColor: '#095D72',
          color: '#F6F6F6',
          borderRadius: '10px'
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              margin: '8px',
              padding: message.isUser ? '10px' : '0 8px',
              borderRadius: '5px',
              backgroundColor: message.isUser ? '#2A2A2A' : 'transparent',
              maxWidth: message.isUser ? '90%' : 'auto',
              width: message.isUser ? 'fit-content' : 'auto',
              marginLeft: message.isUser ? 'auto' : '0',
              textAlign: message.isUser ? 'right' : 'left',
              filter: message.isUser ? 'brightness(1.2)' : 'none'
            }}
          >
            {message.text}
          </div>
        ))}
      </div>
    </div>
  )
}
