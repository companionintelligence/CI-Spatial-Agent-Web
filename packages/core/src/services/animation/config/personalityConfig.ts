import type { PersonalityConfiguration } from '../animationTypes'

export const personalityConfigurations: Record<string, PersonalityConfiguration> = {
  friendly: {
    defaultCycleInterval: 8000,
    blendTime: 800,
    randomizeOrder: true,
    categories: ['idle', 'gesture', 'expression', 'communication'],
    weights: {
      idle: 0.3,
      gesture: 0.3,
      movement: 0.1,
      expression: 0.1,
      action: 0.0,
      communication: 0.2
    }
  },
  energetic: {
    defaultCycleInterval: 5000,
    blendTime: 600,
    randomizeOrder: true,
    categories: ['idle', 'gesture', 'movement', 'action'],
    weights: {
      idle: 0.2,
      gesture: 0.2,
      movement: 0.3,
      expression: 0.1,
      action: 0.1,
      communication: 0.1
    }
  },
  calm: {
    defaultCycleInterval: 12000,
    blendTime: 1200,
    randomizeOrder: false,
    categories: ['idle', 'expression'],
    weights: {
      idle: 0.7,
      gesture: 0.2,
      movement: 0.0,
      expression: 0.1,
      action: 0.0,
      communication: 0.0
    }
  },
  professional: {
    defaultCycleInterval: 10000,
    blendTime: 1000,
    randomizeOrder: false,
    categories: ['idle', 'gesture', 'communication'],
    weights: {
      idle: 0.5,
      gesture: 0.2,
      movement: 0.1,
      expression: 0.0,
      action: 0.0,
      communication: 0.2
    }
  },
  playful: {
    defaultCycleInterval: 6000,
    blendTime: 700,
    randomizeOrder: true,
    categories: ['idle', 'gesture', 'movement', 'action', 'expression'],
    weights: {
      idle: 0.2,
      gesture: 0.2,
      movement: 0.3,
      expression: 0.1,
      action: 0.1,
      communication: 0.1
    }
  },
  thoughtful: {
    defaultCycleInterval: 15000,
    blendTime: 1500,
    randomizeOrder: false,
    categories: ['idle', 'expression'],
    weights: {
      idle: 0.8,
      gesture: 0.1,
      movement: 0.0,
      expression: 0.1,
      action: 0.0,
      communication: 0.0
    }
  }
}

export const getPersonalityConfiguration = (personality: string): PersonalityConfiguration => {
  return personalityConfigurations[personality] || personalityConfigurations.friendly
}

export const getAvailablePersonalities = (): string[] => {
  return Object.keys(personalityConfigurations)
}
