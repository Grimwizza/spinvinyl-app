import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Personal collection archive ──────────────────────────────────
// Strictly per-user: each user's own collection, stored to be served back to
// that same user only. See supabase/schema_collection_archive.sql for the
// table definition and the reasoning behind it (Discogs API ToS classifies
// "collection" as Restricted Data — not a shared/cross-user catalog).

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

const MAX_BATCH = 500; // server-side guard even though the client sends smaller batches
const ALLOWED_PROVENANCE = new Set(['scan', 'search', 'matrix', 'photo', 'edit', 'backfill']);

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
        return res.status(503).json({ error: 'Archive not configured (SUPABASE_SERVICE_ROLE_KEY missing)' });
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || req.query?.action;

    // ── status: cheap read for the UI (count + last updated) ──────
    if (req.method === 'GET' && action === 'status') {
        const { count, error: countErr } = await sb.from('sv_collection_archive')
            .select('id', { count: 'exact', head: true })
            .eq('username', username);
        if (countErr) {
            console.error('[CollectionArchive] Status count error:', countErr);
            return res.status(500).json({ error: 'Failed to read archive status' });
        }
        const { data: latest, error: latestErr } = await sb.from('sv_collection_archive')
            .select('updated_at')
            .eq('username', username)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (latestErr) {
            console.error('[CollectionArchive] Status latest error:', latestErr);
            return res.status(500).json({ error: 'Failed to read archive status' });
        }
        return res.status(200).json({ count: count || 0, lastUpdatedAt: latest?.updated_at || null });
    }

    // ── upsert: single item (ongoing capture) or batch (backfill) ──
    if (req.method === 'POST' && action === 'upsert') {
        let body;
        try {
            body = JSON.parse(await readBody(req));
        } catch {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_BATCH) : [];
        if (items.length === 0) return res.status(400).json({ error: 'No items provided' });

        const rows = [];
        for (const it of items) {
            if (!it.release_id || !it.instance_id) continue;
            if (!ALLOWED_PROVENANCE.has(it.provenance)) continue;
            rows.push({
                username, // never trust a client-sent value
                release_id: Number(it.release_id),
                instance_id: Number(it.instance_id),
                folder_id: it.folder_id != null ? Number(it.folder_id) : null,
                rating: it.rating != null ? Number(it.rating) : null,
                fields: it.fields ?? [],
                barcode: it.barcode ?? null,
                date_added: it.date_added ?? null,
                title: it.title ?? null,
                artist: it.artist ?? null,
                year: it.year ?? null,
                country: it.country ?? null,
                format: it.format ?? null,
                label: it.label ?? null,
                genre: it.genre ?? null,
                style: it.style ?? null,
                catno: it.catno ?? null,
                cover_image: it.cover_image ?? null,
                thumb: it.thumb ?? null,
                provenance: it.provenance,
                provenance_query: it.provenance_query ?? null,
                raw: it.raw ?? {},
                updated_at: new Date().toISOString(),
                // created_at intentionally omitted — the column default (now())
                // should only apply on first INSERT, never overwritten on UPDATE.
            });
        }
        if (rows.length === 0) return res.status(400).json({ error: 'No valid items after validation' });

        const { error } = await sb.from('sv_collection_archive')
            .upsert(rows, { onConflict: 'username,instance_id' });
        if (error) {
            console.error('[CollectionArchive] Upsert error:', error);
            return res.status(500).json({ error: 'Failed to save archive items' });
        }
        return res.status(200).json({ ok: true, saved: rows.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
