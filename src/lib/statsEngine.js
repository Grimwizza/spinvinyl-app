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

export const saveStats = (stats) => {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('[StatsEngine] Failed to save:', e);
    }
};

/**
 * Recompute all derived aggregates from a sessions array.
 * Returns a full stats object. Does NOT save — caller decides.
 * Used by syncEngine after merging local + cloud sessions.
 */
export const recomputeFromSessions = (sessions) => {
    const stats = defaultStats();
    stats.sessions = sessions;
    for (const s of sessions) {
        const key = String(s.albumId);
        stats.albumPlayCounts[key] = (stats.albumPlayCounts[key] || 0) + 1;
        (s.genres || []).forEach(g => { if (g) stats.genrePlays[g] = (stats.genrePlays[g] || 0) + 1; });
        (s.labels || []).forEach(l => { if (l) stats.labelPlays[l] = (stats.labelPlays[l] || 0) + 1; });
        if (s.year > 0) {
            const decade = `${Math.floor(s.year / 10) * 10}s`;
            stats.decadePlays[decade] = (stats.decadePlays[decade] || 0) + 1;
        }
        stats.totalSessions += 1;
    }
    return stats;
};

// ─── Session Recording ───────────────────────────────────────────

/**
 * Record a spin (a single "mark as spun" tap — timestamp only, no duration).
 * @param {object} session
 * @param {number} session.albumId
 * @param {string} session.albumTitle
 * @param {string} session.artist
 * @param {string[]} session.genres
 * @param {number}  session.year
 * @param {string[]} session.labels
 * @param {string}  session.startTime — ISO-8601
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

    saveStats(stats);
    return stats;
};

// ─── Queries ─────────────────────────────────────────────────────

const toDateStr = (date) => date.toISOString().slice(0, 10);

/** Number of spins logged in a given period. period: 'today' | 'week' | 'month' | 'year' | 'all' */
export const getPeriodSpinCount = (period) => {
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
        .length;
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

/** Sorted decade breakdown: [{ decade, count }] */
export const getDecadeBreakdown = () => {
    const stats = getStoredStats();
    return Object.entries(stats.decadePlays)
        .sort(([, a], [, b]) => b - a)
        .map(([decade, count]) => ({ decade, count }));
};

/**
 * Day activity map for the calendar heatmap.
 * Returns { 'YYYY-MM-DD': spinCount }.
 */
export const getDayMap = () => {
    const stats = getStoredStats();
    const map = {};
    stats.sessions.forEach(s => {
        const day = s.startTime?.slice(0, 10);
        if (day) map[day] = (map[day] || 0) + 1;
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

/**
 * Weekly digest: spins logged this calendar week, artists spun for the
 * first time ever this week, and the current streak. Powers the Explore
 * tab's Weekly Recap card. Uses the same Sunday-start week boundary as
 * getPeriodSpinCount('week') for a consistent "this week" definition.
 */
export const getWeeklyRecap = () => {
    const stats = getStoredStats();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = toDateStr(weekStart);

    const firstSeenByArtist = new Map();
    stats.sessions.forEach(s => {
        if (!s.artist || !s.startTime) return;
        const day = s.startTime.slice(0, 10);
        if (!firstSeenByArtist.has(s.artist) || day < firstSeenByArtist.get(s.artist)) {
            firstSeenByArtist.set(s.artist, day);
        }
    });
    const newArtists = [...firstSeenByArtist.values()].filter(day => day >= weekStartStr).length;

    return {
        spins: getPeriodSpinCount('week'),
        newArtists,
        streak: getCurrentStreak(),
    };
};
