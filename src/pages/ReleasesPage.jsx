import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Newspaper, Disc3, Music2, ExternalLink, Heart, HeartOff, Loader2, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Bookmark, Trash2, Compass, LayoutList, LayoutGrid, Library } from 'lucide-react';

// ─── Cache helpers ────────────────────────────────────────────────

const CACHE_KEYS = {
    releases: 'spinvinyl_releases_cache',
    news: 'spinvinyl_news_cache',
    gaps: 'spinvinyl_gaps_cache',
    wantlist: 'spinvinyl_wantlist_cache',
};
const TTL = { releases: 6, news: 4, gaps: 12, wantlist: 1 }; // hours

const readCache = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, fetchedAt } = JSON.parse(raw);
        const hours = (Date.now() - new Date(fetchedAt)) / 3600000;
        if (hours > TTL[Object.keys(CACHE_KEYS).find(k => CACHE_KEYS[k] === key)]) return null;
        return data;
    } catch { return null; }
};
const writeCache = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ data, fetchedAt: new Date().toISOString() })); } catch { }
};
const clearCache = (key) => { try { localStorage.removeItem(key); } catch { } };

// ─── Upcoming wantlist persistence ────────────────────────────────
// Stores saved upcoming releases locally (keyed by `raw`). No Discogs lookup —
// data comes entirely from upcomingvinyl.com so there are no wrong-version issues.

const UPCOMING_WANTLIST_LS_KEY = 'spinvinyl_upcoming_wantlist';

const loadUpcomingWantlist = () => {
    try { return JSON.parse(localStorage.getItem(UPCOMING_WANTLIST_LS_KEY) || '{}'); }
    catch { return {}; }
};

const saveUpcomingWantlist = (map) => {
    try { localStorage.setItem(UPCOMING_WANTLIST_LS_KEY, JSON.stringify(map)); }
    catch { }
};

// ─── Shared helpers ───────────────────────────────────────────────

const cleanName = (name) => (name || '').replace(/\s*\(\d+\)\s*$/, '').trim();

