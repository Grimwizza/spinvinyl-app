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
      chunkSizeWarningLimit: 1000,
    },
  }
})