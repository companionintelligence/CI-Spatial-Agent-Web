import { describe, expect, it, vi } from 'vitest'

import { ToolRegistry } from './toolRegistry'

describe('ToolRegistry', () => {
  it('advertises only the tools the host can actually perform', () => {
    const registry = new ToolRegistry({ say: () => 'ok' })
    expect(registry.definitions().map((d) => d.function.name)).toEqual(['say'])
  })

  it('executes a handler and returns its string', async () => {
    const registry = new ToolRegistry({ say: ({ text }) => `said "${text}"` })
    expect(await registry.execute('say', { text: 'hello' })).toBe('said "hello"')
  })

  it('parses JSON-string arguments, which is how models send them', async () => {
    const registry = new ToolRegistry({ say: ({ text }) => text })
    expect(await registry.execute('say', '{"text":"hi"}')).toBe('hi')
  })

  it('reports a tool the host does not support instead of throwing', async () => {
    // Feeding the failure back into the loop lets the model recover; throwing
    // would kill the turn and the user would just see silence.
    const registry = new ToolRegistry({})
    expect(await registry.execute('walk_to', { target: 'user' })).toMatch(/No such tool/)
  })

  it('reports unparseable arguments', async () => {
    const registry = new ToolRegistry({ say: () => 'ok' })
    expect(await registry.execute('say', '{not json')).toMatch(/Could not parse/)
  })

  it('rejects an invalid gesture by naming the valid ones', async () => {
    const registry = new ToolRegistry({ gesture: () => 'ok' })
    const result = await registry.execute('gesture', { name: 'moonwalk' })
    expect(result).toMatch(/wave/)
  })

  it('rejects an empty say', async () => {
    const registry = new ToolRegistry({ say: () => 'ok' })
    expect(await registry.execute('say', { text: '   ' })).toMatch(/non-empty/)
  })

  it('rejects a non-numeric walk_to distance', async () => {
    const registry = new ToolRegistry({ walk_to: () => 'ok' })
    expect(await registry.execute('walk_to', { target: 'user', distance: 'far' })).toMatch(/metres/)
  })

  it('allows walk_to without a distance', async () => {
    const registry = new ToolRegistry({ walk_to: () => 'walked' })
    expect(await registry.execute('walk_to', { target: 'user' })).toBe('walked')
  })

  it('turns a throwing handler into a tool result, not a crash', async () => {
    const registry = new ToolRegistry({
      detect_objects: () => {
        throw new Error('camera busy')
      }
    })
    expect(await registry.execute('detect_objects', {})).toBe('detect_objects failed: camera busy')
  })

  it('awaits async handlers', async () => {
    const handler = vi.fn(async () => 'done')
    expect(await new ToolRegistry({ look_at: handler }).execute('look_at', { target: 'user' })).toBe('done')
  })
})
