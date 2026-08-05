# SpinVinyl — Full-App Audit & Recommendations

_Compiled 2026-08-04 from a full-app functional debug (three parallel
audits covering Collection/scanning/account-sync, a live end-to-end pass
through the Explore tab, and Stats/lib/API health) plus the findings
synthesis below. This document is self-contained and should remain
useful as a reference across future sessions and models, independent of
any specific chat history._

## What this audit covered

Every major feature area was either live-tested (guest-accessible parts:
Explore's five sub-tabs, Shop Local's real geocode/Overpass search,
Upcoming Releases' real scrape) or code-reviewed plus curl-tested against
every API action with a fake session cookie (auth-gated parts: Collection,
Stats, scanning, account/sync — full live click-through wasn't possible
without real Discogs credentials). `npm run build` and a corrected
`npm run lint` were run clean against the whole codebase.

**Bugs found were fixed and verified in the same pass** (see commit
history around this date) — this doc is the forward-looking half: what's
still worth doing, given the app's actual intended use and audience.

## Who this app is for

Two audiences now, deliberately kept simple rather than social:

1. **Discogs-connected vinyl collectors** — the primary audience, mobile-first
   (this app is designed and tested primarily at 320–430px widths). They get
   collection browsing, scanning-to-add, spin tracking, stats, and
   collection-gap/wantlist tools.
2. **Browsing-only guests** (new as of this session) — people interested in
   vinyl/music news, upcoming releases, or finding a local record shop, with
   no Discogs account. Explore is their entire experience; Collection/Stats
   are visibly locked, not hidden.

The project has a stated design philosophy (see `docs/feature-recommendations.md`)
of staying a personal companion app, not a social platform — recommendations
below respect that; nothing here proposes multi-user/social features beyond
what's already flagged elsewhere as a deliberately-deferred idea.

---

## Speed

1. **Prefetch Upcoming Releases before the user taps that tab.** It's
   arguably the single most compelling piece of content for a first-time
   guest (personalized "new vinyl from artists you own"), but today it
   only starts fetching once `activeTab === 'newReleases'` — and a
   cold-cache scrape+enrich cycle can take several seconds
   (`REQUEST_BUDGET_MS` in `api/upcoming.js` budgets up to 6s). Kicking off
   that fetch as soon as `ReleasesPage` mounts (regardless of which tab is
   initially active) would mean it's often already warm by the time a
   guest clicks over.

2. **Shop Local search has no "still searching" messaging.** The live
   audit measured real Overpass API searches taking 4–8.7 seconds, shown
   only as a generic skeleton the whole time. A free public API's latency
   isn't something to fix directly, but a "Still searching nearby
   shops…" message after ~3s would keep a first-time guest from assuming
   it's broken and giving up.

3. **Cache the geocode step too, not just the shop search.** Shop Local's
   `search` action already has a 30-min cache; `geocode` (Nominatim) does
   not, so re-searching the same zip/city re-hits Nominatim's free,
   rate-limited service every time. A simple TTL cache keyed on the raw
   query string would cut load on a service this app doesn't control and
   speed up repeat searches.

4. **Main JS bundle is ~550KB (158KB gzipped) as a single chunk**
   (confirmed via `npm run build` output). Since guests and authenticated
   users now land on genuinely different primary pages (Explore vs.
   Collection), route-level code-splitting — lazy-loading `StatsPage`,
   `ReleasesPage`'s Leaflet-heavy Shop Local section, and
   `CollectionItemEditor`/`BarcodeScanner` behind `React.lazy()` — would
   shrink the initial payload for whichever landing experience a given
   visitor actually gets, rather than shipping all of it up front.

5. **`statsEngine.js` buckets every date by UTC calendar day**
   (`date.toISOString().slice(0,10)`), not local calendar day. For users
   west of UTC (the US), a spin logged in the evening can land on
   "tomorrow" by UTC, which can shift streaks and "this week" counts near
   local midnight. This is a correctness issue more than a speed one, but
   it's foundational — flagging here rather than fixing live because it
   touches core stats math and any change needs to consider existing
   stored data (a straight swap could cause a discontinuity in someone's
   real streak). Worth a deliberate pass with test coverage, not a quick
   patch.

## Functionality

1. **CSV export emits raw data structures, not readable text.**
   `dataExport.js`'s `toCollectionCsv` JSON-stringifies non-scalar fields
   (genre/style/format/label are stored as Discogs' native
   array-of-objects shapes), so exported cells look like
   `[{"name":"Vinyl","qty":"1"}]` instead of `Vinyl`. Functions correctly,
   just not friendly to open in a spreadsheet — worth a flattening pass
   (e.g. join genre/style arrays with `, `, extract just the `name` field
   from format/label objects) given "own your data" is an explicit
   feature pitch for this app.

2. **A locked tab is a dead end for guests today.** Complete Collection
   and Wantlist show a Lock icon and, on tap, only offer "Connect
   Discogs." Consider a lightweight sample/demo state behind the lock —
   even a single static example of what a completed-artist ring or a gap
   list looks like — so a guest can see the value before deciding to
   connect, rather than taking it on faith from a locked icon alone.

3. **Discogs rate-limit handling is reactive, not proactive.** The one
   central retry helper (`discogsRateLimitedFetch` in `api/discogs.js`)
   only backs off after actually hitting a 429; client-side throttling
   elsewhere is a patchwork of hand-placed `setTimeout` delays (150ms/300ms
   sleeps scattered through `ReleasesPage.jsx`'s gap-analysis and wantlist
   pagination loops). A single shared client-side rate-limiter/queue
   utility, used consistently everywhere the app calls Discogs, would be
   easier to reason about and tune than delays sprinkled per call site.

4. **No automated tests anywhere in the project.** Every bug found and
   fixed this session — the barcode-scanner race condition, the stuck
   guest loading state, the geocode wrong-country bug, the
   isGuestMode/session-expiry desync — was found by manual live testing,
   not caught earlier by any automated check, because there isn't one.
   Given how stateful some of this app's logic is (the scanner's
   multi-phase state machine, guest/auth mode transitions, incremental
   collection sync), even a small Playwright suite covering the handful
   of highest-value flows (guest landing, barcode scan happy-path, wantlist
   pagination) would catch regressions like these before they reach
   production instead of after.

