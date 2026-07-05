// ─── Price Cache ─────────────────────────────────────────────────
// Per-release cache for Discogs marketplace price data (price suggestions +
// marketplace stats). Discogs' API Terms of Use restrict displaying this kind
// of "Content" more than 6 hours stale, so the TTL here must stay under that —
// keep it well under (4h) to leave margin for clock drift/slow syncs.
const TTL_HOURS = 4;
const keyFor = (releaseId) => `spinvinyl_price_${releaseId}`;

export const readPriceCache = (releaseId) => {
    try {
        const raw = localStorage.getItem(keyFor(releaseId));
        if (!raw) return null;
        const { data, fetchedAt } = JSON.parse(raw);
        const hours = (Date.now() - new Date(fetchedAt)) / 3600000;
        if (hours > TTL_HOURS) return null;
        return data;
    } catch {
        return null;
    }
};

export const writePriceCache = (releaseId, data) => {
    try {
        localStorage.setItem(keyFor(releaseId), JSON.stringify({ data, fetchedAt: new Date().toISOString() }));
    } catch { /* ignore quota errors */ }
};

/**
 * Fetch (with caching) price_suggestions + marketplace/stats for a release.
 * Returns { suggestions, stats, fetchedAt } | null on failure.
 */
export const fetchReleasePrice = async (releaseId) => {
    const cached = readPriceCache(releaseId);
    if (cached) return cached;

    try {
        const [suggRes, statsRes] = await Promise.all([
            fetch(`/api/discogs?action=priceSuggestions&id=${releaseId}`),
            fetch(`/api/discogs?action=marketplaceStats&id=${releaseId}`),
        ]);
        const suggestions = suggRes.ok ? await suggRes.json() : null;
        const stats = statsRes.ok ? await statsRes.json() : null;
        if (!suggestions && !stats) return null;

        const result = { suggestions, stats, fetchedAt: new Date().toISOString() };
        writePriceCache(releaseId, result);
        return result;
    } catch {
        return null;
    }
};
