// ─── Upcoming Vinyl Scraper ─────────────────────────────────────────────────
// Scrapes https://upcomingvinyl.com/featured and returns structured release data.
// Uses cheerio for HTML parsing. No external API keys required.

import * as cheerio from 'cheerio';

const UPCOMING_URL = 'https://upcomingvinyl.com/featured';
const USER_AGENT = 'SpinVinyl/1.0 +https://aimlow.ai';

// Strip vinyl-specific suffixes from a title to get the clean album title
// e.g. "Album Name (Neon Orange Splatter) [2xLP]" → "Album Name"
const stripVariantSuffix = (raw) => {
    return raw
        .replace(/\s*\[.*?\]/g, '')       // remove [2xLP], [8xLP] etc.
        .replace(/\s*\(.*?\)/g, '')       // remove (colour variant) etc.
        .trim();
};

// Parse "Artist Album Title" text into { artist, title }.
// upcomingvinyl.com lists entries as "Artist Name Album Title" with no separator.
// We store the whole text as the "title" and try to split on the longest match
// so the caller can display it as-is or attempt smarter splitting client-side.
// Returns { raw, artist: '', title: raw } — artist splitting happens on the
// frontend where we have the user's collection to cross-reference.
const parseEntry = (rawText) => {
    const clean = rawText.trim();
    if (!clean) return null;
    return {
        raw: clean,
        title: stripVariantSuffix(clean),
    };
};

// Parse a date string like "March 27, 2026" into an ISO date string
const parseDate = (str) => {
    try {
        const d = new Date(str.trim());
        if (isNaN(d.getTime())) return str.trim();
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
        return str.trim();
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const response = await fetch(UPCOMING_URL, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} fetching upcomingvinyl.com`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const releases = [];

        // upcomingvinyl.com/featured: dates are h2/h3/strong elements,
        // each followed by a list of "Artist - Album" or a plain UL/OL.
        // Strategy: walk the main content, detect date headings, then collect
        // every list item or br-separated entry until the next date heading.

        let currentDate = null;
        let currentDayOfWeek = null;

        // Find the main content wrapper
        const $main = $('main, .entry-content, article, #content, .content, body');

        // Walk every direct child looking for date headers and release entries
        $main.find('*').each((_, el) => {
            const $el = $(el);
            const tag = el.name?.toLowerCase();
            const text = $el.text().trim();

            // Detect date headings — look for text matching a date pattern
            const dateMatch = text.match(/^([A-Z][a-z]+ \d+,\s*\d{4})\s*(?:\/\s*\w+)?$/);
            if (dateMatch && ['h1','h2','h3','h4','strong','b','p'].includes(tag)) {
                currentDate = parseDate(dateMatch[1]);
                currentDayOfWeek = text.replace(dateMatch[1], '').replace(/[^A-Za-z]/g, '').trim();
                return; // continue
            }

            // Detect list items that contain a release link and artwork
            if (currentDate && tag === 'li') {
                const $a = $el.find('a').first();
                const link = $a.attr('href');
                if (!link || !link.includes('/record/')) return;
                
                const $img = $a.find('img');
                const thumb = $img.attr('data-src') || $img.attr('src');
                
                const $h2 = $a.find('h2');
                const titleSpan = $h2.find('span').text().replace(/\s+/g, ' ').trim();
                const artist = $h2.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
                
                if (artist && titleSpan && artist.length > 1) {
                    const cleanTitle = stripVariantSuffix(titleSpan);
                    releases.push({
                        artist,
                        title: cleanTitle,
                        raw: `${artist} - ${titleSpan}`,
                        thumb,
                        releaseDate: currentDate,
                        dayOfWeek: currentDayOfWeek || '',
                        sourceUrl: link,
                        searchUrl: `https://www.discogs.com/search/?q=${encodeURIComponent(artist + ' ' + cleanTitle)}&type=release&format=Vinyl`
                    });
                }
            }
        });

        // Deduplicate by raw text
        const seen = new Set();
        const deduped = releases.filter(r => {
            if (seen.has(r.raw)) return false;
            seen.add(r.raw);
            return true;
        });

        return res.status(200).json({
            releases: deduped,
            fetchedAt: new Date().toISOString(),
            source: UPCOMING_URL,
        });

    } catch (err) {
        console.error('[Upcoming Vinyl] Scrape failed:', err.message);
        return res.status(500).json({ error: 'Failed to fetch upcoming vinyl data', detail: err.message });
    }
}
