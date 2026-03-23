
import discogsHandler from './api/discogs.js';
import lyricsHandler from './api/lyrics.js';
import releasesHandler from './api/releases.js';
import upcomingHandler from './api/upcoming.js';
import upcomingDetailHandler from './api/upcoming-detail.js';

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
        send: (data) => {
            res.statusCode = mock.statusCode;
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
                }
            } catch (e) {
                console.error('[API Proxy] Failed to reload .env', e);
            }

            // ... route handling ...


            // --- ROUTE: /api/discogs (Serverless / Express Style) ---
            if (url === '/discogs') {
                try {
                    await new Promise(async (resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        try {
                            // CRITICAL: Await the handler since it's async
                            await discogsHandler(req, mockedRes);
                        } catch (handlerErr) {
                            reject(handlerErr);
                        }
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
                    await new Promise(async (resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        try {
                            await lyricsHandler(req, mockedRes);
                        } catch (handlerErr) {
                            reject(handlerErr);
                        }
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
                    await new Promise(async (resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        try {
                            await releasesHandler(req, mockedRes);
                        } catch (handlerErr) {
                            reject(handlerErr);
                        }
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
                    await new Promise(async (resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        req.query = {};
                        try {
                            await upcomingHandler(req, mockedRes);
                        } catch (handlerErr) {
                            reject(handlerErr);
                        }
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
                    await new Promise(async (resolve, reject) => {
                        const mockedRes = mockResponse(resolve, res);
                        const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
                        req.query = { url: urlParams.get('url') };
                        try {
                            await upcomingDetailHandler(req, mockedRes);
                        } catch (handlerErr) {
                            reject(handlerErr);
                        }
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

