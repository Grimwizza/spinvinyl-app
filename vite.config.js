import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { apiMiddleware } from './vite-api-proxy.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiMiddleware()],
    server: {
      watch: {
        usePolling: true,
      },
    },
    build: {
      chunkSizeWarningLimit: 1000, // Increase from default 500kb to 1000kb
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor code into separate chunks for better caching
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['framer-motion', 'lucide-react'],
            'map-vendor': ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
            'chart-vendor': ['recharts'],
          },
        },
      },
    },
  }
})