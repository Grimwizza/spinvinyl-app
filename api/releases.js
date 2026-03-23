// ─── Vinyl Releases — RSS News Feed Aggregator ────────────────────────────
// Fetches and parses RSS from vinyl / music journalism sources.
// No external dependencies — pure XML regex parsing.

const USER_AGENT = 'SpinVinyl/1.0 +https://aimlow.ai';

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

    while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
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

const FEEDS = [
    { url: 'https://thevinylfactory.com/feed/', source: 'Vinyl Factory' },
    { url: 'https://pitchfork.com/rss/news/', source: 'Pitchfork' },
    { url: 'https://daily.bandcamp.com/feed', source: 'Bandcamp Daily' },
    { url: 'https://www.nme.com/feed', source: 'NME' },
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
        .slice(0, 40);

    return res.status(200).json({ articles: deduped, errors });
}
