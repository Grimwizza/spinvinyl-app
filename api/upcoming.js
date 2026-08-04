// ─── Upcoming Vinyl Scraper + Server-Side Enrichment ─────────────────────────
// Primary: scrapes https://upcomingvinyl.com/featured
// Fallback: Discogs popular new vinyl (year=current/next) if scraper returns 0
//
// Cache strategy (dual-layer):
//   1. Module-level in-memory object — zero-latency for warm container hits
//   2. /tmp file — survives container restarts within the same Vercel instance
//
// Discogs ToS: content must not be displayed if >6 hours stale (TTL = 6h).
// Enrichment calls use app-level auth (consumer key/secret) — no user token needed.

import { readFile, writeFile } from 'fs/promises';
import { createRequire, Module } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

// Load cheerio via CJS require(), not ESM import() — see the long comment
// on scrapeHTML() below for why. `require` isn't natively available here
// since package.json sets "type": "module", so it's constructed manually.
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// See api/_vendor/entities/README.md for full context. Vercel's function
// bundler drops files from node_modules/entities/lib/ in the deployed
// bundle — confirmed to affect multiple different files across several
// rounds of debugging (first lib/generated/decode-data-html.js, then
// lib/escape.js once that gap was patched around), regardless of
// vercel.json includeFiles config (confirmed ineffective twice, for any
// target, via fresh production-request tests). Rather than continuing to
// patch individual missing files one at a time as they keep surfacing,
// the entire entities package is vendored into api/_vendor/entities/.
//
// This patches Module._resolveFilename (not the require *cache* — a first,
// narrower attempt at that provably didn't work, since Node resolves a
// request to an absolute path, which requires the file to exist on disk,
// BEFORE ever consulting the cache; a missing file throws during
// resolution, so a pre-populated cache entry for that path is never
// reached). It always tries real resolution first — so this is a complete
// no-op the moment Vercel's bundling is ever fixed — and only falls back
// to the equivalent file in the vendored copy when resolution fails for a
// request originating from somewhere inside the real entities package.
let entitiesResolutionPatched = false;
function patchEntitiesGeneratedResolution() {
    if (entitiesResolutionPatched) return;
    entitiesResolutionPatched = true;
    try {
        // entities' own package.json "exports" map blocks direct subpath
        // access to "./package.json", so the root is derived from the main
        // entry (lib/index.js) instead: strip the filename and one "lib"
        // directory level.
        const entitiesRoot = path.dirname(path.dirname(require.resolve('entities')));
        const vendorRoot = path.join(__dirname, '_vendor', 'entities');
        const originalResolveFilename = Module._resolveFilename;
        Module._resolveFilename = function (request, parent, ...rest) {
            try {
                return originalResolveFilename.call(this, request, parent, ...rest);
            } catch (err) {
                const parentFilename = parent?.filename;
                if (parentFilename && parentFilename.startsWith(entitiesRoot + path.sep)) {
                    const parentRelDir = path.relative(entitiesRoot, path.dirname(parentFilename));
                    return path.join(vendorRoot, parentRelDir, request);
                }
                throw err;
            }
        };
    } catch (err) {
        // Best-effort — if this fails, cheerio's own require() below throws
        // its normal (already-handled) error and we fall through to the
        // Discogs fallback exactly as before.
        console.warn('[Upcoming Vinyl] entities resolution patch failed:', err.message);
    }
}

