// ─── Discogs Client-Side Rate Limiter ─────────────────────────────
// Discogs' documented authenticated rate limit is 60 requests/minute.
// Client code previously respected this with fixed per-call-site delays
// (150ms/300ms `setTimeout`s scattered across ReleasesPage.jsx) — simple,
// but a guess: under light use it waits when it didn't need to, and under
// a sustained burst (e.g. Complete Collection's "Show complete" scanning
// ~200 artists) sequential fetch-time + fixed-delay doesn't actually
// guarantee staying under the real limit.
//
// This tracks a rolling 60s window of actual call timestamps and only
// delays the next call by exactly as much as needed to stay under a
// safety-margined budget — a no-op most of the time, and adaptive under
// real bursts. `api/discogs.js`'s `discogsRateLimitedFetch` (reactive,
// retries with backoff on an actual 429) is the complementary safety net
// for this proactive half.

const WINDOW_MS = 60_000;
const SAFE_BUDGET = 50; // stay under Discogs' documented 60/min, with margin

let callTimestamps = [];

/**
 * Resolves once it's safe to make another Discogs call without exceeding
 * the rolling-window budget. Call immediately before each Discogs fetch —
 * resolves instantly unless the budget's actually been hit recently.
 */
export async function waitForDiscogsSlot() {
    const now = Date.now();
    callTimestamps = callTimestamps.filter(t => now - t < WINDOW_MS);

    if (callTimestamps.length >= SAFE_BUDGET) {
        const oldest = callTimestamps[0];
        const waitMs = WINDOW_MS - (now - oldest) + 50; // +50ms margin past the window edge
        await new Promise(r => setTimeout(r, Math.max(0, waitMs)));
        return waitForDiscogsSlot(); // re-check — another caller may have taken the freed slot
    }

    callTimestamps.push(now);
}

/** Convenience wrapper: waits for a slot, then runs `fetch` with the given args. */
export async function discogsFetch(url, options) {
    await waitForDiscogsSlot();
    return fetch(url, options);
}
