import { createClient } from '@supabase/supabase-js';
import cookie from 'cookie';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Last.fm scrobble integration ─────────────────────────────────
// Optional: users can connect a Last.fm account so every "Spin This" tap
// also scrobbles there. Session key is stored server-side only
// (sv_lastfm_connections) and never sent to the client.

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';

// ─── Supabase admin client (service role — bypasses RLS) ─────────
const supabaseAdmin = () => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || key === 'your-service-role-key-here') return null;
    return createClient(url, key, { auth: { persistSession: false } });
};

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

// Last.fm request signing: sort params alphabetically (excluding format/
// callback, which are excluded from the signature per Last.fm's own docs),
// concatenate key+value pairs, append the shared secret, MD5 the result.
function signParams(params, secret) {
    const keys = Object.keys(params).filter(k => k !== 'format' && k !== 'callback').sort();
    const base = keys.map(k => `${k}${params[k]}`).join('') + secret;
    return crypto.createHash('md5').update(base, 'utf8').digest('hex');
}

async function lastfmCall(params, secret, method = 'GET') {
    const signed = { ...params, api_sig: signParams(params, secret), format: 'json' };
    const qs = new URLSearchParams(signed).toString();
    const url = method === 'GET' ? `${LASTFM_API}?${qs}` : LASTFM_API;
    const res = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
        body: method === 'POST' ? qs : undefined,
    });
    return res.json();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const apiKey = process.env.LASTFM_API_KEY;
    const secret = process.env.LASTFM_SHARED_SECRET;

    const session = parseSession(req);
    if (!session?.username) return res.status(401).json({ error: 'Not authenticated' });
    const { username } = session;

    const sb = supabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Last.fm not configured (SUPABASE_SERVICE_ROLE_KEY missing)' });

    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const url = new URL(req.url, baseUrl);
    const action = url.searchParams.get('action') || req.query?.action;

    if (!apiKey || !secret) {
        if (action === 'status') return res.status(200).json({ connected: false, configured: false });
        return res.status(503).json({ error: 'Last.fm not configured (LASTFM_API_KEY/LASTFM_SHARED_SECRET missing)' });
    }

    // ── connect: redirect the user to Last.fm's web-app auth page ──
    if (action === 'connect') {
        const cb = `${baseUrl}/api/lastfm?action=callback`;
        return res.redirect(302, `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(cb)}`);
    }

    // ── callback: exchange ?token= for a permanent session key ─────
    if (action === 'callback') {
        const token = url.searchParams.get('token');
        if (!token) return res.redirect(302, `${baseUrl}/?lastfm=error`);
        try {
            const data = await lastfmCall({ method: 'auth.getSession', api_key: apiKey, token }, secret, 'GET');
            const sessionKey = data?.session?.key;
            if (!sessionKey) {
                console.error('[LastFM] getSession failed:', data);
                return res.redirect(302, `${baseUrl}/?lastfm=error`);
            }
            const { error } = await sb.from('sv_lastfm_connections').upsert({
                username, session_key: sessionKey,
                lastfm_username: data.session.name || null,
                connected_at: new Date().toISOString(),
            }, { onConflict: 'username' });
            if (error) { console.error('[LastFM] Store error:', error); return res.redirect(302, `${baseUrl}/?lastfm=error`); }
            return res.redirect(302, `${baseUrl}/?lastfm=connected`);
        } catch (e) {
            console.error('[LastFM] Callback error:', e);
            return res.redirect(302, `${baseUrl}/?lastfm=error`);
        }
    }

    // ── status ───────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'status') {
        const { data, error } = await sb.from('sv_lastfm_connections')
            .select('lastfm_username, connected_at').eq('username', username).maybeSingle();
        if (error) { console.error('[LastFM] Status error:', error); return res.status(500).json({ error: 'Failed to read status' }); }
        return res.status(200).json({ connected: !!data, lastfmUsername: data?.lastfm_username || null, connectedAt: data?.connected_at || null, configured: true });
    }

    // ── disconnect ───────────────────────────────────────────────
    if (req.method === 'POST' && action === 'disconnect') {
        const { error } = await sb.from('sv_lastfm_connections').delete().eq('username', username);
        if (error) { console.error('[LastFM] Disconnect error:', error); return res.status(500).json({ error: 'Failed to disconnect' }); }
        return res.status(200).json({ ok: true });
    }

    // ── scrobble: server-side proxy — keeps the shared secret off the client ──
    if (req.method === 'POST' && action === 'scrobble') {
        let body;
        try { body = JSON.parse(await readBody(req)); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
        const { artist, track, timestamp } = body || {};
        if (!artist || !track) return res.status(400).json({ error: 'artist and track are required' });

        const { data: conn, error: connErr } = await sb.from('sv_lastfm_connections')
            .select('session_key').eq('username', username).maybeSingle();
        if (connErr) { console.error('[LastFM] Lookup error:', connErr); return res.status(500).json({ error: 'Failed to look up connection' }); }
        if (!conn?.session_key) return res.status(409).json({ error: 'Last.fm not connected' });

        try {
            const result = await lastfmCall({
                method: 'track.scrobble', api_key: apiKey, sk: conn.session_key,
                artist, track, timestamp: timestamp || Math.floor(Date.now() / 1000),
            }, secret, 'POST');
            if (result?.error) { console.error('[LastFM] Scrobble rejected:', result); return res.status(502).json({ error: 'Last.fm rejected the scrobble' }); }
            return res.status(200).json({ ok: true });
        } catch (e) {
            console.error('[LastFM] Scrobble error:', e);
            return res.status(502).json({ error: 'Failed to reach Last.fm' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
