import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Supabase admin client (service role — bypasses RLS) ─────────
const supabaseAdmin = () => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || key === 'your-service-role-key-here') return null;
    return createClient(url, key, { auth: { persistSession: false } });
};

// ─── Helpers ─────────────────────────────────────────────────────

/** Parse the Discogs session cookie → { access_token, access_secret, username } | null */
function parseSession(req) {
    try {
        const cookies = cookie.parse(req.headers.cookie || '');
        if (!cookies.discogs_session) return null;
        return JSON.parse(Buffer.from(cookies.discogs_session, 'base64').toString('ascii'));
    } catch {
        return null;
    }
}

/** Read raw POST body as a string, handling both Vercel (pre-parsed) and Vite dev (stream). */
async function readBody(req) {
    if (req.body !== undefined) {
        if (typeof req.body === 'string') return req.body;
        if (typeof req.body === 'object') return JSON.stringify(req.body);
    }
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk.toString(); });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

/**
 * Recompute all derived aggregates from a sessions array.
 * Returns a full stats object without saving — caller persists.
 */
function recomputeStats(sessions) {
    const stats = {
        sessions,
        albumPlayCounts: {},
        genrePlays: {},
        labelPlays: {},
        decadePlays: {},
        totalSessions: 0,
        totalPlaySeconds: 0,
    };
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
        stats.totalPlaySeconds += s.durationSeconds || 0;
    }
    return stats;
}

/** Dedup sessions array by id, keeping last occurrence (incoming wins). */
function unionSessions(existing, incoming) {
    const map = new Map();
    for (const s of existing) map.set(s.id, s);
    for (const s of incoming) map.set(s.id, s);
    return [...map.values()].sort((a, b) => (a.startTime || '') < (b.startTime || '') ? -1 : 1);
}

// ─── Handler ─────────────────────────────────────────────────────

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const session = parseSession(req);
    if (!session?.username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const { username } = session;

    const sb = supabaseAdmin();
    if (!sb) {
        return res.status(503).json({ error: 'Sync not configured (SUPABASE_SERVICE_ROLE_KEY missing)' });
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || req.query?.action;

    // ── ping: lightweight auth check ──────────────────────────────
    if (action === 'ping') {
        return res.status(200).json({ ok: true, username });
    }

    // ── pull: fetch cloud data for this user ──────────────────────
    if (req.method === 'GET' && action === 'pull') {
        const [statsRow, badgesRow] = await Promise.all([
            sb.from('sv_user_stats').select('*').eq('username', username).single(),
            sb.from('sv_user_badges').select('*').eq('username', username).single(),
        ]);

        const stats = statsRow.data
            ? {
                sessions: statsRow.data.sessions || [],
                albumPlayCounts: statsRow.data.album_play_counts || {},
                genrePlays: statsRow.data.genre_plays || {},
                labelPlays: statsRow.data.label_plays || {},
                decadePlays: statsRow.data.decade_plays || {},
                totalSessions: statsRow.data.total_sessions || 0,
                totalPlaySeconds: statsRow.data.total_play_seconds || 0,
            }
            : null;

        const badges = badgesRow.data
            ? { earned: badgesRow.data.earned || [], seen: badgesRow.data.seen || [] }
            : null;

        return res.status(200).json({ stats, badges });
    }

    // ── push: merge incoming stats + badges into cloud ────────────
    if (req.method === 'POST' && action === 'push') {
        let body;
        try {
            const raw = await readBody(req);
            body = JSON.parse(raw);
        } catch {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        const { stats: incoming, badges: incomingBadges } = body;

        // Stats merge
        if (incoming?.sessions !== undefined) {
            const existingRow = await sb
                .from('sv_user_stats')
                .select('sessions')
                .eq('username', username)
                .single();

            const existingSessions = existingRow.data?.sessions || [];
            const merged = recomputeStats(unionSessions(existingSessions, incoming.sessions || []));

            const { error: upsertErr } = await sb.from('sv_user_stats').upsert({
                username,
                sessions: merged.sessions,
                album_play_counts: merged.albumPlayCounts,
                genre_plays: merged.genrePlays,
                label_plays: merged.labelPlays,
                decade_plays: merged.decadePlays,
                total_sessions: merged.totalSessions,
                total_play_seconds: merged.totalPlaySeconds,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'username' });

            if (upsertErr) {
                console.error('[Sync] Stats upsert error:', upsertErr);
                return res.status(500).json({ error: 'Failed to save stats' });
            }
        }

        // Badges merge
        if (incomingBadges) {
            const existingBadgesRow = await sb
                .from('sv_user_badges')
                .select('earned, seen')
                .eq('username', username)
                .single();

            const existingEarned = existingBadgesRow.data?.earned || [];
            const existingSeen = existingBadgesRow.data?.seen || [];

            const mergedEarned = [...new Set([...existingEarned, ...(incomingBadges.earned || [])])];
            const mergedSeen   = [...new Set([...existingSeen,   ...(incomingBadges.seen   || [])])];

            const { error: badgeErr } = await sb.from('sv_user_badges').upsert({
                username,
                earned: mergedEarned,
                seen: mergedSeen,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'username' });

            if (badgeErr) {
                console.error('[Sync] Badges upsert error:', badgeErr);
                return res.status(500).json({ error: 'Failed to save badges' });
            }
        }

        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
