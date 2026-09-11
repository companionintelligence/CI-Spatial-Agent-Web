import * as THREE from 'three/webgpu';

/**
 * ToolRegistry — the agent's body and senses as OpenAI tool definitions.
 *
 * say / gesture / look_at / walk_to / come_here / detect_objects. Execution
 * is wired to the character controllers and the perception system; results
 * are strings fed back into the tool-call loop.
 */
export class ToolRegistry {
  /**
   * @param {object} deps { character, locomotion, gaze, animation, speech,
   *                        perception, memory, engine }
   */
  constructor(deps) {
    this.deps = deps;
  }

  definitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'say',
          description:
            'Speak a line out loud immediately. Use for interjections before slow actions; '
            + 'your final plain-text reply is also spoken automatically.',
          parameters: {
            type: 'object',
            properties: { text: { type: 'string', description: 'What to say.' } },
            required: ['text'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'gesture',
          description: 'Play a body gesture.',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                enum: ['wave', 'nod', 'shake', 'point', 'celebrate', 'think'],
              },
            },
            required: ['name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'look_at',
          description: 'Turn your gaze toward the user or a remembered object.',
          parameters: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: "'user' or an object label from your spatial memory (e.g. 'chair').",
              },
            },
            required: ['target'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'walk_to',
          description: 'Walk somewhere in the room. Takes a few seconds.',
          parameters: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description:
                  "'user' (approach the user), an object label from spatial memory, "
                  + "or 'wander' (a random nearby spot).",
              },
            },
            required: ['target'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'detect_objects',
          description:
            'Run the object detector on the current camera view. Returns labels with '
            + 'confidence and rough direction. Use when asked what is around.',
          parameters: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description:
                  "Optional ' . '-separated noun phrases to look for (open vocabulary).",
              },
            },
          },
        },
      },
    ];
  }

  /** Execute one tool call; always resolves to a result string. */
  async execute(name, args) {
    try {
      switch (name) {
        case 'say':
          return this._say(args.text);
        case 'gesture':
          return this._gesture(args.name);
        case 'look_at':
          return this._lookAt(args.target);
        case 'walk_to':
          return this._walkTo(args.target);
        case 'detect_objects':
          return this._detect(args.prompt);
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (err) {
      return `Tool ${name} failed: ${err.message ?? err}`;
    }
  }

  async _say(text) {
    if (!text) return 'Nothing to say.';
    await this.deps.speech.speak(text);
    return 'Said it.';
  }

  _gesture(name) {
    this.deps.animation.playGesture(name);
    return `Playing ${name} gesture.`;
  }

  _resolveTarget(target) {
    const { memory, engine, locomotion } = this.deps;
    const t = (target ?? 'user').toLowerCase().trim();
    if (t === 'user' || t === 'me' || t === 'you') {
      return { position: engine.getHeadPose(new THREE.Vector3()), label: 'user' };
    }
    if (t === 'wander' || t === 'random' || t === 'around') {
      const angle = Math.random() * Math.PI * 2;
      const r = locomotion.wanderRadius * (0.4 + Math.random() * 0.6);
      return {
        position: new THREE.Vector3(
          locomotion.home.x + Math.cos(angle) * r,
          0,
          locomotion.home.z + Math.sin(angle) * r,
        ),
        label: 'a nearby spot',
      };
    }
    const obj = this.deps.memory.getObject(t);
    if (obj?.position) return { position: obj.position.clone(), label: obj.label };
    if (obj) return { error: `I remember seeing a ${obj.label} but never anchored its position.` };
    return { error: `No '${target}' in my spatial memory. Try detect_objects first.` };
  }

  _lookAt(target) {
    const resolved = this._resolveTarget(target);
    if (resolved.error) return resolved.error;
    if (resolved.label === 'user') {
      this.deps.gaze.clearOverride();
      return 'Looking at the user.';
    }
    this.deps.gaze.lookAt(resolved.position, 6000);
    return `Looking at the ${resolved.label}.`;
  }

  async _walkTo(target) {
    const resolved = this._resolveTarget(target);
    if (resolved.error) return resolved.error;
    const arrived = await this.deps.locomotion.walkTo(resolved.position);
    return arrived
      ? `Arrived at ${resolved.label}.`
      : `Walk to ${resolved.label} was interrupted.`;
  }

  async _detect(prompt) {
    const { perception } = this.deps;
    if (!perception?.detectionAvailable) {
      return 'Object detector is offline. Describe the attached camera frame instead.';
    }
    const detections = await perception.detectNow(prompt);
    if (!detections.length) return 'No objects detected in the current view.';
    return JSON.stringify(
      detections.map((d) => ({
        label: d.label,
        confidence: Math.round(d.confidence * 100) / 100,
        direction: d.direction,
      })),
    );
  }
}
