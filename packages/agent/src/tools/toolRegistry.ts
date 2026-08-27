/**
 * toolRegistry.ts — the companion's body and senses, as LLM tools.
 *
 * Absorbed from CI-Spatial-Agent-Web-2, where the agent could already act:
 * speak, gesture, look at something, walk somewhere, and look around. The React
 * client can only talk — `ChatMessage` is text-only end to end — so a user can
 * ask it to come closer and the best it can do is describe doing so.
 *
 * Deliberately transport-agnostic and renderer-free: definitions are plain JSON
 * schema, execution goes through a handler map the host supplies. That is what
 * lets the same registry serve the r3f client, the BFF, and a test.
 */

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export type ToolName = 'say' | 'gesture' | 'look_at' | 'walk_to' | 'detect_objects'

export const GESTURES = ['wave', 'nod', 'shake', 'point', 'celebrate', 'think'] as const
export type GestureName = (typeof GESTURES)[number]

export interface ToolHandlers {
  say?(args: { text: string }): Promise<string> | string
  gesture?(args: { name: GestureName }): Promise<string> | string
  look_at?(args: { target: string }): Promise<string> | string
  walk_to?(args: { target: string; distance?: number }): Promise<string> | string
  detect_objects?(args: { query?: string }): Promise<string> | string
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'say',
      description:
        'Speak a line out loud immediately. Use for interjections before a slow action; your ' +
        'final plain-text reply is spoken automatically, so do not repeat it here.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'What to say.' } },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'gesture',
      description: 'Play a body gesture.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', enum: [...GESTURES] } },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'look_at',
      description: 'Turn your gaze toward the user or a remembered object.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: '"user", or the label of a remembered object.' }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'walk_to',
      description: 'Walk to the user or a remembered object, stopping a polite distance away.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: '"user", or the label of a remembered object.' },
          distance: { type: 'number', description: 'Metres to stop short. Defaults to 1.' }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'detect_objects',
      description: 'Look around and report what you can see right now.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional thing to look for specifically.' }
        }
      }
    }
  }
]

export class ToolRegistry {
  constructor(private readonly handlers: ToolHandlers) {}

  /** Only the tools this host can actually perform. */
  definitions(): ToolDefinition[] {
    return TOOL_DEFINITIONS.filter((d) => this.handlers[d.function.name as ToolName])
  }

  supports(name: string): boolean {
    return Boolean(this.handlers[name as ToolName])
  }

  /**
   * Run a tool call and return a string for the tool-result message.
   *
   * Never throws. A model that calls a tool with bad arguments, or one the host
   * cannot perform, gets a plain description of what went wrong fed back into
   * the loop — which it can recover from. An exception here would take down the
   * turn instead, and the user would just see the companion go silent.
   */
  async execute(name: string, rawArgs: unknown): Promise<string> {
    const handler = this.handlers[name as ToolName]
    if (!handler) return `No such tool: ${name}.`

    let args: Record<string, unknown>
    try {
      args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : ((rawArgs ?? {}) as Record<string, unknown>)
    } catch {
      return `Could not parse arguments for ${name}.`
    }

    const invalid = validate(name as ToolName, args)
    if (invalid) return invalid

    try {
      return await (handler as (a: unknown) => Promise<string> | string)(args)
    } catch (err) {
      return `${name} failed: ${(err as Error).message}`
    }
  }
}

function validate(name: ToolName, args: Record<string, unknown>): string | null {
  switch (name) {
    case 'say':
      return typeof args.text === 'string' && args.text.trim() ? null : 'say requires a non-empty `text`.'
    case 'gesture':
      return GESTURES.includes(args.name as GestureName)
        ? null
        : `gesture requires one of: ${GESTURES.join(', ')}.`
    case 'look_at':
      return typeof args.target === 'string' && args.target.trim()
        ? null
        : 'look_at requires a `target`.'
    case 'walk_to':
      if (typeof args.target !== 'string' || !args.target.trim()) return 'walk_to requires a `target`.'
      if (args.distance !== undefined && (typeof args.distance !== 'number' || !Number.isFinite(args.distance))) {
        return 'walk_to `distance` must be a number of metres.'
      }
      return null
    case 'detect_objects':
      return args.query === undefined || typeof args.query === 'string'
        ? null
        : 'detect_objects `query` must be a string.'
    default:
      return null
  }
}
