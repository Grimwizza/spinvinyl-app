// ─── SpinVinyl Stats Engine ──────────────────────────────────────
// All stats are persisted in localStorage under STATS_KEY.
// Sessions are the source of truth — derived stats are re-computed on read.

const STATS_KEY = 'spinvinyl_stats';

const defaultStats = () => ({
    sessions: [],
    albumPlayCounts: {},
    genrePlays: {},
    labelPlays: {},
    decadePlays: {},
    totalSessions: 0,
    totalPlaySeconds: 0,
});

export const getStoredStats = () => {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (!raw) return defaultStats();
        return { ...defaultStats(), ...JSON.parse(raw) };
    } catch {
        return defaultStats();
    }
};

const saveStats = (stats) => {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('[StatsEngine] Failed to save:', e);
    }
};

// ─── Session Recording ───────────────────────────────────────────

/**
 * Record a completed listening session.
 * @param {object} session
 * @param {number} session.albumId
 * @param {string} session.albumTitle
 * @param {string} session.artist
 * @param {string[]} session.genres
 * @param {number}  session.year
 * @param {string[]} session.labels
 * @param {string}  session.side   — e.g. "A" or "B"
 * @param {string}  session.startTime — ISO-8601
 * @param {number}  session.durationSeconds
 */
export const recordSession = (session) => {
    const stats = getStoredStats();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    stats.sessions.push({ id, ...session });

    // Album play counts
    const key = String(session.albumId);
    stats.albumPlayCounts[key] = (stats.albumPlayCounts[key] || 0) + 1;

    // Genre plays
    (session.genres || []).forEach(g => {
        if (g) stats.genrePlays[g] = (stats.genrePlays[g] || 0) + 1;
    });

    // Label plays
    (session.labels || []).forEach(l => {
        if (l) stats.labelPlays[l] = (stats.labelPlays[l] || 0) + 1;
    });

    // Decade plays
    if (session.year > 0) {
        const decade = `${Math.floor(session.year / 10) * 10}s`;
        stats.decadePlays[decade] = (stats.decadePlays[decade] || 0) + 1;
    }

    stats.totalSessions += 1;
    stats.totalPlaySeconds += session.durationSeconds || 0;

    saveStats(stats);
    return stats;
};

// ─── Queries ─────────────────────────────────────────────────────

const toDateStr = (date) => date.toISOString().slice(0, 10);

/** Total play seconds for a given period. period: 'today' | 'week' | 'month' | 'year' | 'all' */
export const getPeriodTotalSeconds = (period) => {
    const stats = getStoredStats();
    const now = new Date();
    const today = toDateStr(now);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = toDateStr(weekStart);

    const monthStartStr = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const yearStartStr = toDateStr(new Date(now.getFullYear(), 0, 1));

    return stats.sessions
        .filter(s => {
            const d = s.startTime?.slice(0, 10);
            if (!d) return false;
            if (period === 'today') return d === today;
            if (period === 'week') return d >= weekStartStr;
            if (period === 'month') return d >= monthStartStr;
            if (period === 'year') return d >= yearStartStr;
            return true; // 'all'
        })
        .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
};

/** Top N albums by play count. Returns array of { albumId, albumTitle, artist, count }. */
export const getTopAlbums = (n = 5) => {
    const stats = getStoredStats();
    return Object.entries(stats.albumPlayCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, n)
        .map(([albumId, count]) => {
            const s = stats.sessions.find(x => String(x.albumId) === albumId);
            return {
                albumId,
                albumTitle: s?.albumTitle || 'Unknown',
                artist: s?.artist || 'Unknown',
                count,
            };
        });
};

/** Sorted genre breakdown: [{ genre, count }] */
export const getGenreBreakdown = () => {
    const stats = getStoredStats();
    return Object.entries(stats.genrePlays)
        .sort(([, a], [, b]) => b - a)
        .map(([genre, count]) => ({ genre, count }));
};

/**
 * Day activity map for the calendar heatmap.
 * Returns { 'YYYY-MM-DD': totalSeconds }.
 */
export const getDayMap = () => {
    const stats = getStoredStats();
    const map = {};
    stats.sessions.forEach(s => {
        const day = s.startTime?.slice(0, 10);
        if (day) map[day] = (map[day] || 0) + (s.durationSeconds || 0);
    });
    return map;
};

/** Number of unique album IDs that have at least one session. */
export const getUniqueAlbumsSpun = () => Object.keys(getStoredStats().albumPlayCounts).length;

/** Number of unique genres ever spun. */
export const getUniqueGenresSpun = () => Object.keys(getStoredStats().genrePlays).length;

/** Number of unique decades ever spun. */
export const getUniqueDecadesSpun = () => Object.keys(getStoredStats().decadePlays).length;

/** Current consecutive daily listening streak (in days). */
export const getCurrentStreak = () => {
    const stats = getStoredStats();
    if (!stats.sessions.length) return 0;
    const days = [...new Set(stats.sessions.map(s => s.startTime?.slice(0, 10)).filter(Boolean))].sort().reverse();
    const today = toDateStr(new Date());
    const yesterday = toDateStr(new Date(Date.now() - 86400000));
    if (days[0] !== today && days[0] !== yesterday) return 0;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
        const diff = (new Date(days[i - 1]) - new Date(days[i])) / 86400000;
        if (Math.round(diff) === 1) streak++;
        else break;
    }
    return streak;
};

/** Number of unique calendar days with at least one session. */
export const getUniqueDays = () => {
    const stats = getStoredStats();
    return new Set(stats.sessions.map(s => s.startTime?.slice(0, 10)).filter(Boolean)).size;
};

/** Format seconds as a human-readable duration string ("2h 15m"). */
export const formatDuration = (seconds) => {
    if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};
