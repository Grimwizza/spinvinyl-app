// ─── Supabase Keep-Alive ─────────────────────────────────────────────────────
// Supabase pauses free-tier projects after ~7 days without database activity
// (happened 2026-10, taking Last.fm/sync/collection-archive down). A Vercel
// cron (see vercel.json "crons") hits this once a day to run a trivial query.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations when
// that env var is set — if it is, any other caller is rejected.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({ error: 'Supabase not configured' });

    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from('sv_user_stats').select('username', { head: true, count: 'exact' }).limit(1);

    if (error) {
        console.error('[KeepAlive] Supabase query failed:', error.message || error);
        return res.status(502).json({ ok: false, error: error.message || 'Query failed' });
    }
    return res.status(200).json({ ok: true, at: new Date().toISOString() });
}
