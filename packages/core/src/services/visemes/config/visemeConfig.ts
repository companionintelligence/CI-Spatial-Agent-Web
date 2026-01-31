
/**
 * Centralized configuration for viseme timing and behavior
 * Modify these values to adjust how visemes look and feel
 */
export interface VisemeConfig {
  // Timing parameters
  timing: {
    fudgeFactor: number // Base time offset added to all visemes (ms)
    attackTime: number // How long visemes take to fade in (ms)
    releaseTime: number // How long visemes take to fade out (ms)
    minDuration: number // Minimum viseme duration to process (ms, 0 = no filter)
  }

  // Intensity parameters
  intensity: {
    baseMultiplier: number // Base intensity boost for all visemes
    minThreshold: number // Minimum viseme intensity for visibility
    dampeningFactor: number // How quickly visemes fade over time (0.0-1.0)
  }

  // Animation curves
  curves: {
    attackCurve: 'linear' | 'quadratic' | 'cubic' | 'exponential'
    releaseCurve: 'linear' | 'quadratic' | 'cubic' | 'exponential'
  }

  // Lipsync generation
  lipsync: {
    baseLevel: number // Base viseme intensity (0.0-1.0)
    levelRange: number // Additional intensity range (0.0-1.0)
    specialVisemes: {
      // Special intensity for specific visemes
      PP: number
      FF: number
    }
  }
}

/**
 * Default configuration - balanced for natural movement
 */
export const defaultVisemeConfig: VisemeConfig = {
  timing: {
    fudgeFactor: 0, // 150ms offset for audio sync
    attackTime: 120, // 120ms attack for smooth onset
    releaseTime: 150, // 150ms release for smooth decay
    minDuration: 0 // No minimum duration filter
  },

  intensity: {
    baseMultiplier: 1.2, // 20% intensity boost
    minThreshold: 0, // Minimum 15% intensity
    dampeningFactor: 0.95 // 95% persistence (5% decay per frame)
  },

  curves: {
    attackCurve: 'quadratic', // Smooth quadratic attack
    releaseCurve: 'quadratic' // Smooth quadratic release
  },

  lipsync: {
    baseLevel: 0.8, // 80% base intensity
    levelRange: 0.6, // Additional 60% range
    specialVisemes: {
      PP: 0.9, // 90% for PP visemes
      FF: 0.9 // 90% for FF visemes
    }
  }
}

/**
 * Preset configurations for different styles
 */
export const visemePresets = {
  natural: defaultVisemeConfig,

  smooth: {
    ...defaultVisemeConfig,
    timing: {
      ...defaultVisemeConfig.timing,
      attackTime: 150,
      releaseTime: 200
    },
    intensity: {
      ...defaultVisemeConfig.intensity,
      dampeningFactor: 0.97
    }
  },

  responsive: {
    ...defaultVisemeConfig,
    timing: {
      ...defaultVisemeConfig.timing,
      attackTime: 60,
      releaseTime: 80
    },
    intensity: {
      ...defaultVisemeConfig.intensity,
      dampeningFactor: 0.9
    }
  },

  dramatic: {
    ...defaultVisemeConfig,
    intensity: {
      ...defaultVisemeConfig.intensity,
      baseMultiplier: 1.5,
      minThreshold: 0.25
    },
    lipsync: {
      ...defaultVisemeConfig.lipsync,
      baseLevel: 0.9,
      levelRange: 0.8
    }
  }
}

/**
 * Helper function to apply curve function
 */
export function applyCurve(value: number, curveType: string): number {
  switch (curveType) {
    case 'linear':
      return value
    case 'quadratic':
      return Math.pow(value, 2)
    case 'cubic':
      return Math.pow(value, 3)
    case 'exponential':
      return 1 - Math.exp(-value * 3)
    default:
      return Math.pow(value, 2) // Default to quadratic
  }
}
