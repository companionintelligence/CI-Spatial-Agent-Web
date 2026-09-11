import { AIClient, userMessage } from './AIClient.js';
import { Memory } from './Memory.js';
import { ToolRegistry } from './ToolRegistry.js';

/**
 * Agent — the perceive → think → act loop.
 *
 * On each user utterance (voice or text) it builds a multimodal request
 * (optionally attaching the live camera frame), runs the tool-call loop
 * against the OpenAI-compatible backend, executes embodied tools (walk,
 * gesture, gaze, detection) and speaks the final reply with lip sync.
 *
 * Proactive mode: when perception reports a brand-new object class while
 * the agent is idle, it offers a short Astra-style comment (rate limited).
 */
export class Agent {
  constructor({ config, events, engine, character, locomotion, gaze, animation,
    speechOut, perception, memory }) {
    this.config = config;
    this.events = events;
    this.engine = engine;
    this.speechOut = speechOut;
    this.perception = perception;

    this.ai = new AIClient(config);
    this.memory = memory ?? new Memory(config);
    this.tools = new ToolRegistry({
      character, locomotion, gaze, animation, engine,
      speech: speechOut, perception, memory: this.memory,
    });

    this.state = 'idle';   // idle | thinking | speaking
    this._busy = false;
    this._abort = null;
    this._lastProactive = 0;

    events.on('stt-result', (text) => this.handleUtterance(text));
    events.on('novel-object', (label) => this._maybeProact(label));
  }

  _setState(state) {
    this.state = state;
    this.events.emit('agent-state', state);
  }

  /** Entry point for both voice and typed input. */
  async handleUtterance(text) {
    text = text?.trim();
    if (!text) return;
    if (this._busy) {
      // Barge-in: cancel the running turn and wait for it to drain so the
      // chat history never interleaves two turns' tool calls.
      this._abort?.abort();
      this.speechOut.stop();
      await this._turnPromise?.catch(() => {});
    }
    this.events.emit('chat', { role: 'user', text });

    const frame = this.config.vision.attachFrameToChat
      ? await this.perception?.captureFrame()
      : null;
    this.memory.pushUser(
      frame ? userMessage(text, frame).content : text,
    );

    this._turnPromise = this._think();
    await this._turnPromise;
  }

  async _think() {
    this._busy = true;
    this._abort = new AbortController();
    const signal = this._abort.signal;
    this._setState('thinking');

    try {
      const tools = this.tools.definitions();
      for (let round = 0; round < this.config.ai.maxToolRounds; round++) {
        const messages = [this._systemMessage(), ...this.memory.getMessages()];
        const { message } = await this.ai.chat(messages, tools, { signal });

        if (message.tool_calls?.length) {
          this.memory.pushAssistant({
            role: 'assistant',
            content: message.content ?? null,
            tool_calls: message.tool_calls,
          });
          // Voice any thinking-out-loud text that accompanied the calls.
          if (message.content?.trim()) this._speak(message.content);

          for (const call of message.tool_calls) {
            let args = {};
            try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* malformed */ }
            this.events.emit('agent-action', { tool: call.function.name, args });
            const result = await this.tools.execute(call.function.name, args);
            this.memory.pushToolResult(call.id, call.function.name, result);
          }
          continue;
        }

        const text = (message.content ?? '').trim();
        this.memory.pushAssistant({ role: 'assistant', content: text });
        if (text) {
          this.events.emit('chat', { role: 'assistant', text });
          this._setState('speaking');
          await this._speak(text);
        }
        break;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[Agent] turn failed:', err);
        this.events.emit('toast', `Agent error: ${err.message ?? err}`);
      }
    } finally {
      this._busy = false;
      this._abort = null;
      this._setState('idle');
    }
  }

  _speak(text) {
    return this.speechOut.speak(text).catch(() => {});
  }

  _systemMessage() {
    const cfg = this.config.agent;
    const persona = cfg.persona.replaceAll('{name}', cfg.name);
    const userPos = this.engine.getHeadPose();
    const scene = this.memory.describeScene(userPos);
    const mode = this.engine.presenting
      ? 'mixed reality — you appear in the user\'s real room'
      : 'a 3D scene on the user\'s screen';

    return {
      role: 'system',
      content:
        `${persona}\n\n` +
        `EMBODIMENT: You are rendered in ${mode}. You can physically act with tools: ` +
        'gesture, look_at, walk_to, detect_objects, say. Use them naturally — wave when greeting, ' +
        'walk to things you talk about, look at what the user mentions. Never describe an action ' +
        'in text instead of doing it with a tool.\n' +
        `SPATIAL MEMORY (recently seen): ${scene}.\n` +
        'If an image is attached to the user message, it is the live view from the user\'s camera ' +
        '— treat it as what you both are looking at right now.\n' +
        'Speak plainly: no markdown, no emoji, no stage directions.',
    };
  }

  async _maybeProact(label) {
    if (!this.config.agent.proactive || this._busy) return;
    const now = Date.now();
    if (now - this._lastProactive < this.config.agent.proactiveCooldownMs) return;
    this._lastProactive = now;

    this.memory.pushUser(
      `[spatial event — not the user speaking] A "${label}" just came into view for the first time. ` +
      'If it is interesting, make ONE short casual remark or ask a brief question about it. ' +
      'If it is mundane, reply with just: ...',
    );
    this._turnPromise = this._think();
    await this._turnPromise;
  }
}
