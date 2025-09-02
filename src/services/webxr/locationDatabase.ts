/**
 * Local SQLite Database Service for XR Location Storage
 * Uses IndexedDB as storage backend since SQLite is not directly available in browsers
 */

import type { SceneLocation } from './sceneUnderstanding'

interface LocationRecord {
  id: string
  position: [number, number, number]
  orientation: [number, number, number, number]
  timestamp: number
  type: string
  confidence: number
  description: string
  imageData?: string
  metadata?: string // JSON stringified metadata
}

export class XRLocationDatabase {
  private db: IDBDatabase | null = null
  private readonly dbName = 'XRLocationDB'
  private readonly version = 1
  private readonly storeName = 'locations'

  constructor() {
    this.initializeDB()
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error('Failed to open database'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          
          // Create indices for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('confidence', 'confidence', { unique: false })
        }
      }
    })
  }

  async storeLocation(location: SceneLocation): Promise<boolean> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return false
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const record: LocationRecord = {
        id: location.id,
        position: location.anchor.position,
        orientation: location.anchor.orientation,
        timestamp: location.anchor.timestamp,
        type: location.anchor.type,
        confidence: location.anchor.confidence,
        description: location.description,
        imageData: location.imageData,
        metadata: location.metadata ? JSON.stringify(location.metadata) : undefined
      }

      const request = store.put(record)

      request.onsuccess = () => {
        resolve(true)
      }

      request.onerror = () => {
        reject(new Error('Failed to store location'))
      }
    })
  }

  async getLocation(id: string): Promise<SceneLocation | null> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return null
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(id)

      request.onsuccess = () => {
        const record = request.result as LocationRecord
        if (record) {
          const location: SceneLocation = {
            id: record.id,
            anchor: {
              id: record.id,
              position: record.position,
              orientation: record.orientation,
              timestamp: record.timestamp,
              type: record.type as 'plane' | 'mesh' | 'point',
              confidence: record.confidence
            },
            description: record.description,
            imageData: record.imageData,
            metadata: record.metadata ? JSON.parse(record.metadata) : undefined
          }
          resolve(location)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to retrieve location'))
      }
    })
  }

  async getAllLocations(): Promise<SceneLocation[]> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const records = request.result as LocationRecord[]
        const locations: SceneLocation[] = records.map(record => ({
          id: record.id,
          anchor: {
            id: record.id,
            position: record.position,
            orientation: record.orientation,
            timestamp: record.timestamp,
            type: record.type as 'plane' | 'mesh' | 'point',
            confidence: record.confidence
          },
          description: record.description,
          imageData: record.imageData,
          metadata: record.metadata ? JSON.parse(record.metadata) : undefined
        }))
        resolve(locations)
      }

      request.onerror = () => {
        reject(new Error('Failed to retrieve all locations'))
      }
    })
  }

  async getLocationsByTimeRange(startTime: number, endTime: number): Promise<SceneLocation[]> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('timestamp')
      const range = IDBKeyRange.bound(startTime, endTime)
      const request = index.getAll(range)

      request.onsuccess = () => {
        const records = request.result as LocationRecord[]
        const locations: SceneLocation[] = records.map(record => ({
          id: record.id,
          anchor: {
            id: record.id,
            position: record.position,
            orientation: record.orientation,
            timestamp: record.timestamp,
            type: record.type as 'plane' | 'mesh' | 'point',
            confidence: record.confidence
          },
          description: record.description,
          imageData: record.imageData,
          metadata: record.metadata ? JSON.parse(record.metadata) : undefined
        }))
        resolve(locations)
      }

      request.onerror = () => {
        reject(new Error('Failed to retrieve locations by time range'))
      }
    })
  }

  async deleteLocation(id: string): Promise<boolean> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return false
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve(true)
      }

      request.onerror = () => {
        reject(new Error('Failed to delete location'))
      }
    })
  }

  async clearAllLocations(): Promise<boolean> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return false
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => {
        resolve(true)
      }

      request.onerror = () => {
        reject(new Error('Failed to clear all locations'))
      }
    })
  }

  async getLocationCount(): Promise<number> {
    if (!this.db) {
      await this.initializeDB()
      if (!this.db) return 0
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(new Error('Failed to get location count'))
      }
    })
  }
}