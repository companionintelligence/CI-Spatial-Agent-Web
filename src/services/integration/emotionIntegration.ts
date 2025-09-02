import type { ConversationMessage } from '../conversation/conversationType'
import type { EmotionType, PerformanceData } from '../emote/emoteTypes'

/**
 * Enhanced emotion detection based on keywords, patterns, and contextual cues in text
 * Improved from simple keyword matching to better sentiment analysis
 */
export const detectEmotionFromText = (text: string): EmotionType => {
  const lowerText = text.toLowerCase()
  
  // Initialize emotion scores
  const emotionScores = {
    happy: 0,
    sad: 0,
    angry: 0,
    fear: 0,
    disgust: 0,
    love: 0,
    neutral: 0
  }

  // Enhanced Happy indicators with weights
  const happyPatterns = [
    { patterns: ['ecstatic', 'overjoyed', 'elated', 'thrilled'], weight: 3 },
    { patterns: ['happy', 'joy', 'joyful', 'excited', 'delighted'], weight: 2 },
    { patterns: ['great', 'wonderful', 'amazing', 'fantastic', 'excellent', 'awesome', 'brilliant'], weight: 2 },
    { patterns: ['love', 'adore', 'celebrate', 'cheerful', 'glad', 'pleased'], weight: 2 },
    { patterns: ['good', 'nice', 'fun', 'cool', 'sweet', 'perfect'], weight: 1 },
    { patterns: ['😊', '😄', '😃', '😁', '🎉', '👍', '🙂', '😌'], weight: 2 }
  ]

  // Enhanced Sad indicators
  const sadPatterns = [
    { patterns: ['devastated', 'heartbroken', 'miserable', 'depressed'], weight: 3 },
    { patterns: ['sad', 'sorrow', 'grief', 'melancholy', 'disappointed'], weight: 2 },
    { patterns: ['sorry', 'unfortunately', 'regret', 'regrettably'], weight: 2 },
    { patterns: ['cry', 'crying', 'tears', 'weep', 'hurt', 'pain'], weight: 2 },
    { patterns: ['down', 'low', 'blue', 'gloomy', 'upset'], weight: 1 },
    { patterns: ['😢', '😭', '💔', '😔', '😞', '☹️'], weight: 2 }
  ]

  // Enhanced Angry indicators
  const angryPatterns = [
    { patterns: ['furious', 'enraged', 'livid', 'irate'], weight: 3 },
    { patterns: ['angry', 'mad', 'rage', 'wrath', 'irritated'], weight: 2 },
    { patterns: ['frustrated', 'annoyed', 'annoying', 'infuriating'], weight: 2 },
    { patterns: ['outrageous', 'ridiculous', 'absurd', 'unacceptable'], weight: 2 },
    { patterns: ['hate', 'despise', 'loathe', 'can\'t stand'], weight: 2 },
    { patterns: ['😠', '😡', '🤬', '💢', '😤'], weight: 2 }
  ]

  // Enhanced Fear indicators
  const fearPatterns = [
    { patterns: ['terrified', 'petrified', 'horrified', 'panic'], weight: 3 },
    { patterns: ['scared', 'afraid', 'frightened', 'fearful'], weight: 2 },
    { patterns: ['nervous', 'worried', 'anxious', 'concerned'], weight: 2 },
    { patterns: ['dread', 'apprehensive', 'uneasy', 'alarmed'], weight: 2 },
    { patterns: ['scared', 'spooked', 'startled'], weight: 1 },
    { patterns: ['😨', '😰', '😱', '🫣', '😖'], weight: 2 }
  ]

  // Enhanced Disgust indicators
  const disgustPatterns = [
    { patterns: ['disgusting', 'revolting', 'repulsive', 'sickening'], weight: 3 },
    { patterns: ['gross', 'yuck', 'nasty', 'foul'], weight: 2 },
    { patterns: ['awful', 'terrible', 'horrible', 'appalling'], weight: 2 },
    { patterns: ['repugnant', 'repulsive', 'vile', 'loathsome'], weight: 2 },
    { patterns: ['ugh', 'eww', 'sick', 'nauseous'], weight: 1 },
    { patterns: ['🤢', '🤮', '😷', '🤧'], weight: 2 }
  ]

  // Enhanced Love/affection indicators
  const lovePatterns = [
    { patterns: ['love you', 'adore you', 'worship', 'devoted'], weight: 3 },
    { patterns: ['love', 'adore', 'cherish', 'treasure'], weight: 2 },
    { patterns: ['romantic', 'romance', 'passion', 'intimate'], weight: 2 },
    { patterns: ['sweetheart', 'darling', 'beloved', 'dear'], weight: 2 },
    { patterns: ['affection', 'fondness', 'warmth', 'care'], weight: 1 },
    { patterns: ['💕', '💖', '💗', '❤️', '😍', '🥰', '💘'], weight: 2 }
  ]

  // Calculate scores for each emotion
  const patternGroups = [
    { patterns: happyPatterns, emotion: 'happy' as keyof typeof emotionScores },
    { patterns: sadPatterns, emotion: 'sad' as keyof typeof emotionScores },
    { patterns: angryPatterns, emotion: 'angry' as keyof typeof emotionScores },
    { patterns: fearPatterns, emotion: 'fear' as keyof typeof emotionScores },
    { patterns: disgustPatterns, emotion: 'disgust' as keyof typeof emotionScores },
    { patterns: lovePatterns, emotion: 'love' as keyof typeof emotionScores }
  ]

  patternGroups.forEach(({ patterns, emotion }) => {
    patterns.forEach(({ patterns: patternList, weight }) => {
      patternList.forEach(pattern => {
        if (lowerText.includes(pattern)) {
          emotionScores[emotion] += weight
        }
      })
    })
  })

  // Additional contextual analysis
  
  // Negation detection - reduce positive emotions if negated
  const negationWords = ['not', 'no', 'never', 'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'can\'t', 'isn\'t', 'aren\'t']
  const hasNegation = negationWords.some(word => lowerText.includes(word))
  
  if (hasNegation) {
    emotionScores.happy *= 0.3
    emotionScores.love *= 0.3
    emotionScores.sad += 1
  }

  // Question detection - often indicates uncertainty or curiosity (neutral)
  if (lowerText.includes('?') || lowerText.startsWith('what') || lowerText.startsWith('how') || lowerText.startsWith('why')) {
    emotionScores.neutral += 1
  }

  // Exclamation detection - amplifies existing emotions
  const exclamationCount = (lowerText.match(/!/g) || []).length
  if (exclamationCount > 0) {
    const amplifyFactor = 1 + (exclamationCount * 0.3)
    Object.keys(emotionScores).forEach(key => {
      if (key !== 'neutral' && emotionScores[key as keyof typeof emotionScores] > 0) {
        emotionScores[key as keyof typeof emotionScores] *= amplifyFactor
      }
    })
  }

  // Find the highest scoring emotion
  const maxEmotion = Object.entries(emotionScores).reduce((max, [emotion, score]) => 
    score > max.score ? { emotion: emotion as EmotionType, score } : max,
    { emotion: 'neutral' as EmotionType, score: 0 }
  )

  // Return the emotion with highest score, or neutral if no strong emotion detected
  return maxEmotion.score > 0 ? maxEmotion.emotion : 'neutral'
}

