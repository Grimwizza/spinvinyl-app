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
let memCache = null; // { data: [...], fetchedAt: ISO string, fallback?: boolean }

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

// Matches date headers in various formats upcomingvinyl.com has used:
//   "April 19, 2026"  "April 19, 2026 / Saturday"  "April 19"  "April 19 · Saturday"
const DATE_RE = /^([A-Z][a-z]+ \d{1,2},?\s*(?:\d{4})?)\s*(?:[/·\-]\s*\w+)?$/;

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
            signal: AbortSignal.timeout(10000),
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
    if (memCache && isFresh(memCache.fetchedAt)) {
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

        let scraped = [];
        let isFallback = false;
        let scrapeError = null;

        // Primary: upcomingvinyl.com
        try {
            const htmlRes = await fetch(UPCOMING_URL, {
                headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
                signal: AbortSignal.timeout(10000),
            });
            if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} from upcomingvinyl.com`);
            scraped = scrapeHTML(await htmlRes.text());
            console.log(`[Upcoming Vinyl] Scraped ${scraped.length} releases from upcomingvinyl.com`);
        } catch (err) {
            scrapeError = err.message;
            console.error('[Upcoming Vinyl] Primary scrape failed:', err.message);
        }

        // Fallback: Discogs new vinyl if scraper yielded nothing
        if (scraped.length === 0 && process.env.DISCOGS_CONSUMER_KEY) {
            console.log('[Upcoming Vinyl] Falling back to Discogs new vinyl...');
            scraped = await fetchDiscogsNewVinyl();
            isFallback = true;
            console.log(`[Upcoming Vinyl] Discogs fallback returned ${scraped.length} releases`);
        }

        // Enrich with Discogs artwork + genres (skip if already from Discogs fallback)
        const enriched = (!isFallback && process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET)
            ? await enrichReleases(scraped)
            : scraped;

        const fetchedAt = new Date().toISOString();
        const payload = { data: enriched, fetchedAt, fallback: isFallback };

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
