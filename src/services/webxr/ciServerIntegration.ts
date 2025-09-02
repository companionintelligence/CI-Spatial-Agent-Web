/**
 * CI Server Integration Service
 * Handles communication with Ollama/llama4 for scene image processing
 */

import type { SceneLocation } from './sceneUnderstanding'

export interface ImageAnalysisRequest {
  imageData: string // base64 encoded image
  location: SceneLocation
  prompt?: string
}

export interface ImageAnalysisResponse {
  description: string
  objects: Array<{
    name: string
    confidence: number
    boundingBox?: [number, number, number, number] // x, y, width, height
  }>
  metadata: Record<string, any>
  success: boolean
  error?: string
}

export class CIServerIntegration {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.VITE_CI_SERVER_URL || 'http://localhost:11434'
    this.apiKey = apiKey || process.env.VITE_CI_SERVER_API_KEY
  }

  async analyzeSceneImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResponse> {
    try {
      const prompt = request.prompt || `Analyze this image from a WebXR scene. 
        The image was captured at position ${request.location.anchor.position.join(', ')} 
        with description: "${request.location.description}". 
        Please describe what you see and identify any objects, their locations, and relationships.`

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          model: 'llava', // or 'llama4' when available
          prompt: prompt,
          images: [request.imageData.replace(/^data:image\/[a-z]+;base64,/, '')],
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`CI Server responded with ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      return {
        description: result.response || 'No description available',
        objects: this.extractObjectsFromDescription(result.response || ''),
        metadata: {
          model: result.model,
          totalDuration: result.total_duration,
          loadDuration: result.load_duration,
          promptEvalCount: result.prompt_eval_count,
          evalCount: result.eval_count
        },
        success: true
      }

    } catch (error) {
      console.error('Failed to analyze scene image:', error)
      return {
        description: '',
        objects: [],
        metadata: {},
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private extractObjectsFromDescription(description: string): Array<{
    name: string
    confidence: number
    boundingBox?: [number, number, number, number]
  }> {
    // This is a simplified extraction - in a real implementation,
    // you would use more sophisticated NLP or structured prompts
    const objects: Array<{ name: string; confidence: number }> = []
    
    // Look for common object patterns
    const objectPatterns = [
      /\b(chair|table|desk|bed|sofa|couch)\b/gi,
      /\b(wall|ceiling|floor|door|window)\b/gi,
      /\b(computer|laptop|monitor|screen|keyboard|mouse)\b/gi,
      /\b(book|paper|document|pen|pencil)\b/gi,
      /\b(plant|tree|flower|pot)\b/gi,
      /\b(light|lamp|bulb)\b/gi
    ]

    objectPatterns.forEach(pattern => {
      const matches = description.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const existing = objects.find(obj => obj.name.toLowerCase() === match.toLowerCase())
          if (!existing) {
            objects.push({
              name: match.toLowerCase(),
              confidence: 0.8 // Default confidence for pattern matching
            })
          }
        })
      }
    })

    return objects
  }

  async sendLocationData(location: SceneLocation): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          id: location.id,
          anchor: location.anchor,
          description: location.description,
          imageData: location.imageData,
          metadata: location.metadata,
          timestamp: Date.now()
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to send location data: ${response.status}`)
      }

      return true
    } catch (error) {
      console.error('Failed to send location data to CI server:', error)
      return false
    }
  }

  async batchSendLocationData(locations: SceneLocation[]): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0

    // Send in batches to avoid overwhelming the server
    const batchSize = 10
    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize)
      
      try {
        const response = await fetch(`${this.baseUrl}/api/locations/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
          },
          body: JSON.stringify({
            locations: batch.map(location => ({
              id: location.id,
              anchor: location.anchor,
              description: location.description,
              imageData: location.imageData,
              metadata: location.metadata,
              timestamp: Date.now()
            }))
          })
        })

        if (response.ok) {
          success += batch.length
        } else {
          failed += batch.length
          console.error(`Batch ${i / batchSize + 1} failed:`, response.statusText)
        }
      } catch (error) {
        failed += batch.length
        console.error(`Batch ${i / batchSize + 1} error:`, error)
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { success, failed }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      })

      return response.ok
    } catch (error) {
      console.error('Failed to test CI server connection:', error)
      return false
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.status}`)
      }

      const data = await response.json()
      return data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.error('Failed to get available models:', error)
      return []
    }
  }

  setCredentials(baseUrl?: string, apiKey?: string) {
    if (baseUrl) this.baseUrl = baseUrl
    if (apiKey) this.apiKey = apiKey
  }
}