/**
 * Analyze message for special actions or behaviors
 */
export const analyzeMessageForActions = (message: ConversationMessage): string | undefined => {
  const lowerText = message.text.toLowerCase()

  // Detect greeting behaviors
  if (
    lowerText.includes('hello') ||
    lowerText.includes('to meet you') ||
    lowerText.includes('hi there') ||
    lowerText.includes('good morning') ||
    lowerText.includes('good afternoon') ||
    lowerText.includes('good evening')
  ) {
    return 'greeting'
  }

  // Detect farewell behaviors
  if (
    lowerText.includes('goodbye') ||
    lowerText.includes('bye') ||
    lowerText.includes('see you later') ||
    lowerText.includes('take care') ||
    lowerText.includes('farewell')
  ) {
    return 'farewell'
  }

  // Detect agreement
  if (
    lowerText.includes('yes') ||
    lowerText.includes('absolutely') ||
    lowerText.includes('definitely') ||
    lowerText.includes('agreed') ||
    lowerText.includes('exactly')
  ) {
    return 'agreement'
  }

  // Detect disagreement
  if (
    lowerText.includes('no way') ||
    lowerText.includes('disagree') ||
    lowerText.includes('absolutely not') ||
    lowerText.includes('never') ||
    lowerText.includes('refuse')
  ) {
    return 'disagreement'
  }

  return undefined
}

/**
 * Create performance data based on a conversation message
 */
export const createPerformanceFromMessage = (
  message: ConversationMessage,
  messageIndex: number = 0
): PerformanceData => {
  const emotion = detectEmotionFromText(message.text)
  const action = analyzeMessageForActions(message)

  return {
    emotion,
    action,
    bcounter: messageIndex, // Used for gaze behavior
    whisper: message.visemeData as { words?: string[]; wtimes?: number[]; wdurations?: number[] } | undefined // If available from TTS
  }
}

/**
 * Determine if a message should trigger barge-in behavior
 */
