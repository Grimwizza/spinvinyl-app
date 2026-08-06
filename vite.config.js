import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { sentryVitePlugin } from '@sentry/vite-plugin'

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

  // Uploads source maps to Sentry so production stack traces resolve to real
  // source instead of minified output — only during a real production build,
  // and only if SENTRY_AUTH_TOKEN is actually set (missing-config degrades
  // gracefully here, same convention used everywhere else in this project;
  // a contributor without the token just gets a build with no source-map
  // upload, not a broken build). Must be listed last in `plugins` per
  // Sentry's own setup docs — it needs to see the final generated bundle.
  if (command === 'build' && process.env.SENTRY_AUTH_TOKEN) {
    plugins.push(sentryVitePlugin({
      org: 'lowhigh-llc',
      project: 'javascript-react',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        // Maps are uploaded to Sentry, then removed from dist/ so they're
        // never publicly servable from the deployed site.
        filesToDeleteAfterUpload: ['**/*.map'],
      },
    }));
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
      // Required for the Sentry plugin above to have anything to upload —
      // otherwise Vite never generates .map files at all.
      sourcemap: true,
    },
  }
})