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
    port: 5173
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'three']
  }
})
