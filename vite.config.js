import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  const plugins = [react()];
  if (command === 'serve') {
    const { apiMiddleware } = await import('./vite-api-proxy.js');
    plugins.push(apiMiddleware());
  }

  return {
    plugins,
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