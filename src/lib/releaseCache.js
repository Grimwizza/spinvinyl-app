// ─── Release Detail Cache ────────────────────────────────────────
// Per-release cache for Discogs' `action=release` lookup (title, artists,
// tracklist, credits, notes, videos). Unlike price data (see priceCache.js,
// market-based and time-sensitive), a release's catalogued metadata is
// essentially static once published — safe to cache far longer. This exists
// because re-opening the same record in a session (browsing back and forth,
// or re-visiting a favorite) re-fetched identical data every time.
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const keyFor = (releaseId) => `spinvinyl_release_${releaseId}`;

export const readReleaseCache = (releaseId) => {
    try {
        const raw = localStorage.getItem(keyFor(releaseId));
        if (!raw) return null;
        const { data, fetchedAt } = JSON.parse(raw);
        if (Date.now() - new Date(fetchedAt).getTime() > TTL_MS) return null;
        return data;
    } catch {
        return null;
    }
};

export const writeReleaseCache = (releaseId, data) => {
    try {
        localStorage.setItem(keyFor(releaseId), JSON.stringify({ data, fetchedAt: new Date().toISOString() }));
    } catch { /* ignore quota errors */ }
};

/** Fetch (with caching) full release detail for a Discogs release id. */
export const fetchReleaseDetail = async (releaseId) => {
    const cached = readReleaseCache(releaseId);
    if (cached) return cached;

    const res = await fetch(`/api/discogs?action=release&id=${releaseId}`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    writeReleaseCache(releaseId, data);
    return data;
};