## API

1. **Status-code inconsistency for missing configuration.**
   `api/collection-archive.js`, `api/sync.js`, and `api/lastfm.js` all
   return `503` when their required config (Supabase/Last.fm keys) is
   missing; `api/discogs.js` and `api/identify.js` return `500` for the
   same class of situation (missing Discogs/Anthropic keys). Both
   degrade to clean JSON either way — this is a consistency cleanup, not
   a functional bug — but worth aligning on `503` everywhere, since that's
   the more semantically correct code for "this feature isn't configured"
   versus "something broke."

2. **Per-release Discogs lookups aren't cached.** The album detail modal
   calls `action=release` fresh every time it's opened, even for a record
   the user has already viewed in the same session (re-opening a
   favorite record from search results re-fetches identical data). A
   short-TTL (a few minutes) in-memory or localStorage cache, mirroring
   the pattern already established for Complete Collection's per-artist
   masters cache, would cut redundant Discogs calls for a genuinely
   common interaction pattern (browsing back and forth in a session).

3. **`npm audit` reports 10 vulnerabilities** (1 low, 1 moderate, 8 high) —
   all in `undici` (a transitive dependency of `cheerio`, now vendored
   in `api/_vendor/entities/` for an unrelated bundling issue — see that
   directory's README for context) and `ws` (transitive via
   `@supabase/supabase-js`'s realtime client). `npm audit fix` (non-force)
   should resolve these without breaking changes; worth running and
   testing as a standalone follow-up rather than bundling with feature
   work.

## Other

1. **No error/exception monitoring in production.** `@vercel/analytics`
   tracks page views, but there's no equivalent for runtime errors. The
   `cheerio`/`entities` Vercel-bundling bug this session took six rounds
   of manual curl-based production debugging to fully diagnose and fix —
   a lightweight error tracker (e.g. Sentry's free tier, or even just
   forwarding `console.error` calls somewhere queryable) would have
   surfaced the exact stack trace on the very first failed deploy instead
   of needing that much live back-and-forth.

2. **`npm run lint` was silently checking almost nothing** (missing
   `--ext .js,.jsx`, so it only ever linted `.js` files — meaning nearly
   every React component in the app was never actually linted by the
   project's own lint command). Fixed this session, but worth adding a
   CI check (even a simple GitHub Action running `npm run build && npm
   run lint`) so a regression like that — or a build break — is caught
   automatically rather than discovered by accident during an unrelated
   audit.

3. **See also**: `docs/explore-stickiness-recommendations.md` (retention
   ideas: Weekly Recap and On This Day are already built; push
   notifications and a "community pulse" signal are scoped but
   deliberately not started) and `docs/feature-recommendations.md` (the
   original product-review doc — NFC tap-to-log, social features, and an
   in-app marketplace were all considered and explicitly deferred, for
   reasons still valid today).

## Priority if picking a next step

Given the audience (mobile-first personal companion, now with a guest
front door), the highest-leverage items here are: **prefetching Upcoming
Releases** (cheap, directly improves the first impression guests get),
**a small Playwright regression suite** (would have caught several of the
bugs fixed this session before they shipped), and **the CSV export
readability fix** (quick, and directly serves the app's own "own your
data" pitch). The UTC/local-timezone stats bucketing issue is the one
item here that's more involved than it looks and deserves dedicated
attention rather than a quick patch.
