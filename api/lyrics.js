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

    // Use full URL to parse params reliably in different environments
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

        // Try lyrics.ovh
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const ovhRes = await fetch(ovhUrl);
        if (ovhRes.ok) {
            const data = await ovhRes.json();
            if (data.lyrics) {
                console.log(`[Lyrics Proxy] Found lyrics via lyrics.ovh`);
                return res.status(200).json({ lyrics: data.lyrics, source: 'lyrics.ovh' });
            }
        }

        // Try LRCLIB
        const lrcUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const lrcRes = await fetch(lrcUrl);
        if (lrcRes.ok) {
            const data = await lrcRes.json();
            if (data && data.length > 0 && data[0].plainLyrics) {
                console.log(`[Lyrics Proxy] Found lyrics via LRCLIB`);
                return res.status(200).json({ lyrics: data[0].plainLyrics, source: 'lrclib' });
            }
        }

        return res.status(404).json({ error: 'Lyrics not found' });
    } catch (error) {
        console.error('[Lyrics Proxy] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
