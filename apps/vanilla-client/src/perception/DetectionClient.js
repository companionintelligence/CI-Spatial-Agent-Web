/**
 * DetectionClient — WebSocket client for the bundled Grounding DINO server
 * (server/main.py). Open-vocabulary detection: send a JPEG frame + a
 * ' . '-separated prompt, receive normalized box centers with labels.
 *
 * Carried over from the original CI-Spatial-Companion-Web app, trimmed to
 * the transport concerns (auto-reconnect, request/response correlation).
 */
export class DetectionClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this._pending = new Map();
    this._requestId = 0;
    this.onStatusChange = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.serverUrl);
      } catch (err) {
        reject(err);
        return;
      }
      this.websocket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onStatusChange?.(true);
        resolve();
      };
      this.websocket.onmessage = (event) => this._handleMessage(event.data);
      this.websocket.onclose = () => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        if (wasConnected) this.onStatusChange?.(false);
        this._attemptReconnect();
      };
      this.websocket.onerror = (err) => reject(err);
    });
  }

  _handleMessage(data) {
    let response;
    try {
      response = JSON.parse(data);
    } catch {
      return;
    }
    const pending = this._pending.get(response.request_id);
    if (!pending) return;
    this._pending.delete(response.request_id);
    if (response.error) pending.reject(new Error(response.error));
    else pending.resolve(response);
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    setTimeout(() => this.connect().catch(() => { /* retry handled on close */ }),
      this.reconnectDelay);
  }

  /**
   * @param {HTMLVideoElement|HTMLCanvasElement} source
   * @returns {Promise<{detections: Array, inference_time_ms: number}>}
   */
  async detect(source, prompt, { boxThreshold = 0.35, textThreshold = 0.25, timeoutMs = 10000 } = {}) {
    if (!this.isConnected) throw new Error('Detection server not connected');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = source.videoWidth ?? source.width;
    canvas.height = source.videoHeight ?? source.height;
    ctx.drawImage(source, 0, 0);

    const request = {
      action: 'detect',
      image: canvas.toDataURL('image/jpeg', 0.85),
      prompt,
      box_threshold: boxThreshold,
      text_threshold: textThreshold,
      request_id: ++this._requestId,
    };

    return new Promise((resolve, reject) => {
      this._pending.set(request.request_id, { resolve, reject });
      this.websocket.send(JSON.stringify(request));
      setTimeout(() => {
        if (this._pending.has(request.request_id)) {
          this._pending.delete(request.request_id);
          reject(new Error('Detection request timeout'));
        }
      }, timeoutMs);
    });
  }

  disconnect() {
    this.maxReconnectAttempts = 0;
    this.websocket?.close();
    this.websocket = null;
    this.isConnected = false;
  }
}
