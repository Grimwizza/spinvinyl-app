import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  const plugins = [react()];

  // Only load the API dev proxy during `vite dev` — not during `vite build`.
  // The path is computed at runtime so esbuild cannot statically follow the
  // import chain (which pulls in cheerio → dom-serializer → entities).
  if (command === 'serve') {
    const proxyPath = resolve(process.cwd(), 'vite-api-proxy.js');
    const { apiMiddleware } = await import(proxyPath);
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