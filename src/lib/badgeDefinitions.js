// ─── Badge Definitions ────────────────────────────────────────────
// Each badge: { id, name, description, emoji, category, rarity, condition(stats, collection) }
// collection: { total: number, genres: string[], releases: [] }
// stats: the full stats object from statsEngine

export const BADGE_CATEGORIES = [
    'Listening Milestones',
    'Streak & Consistency',
    'Collection Explorer',
    'Record Counts',
];

// Helper — max value in a label/genre plays map
const maxPlayCount = (map) => Math.max(0, ...Object.values(map || {}));

// Helper — consecutive days streak
const getConsecutiveDays = (stats) => {
    if (!stats.sessions?.length) return 0;
    const days = [...new Set(
        stats.sessions.map(s => s.startTime?.slice(0, 10)).filter(Boolean)
    )].sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (days[0] !== today && days[0] !== yesterday) return 0;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
        const diff = (new Date(days[i - 1]) - new Date(days[i])) / 86400000;
        if (Math.round(diff) === 1) streak++;
        else break;
    }
    return streak;
};

const getUniqueDays = (stats) => new Set(
    (stats.sessions || []).map(s => s.startTime?.slice(0, 10)).filter(Boolean)
).size;

export const BADGES = [

    // ─── Listening Milestones ─────────────────────────────────────

    {
        id: 'first_spin',
        name: 'First Spin',
        description: 'Spin your very first record',
        emoji: '🎵',
        category: 'Listening Milestones',
        rarity: 'common',
        condition: (stats) => stats.totalSessions >= 1,
    },
    {
        id: 'ten_sessions',
        name: 'Getting Into It',
        description: 'Complete 10 spin sessions',
        emoji: '🎶',
        category: 'Listening Milestones',
        rarity: 'common',
        condition: (stats) => stats.totalSessions >= 10,
    },
    {
        id: 'fifty_sessions',
        name: 'Regular Spinner',
        description: 'Complete 50 spin sessions',
        emoji: '🔁',
        category: 'Listening Milestones',
        rarity: 'uncommon',
        condition: (stats) => stats.totalSessions >= 50,
    },
    {
        id: 'century_club',
        name: 'Century Club',
        description: 'Complete 100 spin sessions',
        emoji: '💯',
        category: 'Listening Milestones',
        rarity: 'rare',
        condition: (stats) => stats.totalSessions >= 100,
    },
    {
        id: 'marathon',
        name: 'Marathon Listener',
        description: 'Accumulate 1 hour of total play time',
        emoji: '⏱️',
        category: 'Listening Milestones',
        rarity: 'common',
        condition: (stats) => stats.totalPlaySeconds >= 3600,
    },
    {
        id: 'all_nighter',
        name: 'All-Nighter',
        description: 'Accumulate 8 hours of total play time',
        emoji: '🌙',
        category: 'Listening Milestones',
        rarity: 'uncommon',
        condition: (stats) => stats.totalPlaySeconds >= 28800,
    },
    {
        id: 'vinyl_veteran',
        name: 'Vinyl Veteran',
        description: 'Accumulate 24 hours of total play time',
        emoji: '🏆',
        category: 'Listening Milestones',
        rarity: 'rare',
        condition: (stats) => stats.totalPlaySeconds >= 86400,
    },
    {
        id: 'audiophile',
        name: 'Audiophile',
        description: 'Accumulate 100 hours of total play time',
        emoji: '🔊',
        category: 'Listening Milestones',
        rarity: 'legendary',
        condition: (stats) => stats.totalPlaySeconds >= 360000,
    },

    // ─── Streak & Consistency ─────────────────────────────────────

    {
        id: 'three_day_streak',
        name: 'Daily Spins',
        description: 'Spin records on 3 consecutive days',
        emoji: '🔥',
        category: 'Streak & Consistency',
        rarity: 'common',
        condition: (stats) => getConsecutiveDays(stats) >= 3,
    },
    {
        id: 'seven_day_streak',
        name: 'Weekly Ritual',
        description: 'Spin records on 7 consecutive days',
        emoji: '📆',
        category: 'Streak & Consistency',
        rarity: 'uncommon',
        condition: (stats) => getConsecutiveDays(stats) >= 7,
    },
    {
        id: 'thirty_days',
        name: 'Monthly Regular',
        description: 'Spin records on 30 different calendar days',
        emoji: '🗓️',
        category: 'Streak & Consistency',
        rarity: 'rare',
        condition: (stats) => getUniqueDays(stats) >= 30,
    },
    {
        id: 'one_hundred_days',
        name: 'Committed Collector',
        description: 'Spin records on 100 different calendar days',
        emoji: '🎖️',
        category: 'Streak & Consistency',
        rarity: 'legendary',
        condition: (stats) => getUniqueDays(stats) >= 100,
    },

    // ─── Collection Explorer ──────────────────────────────────────

    {
        id: 'side_flip',
        name: 'Flip Side',
        description: 'Spin Side B of any record',
        emoji: '🔄',
        category: 'Collection Explorer',
        rarity: 'common',
        condition: (stats) => (stats.sessions || []).some(s => s.side === 'B'),
    },
    {
        id: 'genre_hopper',
        name: 'Genre Hopper',
        description: 'Spin records across 5 different genres',
        emoji: '🎸',
        category: 'Collection Explorer',
        rarity: 'uncommon',
        condition: (stats) => Object.keys(stats.genrePlays || {}).length >= 5,
    },
    {
        id: 'era_explorer',
        name: 'Era Explorer',
        description: 'Spin records from 5 different decades',
        emoji: '📅',
        category: 'Collection Explorer',
        rarity: 'uncommon',
        condition: (stats) => Object.keys(stats.decadePlays || {}).length >= 5,
    },
    {
        id: 'label_loyalty',
        name: 'Label Loyalty',
        description: 'Spin 5+ records from the same label',
        emoji: '🏷️',
        category: 'Collection Explorer',
        rarity: 'uncommon',
        condition: (stats) => maxPlayCount(stats.labelPlays) >= 5,
    },
    {
        id: 'deep_cuts',
        name: 'Deep Cuts',
        description: 'Spin at least 25% of your collection',
        emoji: '💿',
        category: 'Collection Explorer',
        rarity: 'uncommon',
        condition: (stats, collection) => {
            if (!collection?.total) return false;
            return Object.keys(stats.albumPlayCounts || {}).length >= Math.ceil(collection.total * 0.25);
        },
    },
    {
        id: 'crate_digger',
        name: 'Crate Digger',
        description: 'Spin at least 50% of your collection',
        emoji: '📦',
        category: 'Collection Explorer',
        rarity: 'rare',
        condition: (stats, collection) => {
            if (!collection?.total) return false;
            return Object.keys(stats.albumPlayCounts || {}).length >= Math.ceil(collection.total * 0.5);
        },
    },
    {
        id: 'full_collection',
        name: 'Full Collection',
        description: 'Spin every record in your collection at least once',
        emoji: '🌟',
        category: 'Collection Explorer',
        rarity: 'legendary',
        condition: (stats, collection) => {
            if (!collection?.total) return false;
            return Object.keys(stats.albumPlayCounts || {}).length >= collection.total;
        },
    },

    // ─── Record Counts ────────────────────────────────────────────

    {
        id: 'starter_shelf',
        name: 'Starter Shelf',
        description: 'Own 10+ records in your Discogs collection',
        emoji: '📚',
        category: 'Record Counts',
        rarity: 'common',
        condition: (_stats, collection) => (collection?.total || 0) >= 10,
    },
    {
        id: 'serious_collector',
        name: 'Serious Collector',
        description: 'Own 50+ records in your Discogs collection',
        emoji: '🗄️',
        category: 'Record Counts',
        rarity: 'uncommon',
        condition: (_stats, collection) => (collection?.total || 0) >= 50,
    },
    {
        id: 'wall_of_sound',
        name: 'Wall of Sound',
        description: 'Own 100+ records in your Discogs collection',
        emoji: '🏛️',
        category: 'Record Counts',
        rarity: 'rare',
        condition: (_stats, collection) => (collection?.total || 0) >= 100,
    },
    {
        id: 'archive',
        name: 'Archive',
        description: 'Own 250+ records in your Discogs collection',
        emoji: '🗃️',
        category: 'Record Counts',
        rarity: 'rare',
        condition: (_stats, collection) => (collection?.total || 0) >= 250,
    },
    {
        id: 'discogs_legend',
        name: 'Discogs Legend',
        description: 'Own 500+ records in your Discogs collection',
        emoji: '👑',
        category: 'Record Counts',
        rarity: 'legendary',
        condition: (_stats, collection) => (collection?.total || 0) >= 500,
    },
];

export const RARITY_COLORS = {
    common: { bg: 'bg-gray-700/50', border: 'border-gray-600', text: 'text-gray-300', glow: '' },
    uncommon: { bg: 'bg-violet-900/30', border: 'border-violet-600/50', text: 'text-violet-300', glow: 'shadow-violet-500/20' },
    rare: { bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-300', glow: 'shadow-blue-500/20' },
    legendary: { bg: 'bg-amber-900/30', border: 'border-amber-500/50', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
};
