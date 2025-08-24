/**
 * Performance monitoring for viseme system
 */
export interface VisemePerformanceMetrics {
  frameTime: number
  visemesProcessed: number
  sequenceLength: number
  updateTime: number
  rigApplyTime: number
}

export class VisemePerformanceMonitor {
  private metrics: VisemePerformanceMetrics[] = []
  private maxMetrics = 100
  private frameStartTime = 0

  startFrame() {
    this.frameStartTime = performance.now()
  }

  endFrame(visemesProcessed: number, sequenceLength: number, updateTime: number, rigApplyTime: number) {
    const frameTime = performance.now() - this.frameStartTime

    this.metrics.push({
      frameTime,
      visemesProcessed,
      sequenceLength,
      updateTime,
      rigApplyTime
    })

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // Log performance warnings
    if (frameTime > 16.67) {
      // 60fps threshold
      console.warn(`Viseme frame took ${frameTime.toFixed(2)}ms (target: <16.67ms)`)
    }
  }

  getAverageMetrics(): Partial<VisemePerformanceMetrics> {
    if (this.metrics.length === 0) return {}

    const totals = this.metrics.reduce(
      (acc, metric) => ({
        frameTime: acc.frameTime + metric.frameTime,
        visemesProcessed: acc.visemesProcessed + metric.visemesProcessed,
        sequenceLength: acc.sequenceLength + metric.sequenceLength,
        updateTime: acc.updateTime + metric.updateTime,
        rigApplyTime: acc.rigApplyTime + metric.rigApplyTime
      }),
      {
        frameTime: 0,
        visemesProcessed: 0,
        sequenceLength: 0,
        updateTime: 0,
        rigApplyTime: 0
      }
    )

    const count = this.metrics.length
    return {
      frameTime: totals.frameTime / count,
      visemesProcessed: totals.visemesProcessed / count,
      sequenceLength: totals.sequenceLength / count,
      updateTime: totals.updateTime / count,
      rigApplyTime: totals.rigApplyTime / count
    }
  }

  getLatestMetrics(): VisemePerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  reset() {
    this.metrics = []
  }
}

export const visemePerformanceMonitor = new VisemePerformanceMonitor()
