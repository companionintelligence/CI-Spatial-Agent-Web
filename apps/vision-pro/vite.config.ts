import react from '@vitejs/plugin-react'
import webspatial from '@webspatial/vite-plugin'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // SSL is optional for dev - Cloudflare tunnel handles HTTPS termination
    // Set VITE_USE_SSL=true if you need direct HTTPS access (e.g., for visionOS testing)
    // For production builds, SSL is typically handled by the hosting provider
    ...(process.env.VITE_USE_SSL === 'true' ? [basicSsl()] : []),
    // HTML plugin should come before webspatial to ensure template is processed first
    createHtmlPlugin({
      inject: {
        data: {
          XR_ENV: process.env.XR_ENV || ''
        }
      }
    }),
    react({
      jsxImportSource: "@webspatial/react-sdk",
    }
    ),
    webspatial(
      {
        outputDir:""
      }
    )
  ],
  server: {
    host: true, // This allows external connections
    port: 5174,
    allowedHosts: [
      '.webspatial.com', 
      'localhost', 
      '127.0.0.1',
      '0.0.0.0',
      '.companionintel.com',
      '.local' // For local network access
    ]
    // Note: Proxy removed - Cloudflare Tunnel handles API routing
    // For local development without tunnel, set VITE_LLM_OLLAMA_API_URL=http://localhost:11434
  }
})
