// ─── Recommend Engine ─────────────────────────────────────────────
// Pure functions only — no side-effects, no imports, all inputs passed in.

const MOOD_GENRES = {
    morning:   ['Jazz', 'Classical', 'Folk', 'Blues', 'Acoustic', 'Ambient', 'Singer-Songwriter', 'Bossa Nova'],
    afternoon: ['Rock', 'Pop', 'Soul', 'Funk', 'Reggae', 'Country', 'Alternative', 'R&B', 'Hip Hop'],
    evening:   ['Ambient', 'Electronic', 'New Age', 'Post-Rock', 'Experimental', 'Shoegaze', 'Indie'],
    night:     [], // no filter — anything goes
};

/**
 * Current time-of-day slot.
 * morning:   05:00–11:59
 * afternoon: 12:00–17:59
 * evening:   18:00–21:59
 * night:     22:00–04:59
 */
export const getTimeSlot = (hour = new Date().getHours()) => {
    if (hour >= 5  && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
};

export const TIME_SLOT_LABELS = {
    morning:   'Morning',
    afternoon: 'Afternoon',
    evening:   'Evening',
    night:     'Late Night',
};

/** Extract all genre + style strings from a release's basic_information. */
const releaseGenres = (release) => {
    const info = release.basic_information || {};
    return [...(info.genres || []), ...(info.styles || [])];
};

/**
 * "Forgotten Gems" — albums with the lowest play count, zeros first.
 * Tiebreaker: date_added ascending (oldest owned first).
 */
export const getForgottenGems = (releases, albumPlayCounts, n = 5) => {
    return [...releases]
        .sort((a, b) => {
            const countA = albumPlayCounts[String(a.id)] || 0;
            const countB = albumPlayCounts[String(b.id)] || 0;
            if (countA !== countB) return countA - countB;
            // Oldest in collection first as tiebreaker
            return (a.date_added || '') < (b.date_added || '') ? -1 : 1;
        })
        .slice(0, n);
};

/**
 * Mood picks — filter by current time-slot genres, sort by lowest play count.
 * Falls back to the full collection if no genre matches.
 */
export const getMoodPicks = (releases, albumPlayCounts, slot, n = 5) => {
    const targetGenres = MOOD_GENRES[slot] || [];

    const eligible = targetGenres.length === 0
        ? releases
        : releases.filter(r => {
            const genres = releaseGenres(r);
            return genres.some(g =>
                targetGenres.some(tg => g.toLowerCase().includes(tg.toLowerCase()))
            );
        });

    const pool = eligible.length > 0 ? eligible : releases;

    return [...pool]
        .sort((a, b) => {
            const countA = albumPlayCounts[String(a.id)] || 0;
            const countB = albumPlayCounts[String(b.id)] || 0;
            return countA - countB;
        })
        .slice(0, n);
};

/**
 * Single random pick from the collection.
 */
export const getRandomPick = (releases) => {
    if (!releases.length) return null;
    return releases[Math.floor(Math.random() * releases.length)];
};
