import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultLLMConfig } from '../services/llm/config/llmConfig'
import {
  LLM_OVERRIDES_KEY,
  clearLocalOverrides,
  readLocalOverrides,
  resolveLLMConfig,
  writeLocalOverrides
} from './appConfigService'

beforeEach(() => {
  localStorage.clear()
})

describe('resolveLLMConfig precedence', () => {
  it('returns the build-time defaults when nothing else is set', () => {
    expect(resolveLLMConfig()).toEqual(defaultLLMConfig)
  })

  it('lets runtime config override the defaults', () => {
    const resolved = resolveLLMConfig({ llm: { ollama_url: 'http://runtime:11434' } })
    expect(resolved.ollama_url).toBe('http://runtime:11434')
  })

  it('lets localStorage overrides win over runtime config', () => {
    writeLocalOverrides({ ollama_model: 'phi3:3.8b' })
    const resolved = resolveLLMConfig({ llm: { ollama_model: 'gemma3:1b' } })
    expect(resolved.ollama_model).toBe('phi3:3.8b')
  })

  it('does not let an empty runtime value blank out a good default', () => {
    // default ollama_model is a non-empty string; an empty runtime value is ignored.
    const resolved = resolveLLMConfig({ llm: { ollama_model: '' } })
    expect(resolved.ollama_model).toBe(defaultLLMConfig.ollama_model)
  })
})

describe('local overrides storage', () => {
  it('merges successive writes rather than replacing', () => {
    writeLocalOverrides({ ollama_url: 'http://a' })
    writeLocalOverrides({ ollama_model: 'llama3.1:8b' })
    expect(readLocalOverrides()).toEqual({ ollama_url: 'http://a', ollama_model: 'llama3.1:8b' })
  })

  it('clears overrides on reset', () => {
    writeLocalOverrides({ ollama_url: 'http://a' })
    clearLocalOverrides()
    expect(readLocalOverrides()).toEqual({})
  })

  it('falls back to {} on corrupt storage without throwing', () => {
    localStorage.setItem(LLM_OVERRIDES_KEY, '{not json')
    expect(readLocalOverrides()).toEqual({})
  })
})

describe('when storage cannot be used', () => {
  const denied = () => {
    throw new DOMException(
      "Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.",
      'SecurityError'
    )
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // A sandboxed document, or a profile that blocks site data: reading `localStorage` itself throws.
  // `typeof localStorage` does not protect against that, and the app used to start from this call.
  it('resolves the defaults when reading localStorage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(denied)

    expect(readLocalOverrides()).toEqual({})
    expect(resolveLLMConfig()).toEqual(defaultLLMConfig)
  })

  it('still returns the merged settings, and does not throw, when the write or the clear is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied)

    expect(writeLocalOverrides({ ollama_model: 'phi3:3.8b' })).toEqual({ ollama_model: 'phi3:3.8b' })
    expect(() => clearLocalOverrides()).not.toThrow()
  })

  it('does not throw from a write or a clear when localStorage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(denied)

    expect(writeLocalOverrides({ ollama_model: 'phi3:3.8b' })).toEqual({ ollama_model: 'phi3:3.8b' })
    expect(() => clearLocalOverrides()).not.toThrow()
  })
})
