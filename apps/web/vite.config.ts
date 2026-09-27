import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    ...(process.env.VITE_USE_SSL === 'true' ? [basicSsl()] : []),
    react()
  ],
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Same-origin BFF in dev: forward /api to the local proxy (pnpm dev:proxy).
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'three']
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // @pixiv/three-vrm's MToonNodeMaterial keeps a runtime-guarded `FnCompat`
        // helper that calls three's pre-r168 `tslFn` only when REVISION < 168, and
        // three's r168+ `Fn` otherwise. We ship three 0.182, so the `tslFn` branch is
        // dead code and works at runtime — but Rollup's static analysis still flags
        // "tslFn is not exported by three.webgpu.js" (code: MISSING_EXPORT). Suppress
        // just that one false positive; let every other warning through.
        if (
          warning.code === 'MISSING_EXPORT' &&
          warning.message.includes('tslFn') &&
          warning.message.includes('three.webgpu')
        ) {
          return
        }
        warn(warning)
      },
      output: {
        // Split stable, rarely-changing vendor code into its own chunks so app
        // code changes don't bust the (large) three.js/vrm/postfx download on
        // every deploy, and so the browser can cache them independently.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/') || id.includes('three-mesh-bvh')) return 'vendor-three'
          if (id.includes('@react-three/fiber') || id.includes('@react-three/drei')) return 'vendor-r3f'
          if (id.includes('@pixiv/three-vrm')) return 'vendor-vrm'
          if (id.includes('/postprocessing/')) return 'vendor-postfx'
        }
      }
    }
  }
})
