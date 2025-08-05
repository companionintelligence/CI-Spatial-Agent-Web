import type { ChatMessage } from '../../services/types'
import { ToggleButton } from '../common/ToggleButton'
import { ChatBubble } from './ChatBubble'
import { useEffect, useRef } from 'react'

interface ChatPanelProps {
  messages: ChatMessage[]
  isVisible: boolean
  onToggleVisibility: () => void
}

export const ChatPanel = ({ messages, isVisible, onToggleVisibility }: ChatPanelProps) => {
  const isMobile = window.innerWidth <= 768
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollContainerRef.current && isVisible) {
      const scrollContainer = scrollContainerRef.current
      
      const scrollToBottom = () => {
        // Ensure we scroll to the very bottom
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
      
      // Use a small delay to ensure DOM is fully updated
      const timeoutId = setTimeout(scrollToBottom, 50)
      
      // Also try with requestAnimationFrame for immediate updates
      requestAnimationFrame(scrollToBottom)
      
      return () => clearTimeout(timeoutId)
    }
  }, [messages, isVisible])
  
  // Additional effect to handle visibility changes
  useEffect(() => {
    if (isVisible && scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current
      // Scroll to bottom when panel becomes visible
      setTimeout(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }, 100)
    }
  }, [isVisible])
  
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: "1rem",
          right: 0,
          height: '80%',
          width: isVisible ? (isMobile ? '12.5rem' : '17.5rem') : '0',
          zIndex: 999,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
          backdropFilter: 'blur(1.25rem)',
          border: '0.0625rem solid rgba(255,255,255,0.08)',
          borderRadius: '1rem 0 0 1rem',
          overflow: 'hidden',
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
          margin: '0'
        }}
      >
        {/* Chat History Content */}
        <div
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            height: '100%',
            paddingTop: isMobile ? '2.5rem' : '3.75rem',
            paddingLeft: isMobile ? '0.75rem' : '1.25rem',
            paddingRight: isMobile ? '0.75rem' : '1.25rem',
            paddingBottom: isMobile ? '0.75rem' : '1.25rem',
            overflow: 'hidden',
            pointerEvents: isVisible ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Chat Log Header */}
          <div
            style={{
              marginBottom: isMobile ? '0.75rem' : '1.25rem',
              paddingBottom: isMobile ? '0.5rem' : '0.75rem',
              borderBottom: '0.0625rem solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <div style={{
              width: isMobile ? '0.375rem' : '0.5rem',
              height: isMobile ? '0.375rem' : '0.5rem',
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #4a90e2, #7b68ee)',
              boxShadow: '0 0 0.5rem rgba(74, 144, 226, 0.5)'
            }} />
            <span style={{ 
              color: 'white', 
              fontSize: isMobile ? '0.75rem' : '0.875rem', 
              fontWeight: '600',
              letterSpacing: '0.03125rem'
            }}>
              Chat Log
            </span>
          </div>

          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              color: '#FFFFFF',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              paddingRight: '0.5rem',
              // Custom scrollbar styling
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
              // Smooth scrolling
              scrollBehavior: 'smooth',
              // Ensure proper scroll margins
              scrollMarginBottom: '1rem'
            }}
            className="custom-scrollbar"
          >
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {/* Invisible element at the bottom to ensure proper scrolling */}
            <div style={{ height: '5rem' }} />
          </div>
        </div>
      </div>

      <ToggleButton
        isVisible={isVisible}
        onToggle={onToggleVisibility}
        label="Chat"
        position="right"
        isMobile={isMobile}
        panelWidth={{ mobile: '12.5rem', desktop: '17.5rem' }}
      />
    </>
  )
} 