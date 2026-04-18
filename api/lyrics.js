const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchWithTimeout(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const url = new URL(req.url, baseUrl);

    const artist = url.searchParams.get('artist');
    const title = url.searchParams.get('title');

    if (!artist || !title) {
        return res.status(400).json({ error: 'Missing artist or title parameters' });
    }

    try {
        console.log(`[Lyrics Proxy] Fetching lyrics for: ${artist} - ${title}`);

        // Try lyrics.ovh (6s timeout)
        try {
            const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
            const ovhRes = await fetchWithTimeout(ovhUrl);
            if (ovhRes.ok) {
                const data = await ovhRes.json();
                if (data.lyrics) {
                    console.log(`[Lyrics Proxy] Found lyrics via lyrics.ovh`);
                    return res.status(200).json({ lyrics: data.lyrics, source: 'lyrics.ovh' });
                }
            }
        } catch (e) {
            console.warn(`[Lyrics Proxy] lyrics.ovh failed: ${e.message}`);
        }

        // Try LRCLIB (6s timeout) — pick best-matching result
        try {
            const lrcUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
            const lrcRes = await fetchWithTimeout(lrcUrl);
            if (lrcRes.ok) {
                const data = await lrcRes.json();
                if (Array.isArray(data) && data.length > 0) {
                    const normArtist = normalize(artist);
                    const normTitle = normalize(title);
                    const match = data.find(r =>
                        normalize(r.artistName) === normArtist &&
                        normalize(r.trackName) === normTitle
                    ) || data[0];
                    if (match?.plainLyrics) {
                        console.log(`[Lyrics Proxy] Found lyrics via LRCLIB`);
                        return res.status(200).json({ lyrics: match.plainLyrics, source: 'lrclib' });
                    }
                }
            }
        } catch (e) {
            console.warn(`[Lyrics Proxy] LRCLIB failed: ${e.message}`);
        }

        // Try chartlyrics.com (6s timeout, no key required)
        try {
            const clUrl = `http://api.chartlyrics.com/apiv1.asmx/SearchLyric?lyricText=&artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}`;
            const clRes = await fetchWithTimeout(clUrl);
            if (clRes.ok) {
                const xml = await clRes.text();
                // Extract the first non-empty <Lyric> value
                const lyricMatch = xml.match(/<Lyric>([^<]{20,})<\/Lyric>/);
                if (lyricMatch) {
                    console.log(`[Lyrics Proxy] Found lyrics via chartlyrics`);
                    return res.status(200).json({ lyrics: lyricMatch[1].trim(), source: 'chartlyrics' });
                }
            }
        } catch (e) {
            console.warn(`[Lyrics Proxy] chartlyrics failed: ${e.message}`);
        }

        return res.status(404).json({ error: 'Lyrics not found' });
    } catch (error) {
        console.error('[Lyrics Proxy] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