const SOURCE_COLORS = {
    'Vinyl Factory': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Pitchfork': 'bg-green-500/20 text-green-300 border-green-500/30',
    'Bandcamp Daily': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'NME': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

// ─── Completion Ring SVG ──────────────────────────────────────────

const CompletionRing = ({ pct, size = 56 }) => {
    const r = size * 0.36;
    const circ = 2 * Math.PI * r;
    const dash = Math.max(0, (pct / 100) * circ);
    const cx = size / 2, cy = size / 2;
    const color = pct >= 75 ? '#34d399' : pct >= 40 ? '#a78bfa' : '#f472b6';

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
            <defs>
                <linearGradient id={`rg-${pct}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.07} />
            <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke={pct > 0 ? `url(#rg-${pct})` : 'transparent'}
                strokeWidth={size * 0.07}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={size * 0.18} fontWeight="bold">
                {pct}%
            </text>
        </svg>
    );
};

// ─── Skeleton loaders ─────────────────────────────────────────────

const CardSkeleton = () => (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden animate-pulse">
        <div className="aspect-square bg-white/5" />
        <div className="p-3 space-y-2">
            <div className="h-3 bg-white/5 rounded w-3/4" />
            <div className="h-2.5 bg-white/5 rounded w-1/2" />
        </div>
    </div>
);

// ─── Upcoming Vinyl Section ───────────────────────────────────────
// Fetches from upcomingvinyl.com/featured via /api/upcoming and
// cross-references against the user's FULL Discogs collection.

// Normalize an artist name for fuzzy matching:
// lowercase, strip "(2)" suffixes, punctuation, and extra whitespace.
const normalizeArtist = (name) =>
    (name || '')
        .toLowerCase()
        .replace(/\s*\(\d+\)\s*$/, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

// Try to identify whether a release entry mentions any of the user's artists.
// upcomingvinyl.com rows are "Artist Name Album Title" — we don't have a clean separator,
// but we can check if any known artist name appears at the START of the raw string.
const matchesArtist = (raw, normalizedArtistSet) => {
    const normalizedRaw = normalizeArtist(raw);
    for (const artist of normalizedArtistSet) {
        if (artist.length < 2) continue;
        // The entry typically starts with the artist name
        if (normalizedRaw.startsWith(artist + ' ') || normalizedRaw === artist) {
            return artist;
        }
    }
    return null;
};

// ─── Upcoming Release Modal ───────────────────────────────────────
const UpcomingReleaseModal = ({ release, enrichedData, onClose, addToWantlist, wantlistState }) => {
    const [bio, setBio] = useState(null);
    const [loadingBio, setLoadingBio] = useState(true);
    const [detail, setDetail] = useState(null);

    // Use artist/title from the scraper directly — no Discogs lookup needed
    const artist = release.artist || (release.raw?.includes(' - ') ? release.raw.split(' - ')[0].trim() : 'Unknown Artist');
    const title = release.title || release.raw;
    const thumb = enrichedData?.thumb || release.thumb;

    useEffect(() => {
        let cancelled = false;
        setDetail(null);
        setBio(null);
        setLoadingBio(true);

        const fetchInfo = async () => {
            // Fetch description + tracklist from upcomingvinyl.com detail page
            if (release.sourceUrl) {
                try {
                    const detailRes = await fetch(`/api/upcoming-detail?url=${encodeURIComponent(release.sourceUrl)}`);
                    if (detailRes.ok && !cancelled) {
                        const d = await detailRes.json();
                        if (d.description || d.tracklist?.length) setDetail(d);
                    }
                } catch { /* ignore */ }
            }

            // Fetch Wikipedia bio for the artist
            if (artist && artist !== 'Unknown Artist') {
                try {
                    const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist.replace(/ /g, '_'))}`);
                    const wikiData = await wikiRes.json();
                    if (!cancelled && wikiData.extract) {
                        setBio({ text: wikiData.extract, url: wikiData.content_urls?.desktop?.page });
                    }
                } catch { /* ignore */ }
            }

            if (!cancelled) setLoadingBio(false);
        };

        fetchInfo();
        return () => { cancelled = true; };
    }, [release, artist]);

    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(`${artist} ${title} vinyl`)}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-gray-900 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-2xl relative max-h-[85dvh] sm:max-h-[90dvh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-white transition-colors"
                >
                    <span className="text-xl leading-none">&times;</span>
                </button>

                <div className="overflow-y-auto p-6 pb-10 flex-1 min-h-0">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-gray-800 shadow-2xl overflow-hidden border border-white/10 mb-6 flex-shrink-0">
                            {thumb ? (
                                <img src={thumb} alt={title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Disc3 size={48} className="text-gray-600" />
                                </div>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white leading-tight">{title}</h2>
                        <p className="text-lg text-gray-400 mt-1">{artist}</p>
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 font-medium">
                            <span>Upcoming Release</span>
                            <span>·</span>
                            <span className="text-violet-400 font-bold">{release.releaseDate}</span>
                            {addToWantlist && (() => {
                                const wState = wantlistState?.[release.raw];
                                return (
                                    <button
                                        onClick={(e) => addToWantlist(e, release)}
                                        disabled={wState === 'pending'}
                                        className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                                            wState === 'done'
                                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                                : wState === 'error'
                                                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400'
                                        }`}
                                        title={wState === 'done' ? 'Added to Wantlist' : 'Add to Wantlist'}
                                    >
                                        {wState === 'pending' ? <Loader2 size={13} className="animate-spin" /> : <Heart size={13} className={wState === 'done' ? 'fill-rose-400' : ''} />}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">About the Artist</h3>
                        {loadingBio ? (
                            <div className="space-y-2 animate-pulse">
                                <div className="h-3 bg-white/5 rounded w-full" />
                                <div className="h-3 bg-white/5 rounded w-5/6" />
                                <div className="h-3 bg-white/5 rounded w-4/6" />
                            </div>
                        ) : bio ? (
                            <div className="text-sm text-gray-400 leading-relaxed space-y-2">
                                <p className="line-clamp-4">{bio.text}</p>
                                {bio.url && (
                                    <a href={bio.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1">
                                        Read more on Wikipedia <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No biography available.</p>
                        )}
                    </div>

                    {detail?.description && (
                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">About this Release</h3>
                            <p className="text-sm text-gray-400 leading-relaxed line-clamp-5">{detail.description}</p>
                        </div>
                    )}

                    {detail?.tracklist?.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Tracklist</h3>
                            <ol className="space-y-1">
                                {detail.tracklist.map((track, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                                        <span className="text-gray-600 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                                        <span>{track}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    <div className="mt-8 space-y-3">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Links</h3>
                        <div className="grid grid-cols-2 gap-3 pb-8 sm:pb-0">
                            {release.sourceUrl && (
                                <a
                                    href={release.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 hover:text-violet-200 border border-violet-500/20 transition-colors text-sm font-semibold"
                                >
                                    <ExternalLink size={16} /> View on Upcoming Vinyl
                                </a>
                            )}
                            <a
                                href={release.searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/10 transition-colors text-sm font-semibold"
                            >
                                <Disc3 size={16} /> Search Discogs
                            </a>
                            <a
                                href={amazonUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/10 transition-colors text-sm font-semibold"
                            >
                                <ExternalLink size={16} /> Search Amazon
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const UpcomingReleasesSection = ({ collection, collectionLoading }) => {
    const [upcoming, setUpcoming] = useState([]);
    const [artistSet, setArtistSet] = useState(null);
    const [artistGenres, setArtistGenres] = useState(null);
    const [genrePrefs, setGenrePrefs] = useState(null);
    const [genreWeights, setGenreWeights] = useState(null);
    const [enriched, setEnriched] = useState({});
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [error, setError] = useState(null);

    const [selectedRelease, setSelectedRelease] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [wantlistState, setWantlistState] = useState(() => {
        const map = loadUpcomingWantlist();
        const state = {};
        Object.keys(map).forEach(raw => { state[raw] = 'done'; });
        return state;
    });
    const [toastMsg, setToastMsg] = useState(null);
    const enrichAttempted = useRef(false);

    const addToWantlist = useCallback((e, release) => {
        e.stopPropagation();
        const key = release.raw;
        const current = loadUpcomingWantlist();
        if (current[key]) {
            delete current[key];
            saveUpcomingWantlist(current);
            setWantlistState(prev => { const n = { ...prev }; delete n[key]; return n; });
            setToastMsg('Removed from saved releases.');
        } else {
            current[key] = release;
            saveUpcomingWantlist(current);
            setWantlistState(prev => ({ ...prev, [key]: 'done' }));
            setToastMsg(`♡ Saved "${release.title || release.raw}"!`);
        }
        setTimeout(() => setToastMsg(null), 2500);
    }, []);

    // ── Build artist/genre profile from the parent's full collection ──
    useEffect(() => {
        if (!collection?.length || collectionLoading) return;

        const names = new Set();
        const agMap = new Map();
        const genreCount = new Map();

        collection.forEach(r => {
            const info = r.basic_information ?? {};
            const genres = [...(info.genres ?? []), ...(info.styles ?? [])];
            (info.artists ?? []).forEach(a => {
                if (!a.name) return;
                const norm = normalizeArtist(a.name);
                names.add(norm);
                if (!agMap.has(norm)) agMap.set(norm, new Set());
                genres.forEach(g => agMap.get(norm).add(g));
            });
            genres.forEach(g => genreCount.set(g, (genreCount.get(g) ?? 0) + 1));
        });

        const topGenres = [...genreCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([g]) => g);

        const total = [...genreCount.values()].reduce((s, v) => s + v, 0);
        const weights = new Map();
        genreCount.forEach((count, genre) => weights.set(genre, count / total));

        setArtistSet(names);
        setArtistGenres(agMap);
        setGenrePrefs(new Set(topGenres));
        setGenreWeights(weights);
    }, [collection, collectionLoading]);

    // ── Background enrichment: artwork + genres for all releases ─────────
    // Enriches all upcoming releases (up to 30) for cover art; non-artist-
    // matched ones also use genre data for the "Matches Your Taste" section.
    const doEnrichment = useCallback(async (upcomingList, aSet, gPrefs) => {
        const toEnrich = upcomingList.slice(0, 30);
        if (toEnrich.length === 0) { setEnriching(false); return; }

        const results = {};
        for (const r of toEnrich) {
            try {
                const res = await fetch(`/api/discogs?action=searchRelease&q=${encodeURIComponent(r.title || r.raw)}`);
                if (res.ok) {
                    const data = await res.json();
                    const top = data.results?.[0];
                    if (top) {
                        results[r.raw] = {
                            genres: [...(top.genre ?? []), ...(top.style ?? [])],
                            thumb: top.cover_image || top.thumb || null,
                        };
                    }
                } else if (res.status === 401) {
                    break;
                }
            } catch { /* skip */ }
            await new Promise(resolve => setTimeout(resolve, 350));
        }

        setEnriched(results);
        setEnriching(false);

        // Persist enriched data in cache so subsequent loads skip re-enrichment
        try {
            const cacheRaw = localStorage.getItem(CACHE_KEYS.releases);
            if (cacheRaw) {
                const parsed = JSON.parse(cacheRaw);
                parsed.data.enriched = results;
                localStorage.setItem(CACHE_KEYS.releases, JSON.stringify(parsed));
            }
        } catch { /* ignore cache errors */ }
    }, []);

    // ── Fetch upcoming releases from upcomingvinyl.com (cached separately) ──
    const fetchUpcoming = useCallback(async (force = false) => {
        if (!force) {
            const cached = readCache(CACHE_KEYS.releases);
            if (cached?.upcoming) {
                setUpcoming(cached.upcoming);
                if (cached.enriched) setEnriched(cached.enriched);
                return;
            }
        }
        clearCache(CACHE_KEYS.releases);
        enrichAttempted.current = false;
        setLoading(true);
        setError(null);
        setEnriched({});
        try {
            const res = await fetch('/api/upcoming');
            const data = res.ok ? await res.json() : { releases: [] };
            const list = data.releases ?? [];
            setUpcoming(list);
            writeCache(CACHE_KEYS.releases, { upcoming: list });
        } catch {
            setError('Failed to load upcoming releases. Try refreshing.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUpcoming(); }, [fetchUpcoming]);

    // ── Trigger enrichment once upcoming + genre prefs are both ready ──
    useEffect(() => {
        if (
            !enrichAttempted.current &&
            upcoming.length > 0 &&
            artistSet &&
            genrePrefs?.size > 0 &&
            !collectionLoading
        ) {
            enrichAttempted.current = true;
            setEnriching(true);
            doEnrichment(upcoming, artistSet, genrePrefs);
        }
    }, [upcoming, artistSet, genrePrefs, collectionLoading, doEnrichment]);

    // ── Annotate upcoming releases ────────────────────────────────────
    const annotatedUpcoming = useMemo(() => {
        if (!artistSet || upcoming.length === 0) return upcoming;
        
        return upcoming.map(r => {
            // Use artist field directly if available (scraper provides it separately)
            const normArtist = r.artist ? normalizeArtist(r.artist) : null;
            const artistMatch = (normArtist && artistSet.has(normArtist)) ? normArtist : matchesArtist(r.raw, artistSet);
            if (artistMatch) {
                const genres = artistGenres?.get(artistMatch) ? [...artistGenres.get(artistMatch)].slice(0, 4) : [];
                return { ...r, isForYou: true, _matchedArtist: r.artist || artistMatch, _genres: genres };
            }
            if (genrePrefs?.size > 0 && enriched[r.raw]?.genres) {
                const matching = enriched[r.raw].genres.filter(g => genrePrefs.has(g));
                if (matching.length > 0) {
                    const weightedScore = matching.reduce((s, g) => s + (genreWeights?.get(g) ?? 0), 0);
                    const sortedGenres = [...matching].sort((a, b) => (genreWeights?.get(b) ?? 0) - (genreWeights?.get(a) ?? 0));
                    return { ...r, isMightLike: true, _genres: sortedGenres.slice(0, 3), _score: weightedScore };
                }
            }
            return r;
        });
    }, [upcoming, artistSet, artistGenres, genrePrefs, genreWeights, enriched]);

    const groupedReleases = useMemo(() => {
        const groups = {};
        annotatedUpcoming.forEach(r => {
            const key = r.releaseDate || 'TBD';
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        const top3Genres = genreWeights
            ? new Set([...genreWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g))
            : null;

        return Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, items]) => {
                const sorted = [...items].sort((a, b) => {
                    const pa = a.isForYou ? 0 : a.isMightLike ? 1 : 2;
                    const pb = b.isForYou ? 0 : b.isMightLike ? 1 : 2;
                    if (pa !== pb) return pa - pb;
                    return (b._score ?? 0) - (a._score ?? 0);
                });
                return [date, sorted.slice(0, 5)];
            })
            .filter(([, items]) =>
                items.some(r =>
                    r.isForYou ||
                    (r.isMightLike && top3Genres && r._genres?.some(g => top3Genres.has(g)))
                )
            );
    }, [annotatedUpcoming, genreWeights]);

    const formatDate = (isoDate) => {
        try {
            return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            });
        } catch { return isoDate; }
    };

    const ReleaseRow = ({ release, isForYou, isMightLike }) => {
        const wState = wantlistState[release.raw];
        return (
            <div
                onClick={() => setSelectedRelease(release)}
                className="w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/10 transition-all group cursor-pointer"
            >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded shadow flex-shrink-0 overflow-hidden bg-white/5 flex items-center justify-center border border-white/10">
                    {release.thumb ? (
                        <img src={release.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                        <Disc3 size={16} className="text-gray-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-snug group-hover:text-violet-300 transition-colors">
                        {release.raw}
                    </p>
                    {release._genres?.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                            {release._genres.map(g => (
                                <span key={g} className="text-[9px] text-gray-500 bg-white/5 px-1 py-0.5 rounded">
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {isForYou && (
                    <span className="flex-shrink-0 text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-md">
                        ARTIST MATCH
                    </span>
                )}
                {isMightLike && (
                    <span className="flex-shrink-0 text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-md whitespace-nowrap">
                        GENRE MATCH
                    </span>
                )}
                <button
                    onClick={(e) => addToWantlist(e, release)}
                    disabled={wState === 'pending'}
                    className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border transition-all opacity-0 group-hover:opacity-100 ${
                        wState === 'done'
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 opacity-100'
                            : wState === 'error'
                            ? 'bg-red-500/20 border-red-500/40 text-red-400 opacity-100'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400'
                    }`}
                    title={wState === 'done' ? 'Added to Wantlist' : 'Add to Wantlist'}
                >
                    {wState === 'pending' ? <Loader2 size={12} className="animate-spin" /> : <Heart size={12} className={wState === 'done' ? 'fill-rose-400' : ''} />}
                </button>
            </div>
        );
    };

    return (
        <div>
            {toastMsg && (
                <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl backdrop-blur-xl border transition-all ${toastMsg.startsWith('♡') ? 'bg-violet-900/90 text-violet-200 border-violet-500/30' : 'bg-rose-900/90 text-rose-200 border-rose-500/30'}`}>
                    {toastMsg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-base font-bold text-white">Upcoming Vinyl Releases</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        From upcomingvinyl.com · personalized to your collection
                        {collectionLoading && <span className="ml-2 text-violet-400">Loading your collection…</span>}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-xl border transition-all ${viewMode === 'list' ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                        title="List view"
                    >
                        <LayoutList size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-xl border transition-all ${viewMode === 'grid' ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                        title="Tile view"
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button
                        onClick={() => fetchUpcoming(true)}
                        disabled={loading}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-9 bg-white/[0.04] rounded-xl" />
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="text-center py-10 text-rose-400 text-sm flex flex-col items-center gap-2">
                    <AlertCircle size={24} />
                    <p>{error}</p>
                </div>
            )}

            {/* Modal */}
            {selectedRelease && (
                <UpcomingReleaseModal
                    release={selectedRelease}
                    enrichedData={enriched[selectedRelease.raw]}
                    onClose={() => setSelectedRelease(null)}
                    addToWantlist={addToWantlist}
                    wantlistState={wantlistState}
                />
            )}

            {/* Empty state */}
            {!loading && !error && upcoming.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                    <Disc3 size={36} className="mx-auto mb-3 opacity-20" />
                    <p>No upcoming releases found.</p>
                </div>
            )}

            {/* All upcoming grouped by date */}
            {!loading && annotatedUpcoming.length > 0 && (
                <div className="mb-6">
                    {/* Enriching indicator */}
                    {!loading && enriching && genrePrefs?.size > 0 && (
                        <p className="text-xs text-pink-400 mb-4 flex items-center gap-1.5">
                            <Loader2 size={11} className="animate-spin" />
                            Searching upcoming releases for genre matches...
                        </p>
                    )}

                    {groupedReleases.map(([date, items]) => (
                        <div key={date} className="mb-5">
                            <a
                                href="https://upcomingvinyl.com/featured"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-semibold text-gray-500 hover:text-violet-400 uppercase tracking-wider mb-1 px-1 inline-flex items-center gap-1 transition-colors"
                            >
                                {formatDate(date)} <ExternalLink size={9} />
                            </a>
                            {viewMode === 'list' ? (
                                <div className="space-y-0.5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden p-1">
                                    {items.map((r, i) => (
                                        <ReleaseRow key={`${r.raw}-${i}`} release={r} isForYou={r.isForYou} isMightLike={r.isMightLike} />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {items.map((r, i) => {
                                        const wState = wantlistState[r.raw];
                                        return (
                                            <div
                                                key={`${r.raw}-${i}`}
                                                onClick={() => setSelectedRelease(r)}
                                                className="group relative rounded-2xl bg-white/[0.03] border border-white/5 hover:border-violet-500/30 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/10 text-left cursor-pointer"
                                            >
                                                <div className="aspect-square bg-gray-800 relative overflow-hidden">
                                                    {r.thumb ? (
                                                        <img src={r.thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Disc3 size={28} className="text-gray-600" />
                                                        </div>
                                                    )}
                                                    {(r.isForYou || r.isMightLike) && (
                                                        <div className="absolute top-2 left-2">
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${r.isForYou ? 'bg-violet-500/80 text-white border-violet-400/50' : 'bg-pink-500/80 text-white border-pink-400/50'}`}>
                                                                {r.isForYou ? 'ARTIST' : 'GENRE'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={(e) => addToWantlist(e, r)}
                                                        disabled={wState === 'pending'}
                                                        className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full border backdrop-blur-sm transition-all ${
                                                            wState === 'done'
                                                                ? 'bg-rose-500/30 border-rose-400/60 text-rose-300'
                                                                : wState === 'error'
                                                                ? 'bg-red-500/30 border-red-400/60 text-red-300'
                                                                : 'bg-black/50 border-white/20 text-white opacity-0 group-hover:opacity-100'
                                                        }`}
                                                        title={wState === 'done' ? 'Added to Wantlist' : 'Add to Wantlist'}
                                                    >
                                                        {wState === 'pending' ? <Loader2 size={12} className="animate-spin" /> : <Heart size={12} className={wState === 'done' ? 'fill-rose-300' : ''} />}
                                                    </button>
                                                </div>
                                                <div className="p-2.5">
                                                    <p className="text-[11px] font-bold text-white truncate leading-tight group-hover:text-violet-300 transition-colors">{r.artist || r.raw}</p>
                                                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{r.title}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Vinyl News Section ───────────────────────────────────────────

const VinylNewsSection = ({ ownedArtistNames, ownedGenres }) => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchNews = useCallback(async (force = false) => {
        if (!force) {
            const cached = readCache(CACHE_KEYS.news);
            if (cached) { setArticles(cached); return; }
        }
        setLoading(true);
        setError(null);
        clearCache(CACHE_KEYS.news);
        try {
            const res = await fetch('/api/releases?action=news');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unknown error');

            // Score articles by relevance to owned artists/genres
            const artistSet = new Set(ownedArtistNames.map(a => a.toLowerCase()));
            const genreSet = new Set(ownedGenres.map(g => g.toLowerCase()));

            const scored = (data.articles || []).map(article => {
                const text = (article.title + ' ' + article.summary).toLowerCase();
                let score = 0;
                artistSet.forEach(a => { if (text.includes(a)) score += 3; });
                genreSet.forEach(g => { if (text.includes(g)) score += 1; });
                return { ...article, _relevance: score };
            });

            // Keep order mostly date-sorted but boost relevant articles
            scored.sort((a, b) => {
                const dateDiff = new Date(b.publishedAt) - new Date(a.publishedAt);
                const relevanceDiff = b._relevance - a._relevance;
                // Within same relevance tier, keep date order
                if (Math.abs(relevanceDiff) >= 3) return relevanceDiff;
                return dateDiff;
            });

            setArticles(scored);
            writeCache(CACHE_KEYS.news, scored);
        } catch (e) {
            setError('Failed to load news. Check your connection.');
        } finally {
            setLoading(false);
        }
    }, [ownedArtistNames, ownedGenres]);

    useEffect(() => { fetchNews(); }, [fetchNews]);

    const formatDate = (iso) => {
        try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch { return ''; }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-bold text-white">Vinyl News</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Latest from Vinyl Factory, Pitchfork, Bandcamp Daily & NME</p>
                </div>
                <button
                    onClick={() => fetchNews(true)}
                    disabled={loading}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-3 animate-pulse">
                            <div className="w-20 h-20 bg-white/5 rounded-xl flex-shrink-0" />
                            <div className="flex-1 space-y-2 py-1">
                                <div className="h-3 bg-white/5 rounded w-3/4" />
                                <div className="h-2.5 bg-white/5 rounded w-full" />
                                <div className="h-2.5 bg-white/5 rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="text-center py-10 text-rose-400 text-sm flex flex-col items-center gap-2">
                    <AlertCircle size={24} />
                    <p>{error}</p>
                </div>
            )}

            {!loading && !error && articles.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                    <Newspaper size={36} className="mx-auto mb-3 opacity-20" />
                    <p>No articles loaded. Check your internet connection.</p>
                </div>
            )}

            {!loading && articles.length > 0 && (
                <div className="space-y-3">
                    {articles.map((article, i) => (
                        <a
                            key={`${article.url}-${i}`}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex gap-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-violet-500/20 p-3 transition-all group"
                        >
                            {/* Thumbnail */}
                            <div className="w-20 h-20 rounded-xl bg-gray-800 flex-shrink-0 overflow-hidden">
                                {article.image ? (
                                    <img src={article.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Music2 size={20} className="text-gray-600" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${SOURCE_COLORS[article.source] || 'bg-gray-700/50 text-gray-400 border-gray-600'}`}>
                                        {article.source}
                                    </span>
                                    {article._relevance >= 3 && (
                                        <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">● For You</span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-violet-200 transition-colors">
                                    {article.title}
                                </p>
                                {article.summary && (
                                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{article.summary}</p>
                                )}
                                <p className="text-[10px] text-gray-600 mt-1">{formatDate(article.publishedAt)}</p>
                            </div>

                            <ExternalLink size={14} className="text-gray-600 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Wantlist Section ───────────────────────────────────────────

const WantlistSection = () => {
    const [wants, setWants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [removeState, setRemoveState] = useState({}); // { id: 'pending'|'error' }
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('sv_wantlist_view') || 'grid');
    const [savedUpcoming, setSavedUpcoming] = useState(() => Object.values(loadUpcomingWantlist()));

    const changeViewMode = (mode) => {
        setViewMode(mode);
        localStorage.setItem('sv_wantlist_view', mode);
    };

    const removeSavedUpcoming = (raw) => {
        const current = loadUpcomingWantlist();
        delete current[raw];
        saveUpcomingWantlist(current);
        setSavedUpcoming(Object.values(current));
    };

    const fetchWantlist = useCallback(async (force = false) => {
        if (!force) {
            const cached = readCache(CACHE_KEYS.wantlist);
            if (cached) { setWants(cached); return; }
        }
        setLoading(true);
        setError(null);
        clearCache(CACHE_KEYS.wantlist);
        try {
            const res = await fetch(`/api/discogs?action=getWantlist`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            
            setWants(data.wants || []);
            writeCache(CACHE_KEYS.wantlist, data.wants || []);
        } catch (e) {
            setError('Failed to load wantlist.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchWantlist(); }, [fetchWantlist]);

    const handleRemove = async (e, releaseId) => {
        e.stopPropagation(); // prevent modal opening
        setRemoveState(prev => ({ ...prev, [releaseId]: 'pending' }));
        try {
            const res = await fetch(`/api/discogs?action=removeFromWantlist&id=${releaseId}`, { method: 'POST' });
            if (res.ok || res.status === 204 || res.status === 200) {
                // success, remove from list and cache
                const updated = wants.filter(w => String(w.id) !== String(releaseId));
                setWants(updated);
                writeCache(CACHE_KEYS.wantlist, updated);
            } else {
                throw new Error('Failed to remove');
            }
        } catch {
            setRemoveState(prev => ({ ...prev, [releaseId]: 'error' }));
            setTimeout(() => setRemoveState(prev => { delete prev[releaseId]; return {...prev} }), 3000);
        }
    };

    return (
        <div>
            {selectedRelease && (
                <MissingRecordModal
                    releaseInfo={selectedRelease}
                    onClose={() => setSelectedRelease(null)}
                    wantlistState={{ [String(selectedRelease.release.id)]: 'done' }}
                    addToWantlist={() => {}}
                />
            )}

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-bold text-white">Your Wantlist</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Records you've marked to complete your collection</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => changeViewMode('list')}
                        className={`p-2 rounded-xl border transition-all ${viewMode === 'list' ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                        title="List view"
                    >
                        <LayoutList size={14} />
                    </button>
                    <button
                        onClick={() => changeViewMode('grid')}
                        className={`p-2 rounded-xl border transition-all ${viewMode === 'grid' ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                        title="Tile view"
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button
                        onClick={() => fetchWantlist(true)}
                        disabled={loading}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Saved Upcoming Releases */}
            {savedUpcoming.length > 0 && (
                <div className="mb-6">
                    <p className="text-xs text-gray-500 mb-3">Saved from upcomingvinyl.com</p>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {savedUpcoming.map(r => (
                                <div key={r.raw} className="group relative rounded-2xl bg-white/[0.03] border border-white/5 hover:border-violet-500/30 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/10">
                                    <div className="aspect-square bg-gray-800 relative overflow-hidden">
                                        {r.thumb ? (
                                            <img src={r.thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Disc3 size={32} className="text-gray-600" />
                                            </div>
                                        )}
                                        {r.releaseDate && (
                                            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-violet-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                                                {r.releaseDate}
                                            </div>
                                        )}
                                        <button onClick={() => removeSavedUpcoming(r.raw)} className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-rose-500/80 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-all shadow-xl" title="Remove">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-violet-300 transition-colors">{r.artist}</p>
                                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{r.title}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {savedUpcoming.map(r => (
                                <div key={r.raw} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-violet-500/20 transition-all">
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden border border-white/10">
                                        {r.thumb ? (
                                            <img src={r.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Disc3 size={16} className="text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{r.artist}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{r.title}</p>
                                    </div>
                                    {r.releaseDate && (
                                        <span className="text-[10px] text-violet-400 font-semibold flex-shrink-0">{r.releaseDate}</span>
                                    )}
                                    {r.sourceUrl && (
                                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-shrink-0 text-gray-600 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100" title="View on Upcoming Vinyl">
                                            <ExternalLink size={13} />
                                        </a>
                                    )}
                                    <button onClick={() => removeSavedUpcoming(r.raw)} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100" title="Remove">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-4 border-t border-white/5" />
                </div>
            )}

            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            )}

            {error && (
                <div className="text-center py-10 text-rose-400 text-sm flex flex-col items-center gap-2">
                    <AlertCircle size={24} />
                    <p>{error}</p>
                </div>
            )}

            {!loading && !error && wants.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                    <Bookmark size={36} className="mx-auto mb-3 opacity-20" />
                    <p>Your wantlist is empty.</p>
                </div>
            )}

            {!loading && wants.length > 0 && viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {wants.map(item => {
                        const info = item.basic_information || {};
                        const title = info.title;
                        const artistName = (info.artists || []).map(a => cleanName(a.name)).join(', ');
                        const img = info.thumb || info.cover_image;
                        const label = info.labels?.[0]?.name || '';
                        return (
                            <div
                                key={item.id}
                                className="group relative rounded-2xl bg-white/[0.03] border border-white/5 hover:border-violet-500/30 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer text-left"
                                onClick={() => setSelectedRelease({ release: { ...info, id: item.id, label, type: 'release' }, artistName })}
                            >
                                <div className="aspect-square bg-gray-800 relative overflow-hidden">
                                    {img ? (
                                        <img src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Disc3 size={32} className="text-gray-600" />
                                        </div>
                                    )}
                                    {info.year && info.year !== 0 && (
                                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                            {info.year}
                                        </div>
                                    )}
                                </div>
                                <div className="p-3">
                                    <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-violet-300 transition-colors">{title}</p>
                                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{artistName}</p>
                                    {label && <p className="text-[10px] text-gray-600 truncate mt-0.5">{label}</p>}
                                </div>
                                <button
                                    onClick={(e) => handleRemove(e, item.id)}
                                    className="absolute bottom-3 right-3 w-7 h-7 bg-black/60 hover:bg-rose-500/80 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 shadow-xl"
                                    title="Remove from Wantlist"
                                >
                                    {removeState[item.id] === 'pending' ? <Loader2 size={12} className="animate-spin" /> :
                                     removeState[item.id] === 'error' ? <AlertCircle size={12} className="text-rose-400" /> : <Trash2 size={12} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && wants.length > 0 && viewMode === 'list' && (
                <div className="space-y-1">
                    {wants.map(item => {
                        const info = item.basic_information || {};
                        const title = info.title;
                        const artistName = (info.artists || []).map(a => cleanName(a.name)).join(', ');
                        const img = info.thumb || info.cover_image;
                        const label = info.labels?.[0]?.name || '';
                        return (
                            <div
                                key={item.id}
                                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-violet-500/20 transition-all cursor-pointer"
                                onClick={() => setSelectedRelease({ release: { ...info, id: item.id, label, type: 'release' }, artistName })}
                            >
                                <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden border border-white/10">
                                    {img ? (
                                        <img src={img} alt={title} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Disc3 size={16} className="text-gray-600" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate group-hover:text-violet-300 transition-colors">{title}</p>
                                    <p className="text-[11px] text-gray-400 truncate">{artistName}{label ? ` · ${label}` : ''}</p>
                                </div>
                                {info.year && info.year !== 0 && (
                                    <span className="text-[10px] text-gray-600 flex-shrink-0">{info.year}</span>
                                )}
                                <button
                                    onClick={(e) => handleRemove(e, item.id)}
                                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                    title="Remove from Wantlist"
                                >
                                    {removeState[item.id] === 'pending' ? <Loader2 size={12} className="animate-spin" /> :
                                     removeState[item.id] === 'error' ? <AlertCircle size={12} className="text-rose-400" /> : <Trash2 size={12} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Missing Record Modal ─────────────────────────────────────────

const MissingRecordModal = ({ releaseInfo, onClose, wantlistState, addToWantlist }) => {
    const { release, artistName } = releaseInfo;
    const [bio, setBio] = useState(null);
    const [loadingBio, setLoadingBio] = useState(true);

    const releaseId = String(release.main_release || release.id);
    const wState = wantlistState[releaseId];

    // Discogs typically uses /master/{id} or /release/{id}
    const discogsQuery = release.type === 'master' ? `/master/${releaseId}` : `/release/${releaseId}`;
    const discogsUrl = `https://www.discogs.com${release.uri || discogsQuery}`;
    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(`${artistName} ${release.title} vinyl`)}`;
    
    useEffect(() => {
        // Fetch brief artist context from Wikipedia
        setLoadingBio(true);
        const wikiName = artistName.replace(/ /g, '_');
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`)
            .then(res => res.json())
            .then(data => {
                if (data.extract) setBio({ text: data.extract, url: data.content_urls?.desktop?.page });
            })
            .catch(() => {})
            .finally(() => setLoadingBio(false));
    }, [artistName]);

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-gray-900 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-2xl relative max-h-[85dvh] sm:max-h-[90dvh]">
                
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-white transition-colors"
                >
                    <span className="text-xl leading-none">&times;</span>
                </button>

                <div className="overflow-y-auto overflow-x-hidden p-6 flex-1 min-h-0 no-scrollbar">
                    {/* Header: Cover & Title */}
                    <div className="flex flex-col items-center text-center">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-gray-800 shadow-2xl overflow-hidden border border-white/10 mb-6 flex-shrink-0">
                            {release.thumb ? (
                                <img src={release.thumb} alt={release.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Disc3 size={48} className="text-gray-600" />
                                </div>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white leading-tight">{release.title}</h2>
                        <p className="text-lg text-gray-400 mt-1">{artistName}</p>
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 font-medium">
                            {release.year && <span>{release.year}</span>}
                            {release.year && release.label && <span>·</span>}
                            {release.label && <span>{release.label}</span>}
                        </div>
                    </div>

                    {/* Bio Snippet */}
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">About the Artist</h3>
                        {loadingBio ? (
                            <div className="space-y-2 animate-pulse">
                                <div className="h-3 bg-white/5 rounded w-full" />
                                <div className="h-3 bg-white/5 rounded w-5/6" />
                                <div className="h-3 bg-white/5 rounded w-4/6" />
                            </div>
                        ) : bio ? (
                            <div className="text-sm text-gray-400 leading-relaxed space-y-2">
                                <p className="line-clamp-4">{bio.text}</p>
                                {bio.url && (
                                    <a href={bio.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1">
                                        Read more on Wikipedia <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No biography available.</p>
                        )}
                    </div>

                    {/* Purchase Actions */}
                    <div className="mt-8 space-y-3">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Options</h3>
                        
                        <button
                            onClick={() => addToWantlist(releaseId, release.title)}
                            disabled={wState === 'pending' || wState === 'done'}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${
                                wState === 'done' 
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                                    : wState === 'error'
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                        : wState === 'pending'
                                            ? 'bg-white/5 text-gray-400 border border-white/10'
                                            : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/50'
                            }`}
                        >
                            {wState === 'pending' ? <Loader2 size={16} className="animate-spin" /> :
                                wState === 'done' ? <CheckCircle size={16} /> :
                                    wState === 'error' ? <AlertCircle size={16} /> :
                                        <Heart size={16} />}
                            {wState === 'done' ? 'Added to Wantlist' : wState === 'error' ? 'Error Adding' : 'Add to Discogs Wantlist'}
                        </button>

                        <div className="grid grid-cols-2 gap-3 pb-8 sm:pb-0">
                            <a
                                href={discogsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/10 transition-colors text-sm font-semibold"
                            >
                                <Disc3 size={16} /> Discogs
                            </a>
                            <a
                                href={amazonUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/10 transition-colors text-sm font-semibold"
                            >
                                <ExternalLink size={16} /> Amazon
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CompleteCollectionSection = ({ collectionArtists, ownedMasterIds, collectionLoading }) => {
    const [gaps, setGaps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedArtists, setExpandedArtists] = useState(new Set());
    const [wantlistState, setWantlistState] = useState({}); // { [releaseId]: 'pending' | 'done' | 'error' }
    const [toastMsg, setToastMsg] = useState(null);
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [sortBy, setSortBy] = useState('pct_desc');

    const fetchGaps = useCallback(async (force = false) => {
        if (!force) {
            const cached = readCache(CACHE_KEYS.gaps);
            if (cached) { setGaps(cached); return; }
        }
        if (!collectionArtists.length) return;
        setLoading(true);
        setError(null);
        clearCache(CACHE_KEYS.gaps);

        // Exclude "Various" artists; take enough candidates to reliably get 10 results
        const topArtists = collectionArtists
            .filter(a => !/^various/i.test(a.name.trim()))
            .slice(0, 25);
        const gapData = [];

        for (const artist of topArtists) {
            try {
                // Fetch master releases for this artist via search API.
                // Masters are deduplicated canonical albums — one entry per album regardless
                // of pressings. For most artists this is 1–2 pages instead of 10+.
                let allMasters = [];
                const MAX_PAGES = 5;
                for (let p = 1; p <= MAX_PAGES; p++) {
                    const res = await fetch(`/api/discogs?action=artistMasters&artist=${encodeURIComponent(artist.name)}&page=${p}`);
                    if (!res.ok) break;
                    const data = await res.json();
                    allMasters = allMasters.concat(data.results || []);
                    const totalPages = data.pagination?.pages ?? 1;
                    if (p >= totalPages) break;
                    await new Promise(r => setTimeout(r, 300));
                }

                // Filter to album-length releases only (exclude Singles, EPs).
                // Discogs search returns r.format as an array of strings e.g. ["Vinyl","LP","Album"]
                const albumMasters = allMasters.filter(r => {
                    const fmts = (r.format || []).map(f => f.toLowerCase());
                    return !fmts.some(f => f === 'single' || f === 'ep' || f === '7"');
                });

                if (albumMasters.length === 0) continue;

                // Deduplicate by title (search can return duplicates across pages)
                const seen = new Map();
                for (const r of albumMasters) {
                    const t = (r.title || '').toLowerCase().trim();
                    if (!seen.has(t)) seen.set(t, r);
                }
                const uniqueMasters = Array.from(seen.values());

                // Match by master ID — exact lookup, no fuzzy title matching needed
                const isOwned = (r) => ownedMasterIds.has(String(r.id));

                const owned = uniqueMasters.filter(isOwned);
                const missing = uniqueMasters.filter(r => !isOwned(r));
                // Use collection count as owned floor — it's ground truth
                const ownedCount = Math.max(owned.length, artist.count);
                const total = uniqueMasters.length + Math.max(0, ownedCount - owned.length);
                const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 100;

                gapData.push({ artist, total, ownedCount, missing, pct });
            } catch { /* skip this artist */ }

            // Respect Discogs rate limit between artists
            await new Promise(r => setTimeout(r, 300));
        }

        setGaps(gapData);
        writeCache(CACHE_KEYS.gaps, gapData);
        setLoading(false);
    }, [collectionArtists, ownedMasterIds]);

    const prevCollectionLoadingRef = React.useRef(collectionLoading);
    useEffect(() => {
        const wasLoading = prevCollectionLoadingRef.current;
        prevCollectionLoadingRef.current = collectionLoading;
        // Collection just finished loading — clear any gaps cached from a partial collection
        if (wasLoading && !collectionLoading) clearCache(CACHE_KEYS.gaps);
    }, [collectionLoading]);

    useEffect(() => { if (collectionArtists.length && !collectionLoading) fetchGaps(); }, [fetchGaps, collectionLoading]);

    const toggleArtist = (artistId) => {
        setExpandedArtists(prev => {
            const s = new Set(prev);
            s.has(artistId) ? s.delete(artistId) : s.add(artistId);
            return s;
        });
    };

    const addToWantlist = async (releaseId, releaseTitle) => {
        setWantlistState(prev => ({ ...prev, [releaseId]: 'pending' }));
        try {
            const res = await fetch(`/api/discogs?action=addToWantlist&id=${releaseId}`, { method: 'POST' });
            if (res.ok || res.status === 201 || res.status === 200) {
                setWantlistState(prev => ({ ...prev, [releaseId]: 'done' }));
                setToastMsg(`♡ Added "${releaseTitle}" to your Wantlist!`);
                setTimeout(() => setToastMsg(null), 3500);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (e) {
            setWantlistState(prev => ({ ...prev, [releaseId]: 'error' }));
            setToastMsg('Failed to add to Wantlist. Try again.');
            setTimeout(() => setToastMsg(null), 3500);
        }
    };

    return (
        <div>
            {/* Wantlist Toast */}
            {toastMsg && (
                <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl backdrop-blur-xl border transition-all ${toastMsg.startsWith('♡') ? 'bg-violet-900/90 text-violet-200 border-violet-500/30' : 'bg-rose-900/90 text-rose-200 border-rose-500/30'}`}>
                    {toastMsg}
                </div>
            )}

            {/* Missing Record Detail Modal */}
            {selectedRelease && (
                <MissingRecordModal 
                    releaseInfo={selectedRelease} 
                    onClose={() => setSelectedRelease(null)}
                    wantlistState={wantlistState}
                    addToWantlist={addToWantlist}
                />
            )}

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-bold text-white">Complete Your Collection</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Vinyl albums you don't own yet, by artists you collect</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="text-xs bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-gray-300 focus:outline-none focus:border-violet-500/50 cursor-pointer"
                    >
                        <option value="pct_desc">% Complete</option>
                        <option value="owned_desc">Albums Owned</option>
                        <option value="missing_asc">Missing Albums</option>
                        <option value="name_asc">Artist Name</option>
                    </select>
                    <button
                        onClick={() => fetchGaps(true)}
                        disabled={loading}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex flex-col items-center gap-4 py-12 text-gray-500">
                    <Loader2 size={32} className="animate-spin text-violet-500" />
                    <p className="text-sm">Fetching discographies for your artists…</p>
                    <p className="text-xs text-gray-600">This may take a moment (rate-limited API)</p>
                </div>
            )}

            {error && (
                <div className="text-center py-10 text-rose-400 text-sm flex flex-col items-center gap-2">
                    <AlertCircle size={24} />
                    <p>{error}</p>
                </div>
            )}

            {collectionLoading && (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-500 text-sm">
                    <Loader2 size={28} className="animate-spin text-violet-500" />
                    <p>Waiting for your full collection to load…</p>
                </div>
            )}

            {!collectionLoading && !loading && gaps.length === 0 && !error && (
                <div className="text-center py-12 text-gray-500 text-sm">
                    <CheckCircle size={36} className="mx-auto mb-3 opacity-20" />
                    <p>No gap data yet. Make sure your collection is loaded.</p>
                </div>
            )}

            {!loading && gaps.length > 0 && (
                <div className="space-y-4">
                    {[...gaps.filter(g => g.pct < 100)].sort((a, b) => {
                        if (sortBy === 'pct_desc') return b.pct - a.pct;
                        if (sortBy === 'owned_desc') return b.ownedCount - a.ownedCount;
                        if (sortBy === 'missing_asc') return a.missing.length - b.missing.length;
                        if (sortBy === 'name_asc') return a.artist.name.localeCompare(b.artist.name);
                        return 0;
                    }).map(({ artist, total, ownedCount, missing, pct }) => {
                        const isExpanded = expandedArtists.has(artist.id);
                        return (
                            <div key={artist.id} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                {/* Artist header */}
                                <button
                                    onClick={() => toggleArtist(artist.id)}
                                    className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors text-left"
                                >
                                    <CompletionRing pct={pct} size={56} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{artist.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            <span className="text-green-400 font-bold">{ownedCount}</span> owned ·{' '}
                                            <span className="text-rose-400 font-bold">{missing.length}</span> missing
                                            {' '}of <span className="text-gray-300 font-bold">{total}</span> vinyl albums
                                        </p>
                                        {pct === 100 && (
                                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-green-400">
                                                <CheckCircle size={10} /> Complete collection!
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-gray-500">
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </button>

                                {/* Missing records list */}
                                {isExpanded && missing.length > 0 && (
                                    <div className="border-t border-white/5">
                                        {missing.map(release => {
                                            const releaseId = String(release.main_release || release.id);
                                            const wState = wantlistState[releaseId];
                                            return (
                                                <div
                                                    key={release.id}
                                                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                                                >
                                                    <button 
                                                        onClick={() => setSelectedRelease({ release, artistName: artist.name })}
                                                        className="flex-1 min-w-0 flex items-center gap-3 text-left group-hover:opacity-80 transition-opacity"
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                                                            {release.thumb ? (
                                                                <img src={release.thumb} alt={release.title} className="w-full h-full object-cover" loading="lazy" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Disc3 size={16} className="text-gray-600" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-white truncate group-hover:text-violet-300 transition-colors">{release.title}</p>
                                                            <p className="text-[10px] text-gray-500">
                                                                {release.year || '—'}{release.label ? ` · ${release.label}` : ''}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    
                                                    {/* Wantlist button */}
                                                    <button
                                                        onClick={() => addToWantlist(releaseId, release.title)}
                                                        disabled={wState === 'pending' || wState === 'done'}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex-shrink-0 ${
                                                            wState === 'done'
                                                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                                                : wState === 'error'
                                                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                                                    : wState === 'pending'
                                                                        ? 'bg-white/5 border-white/10 text-gray-500'
                                                                        : 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20'
                                                        }`}
                                                        title="Add to Discogs Wantlist"
                                                    >
                                                        {wState === 'pending' ? <Loader2 size={10} className="animate-spin" /> :
                                                            wState === 'done' ? <CheckCircle size={10} /> :
                                                                wState === 'error' ? <AlertCircle size={10} /> :
                                                                    <Heart size={10} />}
                                                        {wState === 'done' ? 'Wanted' : wState === 'error' ? 'Error' : 'Want'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {isExpanded && missing.length === 0 && (
                                    <div className="border-t border-white/5 px-4 py-4 text-center">
                                        <CheckCircle size={20} className="mx-auto mb-1 text-green-400 opacity-60" />
                                        <p className="text-xs text-gray-500">You own all their vinyl releases!</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Main ReleasesPage ────────────────────────────────────────────

const TABS = [
    { id: 'vinylNews', label: 'Vinyl News', icon: Newspaper },
    { id: 'newReleases', label: 'Upcoming Releases', icon: Disc3 },
    { id: 'completeCollection', label: 'Complete Collection', icon: Library },
    { id: 'wantlist', label: 'Wantlist', icon: Heart },
];

const ReleasesPage = ({ releases = [], collectionLoading = false }) => {
    const [activeTab, setActiveTab] = useState('vinylNews');

    const switchTab = (id) => {
        setActiveTab(id);
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    // Extract unique artists + their counts from the user's collection
    const collectionArtists = useMemo(() => {
        const map = {};
        releases.forEach(r => {
            const info = r.basic_information || {};
            (info.artists || []).forEach(a => {
                if (!a.id) return;
                const name = cleanName(a.name);
                if (!map[a.id]) map[a.id] = { id: a.id, name, count: 0 };
                map[a.id].count++;
            });
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
    }, [releases]);

    const ownedArtistNames = useMemo(() => collectionArtists.map(a => a.name), [collectionArtists]);

    const ownedGenres = useMemo(() => {
        const genreSet = new Set();
        releases.forEach(r => {
            (r.basic_information?.genres || []).forEach(g => genreSet.add(g));
        });
        return [...genreSet];
    }, [releases]);

    // Set of master IDs the user already owns (for gap detection)
    const ownedMasterIds = useMemo(() => {
        const s = new Set();
        releases.forEach(r => {
            if (r.basic_information?.master_id) s.add(String(r.basic_information.master_id));
            if (r.basic_information?.id) s.add(String(r.basic_information.id));
        });
        return s;
    }, [releases]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white pb-32">
            {/* Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.12),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-5 text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-xl">
                            <Compass size={24} className="text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                            Explore
                        </h1>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Personalized for your {collectionArtists.length} artists
                    </p>
                </div>
            </div>

            {/* Sub-tab pills */}
            <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-3xl mx-auto px-4 flex gap-1 py-2 overflow-x-auto no-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => switchTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                                activeTab === tab.id
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                    : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/10'
                            }`}
                        >
                            <tab.icon size={12} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 pt-5">
                {activeTab === 'newReleases' && (
                    <UpcomingReleasesSection collection={releases} collectionLoading={collectionLoading} />
                )}
                {activeTab === 'vinylNews' && (
                    <VinylNewsSection ownedArtistNames={ownedArtistNames} ownedGenres={ownedGenres} />
                )}
                {activeTab === 'completeCollection' && (
                    <CompleteCollectionSection
                        collectionArtists={collectionArtists}
                        ownedMasterIds={ownedMasterIds}
                        collectionLoading={collectionLoading}
                    />
                )}
                {activeTab === 'wantlist' && (
                    <WantlistSection />
                )}
            </div>
        </div>
    );
};

export default ReleasesPage;
