// ─── Sentry Error Monitoring (frontend) ───────────────────────────
// No-ops entirely if VITE_SENTRY_DSN isn't set — same "missing config
// degrades gracefully" convention used everywhere else in this app
// (see e.g. supabaseAdmin() in api/collection-archive.js).
import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
    if (!DSN) return;
    Sentry.init({
        dsn: DSN,
        // Tags events so dev-time noise and production errors are
        // filterable within the same Sentry project, rather than mixed.
        environment: import.meta.env.MODE,
        // Tracing/session replay are off by default — this app only needs
        // plain error capture right now, and both features consume their
        // own separate Sentry quota beyond error events. Revisit if
        // performance monitoring becomes something worth paying for.
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    });
}

/** Reports an error to Sentry — a safe no-op if Sentry isn't configured. */
export function captureException(error, extra) {
    if (!DSN) return;
    Sentry.captureException(error, extra ? { extra } : undefined);
}
