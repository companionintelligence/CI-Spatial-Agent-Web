/**
 * RPM Animation Demo Component
 * 
 * This component demonstrates the RPM Animation System integration
 * and provides a UI for testing and managing RPM animations.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { 
  useRPMAnimationSystem, 
  RPMAnimationPresets,
  type RPMAnimationSystemConfig 
} from '../services/animation/rpmAnimationSystem'
import type { AnimationGender } from '../services/animation/config/rpmAnimationLibrary'
import type { AssetDownloadProgress } from '../services/animation/rpmAssetManager'

export const RPMAnimationDemo: React.FC = () => {
  const rpmSystem = useRPMAnimationSystem()
  const [systemStatus, setSystemStatus] = useState(rpmSystem.getSystemStatus())
  const [currentGender, setCurrentGender] = useState<AnimationGender>('masculine')
  const [selectedProfile, setSelectedProfile] = useState('Professional Male')
  const [libraryMode, setLibraryMode] = useState<'local' | 'rpm' | 'mixed'>('mixed')
  const [downloadProgress, setDownloadProgress] = useState<AssetDownloadProgress[]>([])
  const [isDownloading, setIsDownloading] = useState(false)

  // Available categories for demonstration
  const categories = ['idle', 'gesture', 'movement', 'expression', 'action', 'communication']

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStatus(rpmSystem.getSystemStatus())
    }, 1000)

    return () => clearInterval(interval)
  }, [rpmSystem])

  // Handle gender change
  const handleGenderChange = useCallback(async (gender: AnimationGender) => {
    setCurrentGender(gender)
    await rpmSystem.setAvatarGender(gender)
    
    // Update profile based on gender
    const newProfile = gender === 'masculine' ? 'Professional Male' : 'Professional Female'
    setSelectedProfile(newProfile)
    rpmSystem.setMixerProfile(newProfile)
  }, [rpmSystem])

  // Handle profile change
  const handleProfileChange = useCallback((profile: string) => {
    setSelectedProfile(profile)
    rpmSystem.setMixerProfile(profile)
  }, [rpmSystem])

  // Handle library mode change
  const handleLibraryModeChange = useCallback((mode: 'local' | 'rpm' | 'mixed') => {
    setLibraryMode(mode)
    rpmSystem.setLibraryMode(mode)
  }, [rpmSystem])

  // Play random animation
  const playRandomAnimation = useCallback(async (category?: string) => {
    const animation = rpmSystem.getRandomAnimation(category)
    if (animation) {
      console.log(`Playing random ${category || 'any'} animation:`, animation.name)
      
      // If it's an RPM animation, play it through the RPM system
      // For this demo, we'll just log the action
      alert(`Playing animation: ${animation.name} (${animation.category})`)
    }
  }, [rpmSystem])

  // Play specific RPM animation
  const playRPMAnimation = useCallback(async (rpmId: string) => {
    try {
      const success = await rpmSystem.playRPMAnimation(rpmId, {
        immediate: true,
        speed: 1.0
      })
      
      if (success) {
        alert(`Successfully queued RPM animation: ${rpmId}`)
      } else {
        alert(`Failed to play RPM animation: ${rpmId}`)
      }
    } catch (error) {
      console.error('Error playing RPM animation:', error)
      alert(`Error playing animation: ${error}`)
    }
  }, [rpmSystem])

  // Download category
  const downloadCategory = useCallback(async (category: string) => {
    if (isDownloading) return
    
    setIsDownloading(true)
    setDownloadProgress([])
    
    try {
      const results = await rpmSystem.downloadCategory(category, (progress) => {
        setDownloadProgress(prev => {
          const existing = prev.find(p => p.animationId === progress.animationId)
          if (existing) {
            return prev.map(p => p.animationId === progress.animationId ? progress : p)
          } else {
            return [...prev, progress]
          }
        })
      })
      
      console.log(`Downloaded ${results.length} animations for category: ${category}`)
      alert(`Downloaded ${results.length} animations for ${category}`)
      
    } catch (error) {
      console.error('Download error:', error)
      alert(`Download failed: ${error}`)
    } finally {
      setIsDownloading(false)
    }
  }, [rpmSystem, isDownloading])

  // Download all for current gender
  const downloadAllForGender = useCallback(async () => {
    if (isDownloading) return
    
    const confirmDownload = window.confirm(
      `This will download all RPM animations for ${currentGender} gender. This may take a while and use bandwidth. Continue?`
    )
    
    if (!confirmDownload) return
    
    setIsDownloading(true)
    setDownloadProgress([])
    
    try {
      const results = await rpmSystem.downloadAllForCurrentGender((progress) => {
        setDownloadProgress(prev => {
          const existing = prev.find(p => p.animationId === progress.animationId)
          if (existing) {
            return prev.map(p => p.animationId === progress.animationId ? progress : p)
          } else {
            return [...prev, progress]
          }
        })
      })
      
      console.log(`Downloaded ${results.length} animations for ${currentGender}`)
      alert(`Downloaded ${results.length} animations!`)
      
    } catch (error) {
      console.error('Download error:', error)
      alert(`Download failed: ${error}`)
    } finally {
      setIsDownloading(false)
    }
  }, [rpmSystem, currentGender, isDownloading])

  // Apply preset configuration
  const applyPreset = useCallback(async (presetName: string) => {
    let config: Partial<RPMAnimationSystemConfig>
    
    switch (presetName) {
      case 'professional':
        config = RPMAnimationPresets.professional(currentGender)
        break
      case 'complete':
        config = RPMAnimationPresets.complete(currentGender)
        break
      case 'localOnly':
        config = RPMAnimationPresets.localOnly()
        break
      case 'rpmOnly':
        config = RPMAnimationPresets.rpmOnly(currentGender)
        break
      default:
        return
    }
    
    // Apply configuration
    if (config.avatarGender) {
      await handleGenderChange(config.avatarGender)
    }
    
    if (config.mixerProfile) {
      handleProfileChange(config.mixerProfile)
    }
    
    if (config.libraryMode) {
      handleLibraryModeChange(config.libraryMode)
    }
    
    rpmSystem.setRPMAnimationsEnabled(config.enableRPMAnimations ?? true)
    rpmSystem.setAutoDownload(config.autoDownload ?? false)
    
    alert(`Applied ${presetName} preset configuration`)
  }, [currentGender, handleGenderChange, handleProfileChange, handleLibraryModeChange, rpmSystem])

  const availableProfiles = rpmSystem.getAvailableMixerProfiles()
  const stats = rpmSystem.getDetailedStatistics()

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>RPM Animation System Demo</h1>
      
      {/* System Status */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h2>System Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Initialized:</strong> {systemStatus.initialized ? '✅' : '❌'}
          </div>
          <div>
            <strong>Total Animations:</strong> {systemStatus.animationCount}
          </div>
          <div>
            <strong>Cached:</strong> {systemStatus.cachedCount}
          </div>
          <div>
            <strong>Failed:</strong> {systemStatus.failedCount}
          </div>
          <div>
            <strong>Downloading:</strong> {systemStatus.downloadingCount}
          </div>
          <div>
            <strong>Gender:</strong> {systemStatus.currentGender}
          </div>
          <div>
            <strong>Profile:</strong> {systemStatus.mixerProfile}
          </div>
          <div>
            <strong>Library Mode:</strong> {systemStatus.libraryMode}
          </div>
        </div>
      </div>

      {/* Configuration Controls */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px' }}>
        <h2>Configuration</h2>
        
        {/* Quick Presets */}
        <div style={{ marginBottom: '15px' }}>
          <strong>Quick Presets:</strong>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <button onClick={() => applyPreset('professional')}>Professional</button>
            <button onClick={() => applyPreset('complete')}>Complete</button>
            <button onClick={() => applyPreset('localOnly')}>Local Only</button>
            <button onClick={() => applyPreset('rpmOnly')}>RPM Only</button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {/* Gender Selection */}
          <div>
            <label>
              <strong>Avatar Gender:</strong>
              <select 
                value={currentGender} 
                onChange={(e) => handleGenderChange(e.target.value as AnimationGender)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="masculine">Masculine</option>
                <option value="feminine">Feminine</option>
              </select>
            </label>
          </div>
          
          {/* Mixer Profile */}
          <div>
            <label>
              <strong>Mixer Profile:</strong>
              <select 
                value={selectedProfile} 
                onChange={(e) => handleProfileChange(e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                {availableProfiles.map(profile => (
                  <option key={profile} value={profile}>{profile}</option>
                ))}
              </select>
            </label>
          </div>
          
          {/* Library Mode */}
          <div>
            <label>
              <strong>Library Mode:</strong>
              <select 
                value={libraryMode} 
                onChange={(e) => handleLibraryModeChange(e.target.value as any)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="mixed">Mixed (Local + RPM)</option>
                <option value="local">Local Only</option>
                <option value="rpm">RPM Only</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Animation Controls */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8f0', borderRadius: '8px' }}>
        <h2>Animation Controls</h2>
        
        {/* Play Random Animations */}
        <div style={{ marginBottom: '15px' }}>
          <strong>Play Random Animation:</strong>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
            <button onClick={() => playRandomAnimation()}>Any Category</button>
            {categories.map(category => (
              <button 
                key={category} 
                onClick={() => playRandomAnimation(category)}
                style={{ textTransform: 'capitalize' }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        
        {/* Play Specific RPM Animations */}
        <div style={{ marginBottom: '15px' }}>
          <strong>Play Specific RPM Animation:</strong>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
            <button onClick={() => playRPMAnimation('idle')}>Idle</button>
            <button onClick={() => playRPMAnimation('wave')}>Wave</button>
            <button onClick={() => playRPMAnimation('thinking')}>Thinking</button>
            <button onClick={() => playRPMAnimation('clap')}>Clap</button>
            <button onClick={() => playRPMAnimation('dance')}>Dance</button>
            <button onClick={() => playRPMAnimation('bow')}>Bow</button>
          </div>
        </div>
      </div>

      {/* Download Controls */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f0f8', borderRadius: '8px' }}>
        <h2>Download Management</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Download by Category:</strong>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
            {categories.map(category => (
              <button 
                key={category}
                onClick={() => downloadCategory(category)}
                disabled={isDownloading}
                style={{ textTransform: 'capitalize' }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <button 
            onClick={downloadAllForGender}
            disabled={isDownloading}
            style={{ backgroundColor: '#ff6b6b', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px' }}
          >
            {isDownloading ? 'Downloading...' : `Download All for ${currentGender}`}
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => rpmSystem.retryFailedDownloads()}
            disabled={isDownloading || systemStatus.failedCount === 0}
          >
            Retry Failed ({systemStatus.failedCount})
          </button>
          
          <button 
            onClick={() => rpmSystem.clearDownloadQueue()}
            disabled={isDownloading}
          >
            Clear Queue
          </button>
        </div>
        
        {/* Download Progress */}
        {downloadProgress.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <strong>Download Progress:</strong>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px' }}>
              {downloadProgress.map(progress => (
                <div 
                  key={progress.animationId} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '5px',
                    backgroundColor: progress.status === 'completed' ? '#d4edda' : progress.status === 'failed' ? '#f8d7da' : '#fff3cd',
                    marginBottom: '2px',
                    borderRadius: '3px'
                  }}
                >
                  <span>{progress.name}</span>
                  <span>{progress.status} - {progress.progress}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h2>Statistics</h2>
        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          <details>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              <strong>Detailed Statistics (Click to expand)</strong>
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fff', padding: '10px', borderRadius: '5px' }}>
              {JSON.stringify(stats, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}

export default RPMAnimationDemo