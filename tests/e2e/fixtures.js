// Shared mock data + route helpers for e2e specs. External services (RSS
// scraping, the upcomingvinyl.com scraper, Discogs) are never hit live in
// tests — real-world uptime/rate-limits of those third parties shouldn't
// decide whether this suite passes.

export const MOCK_NEWS_ARTICLES = [
    {
        url: 'https://example.com/articles/one',
        title: 'Fleetwood Mac reissue announced on 180g vinyl',
        summary: 'A remastered pressing of the classic album is coming this fall.',
        source: 'Pitchfork',
        publishedAt: '2026-08-01T12:00:00.000Z',
        image: null,
    },
    {
        url: 'https://example.com/articles/two',
        title: 'Inside the resurgence of independent record shops',
        summary: 'A look at how local stores are thriving in the streaming era.',
        source: 'Stereogum',
        publishedAt: '2026-07-30T09:00:00.000Z',
        image: null,
    },
];

// Deliberately distinct from the hardcoded example names inside
// LockedTabPreview/CompleteCollectionPreview/WantlistPreview (Fleetwood Mac,
// Miles Davis, Kind of Blue, Rumours) — the Upcoming Releases section stays
// mounted (just hidden) behind other Explore tabs, so overlapping text would
// create ambiguous locators across unrelated tests.
export const MOCK_UPCOMING_RELEASES = [
    {
        artist: 'Radiohead',
        title: 'In Rainbows (Test Repress)',
        releaseDate: 'Aug 15',
        sourceUrl: 'https://example.com/upcoming/in-rainbows',
        image: null,
        raw: 'Radiohead - In Rainbows (Test Repress)',
    },
    {
        artist: 'Nina Simone',
        title: 'Wild Is the Wind (Test Edition)',
        releaseDate: 'Aug 22',
        sourceUrl: 'https://example.com/upcoming/wild-is-the-wind',
        image: null,
        raw: 'Nina Simone - Wild Is the Wind (Test Edition)',
    },
];

export async function mockExploreApis(page) {
    await page.route('**/api/releases?action=news', route =>
        route.fulfill({ json: { articles: MOCK_NEWS_ARTICLES, errors: [] } })
    );
    await page.route('**/api/upcoming', route =>
        route.fulfill({ json: { releases: MOCK_UPCOMING_RELEASES, fallback: false } })
    );
}

/** Base64 session cookie matching the shape api/discogs.js's `status` action decodes. */
export function fakeDiscogsSessionCookie(username = 'testuser') {
    return Buffer.from(JSON.stringify({ username, access_token: 'x', access_secret: 'x' })).toString('base64');
}

export const MOCK_COLLECTION_RELEASES = [
    {
        instance_id: 1001,
        id: 501,
        date_added: '2026-07-20T10:00:00-08:00',
        basic_information: {
            title: 'Remain in Light',
            year: 1980,
            artists: [{ name: 'Talking Heads' }],
            cover_image: '',
            formats: [{ name: 'Vinyl' }],
        },
    },
    {
        instance_id: 1002,
        id: 502,
        date_added: '2026-07-18T10:00:00-08:00',
        basic_information: {
            title: 'A Love Supreme',
            year: 1965,
            artists: [{ name: 'John Coltrane' }],
            cover_image: '',
            formats: [{ name: 'Vinyl' }],
        },
    },
];

/**
 * Mocks the full `/api/discogs*` surface as an authenticated user with a
 * small fixture collection. Any action not explicitly handled below returns
 * an empty-but-valid payload so unmocked calls degrade quietly instead of
 * timing out or erroring the page.
 */
export async function mockAuthenticatedDiscogs(page, { username = 'testuser' } = {}) {
    await page.context().addCookies([{
        name: 'discogs_session',
        value: fakeDiscogsSessionCookie(username),
        domain: 'localhost',
        path: '/',
    }]);

    await page.route('**/api/discogs*', route => {
        const url = new URL(route.request().url());
        const action = url.searchParams.get('action');

        if (action === 'status') {
            return route.fulfill({ json: { authenticated: true, username } });
        }
        if (action === 'collection') {
            return route.fulfill({
                json: { releases: MOCK_COLLECTION_RELEASES, pagination: { pages: 1, page: 1, items: MOCK_COLLECTION_RELEASES.length } },
            });
        }
        if (action === 'getWantlist') {
            return route.fulfill({ json: { wants: [], pagination: { pages: 1, page: 1, items: 0 } } });
        }
        // Generic fallback for artistMasters/artistReleases/etc — empty but valid.
        return route.fulfill({ json: { releases: [], results: [], wants: [], pagination: { pages: 1, page: 1 } } });
    });
}
