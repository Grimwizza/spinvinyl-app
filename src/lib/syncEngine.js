// ─── Sync Engine ─────────────────────────────────────────────────
// Local-first: all writes go to localStorage immediately via statsEngine,
// then pushed to /api/sync in the background.
// When offline, sessions are queued and flushed on reconnect.

import { recordSession, getStoredStats, saveStats, recomputeFromSessions } from './statsEngine.js';

const SYNC_QUEUE_KEY = 'spinvinyl_sync_queue'; // Array<{ type, payload, queuedAt }>
const LAST_SYNC_KEY  = 'spinvinyl_last_sync';   // ISO timestamp string

// ─── Queue Helpers ───────────────────────────────────────────────

export const getOfflineQueue = () => {
    try {
        return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    } catch {
        return [];
    }
};

const saveQueue = (queue) => {
    try {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error('[SyncEngine] Failed to save queue:', e);
    }
};

const enqueue = (item) => {
    const queue = getOfflineQueue();
    queue.push(item);
    saveQueue(queue);
};

const clearQueue = () => localStorage.removeItem(SYNC_QUEUE_KEY);

// ─── Core Sync Operations ────────────────────────────────────────

/**
 * Push current localStorage stats to /api/sync.
 * Resolves true on success, false on network/auth error.
 */
export const pushToCloud = async (username) => {
    if (!username) return false;
    try {
        const stats = getStoredStats();
        const res = await fetch('/api/sync?action=push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ stats }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            // 503 = sync not configured yet — not a real error, skip queuing
            if (res.status === 503) return true;
            console.warn('[SyncEngine] Push failed:', err.error);
            return false;
        }
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        return true;
    } catch {
        return false;
    }
};

/**
 * Pull cloud stats and merge them into localStorage.
 * Returns true if a merge occurred (caller may want to refresh UI state).
 */
export const pullFromCloud = async (username) => {
    if (!username) return false;
    try {
        const res = await fetch('/api/sync?action=pull', {
            credentials: 'include',
        });
        if (!res.ok) {
            if (res.status === 503) return false; // not configured, skip
            console.warn('[SyncEngine] Pull failed:', res.status);
            return false;
        }
        const { stats: cloud } = await res.json();
        if (!cloud) return false;

        let merged = false;

        // Merge stats
        const local = getStoredStats();
        const localIds  = new Set(local.sessions.map(s => s.id));
        const cloudIds  = new Set((cloud.sessions || []).map(s => s.id));
        const hasNew    = [...cloudIds].some(id => !localIds.has(id));

        if (hasNew) {
            const idMap = new Map();
            for (const s of local.sessions)          idMap.set(s.id, s);
            for (const s of (cloud.sessions || []))  idMap.set(s.id, s);
            const unionSessions = [...idMap.values()].sort(
                (a, b) => (a.startTime || '') < (b.startTime || '') ? -1 : 1
            );
            saveStats(recomputeFromSessions(unionSessions));
            merged = true;
        }

        if (merged) localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        return merged;
    } catch {
        return false;
    }
};

/**
 * Record a session locally first, then push to cloud in the background.
 * If the push fails, the session is queued for later.
 * Returns the updated stats object (same shape as statsEngine.recordSession).
 */
export const recordSessionWithSync = async (sessionData, username) => {
    const updatedStats = recordSession(sessionData);

    if (username) {
        pushToCloud(username).then(ok => {
            if (!ok) {
                enqueue({ type: 'session', payload: sessionData, queuedAt: new Date().toISOString() });
            }
        });
    }

    return updatedStats;
};

/**
 * Flush the offline queue by pushing all current local stats to cloud.
 * Safe to call when the queue is empty — it will no-op.
 */
export const flushOfflineQueue = async (username) => {
    if (!username) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const ok = await pushToCloud(username);
    if (ok) {
        clearQueue();
        console.log(`[SyncEngine] Flushed ${queue.length} queued session(s)`);
    }
};
