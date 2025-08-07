// Test setup file for vitest
import { vi } from 'vitest'

// Mock console warnings for cleaner test output
global.console.warn = vi.fn()
