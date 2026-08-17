/**
 * CameraFeed — one getUserMedia path for every platform.
 *
 * On desktop/mobile this is the webcam; on Quest 3 the browser exposes the
 * passthrough camera through the same API (facingMode: 'environment'), so
 * the vision pipeline is identical in flat and AR modes.
 */
export class CameraFeed {
  constructor() {
    this.video = null;
    this.stream = null;
    this.starting = null;
  }

  get active() {
    return !!this.stream && this.video?.readyState >= 2;
  }

  async start({ width = 1280, height = 720 } = {}) {
    if (this.active) return this.video;
    if (this.starting) return this.starting;

    this.starting = (async () => {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = this.stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      await video.play();
      this.video = video;
      return video;
    })();

    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }

  /** Downscaled JPEG data URL of the current frame (for vision LLM chat). */
  captureFrame(maxSize = 768, quality = 0.8) {
    if (!this.active) return null;
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return null;

    const scale = Math.min(1, maxSize / Math.max(vw, vh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    canvas.getContext('2d').drawImage(this.video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
  }
}
