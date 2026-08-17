/**
 * Memory — what the companion remembers.
 *
 * Conversation: rolling window of chat messages (multimodal content is
 * collapsed to text when trimmed so old frames don't bloat the context).
 *
 * Spatial: object permanence for detections. Each label keeps its last
 * world-space position (when a hit test anchored it), bearing, confidence
 * and timestamp — this is what lets the agent answer "where is the cup?"
 * and walk_to('chair') after the detection overlay is long gone.
 */
export class Memory {
  constructor(config) {
    this.config = config;
    this.history = [];
    this.objects = new Map();   // label → { position|null, confidence, lastSeen, hits }
  }

  pushUser(content) {
    this.history.push({ role: 'user', content });
    this._trim();
  }

  pushAssistant(message) {
    this.history.push(message);
    this._trim();
  }

  pushToolResult(toolCallId, name, result) {
    this.history.push({
      role: 'tool',
      tool_call_id: toolCallId,
      name,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    });
  }

  getMessages() {
    return [...this.history];
  }

  _trim() {
    const limit = this.config.agent.historyLimit;
    while (this.history.length > limit) {
      const dropped = this.history.shift();
      // Never strand tool results without their assistant tool_calls message.
      while (dropped?.tool_calls && this.history[0]?.role === 'tool') {
        this.history.shift();
      }
    }
    // Collapse camera frames from earlier turns. The latest user message
    // keeps its image through the whole tool-call loop; only frames that
    // have a *later user message* (i.e. the turn completed) are collapsed.
    const lastUser = this.history.findLastIndex((m) => m.role === 'user');
    for (let i = 0; i < lastUser; i++) {
      const m = this.history[i];
      if (m.role === 'user' && Array.isArray(m.content)) {
        const text = m.content.find((c) => c.type === 'text')?.text ?? '';
        m.content = `${text} [camera frame was attached]`;
      }
    }
  }

  // ----- spatial memory -----

  rememberDetection(label, { position = null, confidence = 0, bearing = null } = {}) {
    const existing = this.objects.get(label);
    const entry = existing ?? { hits: 0 };
    entry.hits += 1;
    entry.confidence = Math.max(confidence, (existing?.confidence ?? 0) * 0.9);
    entry.lastSeen = Date.now();
    if (position) entry.position = position.clone();
    if (bearing !== null) entry.bearing = bearing;
    this.objects.set(label, entry);
    return !existing;   // true when this label is brand new
  }

  getObject(label) {
    const key = [...this.objects.keys()].find(
      (k) => k.toLowerCase() === label.toLowerCase()
        || k.toLowerCase().includes(label.toLowerCase()),
    );
    return key ? { label: key, ...this.objects.get(key) } : null;
  }

  /** Compact textual summary for the system prompt. */
  describeScene(userPos) {
    const now = Date.now();
    const items = [...this.objects.entries()]
      .filter(([, o]) => now - o.lastSeen < 5 * 60 * 1000)
      .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
      .slice(0, 12)
      .map(([label, o]) => {
        const age = Math.round((now - o.lastSeen) / 1000);
        let where = '';
        if (o.position && userPos) {
          const d = Math.hypot(o.position.x - userPos.x, o.position.z - userPos.z);
          where = ` ~${d.toFixed(1)}m away`;
        }
        return `${label}${where} (seen ${age}s ago)`;
      });
    return items.length ? items.join('; ') : 'nothing detected yet';
  }
}
