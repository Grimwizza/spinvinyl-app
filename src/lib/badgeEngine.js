// ─── Badge Engine ─────────────────────────────────────────────────
// Evaluates badge conditions and manages earned/seen state in localStorage.

import { BADGES } from './badgeDefinitions.js';

const BADGE_KEY = 'spinvinyl_badges';

const getBadgeState = () => {
    try {
        const raw = localStorage.getItem(BADGE_KEY);
        return raw ? JSON.parse(raw) : { earned: [], seen: [] };
    } catch {
        return { earned: [], seen: [] };
    }
};

const saveBadgeState = (state) => {
    try {
        localStorage.setItem(BADGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('[BadgeEngine] Failed to save:', e);
    }
};

/** Returns full badge objects for all earned badges. */
export const getEarnedBadges = () => {
    const { earned } = getBadgeState();
    return BADGES.filter(b => earned.includes(b.id));
};

/** Returns badge IDs that have been earned but not yet shown (the "toast queue"). */
export const getUnseenBadgeIds = () => {
    const { earned, seen } = getBadgeState();
    return earned.filter(id => !seen.includes(id));
};

/** Mark badge IDs as seen so they don't show toasts again. */
export const markBadgesSeen = (ids) => {
    const state = getBadgeState();
    saveBadgeState({ ...state, seen: [...new Set([...state.seen, ...ids])] });
};

/**
 * Evaluate all badge conditions against the current stats + collection.
 * New badges are saved and returned as badge objects.
 *
 * @param {object} stats    — from statsEngine.getStoredStats()
 * @param {object} collection — { total: number }
 * @returns {Array} newly earned badge objects
 */
export const checkAndAwardBadges = (stats, collection) => {
    const state = getBadgeState();
    const newlyEarnedIds = [];

    for (const badge of BADGES) {
        if (state.earned.includes(badge.id)) continue;
        try {
            if (badge.condition(stats, collection)) {
                newlyEarnedIds.push(badge.id);
            }
        } catch {
            // Condition threw (e.g. missing data) — skip silently
        }
    }

    if (newlyEarnedIds.length > 0) {
        saveBadgeState({ earned: [...state.earned, ...newlyEarnedIds], seen: state.seen });
        console.log('[BadgeEngine] Newly awarded:', newlyEarnedIds);
    }

    return BADGES.filter(b => newlyEarnedIds.includes(b.id));
};

/** True if this badge has been earned. */
export const isBadgeEarned = (badgeId) => getBadgeState().earned.includes(badgeId);
