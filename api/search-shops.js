import * as dotenv from 'dotenv';
dotenv.config();

const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY || process.env.VITE_BRAVE_SEARCH_API_KEY;

export default async function handler(req, res) {
    console.log('[Search-Shops] Incoming request:', req.url);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).json({});
    
    const { searchParams } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = searchParams.get('q');
    console.log('[Search-Shops] Query:', query);

    if (!query) return res.status(400).json({ error: 'Missing search query' });
    if (!BRAVE_SEARCH_API_KEY) {
        console.error('[Search-Shops] Missing Brave API Key');
        return res.status(500).json({ error: 'Brave Search API key not configured' });
    }

    try {
        console.log('[Search-Shops] Calling Brave API...');
        const braveRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
            headers: { 'X-Subscription-Token': BRAVE_SEARCH_API_KEY, 'Accept': 'application/json' }
        });

        if (!braveRes.ok) throw new Error(`Brave API error: ${braveRes.status}`);
        const data = await braveRes.json();
        const results = data.web?.results || [];
        console.log(`[Search-Shops] Found ${results.length} results`);

        const shops = results.map((r, i) => ({
            id: `web-${i}`,
            name: r.title.split(/[|•-]/)[0].trim(),
            address: r.description.match(/\d+ [^,]+, [^,]+, [A-Z]{2}( \d{5})?/)?. [0] || 'Address not found',
            website: r.url,
            description: r.description.substring(0, 100),
            source: 'web'
        }));

        console.log('[Search-Shops] Returning shops:', shops.length);
        return res.status(200).json({ shops });

    } catch (e) {
        console.error('[Search-Shops] Critical Error:', e.message);
        return res.status(500).json({ error: e.message });
    }
}
