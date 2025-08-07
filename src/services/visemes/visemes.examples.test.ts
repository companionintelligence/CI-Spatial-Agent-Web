import { describe, expect, it, vi } from 'vitest'

import { lipsyncPreProcessText, lipsyncWordsToVisemes } from './lipsyncQueue'
import {
  initializeVisemeState,
  setupVisemeStateForMorphTargets,
  setupVisemeStateForVRM,
  visemesSequence,
  visemesToRig,
  visemesUpdate
} from './visemesService'
import type { WhisperData } from './visemeTypes'

describe('Viseme Usage Examples', () => {
  describe('Real-world scenarios', () => {
    it('should demonstrate typical avatar speech workflow', () => {
      // This test shows how a developer would integrate visemes into their avatar system

      // 1. Initialize the viseme system
      const visemeState = initializeVisemeState()

      // 2. Setup for a VRM avatar (common 3D avatar format)
      const mockVRM = {
        expressionManager: {
          setValue: vi.fn()
        }
      }
      setupVisemeStateForVRM(visemeState, mockVRM)

      // 3. Process speech recognition results (from Whisper or similar)
      const speechRecognitionResult: WhisperData = {
        words: ['Hello', 'there', 'how', 'are', 'you', 'today'],
        wtimes: [0, 600, 1200, 1600, 2000, 2400],
        wdurations: [500, 400, 300, 300, 400, 500]
      }

      // 4. Generate viseme animation sequence
      const animationStartTime = performance.now()
      const visemeSequence = visemesSequence(visemeState, speechRecognitionResult, animationStartTime)
      visemeState.sequence = visemeSequence

      expect(visemeSequence.length).toBeGreaterThan(0)

      // 5. Simulate game/animation loop (typically 60 FPS)
      const frameDuration = 1000 / 60 // 16.67ms per frame
      const totalSpeechDuration = 3000 // 3 seconds of speech

      let frameCount = 0
      let totalVrmCalls = 0

      for (let elapsed = 0; elapsed < totalSpeechDuration; elapsed += frameDuration) {
        const currentTime = animationStartTime + elapsed

        // Update viseme targets based on current time
        visemesUpdate(visemeState, currentTime)

        // Apply viseme values to the VRM avatar
        visemesToRig(visemeState, currentTime, 1.0) // Full strength

        frameCount++
      }

      totalVrmCalls = mockVRM.expressionManager.setValue.mock.calls.length

      // Verify reasonable animation behavior
      expect(frameCount).toBeGreaterThan(150) // ~3 seconds at 60fps
      expect(totalVrmCalls).toBeGreaterThan(0) // VRM expressions were updated

      // Verify different visemes were used
      const calls = mockVRM.expressionManager.setValue.mock.calls as Array<[string, number]>
      const usedVisemes = new Set(calls.map((call) => call[0]))
      expect(usedVisemes.size).toBeGreaterThan(1)
    })

    it('should handle real-time speech with incremental updates', () => {
      // Simulates real-time speech where words come in progressively

      const visemeState = initializeVisemeState()
      const mockVRM = { expressionManager: { setValue: vi.fn() } }
      setupVisemeStateForVRM(visemeState, mockVRM)

      const baseTime = Date.now()

      // First word arrives
      let speechData: WhisperData = {
        words: ['Hello'],
        wtimes: [0],
        wdurations: [500]
      }

      let sequence = visemesSequence(visemeState, speechData, baseTime)
      visemeState.sequence = sequence

      // Animate first word
      visemesUpdate(visemeState, baseTime + 250)
      visemesToRig(visemeState, baseTime + 250)

      const firstWordCalls = mockVRM.expressionManager.setValue.mock.calls.length

      // Second word arrives - extend the sequence
      speechData = {
        words: ['Hello', 'World'],
        wtimes: [0, 700],
        wdurations: [500, 400]
      }

      sequence = visemesSequence(visemeState, speechData, baseTime)
      visemeState.sequence = [...visemeState.sequence, ...sequence.slice(1)] // Add new visemes

      // Continue animation with both words
      visemesUpdate(visemeState, baseTime + 900)
      visemesToRig(visemeState, baseTime + 900)

      const totalCalls = mockVRM.expressionManager.setValue.mock.calls.length

      expect(firstWordCalls).toBeGreaterThan(0)
      expect(totalCalls).toBeGreaterThan(firstWordCalls)
    })

    it('should demonstrate emotion amplification during speech', () => {
      // Shows how to modify viseme intensity based on emotion

      const visemeState = initializeVisemeState()
      const mockVRM = { expressionManager: { setValue: vi.fn() } }
      setupVisemeStateForVRM(visemeState, mockVRM)

      const speechData: WhisperData = {
        words: ['I', 'am', 'excited'],
        wtimes: [0, 300, 600],
        wdurations: [250, 200, 400]
      }

      const sequence = visemesSequence(visemeState, speechData, 1000)
      visemeState.sequence = sequence

      // Normal speech (amplify = 1.0)
      visemesUpdate(visemeState, 1150)
      visemesToRig(visemeState, 1150, 1.0)

      const normalValues = (mockVRM.expressionManager.setValue.mock.calls as Array<[string, number]>)
        .map((call) => call[1])
        .filter((value: number) => value > 0)

      // Reset mocks
      mockVRM.expressionManager.setValue.mockClear()

      // Excited speech (amplify = 1.5)
      visemesUpdate(visemeState, 1150)
      visemesToRig(visemeState, 1150, 1.5) // 150% intensity

      const excitedValues = (mockVRM.expressionManager.setValue.mock.calls as Array<[string, number]>)
        .map((call) => call[1])
        .filter((value: number) => value > 0)

      // Excited speech should have higher values (but capped at 1.0)
      if (normalValues.length > 0 && excitedValues.length > 0) {
        const normalAvg = normalValues.reduce((a: number, b: number) => a + b, 0) / normalValues.length
        const excitedAvg = excitedValues.reduce((a: number, b: number) => a + b, 0) / excitedValues.length

        expect(excitedAvg).toBeGreaterThanOrEqual(normalAvg)
      }
    })

    it('should handle morphed-based avatars (non-VRM)', () => {
      // For avatars using morph targets instead of VRM expressions

      const visemeState = initializeVisemeState()

      // Setup morph target meshes (typical in Three.js)
      const headMesh = {
        morphTargetInfluences: new Array(20).fill(0) // 20 morph targets
      }
      const faceMesh = {
        morphTargetInfluences: new Array(15).fill(0) // 15 morph targets
      }

      // Dictionary mapping visemes to morph target indices
      const morphDictionary = {
        viseme_aa: [0, 8], // Maps to indices 0 in head, 8 in face
        viseme_E: [1, 9],
        viseme_I: [2, 10],
        viseme_O: [3, 11],
        viseme_U: [4, 12],
        viseme_PP: [5, 13],
        viseme_FF: [6, 14],
        viseme_SS: [7] // Only in head mesh
      }

      setupVisemeStateForMorphTargets(visemeState, [headMesh, faceMesh], morphDictionary)

      // Process speech
      const speechData: WhisperData = {
        words: ['SPEECH'],
        wtimes: [0],
        wdurations: [600]
      }

      const sequence = visemesSequence(visemeState, speechData, 2000)
      visemeState.sequence = sequence

      // Animate
      visemesUpdate(visemeState, 2300)
      visemesToRig(visemeState, 2300)

      // Check that morph targets were influenced
      const headInfluences = headMesh.morphTargetInfluences.filter((v) => v > 0)
      const faceInfluences = faceMesh.morphTargetInfluences.filter((v) => v > 0)

      expect(headInfluences.length).toBeGreaterThan(0)
      expect(faceInfluences.length).toBeGreaterThan(0)

      // Values should be in reasonable range
      headMesh.morphTargetInfluences.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Text processing examples', () => {
    it('should handle various text preprocessing scenarios', () => {
      // Test text cleanup
      expect(lipsyncPreProcessText('Hello, World! 123')).toBe('HELLO WORLD ')
      expect(lipsyncPreProcessText('user@email.com (2024)')).toBe('USEREMAILCOM ')
      expect(lipsyncPreProcessText('')).toBe('')

      // Test viseme generation from processed text
      const result1 = lipsyncWordsToVisemes('HELLO')
      expect(result1).not.toBeNull()
      expect(result1!.visemes.length).toBeGreaterThan(0)

      const result2 = lipsyncWordsToVisemes('WORLD')
      expect(result2).not.toBeNull()
      expect(result2!.visemes.length).toBeGreaterThan(0)

      // Different words should produce different viseme patterns
      expect(result1!.visemes).not.toEqual(result2!.visemes)
    })

    it('should demonstrate phoneme-to-viseme mapping consistency', () => {
      // Test that similar sounds produce similar visemes
      const wordsWithSimilarSounds = [
        ['BAT', 'PAT'], // Both should have PP viseme
        ['SIT', 'SET'], // Both should have SS and DD
        ['MOON', 'ROOM'] // Both should have nn and similar vowels
      ]

      wordsWithSimilarSounds.forEach(([word1, word2]) => {
        const result1 = lipsyncWordsToVisemes(word1)
        const result2 = lipsyncWordsToVisemes(word2)

        expect(result1).not.toBeNull()
        expect(result2).not.toBeNull()

        // Should have some visemes in common
        const visemes1 = new Set(result1!.visemes)
        const visemes2 = new Set(result2!.visemes)
        const intersection = new Set([...visemes1].filter((x) => visemes2.has(x)))

        expect(intersection.size).toBeGreaterThan(0)
      })
    })
  })

  describe('Performance benchmarks', () => {
    it('should handle large speech sequences efficiently', () => {
      // Test with a long speech sequence
      const longText = Array(50).fill('The quick brown fox jumps over the lazy dog').join(' ')
      const words = longText.split(' ')

      const speechData: WhisperData = {
        words: words,
        wtimes: words.map((_, i) => i * 200),
        wdurations: words.map(() => 180)
      }

      const visemeState = initializeVisemeState()

      const startTime = performance.now()
      const sequence = visemesSequence(visemeState, speechData, 0)
      const sequenceTime = performance.now() - startTime

      visemeState.sequence = sequence

      const updateStartTime = performance.now()
      // Simulate 100 update calls
      for (let i = 0; i < 100; i++) {
        visemesUpdate(visemeState, i * 50)
      }
      const updateTime = performance.now() - updateStartTime

      // Should complete in reasonable time
      expect(sequenceTime).toBeLessThan(100) // Less than 100ms for sequence generation
      expect(updateTime).toBeLessThan(50) // Less than 50ms for 100 updates
      expect(sequence.length).toBeGreaterThan(200) // Should generate many visemes
    })

    it('should maintain consistent frame rates during animation', () => {
      const visemeState = initializeVisemeState()
      const mockVRM = { expressionManager: { setValue: vi.fn() } }
      setupVisemeStateForVRM(visemeState, mockVRM)

      // Create moderate speech sequence
      const speechData: WhisperData = {
        words: ['This', 'is', 'a', 'test', 'of', 'consistent', 'performance'],
        wtimes: [0, 300, 500, 700, 1000, 1200, 1600],
        wdurations: [250, 150, 100, 200, 150, 300, 400]
      }

      const sequence = visemesSequence(visemeState, speechData, 5000)
      visemeState.sequence = sequence

      // Measure frame processing times
      const frameTimes: number[] = []

      for (let frame = 0; frame < 180; frame++) {
        // 3 seconds at 60fps
        const frameStart = performance.now()

        const currentTime = 5000 + frame * 16.67
        visemesUpdate(visemeState, currentTime)
        visemesToRig(visemeState, currentTime)

        const frameEnd = performance.now()
        frameTimes.push(frameEnd - frameStart)
      }

      // Calculate statistics
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
      const maxFrameTime = Math.max(...frameTimes)

      // Should maintain good performance
      expect(avgFrameTime).toBeLessThan(2) // Average < 2ms per frame
      expect(maxFrameTime).toBeLessThan(10) // No frame should take > 10ms

      // All frames should complete
      expect(frameTimes.length).toBe(180)
    })
  })
})