const UPCOMING_URL = 'https://upcomingvinyl.com/featured';
const DISCOGS_SEARCH = 'https://api.discogs.com/database/search';
const USER_AGENT = 'SpinVinyl/1.0 +https://spinvinyl.app';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — Discogs ToS maximum
const EMPTY_RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — don't let a transient scrape/fallback failure poison the cache for hours
const CACHE_FILE = '/tmp/spinvinyl_upcoming_enriched.json';
const ENRICH_LIMIT = 40;    // max releases to enrich per cycle
const BATCH_SIZE = 5;       // parallel Discogs calls per batch
const BATCH_DELAY_MS = 400; // pause between batches (respects ~25 req/min app-auth limit)
// Overall wall-clock budget for a cold-cache request (scrape + enrich combined),
// measured from requestStart. Vercel serverless functions have a hard execution
// ceiling (10s on the Hobby tier) — the old unbounded design (scrape up to 10s,
// then up to 8 enrichment batches at up to 6s each) could reach 50s+ worst case,
// which reliably times out in production whenever the cache is cold, even though
// it looks fine locally where a long-lived dev server keeps the cache warm.
// Once this budget is exceeded, enrichment stops starting new batches and the
// request returns whatever's already enriched plus the rest un-enriched —
// degraded results beat a hard failure.
const REQUEST_BUDGET_MS = 6000;

// ─── In-memory cache (warm-container fast path) ───────────────────────────────
let memCache = null; // { data: [...], fetchedAt: ISO string, fallback?: boolean }

const isFresh = (payload) =>
    payload?.fetchedAt && (Date.now() - new Date(payload.fetchedAt).getTime()) < (payload.ttlMs ?? CACHE_TTL_MS);

