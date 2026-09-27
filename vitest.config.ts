import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vitest/config'

/**
 * Root Vitest config using the `projects` API (Vitest 4).
 *
 * Environment is selected by filename convention so it stays greppable and
 * avoids per-file `@vitest-environment` docblocks:
 *   - `*.node.test.ts`      → pure logic (three.js math runs fine in node)
 *   - `*.dom.test.{ts,tsx}` → jsdom + @testing-library/react component logic
 *
 * A third `proxy` project runs the BFF (apps/proxy) unit + integration tests, a
 * fourth `web-node` project covers app-level logic that lives outside
 * packages/core (apps/web/src/lib — the browser telemetry gate and scrubber),
 * and a fifth `nginx-node` project runs the container's config-rendering shell
 * script through `sh` and asserts what it emits.
 *
 * `resolve.dedupe` mirrors apps/web/vite.config.ts so a single React/three
 * instance is used under test.
 */
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', 'three']
  },
  test: {
    projects: [
      {
        // Transport-agnostic agent layer (packages/agent) — tools + spatial memory.
        test: {
          name: 'agent-node',
          environment: 'node',
          globals: true,
          include: ['packages/agent/src/**/*.node.test.ts']
        }
      },
      {
        // Renderer-free avatar engine (packages/engine) — pure arbitration logic.
        test: {
          name: 'engine-node',
          environment: 'node',
          globals: true,
          include: ['packages/engine/src/**/*.node.test.ts']
        }
      },
      {
        // Pure service logic — no DOM.
        test: {
          name: 'core-node',
          environment: 'node',
          globals: true,
          include: ['packages/core/src/**/*.node.test.ts']
        }
      },
      {
        // Component + browser-API logic — jsdom.
        plugins: [react()],
        resolve: { dedupe: ['react', 'react-dom', 'three'] },
        test: {
          name: 'core-dom',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['packages/core/src/**/*.dom.test.{ts,tsx}']
        }
      },
      {
        // Backend proxy (BFF).
        test: {
          name: 'proxy',
          environment: 'node',
          globals: true,
          include: ['apps/proxy/test/**/*.test.ts']
        }
      },
      {
        // App-level logic outside packages/core — the browser telemetry gate and
        // scrubber, which are node-testable pure functions plus a fetch gate.
        test: {
          name: 'web-node',
          environment: 'node',
          globals: true,
          include: ['apps/web/src/**/*.node.test.ts']
        }
      },
      {
        // The container entrypoint that renders /config.json from APP_* env. The
        // test shells out to the real script, so it covers the sh quoting rather
        // than a reimplementation of it.
        test: {
          name: 'nginx-node',
          environment: 'node',
          globals: true,
          include: ['nginx/**/*.node.test.ts']
        }
      }
    ]
  }
})
