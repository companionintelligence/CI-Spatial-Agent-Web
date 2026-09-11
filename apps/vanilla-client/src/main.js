/**
 * Thin entry point: paint the splash immediately, then lazy-load the engine
 * bundle (three.js + all systems live in async chunks — see vite.config.js).
 */
const status = document.getElementById('splash-status');

import { initTelemetry } from './telemetry.js';

initTelemetry();

import('./app.js')
  .then(({ boot }) => boot())
  .catch((err) => {
    console.error('[Boot] fatal:', err);
    if (status) {
      status.textContent = `Failed to start: ${err.message ?? err}`;
      status.style.color = '#ff6b6b';
    }
  });