// ─── /tmp file cache (survives container restarts) ────────────────────────────
async function readFileCache() {
    try {
        const raw = await readFile(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (isFresh(parsed)) return parsed;
    } catch { /* miss */ }
    return null;
}

async function writeFileCache(payload) {
    try {
        await writeFile(CACHE_FILE, JSON.stringify(payload));
    } catch { /* non-fatal — in-memory cache still works */ }
}

// ─── Discogs app-level auth header ───────────────────────────────────────────
const discogsAuth = () =>
    `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`;

// ─── Enrich a single release with Discogs artwork + genres ───────────────────
async function enrichOne(release) {
    try {
        const q = release.artist
            ? `${release.artist} ${release.title}`
            : release.title || release.raw;
        const url = `${DISCOGS_SEARCH}?q=${encodeURIComponent(q)}&type=release&format=Vinyl&per_page=3`;
        const res = await fetch(url, {
            headers: { Authorization: discogsAuth(), 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) return release;
        const data = await res.json();
        const top = data.results?.[0];
        if (!top) return release;
        return {
            ...release,
            // Prefer scraper thumb (sourced from the release page); fall back to Discogs
            thumb: release.thumb || top.cover_image || top.thumb || null,
            genres: [...new Set([...(top.genre ?? []), ...(top.style ?? [])])],
            discogsId: top.master_id || top.id || null,
        };
    } catch {
        return release; // enrichment is best-effort — never fail the whole request
    }
}

// ─── Batch enrichment with rate-limit awareness ───────────────────────────────
// requestStart anchors the shared wall-clock budget (see REQUEST_BUDGET_MS) —
// stops starting new batches once time is running out, rather than pushing the
// whole request past the platform's function timeout.
async function enrichReleases(releases, requestStart) {
    const toEnrich = releases.slice(0, ENRICH_LIMIT);
    const rest = releases.slice(ENRICH_LIMIT);
    const enriched = [];

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
        if (Date.now() - requestStart > REQUEST_BUDGET_MS) {
            console.warn(`[Upcoming Vinyl] Enrichment budget exceeded — stopping early at ${i}/${toEnrich.length}`);
            return [...enriched, ...toEnrich.slice(i), ...rest];
        }
        const batch = toEnrich.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(enrichOne));
        enriched.push(...results);
        if (i + BATCH_SIZE < toEnrich.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
    }

    return [...enriched, ...rest];
}

// ─── HTML scraping helpers ────────────────────────────────────────────────────
const stripVariantSuffix = (raw) =>
    raw.replace(/\s*\[.*?\]/g, '').replace(/\s*\(.*?\)/g, '').trim();

const parseDate = (str) => {
    try {
        const d = new Date(str.trim());
        return isNaN(d.getTime()) ? str.trim() : d.toISOString().split('T')[0];
    } catch { return str.trim(); }
};

// Matches date headers in various formats upcomingvinyl.com has used:
//   "April 19, 2026"  "April 19, 2026 / Saturday"  "April 19"  "April 19 · Saturday"
const DATE_RE = /^([A-Z][a-z]+ \d{1,2},?\s*(?:\d{4})?)\s*(?:[/·-]\s*\w+)?$/;

// cheerio is required lazily inside a try/catch-guarded call (not imported
// at module scope) so a load failure surfaces as a catchable error, falling
// through to the Discogs fallback, rather than crashing the whole function
// invocation at cold start.
//
// Loaded via CJS require() (see the top-of-file createRequire setup), not
// ESM import() — this is deliberate, not a style choice. Debug history
// (2026-08-04, all confirmed via fresh x-cache:MISS production curls,
// each a genuinely new production request, not a stale cache read):
//   1. import() resolved cheerio's whole dependency graph through each
//      package's ESM "exports" condition, which for dom-serializer routes
//      through `entities/lib/esm/index.js` — missing in the deployed
//      bundle. Two `includeFiles` globs (brace-expansion, then the
//      maximally broad `node_modules/**`) both had no effect on this
//      specific error.
//   2. Switched to require() so the graph resolves through each package's
//      CJS "require" condition instead — confirmed via the error's own
//      "Did you mean to import entities/lib/index.js?" that this file
//      *is* present. This worked: resolution got much further, correctly
//      walking cheerio → domutils → dom-serializer → entities/lib/index.js.
//   3. New failure at that depth: entities/lib/decode.js (and encode.js)
//      do plain, fully static `require("./generated/*.js")` calls for
//      three small generated data files — real, present locally — but
//      missing from the deployed bundle too. `includeFiles:
//      "node_modules/**"` in vercel.json, tested specifically against
//      this failure (untested before, since step 1 never got this far),
//      had zero effect — a fresh production curl afterward showed the
//      byte-identical error, proving `includeFiles` doesn't work in this
//      project's deployment pipeline, for any target. Reverted it.
//   4. A first fix attempt pre-populated Node's require *cache* for the
//      expected paths using vendored copies — didn't work; Node resolves
//      a request to an absolute path (which requires the file to exist on
//      disk) before ever consulting the cache, so a missing file throws
//      during resolution and the cache is never reached.
//   5. Fixed properly via patching `Module._resolveFilename` itself,
//      targeted at those three specific filenames — deployed, and a fresh
//      production curl showed real progress (a different, deeper error),
//      but then failed on `entities/lib/escape.js` (required by
//      encode.js) — a *different* file than the three originally
//      patched, proving Vercel drops more than just the generated/
//      subfolder from this package.
//   6. Rather than keep patching individual files one at a time as more
//      surface, vendored the *entire* entities package (see
//      `api/_vendor/entities/README.md`) and generalized
//      `patchEntitiesGeneratedResolution()` to redirect ANY failed
//      resolution whose parent module lives inside the real entities
//      package to the equivalent path in the vendored copy — covers every
//      file Vercel might be dropping, not just the ones discovered so far.
// package.json's `overrides.htmlparser2` pin is a leftover from an
// earlier, separate attempt at this same class of problem.
async function scrapeHTML(html) {
    patchEntitiesGeneratedResolution();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const releases = [];
    let currentDate = null;
    let currentDayOfWeek = null;

    const $main = $('main, .entry-content, article, #content, .content, body');

    $main.find('*').each((_, el) => {
        const $el = $(el);
        const tag = el.name?.toLowerCase();
        const text = $el.text().trim();

        // ── Detect date headers ──────────────────────────────────────────────
        if (['h1', 'h2', 'h3', 'h4', 'strong', 'b', 'p'].includes(tag)) {
            const dateMatch = text.match(DATE_RE);
            if (dateMatch) {
                currentDate = parseDate(dateMatch[1]);
                currentDayOfWeek = text.replace(dateMatch[1], '').replace(/[^A-Za-z]/g, '').trim();
                return;
            }
        }

        if (!currentDate) return;

        // ── Detect release items ─────────────────────────────────────────────
        // Strategy 1: <li> or <article> or <div> containing an <a href="/record/...">
        const isContainer = ['li', 'article', 'div'].includes(tag);
        if (!isContainer) return;

        // Avoid descending into containers that are themselves inside a matching container
        // (cheerio walks all descendants, so skip if the parent is also a release container)
        if (tag === 'div' && ($el.parent().is('li') || $el.parent().is('article'))) return;

        const $a = $el.find('a[href*="/record/"]').first();
        const link = $a.attr('href');
        if (!link) return;

        const $img = $a.find('img').first();
        const thumb = $img.attr('data-src') || $img.attr('src') || null;

        // Try <h2> with <span> (original format)
        const $h2 = $a.find('h2').first();
        let artist = '';
        let titleSpan = '';

        if ($h2.length) {
            titleSpan = $h2.find('span').text().replace(/\s+/g, ' ').trim();
            artist = $h2.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
        }

        // Fallback: try anchor text directly, split on " - " or " – "
        if (!artist || !titleSpan) {
            const anchorText = $a.text().replace(/\s+/g, ' ').trim();
            const sep = anchorText.includes(' – ') ? ' – ' : anchorText.includes(' - ') ? ' - ' : null;
            if (sep) {
                const parts = anchorText.split(sep);
                artist = parts[0].trim();
                titleSpan = parts.slice(1).join(sep).trim();
            } else if (anchorText) {
                // Can't split: use the whole text as raw, leave artist empty
                titleSpan = anchorText;
                artist = '';
            }
        }

        if (titleSpan && titleSpan.length > 1) {
            releases.push({
                artist: artist || '',
                title: stripVariantSuffix(titleSpan),
                raw: artist ? `${artist} - ${titleSpan}` : titleSpan,
                thumb,
                genres: [],        // populated by enrichReleases()
                discogsId: null,   // populated by enrichReleases()
                releaseDate: currentDate,
                dayOfWeek: currentDayOfWeek || '',
                sourceUrl: link,
                searchUrl: `https://www.discogs.com/search/?q=${encodeURIComponent((artist ? artist + ' ' : '') + stripVariantSuffix(titleSpan))}&type=release&format=Vinyl`,
            });
        }
    });

    // Deduplicate by raw text
    const seen = new Set();
    return releases.filter(r => {
        if (seen.has(r.raw)) return false;
        seen.add(r.raw);
        return true;
    });
}

// ─── Discogs fallback: popular new vinyl releases ─────────────────────────────
async function fetchDiscogsNewVinyl() {
    const year = new Date().getFullYear();
    const years = `${year},${year + 1}`;
    const url = `${DISCOGS_SEARCH}?format=Vinyl&year=${years}&sort=have&sort_order=desc&per_page=50&type=release`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: discogsAuth(), 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map(r => {
            const title = (r.title || '').replace(/\s*\(\d+\)\s*$/, '').trim();
            // Discogs title format is often "Artist - Album"
            const sep = title.includes(' - ') ? ' - ' : title.includes(' – ') ? ' – ' : null;
            let artist = '';
            let albumTitle = title;
            if (sep) {
                const parts = title.split(sep);
                artist = parts[0].trim();
                albumTitle = parts.slice(1).join(sep).trim();
            }
            return {
                artist,
                title: albumTitle,
                raw: title,
                thumb: r.cover_image || r.thumb || null,
                genres: [...new Set([...(r.genre ?? []), ...(r.style ?? [])])],
                discogsId: r.master_id || r.id || null,
                releaseDate: null,
                dayOfWeek: '',
                sourceUrl: r.uri ? `https://www.discogs.com${r.uri}` : null,
                searchUrl: `https://www.discogs.com/search/?q=${encodeURIComponent(title)}&type=release&format=Vinyl`,
            };
        }).filter(r => r.raw.length > 1);
    } catch (err) {
        console.error('[Upcoming Vinyl] Discogs fallback failed:', err.message);
        return [];
    }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // ── 1. In-memory cache (fastest) ─────────────────────────────────────────
    if (memCache && isFresh(memCache)) {
        res.setHeader('X-Cache', 'HIT-MEMORY');
        return res.status(200).json({
            releases: memCache.data,
            fetchedAt: memCache.fetchedAt,
            source: UPCOMING_URL,
            fallback: memCache.fallback ?? false,
        });
    }

    // ── 2. /tmp file cache (survives warm restarts) ───────────────────────────
    const fileCached = await readFileCache();
    if (fileCached) {
        memCache = fileCached;
        res.setHeader('X-Cache', 'HIT-FILE');
        return res.status(200).json({
            releases: fileCached.data,
            fetchedAt: fileCached.fetchedAt,
            source: UPCOMING_URL,
            fallback: fileCached.fallback ?? false,
        });
    }

    // ── 3. Cache miss: scrape + enrich ────────────────────────────────────────
    try {
        res.setHeader('X-Cache', 'MISS');
        const requestStart = Date.now();

        let scraped = [];
        let isFallback = false;
        let scrapeError = null;

        // Primary: upcomingvinyl.com
        try {
            const htmlRes = await fetch(UPCOMING_URL, {
                headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
                signal: AbortSignal.timeout(5000),
            });
            if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} from upcomingvinyl.com`);
            scraped = await scrapeHTML(await htmlRes.text());
            console.log(`[Upcoming Vinyl] Scraped ${scraped.length} releases from upcomingvinyl.com`);
        } catch (err) {
            scrapeError = err.message;
            console.error('[Upcoming Vinyl] Primary scrape failed:', err.message);
        }

        // Fallback: Discogs new vinyl if scraper yielded nothing. Skipped once the
        // primary scrape has already burned through most of the request budget —
        // starting a fresh 5s fetch at that point would just trade one timeout
        // (scrape) for another (fallback) with no working response either way.
        const FALLBACK_SUB_BUDGET_MS = 7000;
        if (scraped.length === 0 && process.env.DISCOGS_CONSUMER_KEY) {
            if (Date.now() - requestStart > FALLBACK_SUB_BUDGET_MS) {
                console.warn('[Upcoming Vinyl] Skipping Discogs fallback — request budget already exceeded');
            } else {
                console.log('[Upcoming Vinyl] Falling back to Discogs new vinyl...');
                scraped = await fetchDiscogsNewVinyl();
                isFallback = true;
                console.log(`[Upcoming Vinyl] Discogs fallback returned ${scraped.length} releases`);
            }
        }

        // Enrich with Discogs artwork + genres (skip if already from Discogs fallback)
        const enriched = (!isFallback && process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET)
            ? await enrichReleases(scraped, requestStart)
            : scraped;

        const fetchedAt = new Date().toISOString();
        // Empty results get a much shorter TTL — a transient scrape/fallback
        // failure shouldn't poison the cache with "no releases" for a full 6 hours.
        const ttlMs = enriched.length === 0 ? EMPTY_RESULT_TTL_MS : CACHE_TTL_MS;
        const payload = { data: enriched, fetchedAt, fallback: isFallback, ttlMs };

        memCache = payload;
        await writeFileCache(payload);

        return res.status(200).json({
            releases: enriched,
            fetchedAt,
            source: isFallback ? 'discogs' : UPCOMING_URL,
            fallback: isFallback,
            ...(scrapeError && { scrapeError }),
        });
    } catch (err) {
        console.error('[Upcoming Vinyl] Handler failed:', err.message);
        return res.status(500).json({ error: 'Failed to fetch upcoming vinyl data', detail: err.message });
    }
}
