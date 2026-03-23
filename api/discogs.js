import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import cookie from 'cookie';
import * as dotenv from 'dotenv';
dotenv.config();

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'SpinVinyl/1.0 +https://aimlow.ai';

// Initialize OAuth
const oauth = OAuth({
    consumer: {
        key: process.env.DISCOGS_CONSUMER_KEY,
        secret: process.env.DISCOGS_CONSUMER_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    },
});

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.DISCOGS_CONSUMER_KEY || !process.env.DISCOGS_CONSUMER_SECRET) {
        return res.status(500).json({ error: 'OAuth credentials not set in environment.' });
    }

    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const url = new URL(req.url, baseUrl);
    const action = url.searchParams.get('action') || req.query?.action;

    // --- OAuth Flow Endpoints --- //

    // 1. Initiate Login (Get Request Token)
    if (action === 'login') {
        const callbackUrl = `${baseUrl}/api/discogs?action=callback`;
        const requestData = {
            url: `${DISCOGS_BASE}/oauth/request_token`,
            method: 'GET',
            data: {
                oauth_callback: callbackUrl
            }
        };

        try {
            const authHeader = oauth.toHeader(oauth.authorize(requestData));
            const response = await fetch(requestData.url, {
                headers: {
                    ...authHeader,
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to get request token: ${response.status} ${text}`);
            }

            const data = await response.text();
            const params = new URLSearchParams(data);
            const oauth_token = params.get('oauth_token');
            const oauth_token_secret = params.get('oauth_token_secret');

            if (!oauth_token || !oauth_token_secret) {
                throw new Error('Missing tokens in response');
            }

            // Store the request secret in a temporary cookie so we can use it in the callback
            res.setHeader('Set-Cookie', cookie.serialize('discogs_request_secret', oauth_token_secret, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 15, // 15 minutes
            }));

            // Redirect user to Discogs to authorize the app
            res.redirect(302, `https://www.discogs.com/oauth/authorize?oauth_token=${oauth_token}`);
            return;
        } catch (error) {
            console.error('[OAuth Login]', error);
            return res.status(500).json({ error: 'Failed to initiate login' });
        }
    }

    // 2. Callback (Exchange for Access Token)
    if (action === 'callback') {
        const oauth_token = url.searchParams.get('oauth_token');
        const oauth_verifier = url.searchParams.get('oauth_verifier');

        // Retrieve the request secret we stored in the cookie
        const cookies = cookie.parse(req.headers.cookie || '');
        const oauth_token_secret = cookies.discogs_request_secret;

        if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
            return res.status(400).send('Missing OAuth parameters or session expired');
        }

        const requestData = {
            url: `${DISCOGS_BASE}/oauth/access_token`,
            method: 'POST',
            data: { oauth_verifier },
        };

        const token = { key: oauth_token, secret: oauth_token_secret };

        try {
            const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
            const response = await fetch(requestData.url, {
                method: 'POST',
                headers: {
                    ...authHeader,
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to get access token: ${response.status} ${text}`);
            }

            const data = await response.text();
            const params = new URLSearchParams(data);
            const access_token = params.get('oauth_token');
            const access_secret = params.get('oauth_token_secret');

            // Find out who the user is using the new access token
            const identityReq = { url: `${DISCOGS_BASE}/oauth/identity`, method: 'GET' };
            const authIdentToken = { key: access_token, secret: access_secret };
            const identHeader = oauth.toHeader(oauth.authorize(identityReq, authIdentToken));

            const identRes = await fetch(identityReq.url, {
                headers: { ...identHeader, 'User-Agent': USER_AGENT }
            });
            const identData = await identRes.json();
            const username = identData.username;

            // Store the final access tokens and username securely in an encrypted HTTP-only cookie
            const sessionData = JSON.stringify({ access_token, access_secret, username });
            // In a real production app, this should be encrypted (e.g. using @hapi/iron).
            // For this implementation, we will store it encoded (since this runs on serverless).
            const encodedSession = Buffer.from(sessionData).toString('base64');

            res.setHeader('Set-Cookie', [
                cookie.serialize('discogs_session', encodedSession, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 30, // 30 days
                }),
                // Clear the temporary request secret
                cookie.serialize('discogs_request_secret', '', { maxAge: -1, path: '/' })
            ]);

            // Redirect the user back to the Web App Root
            res.redirect(302, `${baseUrl}/`);
            return;
        } catch (error) {
            console.error('[OAuth Callback]', error);
            return res.status(500).send('Authentication failed');
        }
    }

    // 3. Status Check (Is user logged in?)
    if (action === 'status') {
        const cookies = cookie.parse(req.headers.cookie || '');
        if (!cookies.discogs_session) {
            return res.status(401).json({ authenticated: false });
        }
        try {
            const session = JSON.parse(Buffer.from(cookies.discogs_session, 'base64').toString('ascii'));
            return res.status(200).json({ authenticated: true, username: session.username });
        } catch {
            return res.status(401).json({ authenticated: false });
        }
    }

    // 4. Logout
    if (action === 'logout') {
        res.setHeader('Set-Cookie', cookie.serialize('discogs_session', '', { maxAge: -1, path: '/' }));
        return res.status(200).json({ success: true });
    }

    // --- Authenticated Data Endpoints --- //

    // Ensure user has an active session before making API calls
    const cookies = cookie.parse(req.headers.cookie || '');
    if (!cookies.discogs_session) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    let session;
    try {
        session = JSON.parse(Buffer.from(cookies.discogs_session, 'base64').toString('ascii'));
    } catch {
        return res.status(401).json({ error: 'Invalid session cookie.' });
    }

    const userToken = { key: session.access_token, secret: session.access_secret };
    const username = session.username;

    // Parse API query params
    const page = url.searchParams.get('page') || req.query?.page || '1';
    const perPage = url.searchParams.get('per_page') || req.query?.per_page || '100';
    const releaseId = url.searchParams.get('id') || req.query?.id;
    const sort = url.searchParams.get('sort') || req.query?.sort || 'artist';
    const sortOrder = url.searchParams.get('sort_order') || req.query?.sort_order || 'asc';

    let apiUrl;
    let apiMethod = 'GET';

    switch (action) {
        case 'collection':
            apiUrl = `${DISCOGS_BASE}/users/${username}/collection/folders/0/releases?page=${page}&per_page=${perPage}&sort=${sort}&sort_order=${sortOrder}`;
            break;
        case 'release':
            if (!releaseId) return res.status(400).json({ error: 'Missing release id' });
            apiUrl = `${DISCOGS_BASE}/releases/${releaseId}`;
            break;
        case 'artist':
            if (!releaseId) return res.status(400).json({ error: 'Missing artist id' });
            apiUrl = `${DISCOGS_BASE}/artists/${releaseId}`;
            break;
        // ─── Full collection paginator ─────────────────────────────────
        case 'collectionAll': {
            // Fetches ALL pages of the user's collection and returns a flat array.
            // This is used for cross-referencing against external data sources.
            const PER = 100; // max allowed by Discogs
            let currentPage = 1;
            let totalPages = 1;
            const allReleases = [];

            try {
                do {
                    const collUrl = `${DISCOGS_BASE}/users/${username}/collection/folders/0/releases?page=${currentPage}&per_page=${PER}&sort=artist&sort_order=asc`;
                    const collReq = { url: collUrl, method: 'GET' };
                    const collHeader = oauth.toHeader(oauth.authorize(collReq, userToken));
                    const collRes = await fetch(collUrl, {
                        headers: { ...collHeader, 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
                    });
                    if (!collRes.ok) break;
                    const collData = await collRes.json();
                    allReleases.push(...(collData.releases || []));
                    totalPages = collData.pagination?.pages || 1;
                    currentPage++;
                } while (currentPage <= totalPages);

                return res.status(200).json({ releases: allReleases, total: allReleases.length });
            } catch (collErr) {
                console.error('[collectionAll] Error:', collErr);
                return res.status(500).json({ error: 'Failed to fetch full collection.' });
            }
        }
        // ─── New Releases Tab actions ──────────────────────────────────
        case 'artistReleases': {
            // Full discography for an artist — used for gap analysis
            if (!releaseId) return res.status(400).json({ error: 'Missing artist id' });
            const arPage = url.searchParams.get('page') || '1';
            const arPerPage = url.searchParams.get('per_page') || '100';
            apiUrl = `${DISCOGS_BASE}/artists/${releaseId}/releases?sort=year&sort_order=desc&page=${arPage}&per_page=${arPerPage}`;
            break;
        }
        case 'artistMasters': {
            // Search for master (canonical) releases by artist name — used for gap analysis.
            // Masters deduplicate pressings/reissues into one entry per album, so this returns
            // a clean album list (~50 results) rather than the full discography (100s of pages).
            const amArtist = url.searchParams.get('artist') || req.query?.artist || '';
            if (!amArtist) return res.status(400).json({ error: 'Missing artist name' });
            const amPage = url.searchParams.get('page') || '1';
            apiUrl = `${DISCOGS_BASE}/database/search?artist=${encodeURIComponent(amArtist)}&type=master&per_page=100&page=${amPage}`;
            break;
        }
        case 'newReleases': {
            // Search for recent vinyl releases by artist name
            const artistName = url.searchParams.get('artist') || req.query?.artist || '';
            if (!artistName) return res.status(400).json({ error: 'Missing artist name' });
            apiUrl = `${DISCOGS_BASE}/database/search?artist=${encodeURIComponent(artistName)}&type=release&format=Vinyl&sort=year&sort_order=desc&per_page=5`;
            break;
        }
        case 'searchRelease': {
            // Search Discogs by query string — used for genre enrichment of upcoming releases
            const q = url.searchParams.get('q') || req.query?.q || '';
            if (!q) return res.status(400).json({ error: 'Missing query' });
            apiUrl = `${DISCOGS_BASE}/database/search?q=${encodeURIComponent(q)}&type=release&format=Vinyl&per_page=3`;
            break;
        }
        case 'addToWantlist': {
            // Add a release to the user’s Discogs Wantlist
            if (!releaseId) return res.status(400).json({ error: 'Missing release id' });
            apiUrl = `${DISCOGS_BASE}/users/${username}/wants/${releaseId}`;
            apiMethod = 'PUT';
            break;
        }
        case 'getWantlist': {
            // Fetch the user's Discogs Wantlist
            apiUrl = `${DISCOGS_BASE}/users/${username}/wants?page=${page}&per_page=${perPage}&sort=added&sort_order=desc`;
            apiMethod = 'GET';
            break;
        }
        case 'removeFromWantlist': {
            // Remove a release from the user’s Discogs Wantlist
            if (!releaseId) return res.status(400).json({ error: 'Missing release id' });
            apiUrl = `${DISCOGS_BASE}/users/${username}/wants/${releaseId}`;
            apiMethod = 'DELETE';
            break;
        }
        default:
            return res.status(400).json({ error: 'Invalid action.' });
    }

    const requestData = { url: apiUrl, method: apiMethod };

    try {
        const authHeader = oauth.toHeader(oauth.authorize(requestData, userToken));
        const response = await fetch(apiUrl, {
            method: apiMethod,
            headers: {
                ...authHeader,
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Discogs API] Error ${response.status}: ${errorText}`);
            return res.status(response.status).json({ error: `API error: ${response.status}`, details: errorText });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        console.error('[Discogs API] Data fetch failed:', err);
        return res.status(500).json({ error: 'Failed to fetch data from Discogs.' });
    }
}
