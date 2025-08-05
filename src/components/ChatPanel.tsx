import { useState } from 'react'
import type { AppConfig, ChatMessage } from '../services/types'

interface ChatPanelProps {
  messages: ChatMessage[]
  isVisible: boolean
  onToggleVisibility: () => void
}

export const ChatPanel = ({ messages, isVisible, onToggleVisibility }: ChatPanelProps) => {
  return (
    <>
      {/* Minimizable Chat History Side Panel */}
            <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '80%',
          width: isVisible ? '400px' : '0px',
          zIndex: 999,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px 0 0 16px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          margin: '0'
        }}
      >
        {/* Chat History Content */}
                  <div
            style={{
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
              height: '100%',
              paddingTop: '60px',
              paddingLeft: '20px',
              paddingRight: '20px',
              paddingBottom: '20px',
              overflow: 'hidden',
              pointerEvents: isVisible ? 'auto' : 'none',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
          {/* Chat Log Header */}
          <div
            style={{
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #4a90e2, #7b68ee)',
              boxShadow: '0 0 8px rgba(74, 144, 226, 0.5)'
            }} />
            <span style={{ 
              color: 'white', 
              fontSize: '14px', 
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              Chat Log
            </span>
          </div>

                      <div
              style={{
                flex: 1,
                overflowY: 'auto',
                color: '#FFFFFF',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                paddingRight: '8px'
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
                    ? 'linear-gradient(135deg, rgba(0,131,145,0.25) 0%, rgba(0,131,145,0.12) 100%)'
                    : 'transparent',
                  border: message.isUser ? '1px solid rgba(255,255,255,0.08)' : 'none',
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
      </div>

      {/* Toggle Button - Moves with Panel */}
      <button
        onClick={onToggleVisibility}
        style={{
          position: 'absolute',
          top: '1%',
          right: isVisible ? '370px' : '20px',
          transform: isVisible ? 'translateY(-50%)' : 'translateY(-50%)',
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
        {isVisible ? '▶' : '◀'}
        {!isVisible && <span style={{ marginLeft: '4px' }}>Chat</span>}
      </button>
    </>
  )
} 