export const shouldTriggerBargeIn = (message: ConversationMessage): boolean => {
  // Improved heuristic for barge-in detection:
  // - User message
  // - Contains strong interruptive keywords or phrases
  // - Short, imperative, or urgent tone
  if (!message.isUser || !message.text) return false

  const lowerText = message.text.toLowerCase().trim()

  // List of interruptive keywords/phrases
  const bargeInPhrases = [
    'stop',
    'wait',
    'hold on',
    'pause',
    'enough',
    'that\'s enough',
    'quiet',
    'be quiet',
    'shut up',
    'cancel',
    'interrupt',
    'let me speak',
    'let me talk',
    'listen',
    'no more',
    'please stop',
    'please wait'
  ]

  // Check for exact match for very short commands (e.g., "stop", "wait")
  if (bargeInPhrases.some(phrase => lowerText === phrase)) return true

  // Check for presence of barge-in phrases anywhere in the message
  if (bargeInPhrases.some(phrase => lowerText.includes(phrase))) return true

  // Heuristic: very short user utterances (1-2 words) that are imperative
  const words = lowerText.split(/\s+/)
  if (words.length <= 2 && (
    words.includes('stop') ||
    words.includes('wait') ||
    words.includes('pause') ||
    words.includes('enough') ||
    words.includes('cancel')
  )) {
    return true
  }

  return false
}

/**
 * Enhanced emotion intensity calculation based on message content
 * Returns a value between 0 and 1, considering multiple factors
 */
export const getEmotionIntensity = (text: string): number => {
  const lowerText = text.toLowerCase()
  let intensity = 0.3 // Base intensity
  
  // Intensity amplifiers with different weights
  const intensityModifiers = [
    // Very high intensity words (0.4 boost each)
    {
      patterns: ['extremely', 'incredibly', 'absolutely', 'completely', 'totally', 'utterly', 'entirely'],
      boost: 0.4
    },
    // High intensity words (0.3 boost each)  
    {
      patterns: ['very', 'really', 'quite', 'pretty', 'rather', 'seriously', 'definitely'],
      boost: 0.3
    },
    // Strong emotion words (0.3 boost each)
    {
      patterns: ['amazing', 'fantastic', 'terrible', 'awful', 'furious', 'thrilled', 'devastated', 'ecstatic'],
      boost: 0.3
    },
    // Medium intensity words (0.2 boost each)
    {
      patterns: ['good', 'bad', 'nice', 'great', 'okay', 'fine', 'wonderful', 'horrible'],
      boost: 0.2
    },
    // Mild intensity words (0.1 boost each)
    {
      patterns: ['a bit', 'somewhat', 'kind of', 'sort of', 'a little', 'slightly'],
      boost: 0.1
    }
  ]
  
  // Apply intensity modifiers
  intensityModifiers.forEach(({ patterns, boost }) => {
    patterns.forEach(pattern => {
      if (lowerText.includes(pattern)) {
        intensity += boost
      }
    })
  })
  
  // Punctuation and typography-based intensity
  const exclamationCount = (lowerText.match(/!/g) || []).length
  if (exclamationCount > 0) {
    intensity += Math.min(exclamationCount * 0.15, 0.3) // Max 0.3 boost from exclamations
  }
  
  const questionCount = (lowerText.match(/\?/g) || []).length
  if (questionCount > 0) {
    intensity += Math.min(questionCount * 0.1, 0.2) // Questions add moderate intensity
  }
  
  // CAPS detection (indicates strong emotion)
  const capsWords = text.match(/[A-Z]{2,}/g)
  if (capsWords && capsWords.length > 0) {
    intensity += Math.min(capsWords.length * 0.2, 0.4) // Max 0.4 boost from caps
  }
  
  // Repetitive punctuation (!!!, ???, etc.)
  const repetitivePunctuation = text.match(/[!?]{2,}/g)
  if (repetitivePunctuation && repetitivePunctuation.length > 0) {
    intensity += 0.25 // Strong emotional emphasis
  }
  
  // Length-based modulation (longer texts might have diluted emotion)
  const wordCount = lowerText.trim().split(/\s+/).length
  if (wordCount > 50) {
    intensity *= 0.9 // Slightly reduce for very long texts
  } else if (wordCount < 5) {
    intensity *= 1.1 // Slightly increase for very short, punchy texts
  }
  
  // Emoji intensity (strong visual emotional indicators)
  const emojiPattern = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu
  const emojiCount = (text.match(emojiPattern) || []).length
  if (emojiCount > 0) {
    intensity += Math.min(emojiCount * 0.2, 0.4) // Max 0.4 boost from emojis
  }
  
  // Clamp final intensity between 0.1 and 1.0
  return Math.max(0.1, Math.min(1.0, intensity))
}

/**
 * Integration service for connecting chat messages to emote system
 */
export const emotionIntegrationService = {
  detectEmotionFromText,
  analyzeMessageForActions,
  createPerformanceFromMessage,
  shouldTriggerBargeIn,
  getEmotionIntensity
}
