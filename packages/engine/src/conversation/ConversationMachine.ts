/**
 * ConversationMachine — one explicit machine for "what is the companion doing".
 *
 * WHY
 * ---
 * The conversation's state was spread across booleans in `useAgent`
 * (`isProcessing`, `isSpeaking`, `isListening`, an abort controller's liveness)
 * plus a `ConversationStatusState` store written from several places. Nothing
 * described which combinations were legal, so illegal ones happened:
 *
 *   - a dead AnalyserNode kept `isSpeaking` true after playback ended, and the
 *     jaw hung open (fixed by hand in Phase 1);
 *   - barge-in left an expression frozen because the speech layer was never
 *     told the utterance had ended (fixed by hand in Phase 1);
 *   - an utterance that errored mid-flight left the UI "thinking" forever.
 *
 * Each was fixed where it was found. None of them could have occurred if the
 * transitions were declared in one place and everything else read from it.
 *
 * DLP3D — the comparable system — runs an explicit FSM with 22 states and 24
 * conditions. That is the right shape. This is the same idea sized to our
 * product: the states a *conversation* can be in, not the states an application
 * lifecycle can be in.
 *
 * DESIGN
 * ------
 * Transitions are a total function of (state, event). An event that is not legal
 * in the current state is IGNORED and counted, never thrown — a UI event arriving
 * one frame late must not crash a render loop. The counter is what a test (or the
 * debug overlay) asserts on, so "we silently dropped 400 events" is visible
 * rather than invisible.
 */

export type ConversationState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'failed'

export type ConversationEvent =
  | 'MIC_OPENED'
  | 'SPEECH_DETECTED'
  | 'MIC_CLOSED'
  | 'USER_SUBMITTED'
  | 'RESPONSE_STARTED'
  | 'AUDIO_STARTED'
  | 'AUDIO_ENDED'
  | 'BARGE_IN'
  | 'ABORTED'
  | 'FAILED'
  | 'RECOVERED'
  | 'RESET'

/**
 * The legal moves.
 *
 * Read this table as the specification. If a behaviour is not expressible here,
 * the behaviour is wrong, not the table.
 */
const TRANSITIONS: Record<ConversationState, Partial<Record<ConversationEvent, ConversationState>>> = {
  idle: {
    MIC_OPENED: 'listening',
    USER_SUBMITTED: 'thinking',
    FAILED: 'failed',
    RESET: 'idle'
  },
  listening: {
    SPEECH_DETECTED: 'listening',
    USER_SUBMITTED: 'thinking',
    MIC_CLOSED: 'idle',
    ABORTED: 'idle',
    FAILED: 'failed',
    RESET: 'idle'
  },
  thinking: {
    RESPONSE_STARTED: 'thinking',
    AUDIO_STARTED: 'speaking',
    // A reply with no audio (TTS off, or a silent install) still completes.
    AUDIO_ENDED: 'idle',
    BARGE_IN: 'interrupted',
    ABORTED: 'interrupted',
    FAILED: 'failed',
    RESET: 'idle'
  },
  speaking: {
    // Sentence-chunked TTS starts several clips inside one turn.
    AUDIO_STARTED: 'speaking',
    AUDIO_ENDED: 'idle',
    BARGE_IN: 'interrupted',
    ABORTED: 'interrupted',
    FAILED: 'failed',
    RESET: 'idle'
  },
  interrupted: {
    // Interruption is a settling state, not a resting one: the audio graph and
    // the face's speech layer both need an explicit release before the next turn,
    // and skipping it is exactly what froze an expression mid-word.
    AUDIO_ENDED: 'idle',
    MIC_OPENED: 'listening',
    USER_SUBMITTED: 'thinking',
    ABORTED: 'idle',
    RESET: 'idle',
    FAILED: 'failed'
  },
  failed: {
    RECOVERED: 'idle',
    RESET: 'idle',
    USER_SUBMITTED: 'thinking',
    MIC_OPENED: 'listening'
  }
}

/** States in which the avatar's mouth should be driven by speech. */
const SPEAKING_STATES: ReadonlySet<ConversationState> = new Set<ConversationState>(['speaking'])

/** States in which a new user utterance may begin without an explicit reset. */
const ACCEPTS_INPUT: ReadonlySet<ConversationState> = new Set<ConversationState>([
  'idle',
  'listening',
  'interrupted',
  'failed'
])

export interface ConversationSnapshot {
  state: ConversationState
  /** Monotonic; increments on every ACCEPTED transition, including self-transitions. */
  revision: number
  /** Events dropped as illegal for the state they arrived in. */
  ignored: number
}

export type ConversationListener = (snapshot: ConversationSnapshot) => void

export class ConversationMachine {
  private state: ConversationState = 'idle'
  private revision = 0
  private ignored = 0
  private readonly listeners = new Set<ConversationListener>()

  get current(): ConversationState {
    return this.state
  }

  get snapshot(): ConversationSnapshot {
    return { state: this.state, revision: this.revision, ignored: this.ignored }
  }

  /** True while speech should own the mouth. */
  get isSpeaking(): boolean {
    return SPEAKING_STATES.has(this.state)
  }

  /** True when a new user turn may start. */
  get acceptsInput(): boolean {
    return ACCEPTS_INPUT.has(this.state)
  }

  /**
   * Apply an event. Returns the state after applying it — unchanged if the event
   * was not legal here.
   */
  send(event: ConversationEvent): ConversationState {
    const next = TRANSITIONS[this.state][event]
    if (next === undefined) {
      this.ignored++
      return this.state
    }
    this.state = next
    this.revision++
    const snap = this.snapshot
    for (const l of this.listeners) l(snap)
    return this.state
  }

  /** Would this event be accepted right now? Lets a caller avoid a no-op path. */
  accepts(event: ConversationEvent): boolean {
    return TRANSITIONS[this.state][event] !== undefined
  }

  subscribe(listener: ConversationListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Return to `idle` and forget the counters. For tests and hard resets. */
  reset(): void {
    this.state = 'idle'
    this.revision = 0
    this.ignored = 0
  }
}

/**
 * Map machine state onto the five-value status the avatar and the pill consume.
 *
 * `interrupted` and `failed` both present as `idle`: the avatar should look
 * settled and available, not stuck in a pose that says something is still
 * happening. The distinction still matters internally, which is why the machine
 * keeps them apart and only flattens them here.
 */
export function toDisplayStatus(
  state: ConversationState
): 'loading' | 'idle' | 'listening' | 'thinking' | 'speaking' {
  switch (state) {
    case 'listening':
      return 'listening'
    case 'thinking':
      return 'thinking'
    case 'speaking':
      return 'speaking'
    default:
      return 'idle'
  }
}
