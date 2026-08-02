
// API handlers are lazy-loaded on first use to avoid pulling cheerio and other
// server-only dependencies into the Vite config bundling step.
let _handlers = null;
async function getHandlers() {
    if (_handlers) return _handlers;
    const [discogs, lyrics, releases, upcoming, upcomingDetail, shops, searchShops, sync, identify, collectionArchive] = await Promise.all([
        import('./api/discogs.js'),
        import('./api/lyrics.js'),
        import('./api/releases.js'),
        import('./api/upcoming.js'),
        import('./api/upcoming-detail.js'),
        import('./api/shops.js'),
        import('./api/search-shops.js'),
        import('./api/sync.js'),
        import('./api/identify.js'),
        import('./api/collection-archive.js'),
    ]);
    _handlers = {
        discogs: discogs.default,
        lyrics: lyrics.default,
        releases: releases.default,
        upcoming: upcoming.default,
        upcomingDetail: upcomingDetail.default,
        shops: shops.default,
        searchShops: searchShops.default,
        sync: sync.default,
        identify: identify.default,
        collectionArchive: collectionArchive.default,
    };
    return _handlers;
}

// Helper to mock Vercel/Express 'res' object for Serverless Functions
const mockResponse = (resolve, res) => {
    const mock = {
        statusCode: 200,
        headers: {},
        status: (code) => {
            mock.statusCode = code;
            return mock;
        },
        setHeader: (key, value) => {
            mock.headers[key] = value;
            return mock;
        },
        json: (data) => {
            res.setHeader('Content-Type', 'application/json');
            Object.entries(mock.headers).forEach(([k, v]) => res.setHeader(k, v));
            res.statusCode = mock.statusCode;
            res.end(JSON.stringify(data));
            resolve();
            return mock;
        },
        end: () => {
            res.statusCode = mock.statusCode;
            Object.entries(mock.headers).forEach(([k, v]) => res.setHeader(k, v));
            res.end();
            resolve();
            return mock;
        },
        send: (data) => {
            res.statusCode = mock.statusCode;
            Object.entries(mock.headers).forEach(([k, v]) => res.setHeader(k, v));
            res.end(data);
            resolve();
            return mock;
        },
        redirect: (arg1, arg2) => {
            const code = typeof arg1 === 'number' ? arg1 : 302;
            const targetUrl = typeof arg1 === 'string' ? arg1 : arg2;
            res.statusCode = code;
            res.setHeader('Location', targetUrl);
            Object.entries(mock.headers).forEach(([k, v]) => res.setHeader(k, v));
            res.end();
            resolve();
            return mock;
        }
    };
    return mock;
};

import fs from 'fs';
import path from 'path';

// ... imports ...

export const apiMiddleware = () => ({
    name: 'api-middleware',
    configureServer(server) {
        server.middlewares.use('/api', async (req, res, next) => {
            const url = req.url.split('?')[0];

            // FORCE LOAD ENV
            try {
                const envPath = path.resolve(process.cwd(), '.env');
                if (fs.existsSync(envPath)) {
                    const envConfig = fs.readFileSync(envPath, 'utf8');



                    // Load Discogs credentials
                    const discogsTokenMatch = envConfig.match(/^DISCOGS_TOKEN=(.*)$/m);
                    if (discogsTokenMatch && discogsTokenMatch[1]) {
                        process.env.DISCOGS_TOKEN = discogsTokenMatch[1].replace(/["']/g, '').trim();
                    }
                    const discogsUserMatch = envConfig.match(/^DISCOGS_USERNAME=(.*)$/m);
                    if (discogsUserMatch && discogsUserMatch[1]) {
                        process.env.DISCOGS_USERNAME = discogsUserMatch[1].replace(/["']/g, '').trim();
                    }

                    // Load New Discogs OAuth OAuth Credentials
                    const discogsConsumerKeyMatch = envConfig.match(/^DISCOGS_CONSUMER_KEY=(.*)$/m);
                    if (discogsConsumerKeyMatch && discogsConsumerKeyMatch[1]) {
                        process.env.DISCOGS_CONSUMER_KEY = discogsConsumerKeyMatch[1].replace(/["']/g, '').trim();
                        console.log('[API Proxy] Reloaded DISCOGS_CONSUMER_KEY from .env');
                    }

                    const discogsConsumerSecretMatch = envConfig.match(/^DISCOGS_CONSUMER_SECRET=(.*)$/m);
                    if (discogsConsumerSecretMatch && discogsConsumerSecretMatch[1]) {
                        process.env.DISCOGS_CONSUMER_SECRET = discogsConsumerSecretMatch[1].replace(/["']/g, '').trim();
                        console.log('[API Proxy] Reloaded DISCOGS_CONSUMER_SECRET from .env');
                    }

                    const googlePlacesKeyMatch = envConfig.match(/^GOOGLE_PLACES_API_KEY=(.*)$/m);
                    if (googlePlacesKeyMatch && googlePlacesKeyMatch[1]) {
                        process.env.GOOGLE_PLACES_API_KEY = googlePlacesKeyMatch[1].replace(/["']/g, '').trim();
                    }

                    const braveSearchKeyMatch = envConfig.match(/^BRAVE_SEARCH_API_KEY=(.*)$/m);
                    if (braveSearchKeyMatch && braveSearchKeyMatch[1]) {
                        process.env.BRAVE_SEARCH_API_KEY = braveSearchKeyMatch[1].replace(/["']/g, '').trim();
                    }

                    const anthropicKeyMatch = envConfig.match(/^ANTHROPIC_API_KEY=(.*)$/m);
                    if (anthropicKeyMatch && anthropicKeyMatch[1]) {
                        process.env.ANTHROPIC_API_KEY = anthropicKeyMatch[1].replace(/["']/g, '').trim();
                    }
                }
            } catch (e) {
                console.error('[API Proxy] Failed to reload .env', e);
            }

            const h = await getHandlers();

            // Vercel parses JSON POST bodies into req.body automatically in production;
            // this dev server doesn't, so mirror that here for handlers that read req.body.
            if (req.method === 'POST' && req.body === undefined) {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const raw = Buffer.concat(chunks).toString('utf8');
                try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
            }

            // --- ROUTE: /api/discogs (Serverless / Express Style) ---
            if (url === '/discogs') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.discogs(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/lyrics ---
            if (url === '/lyrics') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.lyrics(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/identify (AI photo cover identification) ---
            if (url === '/identify') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.identify(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/releases (RSS news feed aggregator) ---
            if (url === '/releases') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.releases(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/upcoming (upcomingvinyl.com scraper) ---
            if (url === '/upcoming') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.upcoming(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/upcoming-detail (upcomingvinyl.com record detail scraper) ---
            if (url === '/upcoming-detail') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
                        req.query = { url: urlParams.get('url') };
                        h.upcomingDetail(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/shops (Google Places record store finder) ---
            if (url === '/shops') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.shops(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/sync (Cloud Sync push/pull) ---
            if (url === '/sync') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.sync(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/collection-archive (personal collection archive) ---
            if (url === '/collection-archive') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.collectionArchive(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            // --- ROUTE: /api/search-shops (Brave Search / Gemini augmented search) ---
            if (url === '/search-shops') {
                try {
                    await new Promise((resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        h.searchShops(req, mockedRes).catch(reject);
                    });
                } catch (err) {
                    console.error(`API Error (${url}):`, err);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
                return;
            }

            next();
        });
    }
});

