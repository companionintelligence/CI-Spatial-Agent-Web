import type { KeywordAnimationConfig, KeywordAnimationMapping } from '../keywordAnimationTypes'

// Default keyword to animation/emote mappings
const defaultMappings: KeywordAnimationMapping[] = [
  // Greeting animations
  {
    keywords: ['hello', 'hi', 'hey', 'greetings', 'wave'],
    animation: {
      name: 'Waving',
      category: 'gesture',
      immediate: true,
      loopCount: 1,
      speed: 0.8
    },
    emote: {
      emotion: 'happy',
      duration: 3000
    },
    priority: 5,
    description: 'Greeting gesture with wave and happy expression'
  },

  // Agreement/positive responses
  {
    keywords: ['yes', 'agree', 'correct', 'exactly', 'right', 'nod'],
    animation: {
      name: 'Agreeing',
      category: 'gesture',
      immediate: true,
      loopCount: 1
    },
    emote: {
      emotion: 'happy',
      duration: 2500
    },
    priority: 6,
    description: 'Agreement gesture with positive expression'
  },

  // Celebration/excitement
  {
    keywords: ['celebrate', 'clap', 'applause', 'great', 'excellent', 'amazing'],
    animation: {
      name: 'Clapping',
      category: 'gesture',
      immediate: true,
      loopCount: 2
    },
    emote: {
      emotion: 'happy',
      duration: 4000
    },
    priority: 7,
    description: 'Clapping celebration with happy expression'
  },

  // Thinking/contemplation
  {
    keywords: ['think', 'thinking', 'consider', 'hmm', 'ponder', 'wonder'],
    animation: {
      name: 'Thinking',
      category: 'expression',
      immediate: true,
      loopCount: 1
    },
    emote: {
      emotion: 'neutral',
      duration: 4000
    },
    priority: 6,
    description: 'Thinking pose with neutral contemplative expression'
  },

  // Surprise/shock
  {
    keywords: ['wow', 'surprise', 'shocked', 'amazing', 'incredible', 'unbelievable'],
    animation: {
      name: 'Surprised',
      category: 'expression',
      immediate: true,
      loopCount: 1
    },
    emote: {
      emotion: 'fear', // Maps to surprised expression
      duration: 2000
    },
    priority: 7,
    description: 'Surprised reaction with shocked expression'
  },

  // Dancing/celebration
  {
    keywords: ['dance', 'dancing', 'party', 'music', 'groove', 'boogie'],
    animation: {
      name: 'Dance',
      category: 'action',
      immediate: true,
      loopCount: 1
    },
    emote: {
      emotion: 'happy',
      duration: 6000
    },
    priority: 8,
    description: 'Dance moves with joyful expression'
  },

  // Formal/respectful gestures
  {
    keywords: ['bow', 'respect', 'honor', 'thank you', 'thanks', 'grateful'],
    animation: {
      name: 'Bow',
      category: 'action',
      immediate: true,
      loopCount: 1
    },
    emote: {
      emotion: 'neutral',
      duration: 3000
    },
    priority: 6,
    description: 'Respectful bow with neutral expression'
  },

  // Communication/talking
  {
    keywords: ['talk', 'speaking', 'say', 'tell', 'explain', 'communicate'],
    animation: {
      name: 'Talking',
      category: 'communication',
      immediate: true,
      loopCount: 2
    },
    emote: {
      emotion: 'neutral',
      duration: 3000
    },
    priority: 4,
    description: 'Talking gestures with neutral expression'
  },

  // Pointing/directing attention
  {
    keywords: ['point', 'look', 'see', 'over there', 'that way', 'direction'],
    animation: {
      name: 'Pointing Forward',
      category: 'gesture',
      immediate: true,
      loopCount: 1
    },
    emote: {
      emotion: 'neutral',
      duration: 2500
    },
    priority: 5,
    description: 'Pointing gesture to direct attention'
  },

  // Negative emotions
  {
    keywords: ['sad', 'sorry', 'disappointed', 'upset', 'unhappy', 'down'],
    emote: {
      emotion: 'sad',
      duration: 3000
    },
    priority: 6,
    description: 'Sad facial expression'
  },

  // Angry emotions
  {
    keywords: ['angry', 'mad', 'frustrated', 'annoyed', 'irritated'],
    emote: {
      emotion: 'angry',
      duration: 3000
    },
    priority: 6,
    description: 'Angry facial expression'
  },

  // Love/affection
  {
    keywords: ['love', 'heart', 'adore', 'cherish', 'affection'],
    emote: {
      emotion: 'love',
      duration: 3000
    },
    priority: 6,
    description: 'Loving facial expression'
  },

  // General positive emotions
  {
    keywords: ['happy', 'joy', 'smile', 'cheerful', 'pleased', 'delighted'],
    emote: {
      emotion: 'happy',
      duration: 3000
    },
    priority: 5,
    description: 'Happy facial expression'
  },

  // Neutral/reset
  {
    keywords: ['neutral', 'reset', 'normal', 'default', 'calm'],
    emote: {
      emotion: 'neutral',
      duration: 2000
    },
    priority: 3,
    description: 'Reset to neutral expression'
  }
]

export const defaultKeywordAnimationConfig: KeywordAnimationConfig = {
  mappings: defaultMappings,
  minConfidence: 0.3,
  allowPartialMatches: true
}