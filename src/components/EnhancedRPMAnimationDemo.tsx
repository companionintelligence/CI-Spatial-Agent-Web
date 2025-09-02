/**
 * Enhanced RPM Animation Demo Component
 * 
 * Showcases the sophisticated animation mixer system with the master
 * Animations.json index and GLB asset management.
 */

import React, { useState, useEffect } from 'react'
import { useEnhancedRPMSystem, MIXER_PROFILES } from '@/services/animation/enhancedRPMAnimationSystem'
import type { AnimationData, SystemStatus } from '@/services/animation/enhancedRPMAnimationSystem'

export const EnhancedRPMAnimationDemo: React.FC = () => {
  const rpmSystem = useEnhancedRPMSystem()
  
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('idle')
  const [selectedGender, setSelectedGender] = useState<'masculine' | 'feminine'>('masculine')
  const [selectedProfile, setSelectedProfile] = useState<string>('Professional Male')
  const [animations, setAnimations] = useState<AnimationData[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [cacheStats, setCacheStats] = useState<any>(null)

  // Update status and animations
  useEffect(() => {
    const updateData = async () => {
      // Wait for system to initialize
      if (!rpmSystem.isInitialized()) {
        setStatus({ 
          initialized: false, 
          totalAnimations: 0, 
          loadedAssets: 0, 
          currentGender: 'masculine', 
          currentProfile: 'Loading...', 
          queueLength: 0, 
          statistics: {} 
        })
        return
      }

      setStatus(rpmSystem.getStatus())
      setAnimations(rpmSystem.getAnimationsByCategory(selectedCategory))
      setCacheStats(rpmSystem.getCacheStats())
    }

    updateData()
    const interval = setInterval(updateData, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [selectedCategory, selectedGender, selectedProfile])

  // Handle gender change
  const handleGenderChange = (gender: 'masculine' | 'feminine') => {
    setSelectedGender(gender)
    rpmSystem.setGender(gender)
  }

  // Handle profile change
  const handleProfileChange = (profile: string) => {
    setSelectedProfile(profile)
    rpmSystem.setProfile(profile)
  }

  // Handle animation play
  const handlePlayAnimation = async (animation: AnimationData) => {
    setIsLoading(true)
    try {
      const success = await rpmSystem.playAnimation(animation.id, { preload: true })
      if (success) {
        console.log(`Played animation: ${animation.displayName}`)
      } else {
        console.warn(`Failed to play animation: ${animation.displayName}`)
      }
    } catch (error) {
      console.error('Error playing animation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle random animation play
  const handlePlayRandom = async () => {
    setIsLoading(true)
    try {
      const success = await rpmSystem.playRandomFromCategory(selectedCategory)
      if (!success) {
        console.warn(`Failed to play random animation from category: ${selectedCategory}`)
      }
    } catch (error) {
      console.error('Error playing random animation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle category preload
  const handlePreloadCategory = async () => {
    setIsLoading(true)
    try {
      await rpmSystem.preloadCategory(selectedCategory)
      console.log(`Preloaded category: ${selectedCategory}`)
    } catch (error) {
      console.error('Error preloading category:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle sequence creation
  const handleCreateSequence = async () => {
    setIsLoading(true)
    try {
      const categories = ['idle', 'gesture', 'expression']
      const sequence = await rpmSystem.createAndPlaySequence(
        'Demo Sequence',
        categories,
        { preload: true, loop: false }
      )
      if (sequence) {
        console.log(`Created sequence with ${sequence.animations.length} animations`)
      }
    } catch (error) {
      console.error('Error creating sequence:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      const results = rpmSystem.searchAnimations(query)
      setAnimations(results)
    } else {
      setAnimations(rpmSystem.getAnimationsByCategory(selectedCategory))
    }
  }

  // Get filtered animations
  const filteredAnimations = searchQuery.trim() 
    ? rpmSystem.searchAnimations(searchQuery)
    : animations

  return (
    <div className="enhanced-rpm-demo p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
        🎭 Enhanced RPM Animation System
        <span className="ml-3 px-2 py-1 text-sm bg-green-100 text-green-800 rounded-full">
          {status?.totalAnimations || 0} animations
        </span>
      </h2>

      {/* System Status */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="text-2xl font-bold text-green-600">
              {status.initialized ? 'Ready' : 'Loading...'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-500">Loaded Assets</h3>
            <p className="text-2xl font-bold text-blue-600">
              {status.loadedAssets}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-500">Current Gender</h3>
            <p className="text-2xl font-bold text-purple-600 capitalize">
              {status.currentGender}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-500">Profile</h3>
            <p className="text-lg font-semibold text-indigo-600">
              {status.currentProfile}
            </p>
          </div>
        </div>
      )}

      {/* Cache Statistics */}
      {cacheStats && (
        <div className="bg-white rounded-lg p-4 mb-6 shadow">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Cache Statistics</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total:</span>
              <span className="ml-2 font-semibold">{cacheStats.total}</span>
            </div>
            <div>
              <span className="text-gray-500">Loaded:</span>
              <span className="ml-2 font-semibold text-green-600">{cacheStats.loaded}</span>
            </div>
            <div>
              <span className="text-gray-500">Loading:</span>
              <span className="ml-2 font-semibold text-yellow-600">{cacheStats.loading}</span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 font-semibold text-red-600">{cacheStats.failed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">System Controls</h3>
        
        {/* Gender & Profile Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar Gender
            </label>
            <div className="flex space-x-2">
              {(['masculine', 'feminine'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => handleGenderChange(gender)}
                  className={`px-4 py-2 rounded-lg font-medium capitalize ${
                    selectedGender === gender
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mixer Profile
            </label>
            <select
              value={selectedProfile}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {Object.keys(MIXER_PROFILES).map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Animation Category
          </label>
          <div className="flex flex-wrap gap-2">
            {rpmSystem.getCategories().map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category} ({rpmSystem.getAnimationsByCategory(category).length})
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePlayRandom}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎲 Play Random
          </button>
          <button
            onClick={handlePreloadCategory}
            disabled={isLoading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 Preload Category
          </button>
          <button
            onClick={handleCreateSequence}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎬 Create Sequence
          </button>
          <button
            onClick={() => rpmSystem.clearCache()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            🗑️ Clear Cache
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search animations by name or tag..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Animation List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-700">
            {searchQuery ? `Search Results (${filteredAnimations.length})` : `${selectedCategory} Animations (${animations.length})`}
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {filteredAnimations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'No animations match your search.' : 'No animations in this category.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAnimations.map((animation) => (
                <div key={animation.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-lg font-medium text-gray-900">
                          {animation.displayName}
                        </h4>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {animation.category}
                        </span>
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                          {animation.gender}
                        </span>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <span>Duration: {animation.duration}ms</span>
                        <span className="mx-2">•</span>
                        <span>Weight: {animation.weight}</span>
                        <span className="mx-2">•</span>
                        <span>Priority: {animation.priority}</span>
                        <span className="mx-2">•</span>
                        <span>{animation.loop ? 'Looping' : 'One-shot'}</span>
                      </div>
                      
                      {animation.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {animation.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handlePlayAnimation(animation)}
                      disabled={isLoading}
                      className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ▶️ Play
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          Enhanced animation system with sophisticated mixing and GLB asset management
        </p>
        <p className="mt-1">
          Master index contains {status?.totalAnimations || 0} animations from Ready Player Me
        </p>
      </div>
    </div>
  )
}

export default EnhancedRPMAnimationDemo