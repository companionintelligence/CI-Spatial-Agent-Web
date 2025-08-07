import { describe, expect, it, vi } from 'vitest'
import {
  visemesSequence,
  visemesUpdate,
  visemesToRig,
  initializeVisemeState,
  setupVisemeStateForVRM,
  setupVisemeStateForMorphTargets
} from './visemesService'
import type { WhisperData, VisemeSequenceItem } from './visemeTypes'

describe('Viseme Integration Tests', () => {
  describe('Complete viseme workflow', () => {
    it('should handle end-to-end viseme processing for VRM avatar', () => {
      // 1. Initialize viseme state
      const state = initializeVisemeState()
      
      // 2. Setup VRM avatar
      const mockVrm = {
        expressionManager: {
          setValue: vi.fn()
        }
      }
      setupVisemeStateForVRM(state, mockVrm)
      
      // 3. Create whisper data
      const whisperData: WhisperData = {
        words: ['HELLO', 'WORLD'],
        wtimes: [0, 1000],
        wdurations: [500, 600]
      }
      
      // 4. Generate viseme sequence
      const sequence = visemesSequence(state, whisperData, 2000)
      expect(sequence.length).toBeGreaterThan(0)
      
      // 5. Add sequence to state
      state.sequence = sequence
      
      // 6. Simulate animation loop
      const timeSteps = [2100, 2200, 2300, 2400, 2500, 3000, 3100, 3200]
      
      for (const time of timeSteps) {
        // Update visemes based on current time
        visemesUpdate(state, time)
        
        // Apply to VRM rig
        visemesToRig(state, time)
      }
      
      // 7. Verify VRM expressions were set
      expect(mockVrm.expressionManager.setValue).toHaveBeenCalled()
      
      // Check that different visemes were applied over time
      const calls = mockVrm.expressionManager.setValue.mock.calls as Array<[string, number]>
      const uniqueVisemes = new Set(calls.map(call => call[0]))
      expect(uniqueVisemes.size).toBeGreaterThan(1) // Should have multiple different visemes
    })

    it('should handle end-to-end viseme processing for morph target avatar', () => {
      // 1. Initialize viseme state
      const state = initializeVisemeState()
      
      // 2. Setup morph target avatar
      const mockMorphs = [
        { morphTargetInfluences: new Array(10).fill(0) },
        { morphTargetInfluences: new Array(8).fill(0) }
      ]
      const mockDictionary = {
        viseme_aa: [0, 1],
        viseme_E: [2, 3],
        viseme_I: [4, 5],
        viseme_PP: [6, 7],
        viseme_SS: [8, 9]
      }
      
      setupVisemeStateForMorphTargets(state, mockMorphs, mockDictionary)
      
      // 3. Create simple whisper data
      const whisperData: WhisperData = {
        words: ['HELLO'],
        wtimes: [0],
        wdurations: [800]
      }
      
      // 4. Generate and apply sequence
      const sequence = visemesSequence(state, whisperData, 1000)
      state.sequence = sequence
      
      // 5. Animate over time
      const timeSteps = [1100, 1200, 1300, 1400, 1500]
      
      for (const time of timeSteps) {
        visemesUpdate(state, time)
        visemesToRig(state, time)
      }
      
      // 6. Verify morph targets were affected
      let totalInfluence = 0
      mockMorphs.forEach(morph => {
        morph.morphTargetInfluences.forEach(influence => {
          totalInfluence += Math.abs(influence)
        })
      })
      
      expect(totalInfluence).toBeGreaterThan(0) // Some morphs should have been influenced
    })

    it('should handle real-time viseme updates with damping', () => {
      const state = initializeVisemeState()
      
      // Set initial viseme values
      state.targets.viseme_aa = 1.0
      state.targets.viseme_PP = 0.8
      
      // No active sequence - should see damping
      visemesUpdate(state, 1000)
      
      expect(state.targets.viseme_aa).toBeLessThan(1.0)
      expect(state.targets.viseme_PP).toBeLessThan(0.8)
      expect(state.targets.viseme_aa).toBeGreaterThan(0)
      expect(state.targets.viseme_PP).toBeGreaterThan(0)
      
      // Continue damping - should get smaller
      const previousAA = state.targets.viseme_aa
      visemesUpdate(state, 1100)
      expect(state.targets.viseme_aa).toBeLessThan(previousAA)
    })

    it('should handle overlapping viseme sequences', () => {
      const state = initializeVisemeState()
      
      // Create overlapping sequence items with precise timing
      state.sequence = [
        {
          template: { name: 'viseme' },
          ts: [1000, 1075, 1150] as [number, number, number], // Peak at 1075
          vs: { viseme_aa: [null, 0.8, 0] }
        },
        {
          template: { name: 'viseme' },
          ts: [1050, 1125, 1200] as [number, number, number], // Peak at 1125, overlap at 1075
          vs: { viseme_E: [null, 0.7, 0] }
        }
      ]
      
      // Reset any dampening by setting targets to 0
      Object.keys(state.targets).forEach(key => {
        state.targets[key as keyof typeof state.targets] = 0
      })
      
      // At 1075, first should be at peak, second should be starting up
      visemesUpdate(state, 1075)
      
      // At least one should be active (the first one at peak)
      expect(state.targets.viseme_aa).toBeGreaterThan(0)
      
      // Test again at a different overlap point
      visemesUpdate(state, 1100) // Should have both active
      expect(state.targets.viseme_aa).toBeGreaterThan(0)
      expect(state.targets.viseme_E).toBeGreaterThan(0)
    })

    it('should demonstrate complete speech synthesis workflow', () => {
      // Simulate a typical usage pattern
      const state = initializeVisemeState()
      
      // Setup VRM avatar
      const vrmCalls: Array<{viseme: string, value: number}> = []
      const mockVrm = {
        expressionManager: {
          setValue: (viseme: string, value: number) => {
            vrmCalls.push({ viseme, value })
          }
        }
      }
      setupVisemeStateForVRM(state, mockVrm)
      
      // Simulate speech recognition result
      const speechData: WhisperData = {
        words: ['THE', 'QUICK', 'BROWN', 'FOX'],
        wtimes: [0, 500, 1000, 1500],
        wdurations: [400, 400, 400, 400]
      }
      
      // Generate viseme sequence for speech
      const startTime = 5000
      const sequence = visemesSequence(state, speechData, startTime)
      state.sequence = sequence
      
      expect(sequence.length).toBeGreaterThan(0)
      
      // Simulate 60 FPS animation loop for 2 seconds
      const frameDuration = 1000 / 60 // 16.67ms per frame
      const animationDuration = 2000 // 2 seconds
      const frameCount = Math.floor(animationDuration / frameDuration)
      
      let lastActiveVisemes = 0
      
      for (let frame = 0; frame < frameCount; frame++) {
        const currentTime = startTime + (frame * frameDuration)
        
        // Update visemes
        visemesUpdate(state, currentTime)
        
        // Apply to avatar
        visemesToRig(state, currentTime, 1.0) // Normal amplification
        
        // Count active visemes
        const activeVisemes = Object.values(state.targets).reduce((count, value) => {
          return count + (value > 0.01 ? 1 : 0)
        }, 0)
        
        // During speech, should have active visemes
        if (currentTime >= startTime + 150 && currentTime <= startTime + 1900) {
          if (activeVisemes > lastActiveVisemes) {
            lastActiveVisemes = activeVisemes
          }
        }
      }
      
      // Should have had active visemes during speech
      expect(lastActiveVisemes).toBeGreaterThan(0)
      
      // Should have made multiple VRM calls
      expect(vrmCalls.length).toBeGreaterThan(10)
      
      // Should have used multiple different visemes
      const uniqueVisemes = new Set(vrmCalls.map(call => call.viseme))
      expect(uniqueVisemes.size).toBeGreaterThan(1)
      
      // Values should be reasonable (0-1 range)
      vrmCalls.forEach(call => {
        expect(call.value).toBeGreaterThanOrEqual(0)
        expect(call.value).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Performance and edge cases', () => {
    it('should handle empty sequences gracefully', () => {
      const state = initializeVisemeState()
      state.sequence = []
      
      expect(() => {
        visemesUpdate(state, 1000)
        visemesToRig(state, 1000)
      }).not.toThrow()
    })

    it('should handle very long sequences efficiently', () => {
      const state = initializeVisemeState()
      
      // Create a long sequence (100 items)
      const longSequence: VisemeSequenceItem[] = []
      for (let i = 0; i < 100; i++) {
        longSequence.push({
          template: { name: 'viseme' },
          ts: [i * 100, i * 100 + 50, i * 100 + 100] as [number, number, number],
          vs: { [`viseme_${['aa', 'E', 'I', 'O', 'U'][i % 5]}`]: [null, 0.5, 0] }
        })
      }
      state.sequence = longSequence
      
      const startTime = performance.now()
      
      // Process multiple times
      for (let i = 0; i < 100; i++) {
        visemesUpdate(state, i * 100 + 25) // Peak time for each sequence
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should process 10,000 sequence evaluations in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100)
    })

    it('should handle malformed sequence data', () => {
      const state = initializeVisemeState()
      
      // Add malformed sequence items
      state.sequence = [
        {
          template: { name: 'viseme' },
          ts: [100, 150, 200] as [number, number, number],
          vs: {} // Empty vs
        },
        {
          template: { name: 'viseme' },
          ts: [300, 375, 450] as [number, number, number], // Peak at 375
          vs: { viseme_aa: [null, 0.8, 0] } // Valid item
        }
      ]
      
      // Reset targets to ensure clean test
      Object.keys(state.targets).forEach(key => {
        state.targets[key as keyof typeof state.targets] = 0
      })
      
      expect(() => {
        visemesUpdate(state, 175) // Should handle empty vs
        visemesUpdate(state, 375) // Should process valid item at peak time
      }).not.toThrow()
      
      expect(state.targets.viseme_aa).toBeGreaterThan(0)
    })
  })
})
