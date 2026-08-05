// ─── Vinyl Releases — RSS News Feed Aggregator ────────────────────────────
// Fetches and parses RSS from vinyl / music journalism sources.
// No external dependencies — pure XML regex parsing.
//
// Cache strategy (dual-layer, mirrors api/upcoming.js):
//   1. Module-level in-memory object — zero-latency for warm container hits
//   2. /tmp file — survives container restarts within the same Vercel instance
//
// TTL = 2h — news feeds post a handful of times a day, not continuously, and
// this is plain RSS text (no Discogs ToS freshness constraint applies here).

import { readFile, writeFile } from 'fs/promises';

const USER_AGENT = 'SpinVinyl/1.0 +https://spinvinyl.app';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_FILE = '/tmp/spinvinyl_releases_news.json';

// ─── In-memory cache (warm-container fast path) ───────────────────────────────
let memCache = null; // { data: { articles, errors }, fetchedAt: ISO string }

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

// ─── XML / RSS Helpers ────────────────────────────────────────────

const getTagContent = (xml, tag) => {
    // Try CDATA first, then plain text
    const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
    const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
    const m = xml.match(cdataRe) || xml.match(plainRe);
    return m ? m[1].trim() : '';
};

const getAttrValue = (xml, tag, attr) => {
    const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, 'i');
    const m = xml.match(re);
    return m ? m[1] : '';
};

const extractFirstImage = (html) => {
    const m = html.match(/<img[^>]+src="(https?:[^"]+)"/i);
    return m ? m[1] : '';
};

const decodeEntities = (str) =>
    str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#8217;/g, '\u2019')
        .replace(/&#8216;/g, '\u2018')
        .replace(/&#8220;/g, '\u201c')
        .replace(/&#8221;/g, '\u201d');

const stripHtml = (html) => html.replace(/<[^>]+>/g, '').trim();

const parseRSSFeed = (xml, source) => {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
        const chunk = match[1];

        const title = decodeEntities(getTagContent(chunk, 'title'));
        const link = getTagContent(chunk, 'link') || getAttrValue(chunk, 'link', 'href');
        const description = getTagContent(chunk, 'description') || getTagContent(chunk, 'content:encoded');
        const pubDate = getTagContent(chunk, 'pubDate') || getTagContent(chunk, 'dc:date');

        // Image: try enclosure → media:content → media:thumbnail → first img in description
        const image =
            getAttrValue(chunk, 'enclosure', 'url') ||
            getAttrValue(chunk, 'media:content', 'url') ||
            getAttrValue(chunk, 'media:thumbnail', 'url') ||
            extractFirstImage(description) ||
            '';

        const summary = decodeEntities(stripHtml(description)).slice(0, 220).trim();

        if (title && link) {
            items.push({
                title,
                url: link,
                summary,
                image,
                source,
                publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            });
        }
    }

    return items;
};

// ─── Feed Sources ─────────────────────────────────────────────────
// Vinyl-focused: Analog Planet, Bandcamp Daily
// Popular artists + tours: Rolling Stone, BrooklynVegan, Consequence, Stereogum
// Broad music news: Pitchfork, NME
//
// Vinyl Factory (thevinylfactory.com) was removed 2026-08-04 — their site
// migrated to Webflow and dropped RSS entirely (confirmed: /feed and every
// plausible alternate path all 404; the old feed was a genuine, permanent
// 404 in production, not a transient outage). Re-add if they ever publish
// a working feed again.

const FEEDS = [
    // Vinyl & collector-focused
    { url: 'https://www.analogplanet.com/rss.xml',                          source: 'Analog Planet'  },
    { url: 'https://daily.bandcamp.com/feed',                               source: 'Bandcamp Daily' },
    // Popular artists, new releases & tours
    { url: 'https://www.rollingstone.com/music/feed/',                      source: 'Rolling Stone'  },
    { url: 'https://www.brooklynvegan.com/feed/',                           source: 'BrooklynVegan'  },
    { url: 'https://consequence.net/feed/',                                 source: 'Consequence'    },
    { url: 'https://stereogum.com/feed/',                                   source: 'Stereogum'      },
    // Broad music news
    { url: 'https://pitchfork.com/rss/news/',                               source: 'Pitchfork'      },
    { url: 'https://www.nme.com/feed',                                      source: 'NME'            },
];

// ─── Handler ──────────────────────────────────────────────────────

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const url = new URL(req.url, `${protocol}://${host}`);
    const action = url.searchParams.get('action') || '';

    if (action !== 'news') {
        return res.status(400).json({ error: 'Invalid action. Use action=news' });
    }

    // ── 1. In-memory cache (fastest) ─────────────────────────────────────────
    if (memCache && isFresh(memCache.fetchedAt)) {
        res.setHeader('X-Cache', 'HIT-MEMORY');
        return res.status(200).json(memCache.data);
    }

    // ── 2. /tmp file cache (survives warm restarts) ───────────────────────────
    const fileCached = await readFileCache();
    if (fileCached) {
        memCache = fileCached;
        res.setHeader('X-Cache', 'HIT-FILE');
        return res.status(200).json(fileCached.data);
    }

    // ── 3. Cache miss: fetch all feeds ────────────────────────────────────────
    res.setHeader('X-Cache', 'MISS');

    const articles = [];
    const errors = [];

    await Promise.allSettled(
        FEEDS.map(async (feed) => {
            try {
                const response = await fetch(feed.url, {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(6000),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const xml = await response.text();
                const parsed = parseRSSFeed(xml, feed.source);
                articles.push(...parsed);
            } catch (e) {
                errors.push({ source: feed.source, error: e.message });
                console.error(`[Releases] RSS fetch failed for ${feed.source}:`, e.message);
            }
        })
    );

    // Sort newest first, deduplicate by URL
    const seen = new Set();
    const deduped = articles
        .filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, 54); // 9 sources × 8 items = 72 → trim to 54 newest

    const payload = { data: { articles: deduped, errors }, fetchedAt: new Date().toISOString() };
    memCache = payload;
    await writeFileCache(payload);

    return res.status(200).json(payload.data);
}
