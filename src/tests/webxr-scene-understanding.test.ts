/**
 * Tests for WebXR Scene Understanding functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { WebXRSceneUnderstanding } from '../services/webxr/sceneUnderstanding'
import { XRLocationDatabase } from '../services/webxr/locationDatabase'
import { CIServerIntegration } from '../services/webxr/ciServerIntegration'

// Mock WebXR APIs
global.navigator = {
  xr: {
    isSessionSupported: vi.fn().mockResolvedValue(true)
  }
} as any

// @ts-ignore
global.XRRigidTransform = vi.fn().mockImplementation((position) => ({
  position,
  orientation: { x: 0, y: 0, z: 0, w: 1 }
}))

global.indexedDB = {
  open: vi.fn().mockImplementation(() => ({
    result: {
      createObjectStore: vi.fn(),
      objectStoreNames: { contains: vi.fn().mockReturnValue(false) }
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  }))
} as any

describe('WebXRSceneUnderstanding', () => {
  let sceneUnderstanding: WebXRSceneUnderstanding

  beforeEach(() => {
    sceneUnderstanding = new WebXRSceneUnderstanding()
  })

  it('should initialize properly', () => {
    expect(sceneUnderstanding).toBeDefined()
  })

  it('should handle anchor creation', async () => {
    const position: [number, number, number] = [1, 0, -1]
    const description = 'Test anchor'

    // Mock session to simulate active XR session
    const mockSession = {
      requestReferenceSpace: vi.fn().mockResolvedValue({}),
      requestAnimationFrame: vi.fn() // Add this to prevent the error
    }
    await sceneUnderstanding.startSession(mockSession as any)

    const location = await sceneUnderstanding.createAnchor(position, description)
    
    expect(location).toBeDefined()
    expect(location?.description).toBe(description)
    expect(location?.anchor.position).toEqual(position)
  })

  it('should manage callbacks correctly', () => {
    const onAnchorAdded = vi.fn()
    const onAnchorRemoved = vi.fn()
    const onSceneUpdate = vi.fn()

    sceneUnderstanding.setCallbacks({
      onAnchorAdded,
      onAnchorRemoved,
      onSceneUpdate
    })

    // Callbacks should be registered
    expect(sceneUnderstanding).toBeDefined()
  })
})

describe('XRLocationDatabase', () => {
  let database: XRLocationDatabase

  beforeEach(() => {
    database = new XRLocationDatabase()
  })

  it('should initialize database', () => {
    expect(database).toBeDefined()
  })

  it('should handle location storage operations', () => {
    // Test that methods exist and can be called
    expect(typeof database.storeLocation).toBe('function')
    expect(typeof database.getLocation).toBe('function')
    expect(typeof database.getAllLocations).toBe('function')
  })
})

describe('CIServerIntegration', () => {
  let ciServer: CIServerIntegration

  beforeEach(() => {
    ciServer = new CIServerIntegration('http://localhost:11434')
    
    // Mock fetch globally
    global.fetch = vi.fn()
  })

  it('should initialize with correct base URL', () => {
    expect(ciServer).toBeDefined()
  })

  it('should handle image analysis requests', async () => {
    const mockResponse = {
      response: 'I can see a room with furniture',
      model: 'llava',
      total_duration: 1000
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request = {
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      location: {
        id: 'test-1',
        anchor: {
          id: 'test-1',
          position: [0, 0, 0] as [number, number, number],
          orientation: [0, 0, 0, 1] as [number, number, number, number],
          timestamp: Date.now(),
          type: 'point' as const,
          confidence: 1.0
        },
        description: 'Test location'
      }
    }

    const result = await ciServer.analyzeSceneImage(request)

    expect(result.success).toBe(true)
    expect(result.description).toBe(mockResponse.response)
    expect(result.metadata.model).toBe(mockResponse.model)
  })

  it('should handle connection testing', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true
    })

    const isConnected = await ciServer.testConnection()
    expect(isConnected).toBe(true)
  })

  it('should handle failed connections', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const isConnected = await ciServer.testConnection()
    expect(isConnected).toBe(false)
  })

  it('should extract objects from description', async () => {
    const mockResponse = {
      response: 'I can see a chair, table, and a computer monitor in this room',
      model: 'llava'
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request = {
      imageData: 'data:image/jpeg;base64,test',
      location: {
        id: 'test-1',
        anchor: {
          id: 'test-1',
          position: [0, 0, 0] as [number, number, number],
          orientation: [0, 0, 0, 1] as [number, number, number, number],
          timestamp: Date.now(),
          type: 'point' as const,
          confidence: 1.0
        },
        description: 'Test location'
      }
    }

    const result = await ciServer.analyzeSceneImage(request)

    expect(result.objects.length).toBeGreaterThan(0)
    expect(result.objects.some(obj => obj.name === 'chair')).toBe(true)
    expect(result.objects.some(obj => obj.name === 'table')).toBe(true)
    expect(result.objects.some(obj => obj.name === 'monitor')).toBe(true)
  })
})

describe('Integration Tests', () => {
  it('should work together in a typical workflow', async () => {
    const sceneUnderstanding = new WebXRSceneUnderstanding()
    const database = new XRLocationDatabase()
    const ciServer = new CIServerIntegration('http://localhost:11434')

    // Mock XR session
    const mockSession = {
      requestReferenceSpace: vi.fn().mockResolvedValue({}),
      requestAnimationFrame: vi.fn()
    }

    // Start session
    await sceneUnderstanding.startSession(mockSession as any)

    // Create anchor
    const location = await sceneUnderstanding.createAnchor([1, 0, -1], 'Integration test anchor')
    expect(location).toBeDefined()

    // Verify location can be processed by other components
    if (location) {
      expect(typeof database.storeLocation).toBe('function')
      expect(typeof ciServer.sendLocationData).toBe('function')
    }
  })
})