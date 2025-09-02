import { describe, it, expect } from 'vitest'
import { 
  detectEmotionFromText, 
  getEmotionIntensity, 
  analyzeMessageForActions 
} from '../src/services/integration/emotionIntegration'
import { createReactionFromMessage } from '../src/services/integration/reactionIntegration'
import type { ConversationMessage } from '../src/services/conversation/conversationType'

describe('Enhanced Emotion Integration', () => {
  describe('detectEmotionFromText', () => {
    it('should detect happy emotions with proper scoring', () => {
      expect(detectEmotionFromText('I am absolutely thrilled and ecstatic!')).toBe('happy')
      expect(detectEmotionFromText('This is wonderful and amazing!')).toBe('happy')
      expect(detectEmotionFromText('I feel great today 😊')).toBe('happy')
      expect(detectEmotionFromText('Good job! 👍')).toBe('happy')
    })

    it('should detect sad emotions with context', () => {
      expect(detectEmotionFromText('I am devastated and heartbroken 💔')).toBe('sad')
      expect(detectEmotionFromText('This is very disappointing and unfortunate')).toBe('sad')
      expect(detectEmotionFromText('I regret this decision deeply')).toBe('sad')
      expect(detectEmotionFromText('Crying tears of sorrow 😢')).toBe('sad')
    })

    it('should detect angry emotions', () => {
      expect(detectEmotionFromText('I am absolutely furious about this!')).toBe('angry')
      expect(detectEmotionFromText('This is ridiculous and outrageous 😡')).toBe('angry')
      expect(detectEmotionFromText('I hate this situation completely')).toBe('angry')
    })

    it('should handle negation properly', () => {
      expect(detectEmotionFromText('I am not happy about this')).toBe('sad')
      expect(detectEmotionFromText("This isn't wonderful at all")).toBe('sad')
    })

    it('should detect neutral for ambiguous text', () => {
      expect(detectEmotionFromText('What time is it?')).toBe('neutral')
      expect(detectEmotionFromText('The weather is okay today')).toBe('neutral')
      expect(detectEmotionFromText('Hello, how are you?')).toBe('neutral')
    })

    it('should handle mixed emotions by selecting strongest', () => {
      // Happy should win due to multiple strong indicators
      expect(detectEmotionFromText('I am happy but also a bit sad')).toBe('happy')
      // Sad should win due to stronger weight
      expect(detectEmotionFromText('I feel good but devastated')).toBe('sad')
    })
  })

  describe('getEmotionIntensity', () => {
    it('should calculate low intensity for mild expressions', () => {
      const intensity = getEmotionIntensity('I am okay')
      expect(intensity).toBeGreaterThan(0.3)
      expect(intensity).toBeLessThan(0.6)
    })

    it('should calculate high intensity for strong expressions', () => {
      const intensity = getEmotionIntensity('I am ABSOLUTELY ECSTATIC!!!')
      expect(intensity).toBeGreaterThan(0.8)
    })

    it('should factor in emojis and punctuation', () => {
      const basic = getEmotionIntensity('I am happy')
      const withEmoji = getEmotionIntensity('I am happy 😊')
      const withExclamation = getEmotionIntensity('I am happy!')
      const withBoth = getEmotionIntensity('I am happy! 😊')
      
      expect(withEmoji).toBeGreaterThan(basic)
      expect(withExclamation).toBeGreaterThan(basic)
      expect(withBoth).toBeGreaterThan(withEmoji)
    })

    it('should handle intensity modifiers', () => {
      const mild = getEmotionIntensity('I am a bit happy')
      const medium = getEmotionIntensity('I am very happy')
      const strong = getEmotionIntensity('I am extremely happy')
      
      expect(medium).toBeGreaterThan(mild)
      expect(strong).toBeGreaterThan(medium)
    })
  })

  describe('analyzeMessageForActions', () => {
    it('should detect greetings', () => {
      const message: ConversationMessage = {
        id: '1',
        text: 'Hello, nice to meet you!',
        isUser: false,
        timestamp: Date.now()
      }
      expect(analyzeMessageForActions(message)).toBe('greeting')
    })

    it('should detect farewells', () => {
      const message: ConversationMessage = {
        id: '1',
        text: 'Goodbye, take care!',
        isUser: false,
        timestamp: Date.now()
      }
      expect(analyzeMessageForActions(message)).toBe('farewell')
    })

    it('should detect agreement', () => {
      const message: ConversationMessage = {
        id: '1',
        text: 'Yes, absolutely agreed!',
        isUser: false,
        timestamp: Date.now()
      }
      expect(analyzeMessageForActions(message)).toBe('agreement')
    })
  })

  describe('createReactionFromMessage', () => {
    it('should create proper reaction with relaxTime', () => {
      const message: ConversationMessage = {
        id: '1',
        text: 'I am extremely excited about this wonderful opportunity!',
        isUser: false,
        timestamp: Date.now()
      }
      
      const { performance, animation } = createReactionFromMessage(message, 0)
      
      expect(performance.emotion).toBe('happy')
      expect(performance.relaxTime).toBeGreaterThan(2000) // Should be at least 2 seconds
      expect(performance.bcounter).toBe(0)
    })

    it('should calculate longer duration for longer text', () => {
      const shortMessage: ConversationMessage = {
        id: '1',
        text: 'Great!',
        isUser: false,
        timestamp: Date.now()
      }
      
      const longMessage: ConversationMessage = {
        id: '2',
        text: 'I am absolutely thrilled and incredibly excited about this amazing opportunity that has presented itself. This is truly wonderful news that fills me with joy and happiness.',
        isUser: false,
        timestamp: Date.now()
      }
      
      const shortReaction = createReactionFromMessage(shortMessage, 0)
      const longReaction = createReactionFromMessage(longMessage, 0)
      
      expect(longReaction.performance.relaxTime).toBeGreaterThan(shortReaction.performance.relaxTime!)
    })

    it('should handle neutral emotions with appropriate duration', () => {
      const message: ConversationMessage = {
        id: '1',
        text: 'What time is it?',
        isUser: false,
        timestamp: Date.now()
      }
      
      const { performance } = createReactionFromMessage(message, 0)
      
      expect(performance.emotion).toBe('neutral')
      expect(performance.relaxTime).toBeGreaterThan(1000) // Even neutral should have reasonable duration
      expect(performance.relaxTime).toBeLessThan(5000) // But not too long
    })
  })
})