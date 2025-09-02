/**
 * WebXR Scene Understanding Hook
 * Integrates scene understanding, database storage, and CI server communication
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { XRStore } from '@react-three/xr'

import { WebXRSceneUnderstanding, type SceneLocation } from './sceneUnderstanding'
import { XRLocationDatabase } from './locationDatabase'
import { CIServerIntegration, type ImageAnalysisResponse } from './ciServerIntegration'

export interface UseWebXRSceneUnderstandingOptions {
  enabled?: boolean
  autoAnalyzeImages?: boolean
  autoSendToServer?: boolean
  ciServerUrl?: string
  ciServerApiKey?: string
}

export interface WebXRSceneUnderstandingState {
  isInitialized: boolean
  isSessionActive: boolean
  locations: SceneLocation[]
  boundedGeometry: { boundsGeometry: DOMPointReadOnly[] } | null
  lastAnalysis: ImageAnalysisResponse | null
  error: string | null
}

export const useWebXRSceneUnderstanding = (
  xrStore: XRStore | null,
  options: UseWebXRSceneUnderstandingOptions = {}
) => {
  const {
    enabled = true,
    autoAnalyzeImages = false,
    autoSendToServer = false,
    ciServerUrl,
    ciServerApiKey
  } = options

  const [state, setState] = useState<WebXRSceneUnderstandingState>({
    isInitialized: false,
    isSessionActive: false,
    locations: [],
    boundedGeometry: null,
    lastAnalysis: null,
    error: null
  })

  const sceneUnderstanding = useRef<WebXRSceneUnderstanding | null>(null)
  const database = useRef<XRLocationDatabase | null>(null)
  const ciServer = useRef<CIServerIntegration | null>(null)

  // Initialize services
  useEffect(() => {
    if (!enabled) return

    sceneUnderstanding.current = new WebXRSceneUnderstanding()
    database.current = new XRLocationDatabase()
    ciServer.current = new CIServerIntegration(ciServerUrl, ciServerApiKey)

    // Set up scene understanding callbacks
    sceneUnderstanding.current.setCallbacks({
      onAnchorAdded: async (location: SceneLocation) => {
        console.log('New anchor detected:', location)
        
        // Store in database
        if (database.current) {
          try {
            await database.current.storeLocation(location)
          } catch (error) {
            console.error('Failed to store location:', error)
          }
        }

        // Analyze image if enabled and image data is available
        if (autoAnalyzeImages && location.imageData && ciServer.current) {
          try {
            const analysis = await ciServer.current.analyzeSceneImage({
              imageData: location.imageData,
              location
            })
            
            setState(prev => ({ ...prev, lastAnalysis: analysis }))

            // Update location with analysis results
            const updatedLocation = {
              ...location,
              metadata: {
                ...location.metadata,
                analysis
              }
            }

            if (database.current) {
              await database.current.storeLocation(updatedLocation)
            }

            // Send to server if enabled
            if (autoSendToServer) {
              await ciServer.current.sendLocationData(updatedLocation)
            }
          } catch (error) {
            console.error('Failed to analyze scene image:', error)
            setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Analysis failed' }))
          }
        }

        // Update locations state
        setState(prev => ({
          ...prev,
          locations: [...prev.locations, location],
          error: null
        }))
      },

      onAnchorRemoved: (id: string) => {
        console.log('Anchor removed:', id)
        
        setState(prev => ({
          ...prev,
          locations: prev.locations.filter(loc => loc.id !== id)
        }))

        // Remove from database
        if (database.current) {
          database.current.deleteLocation(id).catch(console.error)
        }
      },

      onSceneUpdate: (locations: SceneLocation[]) => {
        setState(prev => ({
          ...prev,
          locations,
          boundedGeometry: sceneUnderstanding.current?.getBoundedGeometry() || null
        }))
      }
    })

    setState(prev => ({ ...prev, isInitialized: true, error: null }))

    return () => {
      if (sceneUnderstanding.current) {
        sceneUnderstanding.current.endSession()
      }
    }
  }, [enabled, autoAnalyzeImages, autoSendToServer, ciServerUrl, ciServerApiKey])

  // Handle XR session changes
  useEffect(() => {
    if (!enabled || !sceneUnderstanding.current || !xrStore) return

    const handleSessionStart = (session: XRSession) => {
      console.log('XR Session started, initializing scene understanding')
      sceneUnderstanding.current!.startSession(session)
      setState(prev => ({ ...prev, isSessionActive: true }))
    }

    const handleSessionEnd = () => {
      console.log('XR Session ended')
      sceneUnderstanding.current!.endSession()
      setState(prev => ({ 
        ...prev, 
        isSessionActive: false,
        locations: [],
        boundedGeometry: null
      }))
    }

    // Listen for session changes
    const unsubscribe = xrStore.subscribe((state) => {
      if (state.session && !state.session.ended) {
        handleSessionStart(state.session)
      } else {
        handleSessionEnd()
      }
    })

    return unsubscribe
  }, [enabled, xrStore])

  // Load existing locations from database on initialization
  useEffect(() => {
    if (!database.current) return

    const loadStoredLocations = async () => {
      try {
        const storedLocations = await database.current!.getAllLocations()
        setState(prev => ({ ...prev, locations: storedLocations }))
      } catch (error) {
        console.error('Failed to load stored locations:', error)
        setState(prev => ({ ...prev, error: 'Failed to load stored locations' }))
      }
    }

    loadStoredLocations()
  }, [state.isInitialized])

  const createAnchor = useCallback(async (
    position: [number, number, number], 
    description?: string
  ): Promise<SceneLocation | null> => {
    if (!sceneUnderstanding.current) {
      setState(prev => ({ ...prev, error: 'Scene understanding not initialized' }))
      return null
    }

    try {
      const location = await sceneUnderstanding.current.createAnchor(position, description)
      return location
    } catch (error) {
      console.error('Failed to create anchor:', error)
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Failed to create anchor' }))
      return null
    }
  }, [])

  const analyzeLocation = useCallback(async (location: SceneLocation): Promise<ImageAnalysisResponse | null> => {
    if (!ciServer.current || !location.imageData) {
      setState(prev => ({ ...prev, error: 'CI server not available or no image data' }))
      return null
    }

    try {
      const analysis = await ciServer.current.analyzeSceneImage({
        imageData: location.imageData,
        location
      })
      
      setState(prev => ({ ...prev, lastAnalysis: analysis, error: null }))
      return analysis
    } catch (error) {
      console.error('Failed to analyze location:', error)
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Analysis failed' }))
      return null
    }
  }, [])

  const sendLocationToServer = useCallback(async (location: SceneLocation): Promise<boolean> => {
    if (!ciServer.current) {
      setState(prev => ({ ...prev, error: 'CI server not available' }))
      return false
    }

    try {
      const success = await ciServer.current.sendLocationData(location)
      if (!success) {
        setState(prev => ({ ...prev, error: 'Failed to send location to server' }))
      }
      return success
    } catch (error) {
      console.error('Failed to send location to server:', error)
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Failed to send to server' }))
      return false
    }
  }, [])

  const syncAllLocationsToServer = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (!ciServer.current) {
      setState(prev => ({ ...prev, error: 'CI server not available' }))
      return { success: 0, failed: 0 }
    }

    try {
      const result = await ciServer.current.batchSendLocationData(state.locations)
      return result
    } catch (error) {
      console.error('Failed to sync locations:', error)
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Sync failed' }))
      return { success: 0, failed: state.locations.length }
    }
  }, [state.locations])

  const clearAllLocations = useCallback(async (): Promise<boolean> => {
    if (!database.current) return false

    try {
      const success = await database.current.clearAllLocations()
      if (success) {
        setState(prev => ({ ...prev, locations: [] }))
      }
      return success
    } catch (error) {
      console.error('Failed to clear locations:', error)
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Failed to clear locations' }))
      return false
    }
  }, [])

  const testServerConnection = useCallback(async (): Promise<boolean> => {
    if (!ciServer.current) return false

    try {
      const isConnected = await ciServer.current.testConnection()
      if (!isConnected) {
        setState(prev => ({ ...prev, error: 'Cannot connect to CI server' }))
      }
      return isConnected
    } catch (error) {
      console.error('Server connection test failed:', error)
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Connection test failed' }))
      return false
    }
  }, [])

  return {
    ...state,
    createAnchor,
    analyzeLocation,
    sendLocationToServer,
    syncAllLocationsToServer,
    clearAllLocations,
    testServerConnection
  }
}