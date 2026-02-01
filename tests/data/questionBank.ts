/**
 * Test Data: Question Bank
 * 
 * A collection of test questions to verify agent responses
 * across different categories and complexity levels
 */

export const questionBank = {
  // Simple greetings
  greetings: [
    'Hello',
    'Hi there',
    'Good morning',
    'How are you?',
    'What\'s up?'
  ],
  
  // Information queries
  information: [
    'What is your name?',
    'What can you do?',
    'Tell me about yourself',
    'What are your capabilities?',
    'How can you help me?'
  ],
  
  // Technical questions
  technical: [
    'What is artificial intelligence?',
    'Explain machine learning',
    'What is a neural network?',
    'How does natural language processing work?',
    'What is the difference between AI and ML?'
  ],
  
  // Conversational
  conversational: [
    'Tell me a joke',
    'What\'s your favorite color?',
    'Do you like music?',
    'What do you think about technology?',
    'Can you tell me a story?'
  ],
  
  // Math and logic
  mathLogic: [
    'What is 2 plus 2?',
    'Calculate 15 times 7',
    'What is the square root of 144?',
    'Solve: x + 5 = 10',
    'What is 100 divided by 4?'
  ],
  
  // Follow-up questions (should reference previous context)
  followUp: [
    'Can you explain that more?',
    'Tell me more about that',
    'Why is that?',
    'What else?',
    'Go on'
  ],
  
  // Edge cases
  edgeCases: [
    '', // Empty input
    '   ', // Whitespace only
    'a', // Single character
    'This is a very long question that contains multiple sentences and lots of information to see how the agent handles verbose inputs. It should be able to process this without any issues and provide a coherent response that addresses the main points of the question.',
    '🤖 Can you understand emojis? 👋 🎉',
    'WHAT HAPPENS WITH ALL CAPS?',
    'what about all lowercase with no punctuation'
  ],
  
  // Interruption tests (for barge-in)
  interruption: [
    'Stop',
    'Wait',
    'Hold on',
    'Never mind',
    'Skip that'
  ]
}

/**
 * Get all questions from a specific category
 */
export function getQuestionsFromCategory(category: keyof typeof questionBank): string[] {
  return questionBank[category] || []
}

/**
 * Get all questions from all categories
 */
export function getAllQuestions(): string[] {
  return Object.values(questionBank).flat()
}

/**
 * Get a random question from a category
 */
export function getRandomQuestion(category?: keyof typeof questionBank): string {
  if (category) {
    const questions = questionBank[category]
    return questions[Math.floor(Math.random() * questions.length)]
  }
  
  const allQuestions = getAllQuestions()
  return allQuestions[Math.floor(Math.random() * allQuestions.length)]
}

/**
 * Expected response patterns for validation
 */
export const expectedPatterns = {
  greetings: /hello|hi|hey|greetings|good\s+(morning|afternoon|evening)/i,
  information: /i\s+am|my\s+name|i\s+can|help|assist/i,
  technical: /ai|artificial\s+intelligence|machine\s+learning|neural|network|algorithm/i,
  conversational: /think|believe|feel|enjoy|like/i,
  mathLogic: /\d+|equals|result|answer|solution/i
}
