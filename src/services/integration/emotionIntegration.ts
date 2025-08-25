import type { ConversationMessage } from '../conversation/conversationType'
import type { EmotionType, PerformanceData } from '../emote/emoteTypes'

/**
 * Simple emotion detection based on keywords and patterns in text
 * In a production system, this could be replaced with a more sophisticated
 * emotion analysis service or AI model
 */
export const detectEmotionFromText = (text: string): EmotionType => {
  const lowerText = text.toLowerCase()

  // Happy indicators
  if (
    lowerText.includes('happy') ||
    lowerText.includes('joy') ||
    lowerText.includes('excited') ||
    lowerText.includes('great') ||
    lowerText.includes('wonderful') ||
    lowerText.includes('amazing') ||
    lowerText.includes('fantastic') ||
    lowerText.includes('excellent') ||
    lowerText.includes('love') ||
    lowerText.includes('celebrate') ||
    lowerText.includes('😊') ||
    lowerText.includes('😄') ||
    lowerText.includes('🎉') ||
    lowerText.includes('👍')
  ) {
    return 'happy'
  }

  // Sad indicators
  if (
    lowerText.includes('sad') ||
    lowerText.includes('sorry') ||
    lowerText.includes('disappointed') ||
    lowerText.includes('unfortunate') ||
    lowerText.includes('regret') ||
    lowerText.includes('cry') ||
    lowerText.includes('tears') ||
    lowerText.includes('hurt') ||
    lowerText.includes('😢') ||
    lowerText.includes('😭') ||
    lowerText.includes('💔')
  ) {
    return 'sad'
  }

  // Angry indicators
  if (
    lowerText.includes('angry') ||
    lowerText.includes('mad') ||
    lowerText.includes('furious') ||
    lowerText.includes('annoying') ||
    lowerText.includes('irritated') ||
    lowerText.includes('frustrated') ||
    lowerText.includes('outrageous') ||
    lowerText.includes('ridiculous') ||
    lowerText.includes('😠') ||
    lowerText.includes('😡') ||
    lowerText.includes('🤬')
  ) {
    return 'angry'
  }

  // Fear indicators
  if (
    lowerText.includes('scared') ||
    lowerText.includes('afraid') ||
    lowerText.includes('frightened') ||
    lowerText.includes('terrified') ||
    lowerText.includes('nervous') ||
    lowerText.includes('worried') ||
    lowerText.includes('anxious') ||
    lowerText.includes('panic') ||
    lowerText.includes('😨') ||
    lowerText.includes('😰') ||
    lowerText.includes('😱')
  ) {
    return 'fear'
  }

  // Disgust indicators
  if (
    lowerText.includes('disgusting') ||
    lowerText.includes('gross') ||
    lowerText.includes('yuck') ||
    lowerText.includes('revolting') ||
    lowerText.includes('nasty') ||
    lowerText.includes('awful') ||
    lowerText.includes('terrible') ||
    lowerText.includes('🤢') ||
    lowerText.includes('🤮') ||
    lowerText.includes('😷')
  ) {
    return 'disgust'
  }

  // Love/affection indicators
  if (
    lowerText.includes('love you') ||
    lowerText.includes('adore') ||
    lowerText.includes('cherish') ||
    lowerText.includes('romantic') ||
    lowerText.includes('sweetheart') ||
    lowerText.includes('darling') ||
    lowerText.includes('beloved') ||
    lowerText.includes('💕') ||
    lowerText.includes('💖') ||
    lowerText.includes('💗') ||
    lowerText.includes('❤️') ||
    lowerText.includes('😍')
  ) {
    return 'love'
  }

  // Default to neutral
  return 'neutral'
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
 * Get emotion intensity based on message content
 * Returns a value between 0 and 1
 */
export const getEmotionIntensity = (text: string): number => {
  const lowerText = text.toLowerCase()

  // High intensity indicators
  const highIntensityWords = [
    'extremely',
    'incredibly',
    'absolutely',
    'completely',
    'totally',
    'amazing',
    'fantastic',
    'terrible',
    'awful',
    'furious',
    'thrilled'
  ]

  // Medium intensity indicators
  const mediumIntensityWords = ['very', 'really', 'quite', 'pretty', 'rather', 'good', 'bad', 'nice', 'great', 'okay']

  // Count intensity markers
  const highCount = highIntensityWords.reduce((count, word) => (lowerText.includes(word) ? count + 1 : count), 0)

  const mediumCount = mediumIntensityWords.reduce((count, word) => (lowerText.includes(word) ? count + 1 : count), 0)

  if (highCount > 0) return 0.8 + Math.min(highCount, 3) * 0.067 // 0.8 to 1.0
  if (mediumCount > 0) return 0.5 + Math.min(mediumCount, 3) * 0.1 // 0.5 to 0.8

  return 0.3 // Default low intensity
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
