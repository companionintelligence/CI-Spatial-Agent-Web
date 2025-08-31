import fs from 'fs'
import path from 'path'
import react from '@vitejs/plugin-react-swc'
import packageRoot from 'app-root-path'
import dotenv from 'dotenv'
import { defineConfig } from 'vite'

dotenv.config({
  path: packageRoot.path + '/.env.local'
})

export default defineConfig(({ command, mode }) => {
  const isLibraryMode = mode === 'library'
  
  if (isLibraryMode) {
    // Library build configuration
    return {
      plugins: [react()],
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'CIXRWeb',
          fileName: 'index',
          formats: ['es']
        },
        rollupOptions: {
          // Externalize React and other peer dependencies
          external: [
            'react',
            'react-dom',
            'three',
            '@pixiv/three-vrm',
            '@pixiv/three-vrm-animation',
            '@react-three/fiber',
            '@react-three/drei',
            '@react-three/xr',
            '@huggingface/transformers',
            '@mlc-ai/web-llm',
            '@ricky0123/vad-web',
            'ollama'
          ],
          output: {
            globals: {
              'react': 'React',
              'react-dom': 'ReactDOM',
              'three': 'THREE'
            }
          }
        },
        minify: false,
        sourcemap: true
      }
    }
  }

  // Development server configuration
  return {
    server: {
      host: true,
      ...(command === 'serve'
        ? {
            https: {
              key: fs.readFileSync(path.join(packageRoot.path, process.env.KEY || 'certs/key.pem')),
              cert: fs.readFileSync(path.join(packageRoot.path, process.env.CERT || 'certs/cert.pem'))
            }
          }
        : {})
    },
    plugins: [react()]
  }
})
