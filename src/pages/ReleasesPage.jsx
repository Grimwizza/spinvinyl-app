import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Newspaper, Disc3, Music2, ExternalLink, Heart, HeartOff, Loader2, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Bookmark, Trash2, Compass } from 'lucide-react';

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
const UpcomingReleaseModal = ({ release, enrichedData, onClose }) => {
    const [bio, setBio] = useState(null);
    const [loadingBio, setLoadingBio] = useState(true);
    const [parsedInfo, setParsedInfo] = useState({ artist: '', title: release.title || release.raw, thumb: enrichedData?.thumb });

    useEffect(() => {
        const fetchInfo = async () => {
            setLoadingBio(true);
            try {
                let finalArtist = release._matchedArtist || '';
                let finalTitle = release.title || release.raw;
                let coverArt = enrichedData?.thumb;

                if (!release._matchedArtist) {
                    const searchRes = await fetch(`/api/discogs?action=searchRelease&q=${encodeURIComponent(release.title || release.raw)}`);
                    if (searchRes.ok) {
                        const data = await searchRes.json();
                        const top = data.results?.[0];
                        if (top) {
                            if (!coverArt && (top.cover_image || top.thumb)) {
                                coverArt = top.cover_image || top.thumb;
                            }
                            if (top.title && top.title.includes(' - ')) {
                                const parts = top.title.split(' - ');
                                finalArtist = parts[0].trim();
                                finalTitle = parts.slice(1).join(' - ').trim();
                            }
                        }
                    }
                }

                if (!finalArtist) {
                    if (release.raw.includes(' - ')) {
                        const parts = release.raw.split(' - ');
                        finalArtist = parts[0].trim();
                        finalTitle = parts.slice(1).join(' - ').trim();
                    } else {
                        finalArtist = 'Unknown Artist';
                    }
                }

                setParsedInfo({ artist: finalArtist, title: finalTitle, thumb: coverArt });

                if (finalArtist && finalArtist !== 'Unknown Artist') {
                    const wikiName = finalArtist.replace(/ /g, '_');
                    const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`);
                    const wikiData = await wikiRes.json();
                    if (wikiData.extract) {
                        setBio({ text: wikiData.extract, url: wikiData.content_urls?.desktop?.page });
                    } else {
                        setBio(null);
                    }
                } else {
                    setBio(null);
                }
            } catch {
                setBio(null);
            } finally {
                setLoadingBio(false);
            }
        };

        fetchInfo();
    }, [release, enrichedData]);

    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(`${parsedInfo.artist} ${parsedInfo.title} vinyl`)}`;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center bg-black/80 backdrop-blur-md sm:p-4 animate-in fade-in duration-300">
            <div className="flex-1 sm:flex-none w-full max-w-lg bg-gray-900 sm:rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-2xl mt-12 sm:mt-0 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-white transition-colors"
                >
                    <span className="text-xl leading-none">&times;</span>
                </button>

                <div className="overflow-y-auto p-6 flex-1">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-gray-800 shadow-2xl overflow-hidden border border-white/10 mb-6 flex-shrink-0">
                            {parsedInfo.thumb ? (
                                <img src={parsedInfo.thumb} alt={parsedInfo.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Disc3 size={48} className="text-gray-600" />
                                </div>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white leading-tight">{parsedInfo.title}</h2>
                        <p className="text-lg text-gray-400 mt-1">{parsedInfo.artist}</p>
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 font-medium">
                            <span>Upcoming Release</span>
                            <span>·</span>
                            <span className="text-violet-400 font-bold">{release.releaseDate}</span>
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

                    <div className="mt-8 space-y-3">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Links</h3>
                        <div className="grid grid-cols-2 gap-3 pb-8 sm:pb-0">
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
    const [enriched, setEnriched] = useState({});
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [error, setError] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [selectedRelease, setSelectedRelease] = useState(null);
    const enrichAttempted = useRef(false);

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

        setArtistSet(names);
        setArtistGenres(agMap);
        setGenrePrefs(new Set(topGenres));
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
            const artistMatch = matchesArtist(r.raw, artistSet);
            if (artistMatch) {
                const genres = artistGenres?.get(artistMatch) ? [...artistGenres.get(artistMatch)].slice(0, 4) : [];
                return { ...r, isForYou: true, _matchedArtist: artistMatch, _genres: genres };
            }
            if (genrePrefs?.size > 0 && enriched[r.raw]?.genres) {
                const matching = enriched[r.raw].genres.filter(g => genrePrefs.has(g));
                if (matching.length > 0) {
                    return { ...r, isMightLike: true, _genres: matching.slice(0, 3), _score: matching.length };
                }
            }
            return r;
        });
    }, [upcoming, artistSet, artistGenres, genrePrefs, enriched]);

    const groupedReleases = useMemo(() => {
        const groups = {};
        const listToGroup = showAll ? annotatedUpcoming : annotatedUpcoming.slice(0, 30);
        listToGroup.forEach(r => {
            const key = r.releaseDate || 'TBD';
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [annotatedUpcoming, showAll]);

    const formatDate = (isoDate) => {
        try {
            return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            });
        } catch { return isoDate; }
    };

    const ReleaseRow = ({ release, isForYou, isMightLike }) => {
        return (
            <button
                onClick={() => setSelectedRelease(release)}
                className="w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/10 transition-all group"
            >
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
            </button>
        );
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-base font-bold text-white">Upcoming Vinyl Releases</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        From upcomingvinyl.com · personalized to your collection
                        {collectionLoading && <span className="ml-2 text-violet-400">Loading your collection…</span>}
                    </p>
                </div>
                <button
                    onClick={() => fetchUpcoming(true)}
                    disabled={loading}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
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
                        <div key={date} className="mb-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
                                {formatDate(date)}
                            </p>
                            <div className="space-y-0.5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden p-1">
                                {items.map((r, i) => (
                                    <ReleaseRow key={`${r.raw}-${i}`} release={r} isForYou={r.isForYou} isMightLike={r.isMightLike} />
                                ))}
                            </div>
                        </div>
                    ))}
                    {annotatedUpcoming.length > 30 && (
                        <button
                            onClick={() => setShowAll(s => !s)}
                            className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
                        >
                            {showAll
                                ? <><ChevronUp size={14} /> Show Less</>
                                : <><ChevronDown size={14} /> Show {annotatedUpcoming.length - 30} More</>}
                        </button>
                    )}
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
            const res = await fetch(`/api/discogs?action=removeFromWantlist&id=${releaseId}`, { method: 'DELETE' });
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
                    // Mock the wantlist additions because it's already in the wantlist
                    wantlistState={{ [String(selectedRelease.release.id)]: 'done' }}
                    addToWantlist={() => {}}
                />
            )}

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-bold text-white">Your Wantlist</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Records you've marked to complete your collection</p>
                </div>
                <button
                    onClick={() => fetchWantlist(true)}
                    disabled={loading}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

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

            {!loading && wants.length > 0 && (
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
                                className="group relative rounded-2xl bg-white/[0.03] border border-white/5 hover:border-violet-500/30 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer text-left focus:outline-none"
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

                                {/* Remove Button */}
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
        <div className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center bg-black/80 backdrop-blur-md sm:p-4 animate-in fade-in duration-300">
            <div className="flex-1 sm:flex-none w-full max-w-lg bg-gray-900 sm:rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-2xl mt-12 sm:mt-0 relative">
                
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-white transition-colors"
                >
                    <span className="text-xl leading-none">&times;</span>
                </button>

                <div className="overflow-y-auto overflow-x-hidden p-6 flex-1 no-scrollbar">
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

const CompleteCollectionSection = ({ collectionArtists, ownedMasterIds, ownedArtistTitles }) => {
    const [gaps, setGaps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedArtists, setExpandedArtists] = useState(new Set());
    const [wantlistState, setWantlistState] = useState({}); // { [releaseId]: 'pending' | 'done' | 'error' }
    const [toastMsg, setToastMsg] = useState(null);
    const [selectedRelease, setSelectedRelease] = useState(null);

    const isVinylRelease = (r) => {
        const fmt = (r.format || '').toLowerCase();
        return fmt.includes('vinyl') || fmt.includes('lp') || fmt.includes('12"') || fmt.includes('10"') || fmt.includes('7"') || fmt.includes('album');
    };

    const fetchGaps = useCallback(async (force = false) => {
        if (!force) {
            const cached = readCache(CACHE_KEYS.gaps);
            if (cached) { setGaps(cached); return; }
        }
        if (!collectionArtists.length) return;
        setLoading(true);
        setError(null);
        clearCache(CACHE_KEYS.gaps);

        const topArtists = collectionArtists.slice(0, 15);
        const gapData = [];

        for (const artist of topArtists) {
            try {
                const res = await fetch(`/api/discogs?action=artistReleases&id=${artist.id}`);
                if (!res.ok) continue;
                const data = await res.json();

                // We want Main role works. Master releases group different formats, so we accept them.
                // Standalone releases (no master) need a format check to ensure they are vinyl.
                const validReleases = (data.releases || []).filter(r => {
                    if (r.role !== 'Main') return false;
                    if (r.type === 'master') return true;
                    return isVinylRelease(r);
                });

                if (validReleases.length === 0) continue;

                // Deduplicate by title to ensure we don't show multiple variants of the same album
                const uniqueReleasesMap = new Map();
                for (const r of validReleases) {
                    let t = (r.title || '').toLowerCase().trim();
                    // Prefer master releases over standalone releases if there are duplicates
                    if (!uniqueReleasesMap.has(t) || (uniqueReleasesMap.get(t).type !== 'master' && r.type === 'master')) {
                        uniqueReleasesMap.set(t, r);
                    }
                }
                const uniqueReleases = Array.from(uniqueReleasesMap.values());

                const artistNameCanonical = artist.name.toLowerCase();

                const isOwned = (r) => {
                    const titleCanonical = (r.title || '').toLowerCase().trim();
                    return ownedMasterIds.has(String(r.id)) || 
                           ownedArtistTitles.has(`${artistNameCanonical}:::${titleCanonical}`);
                };

                const owned = uniqueReleases.filter(isOwned);
                const missing = uniqueReleases.filter(r => !isOwned(r));
                const pct = Math.round((owned.length / uniqueReleases.length) * 100);

                gapData.push({ artist, total: uniqueReleases.length, ownedCount: owned.length, missing, pct });
            } catch { /* skip this artist */ }

            // Small delay to respect Discogs rate limit (60 req/min authenticated)
            await new Promise(r => setTimeout(r, 300));
        }

        // Sort: most owned records first (they are the ones who care most about completing their collection)
        gapData.sort((a, b) => b.artist.count - a.artist.count);
        setGaps(gapData);
        writeCache(CACHE_KEYS.gaps, gapData);
        setLoading(false);
    }, [collectionArtists, ownedMasterIds, ownedArtistTitles]);

    useEffect(() => { if (collectionArtists.length) fetchGaps(); }, [fetchGaps]);

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
                <button
                    onClick={() => fetchGaps(true)}
                    disabled={loading}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
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

            {!loading && gaps.length === 0 && !error && (
                <div className="text-center py-12 text-gray-500 text-sm">
                    <CheckCircle size={36} className="mx-auto mb-3 opacity-20" />
                    <p>No gap data yet. Make sure your collection is loaded.</p>
                </div>
            )}

            {!loading && gaps.length > 0 && (
                <div className="space-y-4">
                    {gaps.map(({ artist, total, ownedCount, missing, pct }) => {
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
    { id: 'newReleases', label: 'Upcoming Releases', icon: Disc3 },
    { id: 'vinylNews', label: 'Vinyl News', icon: Newspaper },
    { id: 'completeCollection', label: 'Complete Collection', icon: Heart },
    { id: 'wantlist', label: 'Wantlist', icon: Bookmark },
];

const ReleasesPage = ({ releases = [], collectionLoading = false }) => {
    const [activeTab, setActiveTab] = useState('newReleases');

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

    // Set of artist:::title pairs to catch variants that don't share a master ID
    const ownedArtistTitles = useMemo(() => {
        const s = new Set();
        releases.forEach(r => {
            const title = (r.basic_information?.title || '').toLowerCase().trim();
            (r.basic_information?.artists || []).forEach(a => {
                if (!a.name) return;
                const artistNameCanonical = cleanName(a.name).toLowerCase();
                s.add(`${artistNameCanonical}:::${title}`);
            });
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
                            onClick={() => setActiveTab(tab.id)}
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
                        ownedArtistTitles={ownedArtistTitles}
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
