import type { 
  KeywordAnimationConfig, 
  KeywordAnimationMapping, 
  KeywordMatchResult 
} from './keywordAnimationTypes'
import { defaultKeywordAnimationConfig } from './config/defaultMappings'

export class KeywordAnimationService {
  private config: KeywordAnimationConfig
  
  constructor(config?: KeywordAnimationConfig) {
    this.config = config || defaultKeywordAnimationConfig
  }
  
  /**
   * Update the configuration
   */
  updateConfig(config: KeywordAnimationConfig): void {
    this.config = config
  }
  
  /**
   * Find the best matching animation/emote for the given input text
   */
  findBestMatch(input: string): KeywordMatchResult | null {
    const normalizedInput = input.toLowerCase().trim()
    const words = normalizedInput.split(/\s+/)
    
    const matches: Array<KeywordMatchResult> = []
    
    // Check each mapping for keyword matches
    for (const mapping of this.config.mappings) {
      const matchedKeywords: string[] = []
      let totalMatches = 0
      
      // Check for exact keyword matches
      for (const keyword of mapping.keywords) {
        const normalizedKeyword = keyword.toLowerCase()
        
        // Exact word match
        if (words.includes(normalizedKeyword)) {
          matchedKeywords.push(keyword)
          totalMatches += 1
          continue
        }
        
        // Partial match if enabled
        if (this.config.allowPartialMatches) {
          // Check if any word contains the keyword or vice versa
          for (const word of words) {
            if (word.includes(normalizedKeyword) || normalizedKeyword.includes(word)) {
              matchedKeywords.push(keyword)
              totalMatches += 0.5 // Partial match gets lower weight
              break
            }
          }
        }
      }
      
      if (matchedKeywords.length > 0) {
        // Calculate confidence based on:
        // - Number of matches
        // - Mapping priority 
        // - Length of matched keywords vs total keywords
        const keywordCoverage = matchedKeywords.length / mapping.keywords.length
        const wordCoverage = totalMatches / words.length
        const priorityWeight = mapping.priority / 10
        
        const confidence = Math.min(1, (keywordCoverage * 0.4 + wordCoverage * 0.3 + priorityWeight * 0.3))
        
        matches.push({
          mapping,
          matchedKeywords,
          confidence
        })
      }
    }
    
    // Filter by minimum confidence
    const validMatches = matches.filter(match => match.confidence >= this.config.minConfidence)
    
    if (validMatches.length === 0) {
      return null
    }
    
    // Sort by confidence (descending) and then by priority (descending)
    validMatches.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) < 0.01) {
        return b.mapping.priority - a.mapping.priority
      }
      return b.confidence - a.confidence
    })
    
    return validMatches[0]
  }
  
  /**
   * Find all matching animations/emotes for the given input text
   */
  findAllMatches(input: string): KeywordMatchResult[] {
    const normalizedInput = input.toLowerCase().trim()
    const words = normalizedInput.split(/\s+/)
    
    const matches: Array<KeywordMatchResult> = []
    
    for (const mapping of this.config.mappings) {
      const matchedKeywords: string[] = []
      let totalMatches = 0
      
      for (const keyword of mapping.keywords) {
        const normalizedKeyword = keyword.toLowerCase()
        
        if (words.includes(normalizedKeyword)) {
          matchedKeywords.push(keyword)
          totalMatches += 1
          continue
        }
        
        if (this.config.allowPartialMatches) {
          for (const word of words) {
            if (word.includes(normalizedKeyword) || normalizedKeyword.includes(word)) {
              matchedKeywords.push(keyword)
              totalMatches += 0.5
              break
            }
          }
        }
      }
      
      if (matchedKeywords.length > 0) {
        const keywordCoverage = matchedKeywords.length / mapping.keywords.length
        const wordCoverage = totalMatches / words.length
        const priorityWeight = mapping.priority / 10
        
        const confidence = Math.min(1, (keywordCoverage * 0.4 + wordCoverage * 0.3 + priorityWeight * 0.3))
        
        if (confidence >= this.config.minConfidence) {
          matches.push({
            mapping,
            matchedKeywords,
            confidence
          })
        }
      }
    }
    
    // Sort by confidence and priority
    return matches.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) < 0.01) {
        return b.mapping.priority - a.mapping.priority
      }
      return b.confidence - a.confidence
    })
  }
  
  /**
   * Get all available keyword mappings
   */
  getAllMappings(): KeywordAnimationMapping[] {
    return this.config.mappings
  }
  
  /**
   * Get current configuration
   */
  getConfig(): KeywordAnimationConfig {
    return this.config
  }
}