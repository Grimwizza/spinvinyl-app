// ─── Shop Local — OpenStreetMap / Nominatim / Overpass ───────────────────────
// Completely free, no API key required.
//
// Actions:
//   geocode  - zip code → lat/lng via Nominatim
//   search   - nearby record/music stores via Overpass API

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MILES_TO_METERS = 1609.34;
const USER_AGENT = 'SpinVinyl/1.0 +https://aimlow.ai';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).json({});
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action');

    // ── Geocode zip → lat/lng via Nominatim ───────────────────────
    if (action === 'geocode') {
        const zip = url.searchParams.get('zip');
        if (!zip) return res.status(400).json({ error: 'Missing zip code' });
        try {
            const geoRes = await fetch(
                `${NOMINATIM_URL}/search?q=${encodeURIComponent(zip)}&format=json&limit=1&addressdetails=1`,
                { headers: { 'User-Agent': USER_AGENT } },
            );
            const data = await geoRes.json();
            if (!data?.length) return res.status(404).json({ error: 'Location not found for that zip code.' });
            const { lat, lon, display_name } = data[0];
            return res.status(200).json({ lat: parseFloat(lat), lng: parseFloat(lon), name: display_name });
        } catch {
            return res.status(500).json({ error: 'Geocoding failed. Please try again.' });
        }
    }

    // ── Nearby record store search via Overpass ────────────────────
    if (action === 'search') {
        const lat = url.searchParams.get('lat');
        const lng = url.searchParams.get('lng');
        const miles = parseFloat(url.searchParams.get('radius') || '10');
        const radiusMeters = Math.round(miles * MILES_TO_METERS);
        if (!lat || !lng) return res.status(400).json({ error: 'Missing lat/lng' });

        // Query nodes and ways tagged as music/records/vinyl shops
        const query = `
[out:json][timeout:30];
(
  node["shop"="music"](around:${radiusMeters},${lat},${lng});
  node["shop"="records"](around:${radiusMeters},${lat},${lng});
  node["shop"="vinyl"](around:${radiusMeters},${lat},${lng});
  way["shop"="music"](around:${radiusMeters},${lat},${lng});
  way["shop"="records"](around:${radiusMeters},${lat},${lng});
  way["shop"="vinyl"](around:${radiusMeters},${lat},${lng});
);
out center tags;`.trim();

        try {
            const overpassRes = await fetch(OVERPASS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
                body: `data=${encodeURIComponent(query)}`,
            });
            if (!overpassRes.ok) throw new Error(`Overpass HTTP ${overpassRes.status}`);
            const data = await overpassRes.json();
            return res.status(200).json({ elements: data.elements || [] });
        } catch (e) {
            console.error('[Shops] Overpass error:', e.message);
            const isTimeout = e.message.includes('504') || e.message.includes('timeout');
            return res.status(503).json({ 
                error: isTimeout ? 'Map service is temporarily busy.' : 'Store search failed. Please try again.',
                code: isTimeout ? 'MAP_TIMEOUT' : 'SEARCH_ERROR'
            });
        }
    }

    return res.status(400).json({ error: 'Invalid action' });
}
