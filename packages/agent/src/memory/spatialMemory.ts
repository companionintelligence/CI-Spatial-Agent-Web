/**
 * spatialMemory.ts — object permanence for the companion.
 *
 * Absorbed from CI-Spatial-Agent-Web-2. Each label keeps its last known
 * world-space position, confidence and when it was last seen, so the agent can
 * answer "where is the cup?" and `walk_to('chair')` long after the detection
 * overlay is gone. Without it, perception is a live feed the companion forgets
 * the instant it looks away — which is the difference between something that
 * inhabits a room and something that describes a camera frame.
 */

export interface RememberedObject {
  label: string
  /** Last anchored world position, or null when only a bearing was known. */
  position: [number, number, number] | null
  confidence: number
  /** Epoch ms. Supplied by the caller so this stays deterministic under test. */
  lastSeen: number
  /** How many times it has been observed — a proxy for "is this really there". */
  hits: number
}

export interface SpatialMemoryOptions {
  /** Drop an object not seen for this long, in ms. Default 10 minutes. */
  forgetAfterMs?: number
  /** Cap on remembered labels; the least recently seen is evicted. Default 64. */
  capacity?: number
}

export class SpatialMemory {
  private readonly objects = new Map<string, RememberedObject>()
  private readonly forgetAfterMs: number
  private readonly capacity: number

  constructor(options: SpatialMemoryOptions = {}) {
    this.forgetAfterMs = options.forgetAfterMs ?? 10 * 60_000
    this.capacity = options.capacity ?? 64
  }

  /**
   * Record an observation.
   *
   * A new sighting WITHOUT a position does not erase a position we already had:
   * seeing the cup again from across the room, unanchored, should not make us
   * forget where it is. That asymmetry is the whole point of permanence.
   */
  observe(
    label: string,
    options: { position?: [number, number, number] | null; confidence?: number; now: number }
  ): RememberedObject {
    const key = label.trim().toLowerCase()
    const existing = this.objects.get(key)

    const record: RememberedObject = {
      label: key,
      position: options.position ?? existing?.position ?? null,
      confidence: options.confidence ?? existing?.confidence ?? 1,
      lastSeen: options.now,
      hits: (existing?.hits ?? 0) + 1
    }

    this.objects.set(key, record)
    this.evict(options.now)
    return record
  }

  recall(label: string, now: number): RememberedObject | null {
    const record = this.objects.get(label.trim().toLowerCase())
    if (!record) return null
    if (now - record.lastSeen > this.forgetAfterMs) {
      this.objects.delete(record.label)
      return null
    }
    return record
  }

  /** Everything still remembered, most recently seen first. */
  list(now: number): RememberedObject[] {
    this.evict(now)
    return [...this.objects.values()].sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /** A one-line summary for injection into the model's context. */
  describe(now: number): string {
    const items = this.list(now)
    if (items.length === 0) return 'You have not seen anything yet.'
    return items
      .map((o) => (o.position ? `${o.label} (anchored)` : o.label))
      .join(', ')
  }

  clear(): void {
    this.objects.clear()
  }

  get size(): number {
    return this.objects.size
  }

  private evict(now: number): void {
    for (const [key, record] of this.objects) {
      if (now - record.lastSeen > this.forgetAfterMs) this.objects.delete(key)
    }
    while (this.objects.size > this.capacity) {
      let oldestKey: string | null = null
      let oldest = Infinity
      for (const [key, record] of this.objects) {
        if (record.lastSeen < oldest) {
          oldest = record.lastSeen
          oldestKey = key
        }
      }
      if (!oldestKey) break
      this.objects.delete(oldestKey)
    }
  }
}
