/**
 * WebXR Scene Understanding Control Panel
 * Provides UI for managing scene understanding features
 */

import { useCallback, useEffect, useState } from 'react'
import type { XRStore } from '@react-three/xr'

import type { SceneLocation } from '../../services/webxr/sceneUnderstanding'
import { useWebXRSceneUnderstanding } from '../../services/webxr/useWebXRSceneUnderstanding'

interface WebXRSceneControlsProps {
  xrStore: XRStore | null
  onLocationSelected?: (location: SceneLocation) => void
}

export const WebXRSceneControls = ({ xrStore, onLocationSelected }: WebXRSceneControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [serverUrl, setServerUrl] = useState('http://localhost:11434')
  const [isConnected, setIsConnected] = useState(false)

  const sceneUnderstanding = useWebXRSceneUnderstanding(xrStore, {
    enabled: true,
    autoAnalyzeImages: true,
    autoSendToServer: false, // Let user control this
    ciServerUrl: serverUrl
  })

  // Test server connection on URL change
  useEffect(() => {
    if (serverUrl) {
      sceneUnderstanding.testServerConnection().then(setIsConnected)
    }
  }, [serverUrl, sceneUnderstanding.testServerConnection])

  const handleSyncAll = useCallback(async () => {
    const result = await sceneUnderstanding.syncAllLocationsToServer()
    alert(`Synced: ${result.success} success, ${result.failed} failed`)
  }, [sceneUnderstanding.syncAllLocationsToServer])

  const handleClearAll = useCallback(async () => {
    if (confirm('Are you sure you want to clear all stored locations?')) {
      const success = await sceneUnderstanding.clearAllLocations()
      if (success) {
        alert('All locations cleared')
      } else {
        alert('Failed to clear locations')
      }
    }
  }, [sceneUnderstanding.clearAllLocations])

  const handleCreateAnchor = useCallback(async () => {
    // Create an anchor at a default position in front of the user
    const location = await sceneUnderstanding.createAnchor([0, 0, -1], 'Manual test anchor')
    if (location && onLocationSelected) {
      onLocationSelected(location)
    }
  }, [sceneUnderstanding.createAnchor, onLocationSelected])

  if (!sceneUnderstanding.isInitialized) {
    return (
      <div style={styles.container}>
        <div style={styles.status}>
          Initializing WebXR Scene Understanding...
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span>🔍 Scene Understanding</span>
        <span style={styles.toggle}>{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div style={styles.panel}>
          {/* Status */}
          <div style={styles.statusSection}>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}>Session:</span>
              <span style={{ color: sceneUnderstanding.isSessionActive ? '#4ade80' : '#ef4444' }}>
                {sceneUnderstanding.isSessionActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}>Locations:</span>
              <span>{sceneUnderstanding.locations.length}</span>
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}>Bounds:</span>
              <span>{sceneUnderstanding.boundedGeometry ? 'Available' : 'None'}</span>
            </div>
          </div>

          {/* Server Configuration */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>CI Server</div>
            <div style={styles.inputGroup}>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:11434"
                style={styles.input}
              />
              <div style={styles.connectionStatus}>
                <span style={{ color: isConnected ? '#4ade80' : '#ef4444' }}>
                  {isConnected ? '● Connected' : '● Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Actions</div>
            <div style={styles.buttonGroup}>
              <button
                onClick={handleCreateAnchor}
                disabled={!sceneUnderstanding.isSessionActive}
                style={styles.button}
              >
                Create Test Anchor
              </button>
              <button
                onClick={handleSyncAll}
                disabled={!isConnected || sceneUnderstanding.locations.length === 0}
                style={styles.button}
              >
                Sync All to Server
              </button>
              <button
                onClick={handleClearAll}
                disabled={sceneUnderstanding.locations.length === 0}
                style={{ ...styles.button, backgroundColor: '#ef4444' }}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Locations List */}
          {sceneUnderstanding.locations.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Detected Locations</div>
              <div style={styles.locationsList}>
                {sceneUnderstanding.locations.map((location, index) => (
                  <div
                    key={location.id}
                    style={styles.locationItem}
                    onClick={() => onLocationSelected?.(location)}
                  >
                    <div style={styles.locationName}>
                      {location.description || `Location ${index + 1}`}
                    </div>
                    <div style={styles.locationDetails}>
                      Position: {location.anchor.position.map(p => p.toFixed(2)).join(', ')}
                    </div>
                    <div style={styles.locationDetails}>
                      Type: {location.anchor.type} | Confidence: {(location.anchor.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {sceneUnderstanding.error && (
            <div style={styles.error}>
              Error: {sceneUnderstanding.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: '20px',
    right: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    borderRadius: '8px',
    minWidth: '280px',
    maxWidth: '400px',
    zIndex: 1000,
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px'
  },
  header: {
    padding: '12px 16px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  toggle: {
    fontFamily: 'monospace',
    fontSize: '16px'
  },
  panel: {
    padding: '16px'
  },
  status: {
    padding: '16px',
    textAlign: 'center' as const,
    color: '#9ca3af'
  },
  statusSection: {
    marginBottom: '16px'
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px'
  },
  statusLabel: {
    color: '#9ca3af'
  },
  section: {
    marginBottom: '16px'
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: '8px',
    color: '#e5e7eb'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  input: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    fontSize: '12px'
  },
  connectionStatus: {
    fontSize: '12px'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  button: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#3b82f6',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background-color 0.2s'
  },
  locationsList: {
    maxHeight: '200px',
    overflowY: 'auto' as const
  },
  locationItem: {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  locationName: {
    fontWeight: '500',
    marginBottom: '2px'
  },
  locationDetails: {
    fontSize: '11px',
    color: '#9ca3af',
    marginBottom: '1px'
  },
  error: {
    padding: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: '4px',
    color: '#fca5a5',
    fontSize: '12px'
  }
}