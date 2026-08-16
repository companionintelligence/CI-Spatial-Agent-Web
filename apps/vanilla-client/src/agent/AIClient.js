/**
 * AIClient — minimal OpenAI-compatible chat client.
 *
 * Works against any /v1/chat/completions implementation: the Companion
 * Intelligence on-prem server, Ollama, llama.cpp, vLLM, OpenAI, or an
 * Anthropic-compatible gateway. Supports tool calling and multimodal
 * messages (image_url data URLs for camera frames).
 */
export class AIClient {
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {Array} messages OpenAI-format messages
   * @param {Array} [tools] OpenAI tool definitions
   * @returns {Promise<{message: object, finishReason: string}>}
   */
  async chat(messages, tools = undefined, { signal } = {}) {
    const { ai } = this.config;
    const body = {
      model: ai.model,
      messages,
      temperature: ai.temperature,
      max_tokens: ai.maxTokens,
      stream: false,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI backend HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice?.message) throw new Error('AI backend returned no choices');
    return { message: choice.message, finishReason: choice.finish_reason ?? 'stop' };
  }
}

/** Build a user message, optionally with an attached camera frame. */
export function userMessage(text, imageDataUrl = null) {
  if (!imageDataUrl) return { role: 'user', content: text };
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  };
}
