// ─── Upcoming Vinyl Scraper + Server-Side Enrichment ─────────────────────────
// Scrapes https://upcomingvinyl.com/featured, enriches each release with
// Discogs artwork and genre data, then caches the result server-side for 6 hours.
//
// Cache strategy (dual-layer):
//   1. Module-level in-memory object — zero-latency for warm container hits
//   2. /tmp file — survives container restarts within the same Vercel instance
//
// Discogs ToS: content must not be displayed if >6 hours stale (TTL = 6h).
// Enrichment calls use app-level auth (consumer key/secret) — no user token needed.

import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'fs/promises';

const UPCOMING_URL = 'https://upcomingvinyl.com/featured';
const DISCOGS_SEARCH = 'https://api.discogs.com/database/search';
const USER_AGENT = 'SpinVinyl/1.0 +https://aimlow.ai';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — Discogs ToS maximum
const CACHE_FILE = '/tmp/spinvinyl_upcoming_enriched.json';
const ENRICH_LIMIT = 40;    // max releases to enrich per cycle
const BATCH_SIZE = 5;       // parallel Discogs calls per batch
const BATCH_DELAY_MS = 400; // pause between batches (respects ~25 req/min app-auth limit)

// ─── In-memory cache (warm-container fast path) ───────────────────────────────
let memCache = null; // { data: [...], fetchedAt: ISO string }

const isFresh = (fetchedAt) =>
    fetchedAt && (Date.now() - new Date(fetchedAt).getTime()) < CACHE_TTL_MS;

// ─── /tmp file cache (survives container restarts) ────────────────────────────
async function readFileCache() {
    try {
        const raw = await readFile(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (isFresh(parsed.fetchedAt)) return parsed;
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
            signal: AbortSignal.timeout(6000),
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
async function enrichReleases(releases) {
    const toEnrich = releases.slice(0, ENRICH_LIMIT);
    const rest = releases.slice(ENRICH_LIMIT);
    const enriched = [];

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
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

function scrapeHTML(html) {
    const $ = cheerio.load(html);
    const releases = [];
    let currentDate = null;
    let currentDayOfWeek = null;

    const $main = $('main, .entry-content, article, #content, .content, body');
    $main.find('*').each((_, el) => {
        const $el = $(el);
        const tag = el.name?.toLowerCase();
        const text = $el.text().trim();

        const dateMatch = text.match(/^([A-Z][a-z]+ \d+,\s*\d{4})\s*(?:\/\s*\w+)?$/);
        if (dateMatch && ['h1', 'h2', 'h3', 'h4', 'strong', 'b', 'p'].includes(tag)) {
            currentDate = parseDate(dateMatch[1]);
            currentDayOfWeek = text.replace(dateMatch[1], '').replace(/[^A-Za-z]/g, '').trim();
            return;
        }

        if (currentDate && tag === 'li') {
            const $a = $el.find('a').first();
            const link = $a.attr('href');
            if (!link || !link.includes('/record/')) return;

            const $img = $a.find('img');
            const thumb = $img.attr('data-src') || $img.attr('src') || null;
            const $h2 = $a.find('h2');
            const titleSpan = $h2.find('span').text().replace(/\s+/g, ' ').trim();
            const artist = $h2.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();

            if (artist && titleSpan && artist.length > 1) {
                releases.push({
                    artist,
                    title: stripVariantSuffix(titleSpan),
                    raw: `${artist} - ${titleSpan}`,
                    thumb,
                    genres: [],        // populated by enrichReleases()
                    discogsId: null,   // populated by enrichReleases()
                    releaseDate: currentDate,
                    dayOfWeek: currentDayOfWeek || '',
                    sourceUrl: link,
                    searchUrl: `https://www.discogs.com/search/?q=${encodeURIComponent(artist + ' ' + stripVariantSuffix(titleSpan))}&type=release&format=Vinyl`,
                });
            }
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

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // ── 1. In-memory cache (fastest) ─────────────────────────────────────────
    if (memCache && isFresh(memCache.fetchedAt)) {
        res.setHeader('X-Cache', 'HIT-MEMORY');
        return res.status(200).json({ releases: memCache.data, fetchedAt: memCache.fetchedAt, source: UPCOMING_URL });
    }

    // ── 2. /tmp file cache (survives warm restarts) ───────────────────────────
    const fileCached = await readFileCache();
    if (fileCached) {
        memCache = fileCached; // warm in-memory for next request
        res.setHeader('X-Cache', 'HIT-FILE');
        return res.status(200).json({ releases: fileCached.data, fetchedAt: fileCached.fetchedAt, source: UPCOMING_URL });
    }

    // ── 3. Cache miss: scrape + enrich ────────────────────────────────────────
    try {
        res.setHeader('X-Cache', 'MISS');
        const htmlRes = await fetch(UPCOMING_URL, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
            signal: AbortSignal.timeout(10000),
        });
        if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} from upcomingvinyl.com`);

        const raw = scrapeHTML(await htmlRes.text());

        // Enrich with Discogs data (artwork + genres) — only if credentials present
        const enriched = (process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET)
            ? await enrichReleases(raw)
            : raw;

        const fetchedAt = new Date().toISOString();
        const payload = { data: enriched, fetchedAt };

        // Persist to both cache layers
        memCache = payload;
        await writeFileCache(payload); // fire-and-forget effectively (await for safety)

        return res.status(200).json({ releases: enriched, fetchedAt, source: UPCOMING_URL });
    } catch (err) {
        console.error('[Upcoming Vinyl] Scrape/enrich failed:', err.message);
        return res.status(500).json({ error: 'Failed to fetch upcoming vinyl data', detail: err.message });
    }
}
