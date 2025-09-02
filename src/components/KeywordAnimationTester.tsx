import React, { useState, useCallback, useMemo } from 'react'
import { useKeywordAnimation } from '../../services/keywordAnimation/useKeywordAnimation'
import type { KeywordMatchResult } from '../../services/keywordAnimation/keywordAnimationTypes'
import ControlButton from '../common/ControlButton'

interface KeywordAnimationTesterProps {
  className?: string
}

export default function KeywordAnimationTester({ className }: KeywordAnimationTesterProps) {
  const [inputText, setInputText] = useState('')
  const [lastResults, setLastResults] = useState<KeywordMatchResult[]>([])
  const [testHistory, setTestHistory] = useState<Array<{
    input: string
    results: KeywordMatchResult[]
    timestamp: number
    triggered: boolean
  }>>([])
  
  const keywordAnimation = useKeywordAnimation({
    enableAnimations: true,
    enableEmotes: true
  })
  
  // Process keywords without triggering
  const processKeywords = useCallback(() => {
    if (!inputText.trim()) return
    
    const results = keywordAnimation.processKeywords(inputText)
    setLastResults(results)
    
    // Add to history
    setTestHistory(prev => [{
      input: inputText,
      results,
      timestamp: Date.now(),
      triggered: false
    }, ...prev.slice(0, 9)]) // Keep last 10 entries
    
  }, [inputText, keywordAnimation])
  
  // Trigger animation/emote from keywords
  const triggerKeywords = useCallback(() => {
    if (!inputText.trim()) return
    
    const results = keywordAnimation.processKeywords(inputText)
    const triggered = keywordAnimation.triggerFromKeywords(inputText)
    
    setLastResults(results)
    
    // Add to history
    setTestHistory(prev => [{
      input: inputText,
      results,
      timestamp: Date.now(),
      triggered
    }, ...prev.slice(0, 9)])
    
    // Clear input after triggering
    setInputText('')
  }, [inputText, keywordAnimation])
  
  // Get all available mappings for reference
  const allMappings = useMemo(() => {
    return keywordAnimation.service.getAllMappings()
  }, [keywordAnimation.service])
  
  // Group mappings by type
  const groupedMappings = useMemo(() => {
    const groups: Record<string, typeof allMappings> = {
      'Animation + Emote': [],
      'Animation Only': [],
      'Emote Only': []
    }
    
    allMappings.forEach(mapping => {
      if (mapping.animation && mapping.emote) {
        groups['Animation + Emote'].push(mapping)
      } else if (mapping.animation) {
        groups['Animation Only'].push(mapping)
      } else if (mapping.emote) {
        groups['Emote Only'].push(mapping)
      }
    })
    
    return groups
  }, [allMappings])
  
  return (
    <div className={`keyword-animation-tester p-4 bg-gray-900 text-white rounded-lg ${className || ''}`}>
      <h2 className="text-xl font-bold mb-4">Keyword Animation Tester</h2>
      
      {/* Input Section */}
      <div className="mb-6">
        <label htmlFor="keyword-input" className="block text-sm font-medium mb-2">
          Enter keywords or phrases:
        </label>
        <div className="flex gap-2">
          <input
            id="keyword-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) {
                  processKeywords()
                } else {
                  triggerKeywords()
                }
              }
            }}
            placeholder="Type keywords like 'hello', 'dance', 'sad'..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ControlButton 
            onClick={processKeywords}
            disabled={!inputText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700"
          >
            Preview
          </ControlButton>
          <ControlButton 
            onClick={triggerKeywords}
            disabled={!inputText.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700"
          >
            Trigger
          </ControlButton>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Press Enter to trigger, Shift+Enter to preview. "Preview" shows matches without triggering animations.
        </p>
      </div>
      
      {/* Results Section */}
      {lastResults.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            Current Matches ({lastResults.length})
          </h3>
          <div className="space-y-2">
            {lastResults.map((result, index) => (
              <div 
                key={index} 
                className="p-3 bg-gray-800 rounded border-l-4"
                style={{
                  borderLeftColor: result.confidence > 0.7 ? '#10b981' : 
                                  result.confidence > 0.5 ? '#f59e0b' : '#ef4444'
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{result.mapping.description}</h4>
                  <span className="text-sm bg-gray-700 px-2 py-1 rounded">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-300">
                  <p><strong>Matched:</strong> {result.matchedKeywords.join(', ')}</p>
                  {result.mapping.animation && (
                    <p><strong>Animation:</strong> {result.mapping.animation.name} ({result.mapping.animation.category})</p>
                  )}
                  {result.mapping.emote && (
                    <p><strong>Emote:</strong> {result.mapping.emote.emotion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Test History */}
      {testHistory.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Test History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {testHistory.map((entry, index) => (
              <div key={entry.timestamp} className="p-2 bg-gray-800 rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono">"{entry.input}"</span>
                  <div className="flex gap-2">
                    {entry.triggered && (
                      <span className="bg-green-600 text-xs px-2 py-1 rounded">TRIGGERED</span>
                    )}
                    <span className="text-gray-400 text-xs">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className="text-gray-400">
                  {entry.results.length} match{entry.results.length !== 1 ? 'es' : ''} found
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Available Keywords Reference */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Available Keywords Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groupedMappings).map(([groupName, mappings]) => (
            mappings.length > 0 && (
              <div key={groupName} className="bg-gray-800 rounded p-3">
                <h4 className="font-medium mb-2 text-sm text-blue-400">{groupName}</h4>
                <div className="space-y-2">
                  {mappings.map((mapping, index) => (
                    <div key={index} className="text-xs">
                      <div className="font-medium text-gray-300 mb-1">
                        {mapping.description}
                      </div>
                      <div className="text-gray-400">
                        {mapping.keywords.slice(0, 4).join(', ')}
                        {mapping.keywords.length > 4 && ` +${mapping.keywords.length - 4} more`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}