import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Disc3, Music2, Loader2, ChevronLeft, ChevronRight, X, Volume2, Disc, LayoutGrid, List, ArrowUpDown, ChevronDown, Calendar, Tag, User, Play, Pause, SkipForward, Clock, Shuffle, Star, Share, MoreVertical, Download, Info } from 'lucide-react';

// ─── PWA Help / Installation Instructions ──────────────────────
const PWAHelp = () => {
    const [platform, setPlatform] = useState('other');
    const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem('pwaPromptDismissed') === 'true');

    useEffect(() => {
        const ua = window.navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
        else if (/android/.test(ua)) setPlatform('android');
        else if (!window.matchMedia('(display-mode: standalone)').matches) setPlatform('desktop');
    }, []);

    if (isDismissed || window.matchMedia('(display-mode: standalone)').matches) return null;

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem('pwaPromptDismissed', 'true');
    };

    return (
        <div className="w-full max-w-sm mx-auto mb-8 animate-fade-in">
            <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 border border-white/10 backdrop-blur-md p-5">
                <button onClick={handleDismiss} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                    <X size={14} />
                </button>

                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
                        <Download size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
                            Best Experience <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold tracking-tight">WEB APP AVAILABLE</span>
                        </h3>

                        {platform === 'ios' && (
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Tap <span className="inline-flex items-center px-1 py-0.5 rounded bg-white/10 text-white mx-0.5"><Share size={10} className="mr-1" /> Share</span> then select
                                <span className="text-white font-semibold mx-1">"Add to Home Screen"</span> for native fullscreen playback.
                            </p>
                        )}

                        {platform === 'android' && (
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Tap <span className="inline-flex items-center px-1 py-0.5 rounded bg-white/10 text-white mx-0.5"><MoreVertical size={10} className="mr-1" /> Menu</span> and select
                                <span className="text-white font-semibold mx-1">"Install App"</span> to add to your home screen.
                            </p>
                        )}

                        {platform === 'desktop' && (
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Click the <span className="text-white font-semibold mx-1">Install Icon</span> in your browser's address bar to run Spin Vinyl as a standalone app.
                            </p>
                        )}

                        {platform === 'other' && (
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Use your browser's <span className="text-white font-semibold mx-1">"Install"</span> or <span className="text-white font-semibold mx-1">"Add to Home Screen"</span> feature for the best experience.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Star Rating Display ────────────────────────────────────────
const StarRating = ({ rating, size = 10 }) => {
    if (!rating || rating === 0) return null;
    return (
        <div className="flex items-center gap-px">
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    size={size}
                    className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}
                />
            ))}
        </div>
    );
};

// ─── PWA Meta Tags Hook ─────────────────────────────────────────
const useSpinPWA = () => {
    useEffect(() => {
        // Set page title
        const prevTitle = document.title;
        document.title = 'Spin Vinyl';

        // Override existing icons/manifests rather than appending
        const updateLink = (selector, newHref) => {
            const el = document.querySelector(selector);
            if (el) {
                const oldHref = el.getAttribute('href');
                el.setAttribute('href', newHref);
                return () => el.setAttribute('href', oldHref);
            }
            // If it doesn't exist, append it
            const newEl = document.createElement('link');
            // parse selector roughly (e.g. 'link[rel="icon"]')
            const relMatch = selector.match(/rel="([^"]+)"/);
            if (relMatch) newEl.rel = relMatch[1];
            newEl.href = newHref;
            document.head.appendChild(newEl);
            return () => newEl.remove();
        };

        const restoreManifest = updateLink('link[rel="manifest"]', '/spin-manifest.json');
        const restoreAppleIcon = updateLink('link[rel="apple-touch-icon"]', '/apple-touch-icon-spin.png');

        // Also update standard favicons so desktop browsers show it
        const restoreIcon32 = updateLink('link[rel="icon"][sizes="32x32"]', '/spin-icon.png');
        const restoreIcon16 = updateLink('link[rel="icon"][sizes="16x16"]', '/spin-icon.png');

        // Apple web app capable
        const capable = document.createElement('meta');
        capable.name = 'apple-mobile-web-app-capable';
        capable.content = 'yes';
        document.head.appendChild(capable);

        // Apple web app title
        const appTitle = document.createElement('meta');
        appTitle.name = 'apple-mobile-web-app-title';
        appTitle.content = 'Spin Vinyl';
        document.head.appendChild(appTitle);

        // Apple status bar style
        const statusBar = document.createElement('meta');
        statusBar.name = 'apple-mobile-web-app-status-bar-style';
        statusBar.content = 'black-translucent';
        document.head.appendChild(statusBar);

        // Theme color (existing aimlow tag might exist, let's keep the manual append since it's simple)
        const theme = document.createElement('meta');
        theme.name = 'theme-color';
        theme.content = '#030712';
        document.head.appendChild(theme);

        return () => {
            document.title = prevTitle;
            restoreManifest();
            restoreAppleIcon();
            restoreIcon32();
            restoreIcon16();
            [capable, appTitle, statusBar, theme].forEach(el => el.remove());
        };
    }, []);
};

// ─── Sort Options ───────────────────────────────────────────────
const SORT_OPTIONS = [
    { value: 'artist-asc', label: 'Artist A→Z', icon: User, field: 'artist', order: 'asc', apiSort: 'artist', apiOrder: 'asc' },
    { value: 'artist-desc', label: 'Artist Z→A', icon: User, field: 'artist', order: 'desc', apiSort: 'artist', apiOrder: 'desc' },
    { value: 'title-asc', label: 'Title A→Z', icon: Tag, field: 'title', order: 'asc', apiSort: 'artist', apiOrder: 'asc' },
    { value: 'title-desc', label: 'Title Z→A', icon: Tag, field: 'title', order: 'desc', apiSort: 'artist', apiOrder: 'asc' },
    { value: 'year-desc', label: 'Year (Newest)', icon: Calendar, field: 'year', order: 'desc', apiSort: 'artist', apiOrder: 'asc' },
    { value: 'year-asc', label: 'Year (Oldest)', icon: Calendar, field: 'year', order: 'asc', apiSort: 'artist', apiOrder: 'asc' },
    { value: 'added-desc', label: 'Recently Added', icon: Calendar, field: 'added', order: 'desc', apiSort: 'added', apiOrder: 'desc' },
    { value: 'added-asc', label: 'First Added', icon: Calendar, field: 'added', order: 'asc', apiSort: 'added', apiOrder: 'asc' },
    { value: 'label-asc', label: 'Label A→Z', icon: Tag, field: 'label', order: 'asc', apiSort: 'artist', apiOrder: 'asc' },
];

// ─── Helpers ────────────────────────────────────────────────────
const parseDuration = (dur) => {
    if (!dur || typeof dur !== 'string') return 0;
    const parts = dur.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
};

const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Removes Discogs disambiguation suffixes like " (2)" or "(15)" at the end of artist/album names
const cleanName = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name.replace(/\s\(\d+\)$/g, '').trim();
};

const groupTracksBySide = (tracklist) => {
    const sides = {};
    (tracklist || []).forEach(track => {
        // Extract side letter from position (e.g., "A1" → "A", "B2" → "B", "C1" → "C")
        const sideMatch = (track.position || '').match(/^([A-Za-z]+)/);
        const side = sideMatch ? sideMatch[1].toUpperCase() : 'A';
        if (!sides[side]) sides[side] = [];
        sides[side].push({
            ...track,
            durationSeconds: track.durationSeconds !== undefined ? track.durationSeconds : parseDuration(track.duration),
        });
    });
    return sides;
};

// ─── Track Duration Fallback ────────────────────────────────────
const fallbackDurationCache = new Map();
const inFlightDurationRequests = new Map();

const fetchFallbackDuration = async (artist, title) => {
    if (!artist || !title) return 0;
    const key = `${artist}-${title}`;
    if (fallbackDurationCache.has(key)) return fallbackDurationCache.get(key);
    if (inFlightDurationRequests.has(key)) return inFlightDurationRequests.get(key);

    const promise = (async () => {
        try {
            const query = encodeURIComponent(`${artist} ${title}`);
            const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
            if (!res.ok) return 0;
            const data = await res.json();
            if (data?.results?.[0]?.trackTimeMillis) {
                const durationSeconds = Math.floor(data.results[0].trackTimeMillis / 1000);
                fallbackDurationCache.set(key, durationSeconds);
                return durationSeconds;
            }
            fallbackDurationCache.set(key, 0);
            return 0;
        } catch {
            fallbackDurationCache.set(key, 0);
            return 0;
        } finally {
            inFlightDurationRequests.delete(key);
        }
    })();

    inFlightDurationRequests.set(key, promise);
    return promise;
};

// ─── iTunes Artwork Fallback ────────────────────────────────────
const fallbackArtCache = new Map();
const inFlightRequests = new Map();

const fetchFallbackArt = async (artist, title) => {
    if (!artist || !title) return null;
    const key = `${artist}-${title}`;
    if (fallbackArtCache.has(key)) return fallbackArtCache.get(key);
    if (inFlightRequests.has(key)) return inFlightRequests.get(key);

    const promise = (async () => {
        try {
            const query = encodeURIComponent(`${artist} ${title}`);
            const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=album&limit=1`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data?.results?.[0]?.artworkUrl100) {
                const highRes = data.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
                fallbackArtCache.set(key, highRes);
                return highRes;
            }
            fallbackArtCache.set(key, null);
            return null;
        } catch {
            fallbackArtCache.set(key, null);
            return null;
        } finally {
            inFlightRequests.delete(key);
        }
    })();

    inFlightRequests.set(key, promise);
    return promise;
};

const AlbumArt = ({ release, alt, className, fallbackSize = 40, fallbackGradient = false }) => {
    const info = release?.basic_information || {};
    const title = cleanName(info.title);
    const artist = (info.artists || []).map(a => cleanName(a.name)).join(' ');
    const defaultImg = info.cover_image || info.thumb;

    const [imgSrc, setImgSrc] = useState(defaultImg);

    useEffect(() => {
        let mounted = true;
        setImgSrc(defaultImg);

        if (!defaultImg && title && artist) {
            fetchFallbackArt(artist, title).then(url => {
                if (mounted && url) {
                    setImgSrc(url);
                    // Mutate info so it correctly carries over to modals and players
                    info.cover_image = url;
                }
            });
        }
        return () => { mounted = false; };
    }, [defaultImg, title, artist, info]);

    if (imgSrc) {
        return <img src={imgSrc} alt={alt || title} className={className} loading="lazy" />;
    }

    if (fallbackGradient) {
        return <div className={`w-full h-full bg-gradient-to-br from-violet-600 to-pink-500 ${className}`} />;
    }

    return (
        <div className={`w-full h-full flex items-center justify-center bg-gray-800 ${className}`}>
            <Music2 size={fallbackSize} className="text-gray-600" />
        </div>
    );
};

// ─── Album Detail Modal ─────────────────────────────────────────
const AlbumDetailModal = ({ release, onClose, onSpin, onArtistSearch }) => {
    const [detail, setDetail] = useState(null);
    const [artistInfo, setArtistInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!release?.id) return;
        setLoading(true);
        setArtistInfo(null);

        // Fetch release detail from Discogs
        fetch(`/api/discogs?action=release&id=${release.id}`)
            .then(r => r.ok ? r.json() : Promise.reject('Failed'))
            .then(data => {
                setDetail(data);
                // Fetch artist bio from Wikipedia (free, no auth)
                const artistName = data.artists?.[0]?.name;
                if (artistName) {
                    const wikiName = artistName.replace(/ /g, '_');
                    return fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`)
                        .then(r => r.ok ? r.json() : null)
                        .then(wiki => {
                            if (wiki?.extract) {
                                setArtistInfo({ bio: wiki.extract, url: wiki.content_urls?.desktop?.page });
                            }
                        })
                        .catch(() => { });
                }
            })
            .catch(() => setDetail(null))
            .finally(() => setLoading(false));
    }, [release?.id]);

    // Backfill missing track durations
    useEffect(() => {
        if (!detail?.tracklist || !release) return;
        const info = release.basic_information || {};
        const artistName = (info.artists || []).map(a => cleanName(a.name)).join(' ');
        let mounted = true;
        let modified = false;

        const fetchMissing = async () => {
            const newList = [...detail.tracklist];
            for (let i = 0; i < newList.length; i++) {
                const track = newList[i];
                const dur = track.durationSeconds !== undefined ? track.durationSeconds : parseDuration(track.duration);
                if (dur <= 0 && track.title) {
                    const fallbackDur = await fetchFallbackDuration(artistName, track.title);
                    if (fallbackDur > 0 && mounted) {
                        modified = true;
                        newList[i] = { ...track, durationSeconds: fallbackDur, duration: formatTime(fallbackDur) };
                    }
                }
            }
            if (modified && mounted) {
                setDetail(prev => ({ ...prev, tracklist: newList }));
            }
        };
        fetchMissing();

        return () => { mounted = false; };
    }, [detail?.id]); // Note: running when detail loads or updates

    if (!release) return null;

    const info = release.basic_information || {};
    const artist = (info.artists || []).map(a => cleanName(a.name)).join(', ');
    const sides = detail ? groupTracksBySide(detail.tracklist) : {};
    const sideKeys = Object.keys(sides).sort();

    // Clean up Discogs markdown-style formatting from notes
    const cleanDiscogsText = (text) => {
        if (!text) return '';
        return text
            .replace(/\[url=([^\]]+)\]([^\[]*)\[\/url\]/g, '$2')  // [url=...]text[/url] → text
            .replace(/\[([a-z])\d+\]/gi, '')  // [a123] style refs
            .replace(/\[\/?\w+\]/g, '')  // other bbcode tags
            .replace(/\r\n/g, '\n')
            .trim();
    };

    // Get album notes (from release detail)
    const albumNotes = cleanDiscogsText(detail?.notes);
    // Get artist bio (from Wikipedia)
    const artistBio = artistInfo?.bio || '';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal — full screen on mobile, centered card on desktop */}
            <div
                className="relative w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] bg-gray-900 sm:border sm:border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header with album art */}
                <div className="relative flex-shrink-0">
                    {/* Background blur */}
                    <div className="absolute inset-0 overflow-hidden">
                        <AlbumArt release={release} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-30" />
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900" />
                    </div>

                    {/* Close — larger tap target on mobile */}
                    <button onClick={onClose} className="absolute top-3 right-3 z-10 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors">
                        <X size={20} className="text-white" />
                    </button>

                    <div className="relative p-4 sm:p-6 pb-3 sm:pb-4 flex gap-4">
                        {/* Album Art */}
                        <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/10">
                            <AlbumArt release={release} alt={info.title} className="w-full h-full object-cover" />
                        </div>

                        {/* Info */}
                        <div className="flex flex-col justify-end min-w-0 flex-1">
                            <p className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2 mb-1">
                                {cleanName(info.title) || 'Unknown'}
                            </p>
                            <p
                                className="text-sm text-gray-300 font-medium truncate hover:text-violet-300 hover:underline transition-colors cursor-pointer w-fit"
                                onClick={() => {
                                    if (onArtistSearch) onArtistSearch(artist);
                                }}
                                title={`Search collection for ${artist}`}
                            >
                                {artist}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {info.year > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-gray-300">{info.year}</span>
                                )}
                                {info.labels?.[0]?.name && (
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-gray-300 truncate max-w-[140px]">
                                        {info.labels[0].name}
                                    </span>
                                )}
                                {info.formats?.[0]?.name && (
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300">
                                        {info.formats[0].name}
                                        {info.formats[0].qty > 1 ? ` × ${info.formats[0].qty}` : ''}
                                    </span>
                                )}
                            </div>
                            {/* Community Rating */}
                            {detail?.community?.rating?.average > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                    <StarRating rating={Math.round(detail.community.rating.average)} size={12} />
                                    <span className="text-[10px] text-gray-500">{detail.community.rating.average.toFixed(1)} ({detail.community.rating.count})</span>
                                </div>
                            )}
                            {/* Spin + Stream buttons */}
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={() => onSpin(release, detail)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Disc3 size={16} className="animate-spin" style={{ animationDuration: '3s' }} />
                                    Spin This
                                </button>
                                {/* Streaming service links */}
                                <div className="flex items-center gap-1.5">
                                    {(() => {
                                        const q = encodeURIComponent(`${artist} ${info.title}`);
                                        return (
                                            <>
                                                {/* Spotify */}
                                                <a href={`https://open.spotify.com/search/${q}`} target="_blank" rel="noopener noreferrer"
                                                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 flex items-center justify-center transition-all hover:scale-110 group" title="Search on Spotify">
                                                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-gray-400 group-hover:fill-[#1DB954] transition-colors">
                                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                                    </svg>
                                                </a>
                                                {/* Apple Music */}
                                                <a href={`https://music.apple.com/search?term=${q}`} target="_blank" rel="noopener noreferrer"
                                                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-[#FC3C44]/20 flex items-center justify-center transition-all hover:scale-110 group" title="Search on Apple Music">
                                                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-gray-400 group-hover:fill-[#FC3C44] transition-colors">
                                                        <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.282C18.96.094 18.21.042 17.46.022c-.105-.004-.21-.017-.315-.022H6.844c-.09.005-.18.018-.27.022-.69.017-1.378.063-2.06.231A5.14 5.14 0 002.18.916C1.167 1.576.46 2.482.165 3.6A8.455 8.455 0 00.01 5.777c0 .105-.006.21-.01.315v11.842l.022.27c.02.69.065 1.377.232 2.056.317 1.286 1.058 2.282 2.16 3.006.49.323 1.028.546 1.604.683.726.173 1.466.22 2.21.24.105.004.21.017.315.022h11.022l.27-.022c.735-.02 1.462-.07 2.178-.26.99-.263 1.837-.735 2.508-1.457.472-.51.828-1.1 1.047-1.764.217-.657.317-1.337.335-2.025.005-.15.02-.3.022-.45V6.124zm-6.457 4.604l-.003 5.846c0 .396-.04.784-.173 1.157-.2.564-.588.94-1.157 1.078-.217.052-.44.078-.662.08-.727.006-1.327-.453-1.504-1.15a1.584 1.584 0 01.724-1.752c.254-.157.53-.276.818-.373.36-.12.73-.213 1.09-.333.274-.09.417-.274.44-.56.005-.065.004-.13.004-.194V9.594a.636.636 0 00-.014-.152c-.027-.116-.103-.177-.222-.157-.043.007-.086.02-.128.033l-4.86 1.273a.451.451 0 00-.328.39c-.006.063-.005.127-.005.19v7.155c0 .378-.036.752-.16 1.113-.208.607-.617 1.006-1.233 1.15-.217.05-.44.074-.66.074-.72 0-1.32-.46-1.49-1.153a1.587 1.587 0 01.72-1.764c.263-.163.55-.287.848-.387.33-.11.664-.198.994-.305.274-.09.416-.26.443-.55.005-.06.005-.12.005-.18l.002-9.63a1.27 1.27 0 01.105-.5.693.693 0 01.428-.375c.07-.023.142-.04.214-.055l5.612-1.467c.183-.048.368-.09.558-.1.263-.014.424.12.46.384.007.058.01.117.01.176v5.772z" />
                                                    </svg>
                                                </a>
                                                {/* YouTube Music */}
                                                <a href={`https://music.youtube.com/search?q=${q}`} target="_blank" rel="noopener noreferrer"
                                                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-[#FF0000]/20 flex items-center justify-center transition-all hover:scale-110 group" title="Search on YouTube Music">
                                                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-gray-400 group-hover:fill-[#FF0000] transition-colors">
                                                        <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
                                                    </svg>
                                                </a>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Genre/Style tags */}
                {detail && (detail.genres?.length > 0 || detail.styles?.length > 0) && (
                    <div className="px-4 sm:px-6 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                        {(detail.genres || []).map(g => (
                            <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-medium">{g}</span>
                        ))}
                        {(detail.styles || []).map(s => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">{s}</span>
                        ))}
                    </div>
                )}

                {/* Tracklist + info */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="text-violet-400 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Artist Bio */}
                            {artistBio && (
                                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User size={14} className="text-violet-400" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">About {artist}</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-6 whitespace-pre-line">
                                        {artistBio}
                                    </p>
                                    {artistInfo?.url && (
                                        <a href={artistInfo.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                                            Read more on Wikipedia →
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Album Notes */}
                            {albumNotes && (
                                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Music2 size={14} className="text-pink-400" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-pink-400">About This Release</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-6 whitespace-pre-line">
                                        {albumNotes}
                                    </p>
                                    {detail?.uri && (
                                        <a href={`https://www.discogs.com${detail.uri}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs font-semibold text-pink-400 hover:text-pink-300 transition-colors">
                                            View on Discogs →
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Tracklist */}
                            {detail?.tracklist?.length > 0 && (
                                <div className="space-y-4">
                                    {sideKeys.map(side => (
                                        <div key={side}>
                                            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-gray-900 py-1 z-10">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-black text-gray-300 border border-gray-600">
                                                    {side}
                                                </div>
                                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                    Side {side}
                                                </span>
                                                <div className="flex-1 h-px bg-white/5" />
                                                <span className="text-[10px] text-gray-600">
                                                    {sides[side].filter(t => t.durationSeconds > 0).length > 0
                                                        ? formatTime(sides[side].reduce((sum, t) => sum + t.durationSeconds, 0))
                                                        : ''}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                {sides[side].map((track, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
                                                        <span className="text-xs text-gray-600 w-6 text-right tabular-nums font-medium">
                                                            {track.position || idx + 1}
                                                        </span>
                                                        <span className="flex-1 text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                                                            {track.title}
                                                        </span>
                                                        <span className="text-xs text-gray-600 tabular-nums">
                                                            {track.duration || '—'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* No content fallback */}
                            {!artistBio && !albumNotes && !detail?.tracklist?.length && (
                                <p className="text-center text-gray-500 text-sm py-8">No details available</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const NowSpinningWidget = ({ details, trackData, onStop, onViewAlbum, onArtistClick }) => {
    const [selectedSide, setSelectedSide] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [expanded, setExpanded] = useState(true);
    const [showLyrics, setShowLyrics] = useState(false);
    const [lyrics, setLyrics] = useState('');
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [lyricsTrack, setLyricsTrack] = useState('');
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const lyricsRef = useRef(null);

    const sides = trackData ? groupTracksBySide(trackData.tracklist) : {};
    const sideKeys = Object.keys(sides).sort();
    const hasSides = sideKeys.length > 0;

    // Auto-select first side
    useEffect(() => {
        if (sideKeys.length > 0 && !selectedSide) {
            setSelectedSide(sideKeys[0]);
        }
    }, [sideKeys, selectedSide]);

    // Reset when album changes
    useEffect(() => {
        setIsPlaying(false);
        setElapsed(0);
        setSelectedSide(null);
        setLyrics('');
        setLyricsTrack('');
        setShowLyrics(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, [details?.id]);

    // Timer
    useEffect(() => {
        if (isPlaying) {
            startTimeRef.current = Date.now() - elapsed * 1000;
            timerRef.current = setInterval(() => {
                setElapsed((Date.now() - startTimeRef.current) / 1000);
            }, 250);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isPlaying]);

    const handlePlay = () => {
        if (!selectedSide) return;
        setIsPlaying(!isPlaying);
    };

    const handleSideChange = (side) => {
        setSelectedSide(side);
        setIsPlaying(false);
        setElapsed(0);
        setLyrics('');
        setLyricsTrack('');
    };

    // Find current track based on elapsed time
    const currentTrackInfo = useMemo(() => {
        if (!selectedSide || !sides[selectedSide]) return null;
        const tracks = sides[selectedSide];
        let cumulative = 0;
        for (let i = 0; i < tracks.length; i++) {
            const dur = tracks[i].durationSeconds;
            if (dur <= 0) {
                // If no duration data, just show first track with unknown timing
                if (i === 0 && elapsed === 0) return { track: tracks[i], index: i, progress: 0, total: tracks.length };
                continue;
            }
            cumulative += dur;
            if (elapsed < cumulative) {
                const trackElapsed = elapsed - (cumulative - dur);
                return {
                    track: tracks[i],
                    index: i,
                    progress: trackElapsed / dur,
                    trackElapsed,
                    trackDuration: dur,
                    total: tracks.length,
                };
            }
        }
        // Past all tracks — side is done
        const lastTrack = tracks[tracks.length - 1];
        return { track: lastTrack, index: tracks.length - 1, progress: 1, done: true, total: tracks.length };
    }, [selectedSide, sides, elapsed]);

    const fetchLyricsWithFallback = useCallback(async (artist, title) => {
        try {
            // Primary: lyrics.ovh
            const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.lyrics) return data.lyrics;
            }

            // Fallback: LRCLIB
            const lrclibRes = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`);
            if (lrclibRes.ok) {
                const lrclibData = await lrclibRes.json();
                if (lrclibData && lrclibData.length > 0 && lrclibData[0].plainLyrics) {
                    return lrclibData[0].plainLyrics;
                }
            }
            return 'Lyrics not available for this track.';
        } catch {
            return 'Lyrics not available for this track.';
        }
    }, []);

    // Fetch lyrics when current track changes
    useEffect(() => {
        if (!currentTrackInfo?.track?.title || !details?.artist) return;
        const trackTitle = currentTrackInfo.track.title;
        const trackKey = `${details.artist}/${trackTitle}`;

        // Don't re-fetch for the same track
        if (trackKey === lyricsTrack) return;

        setLyricsTrack(trackKey);
        if (!showLyrics) return; // Only fetch if lyrics panel is open

        let mounted = true;
        setLyricsLoading(true);
        setLyrics('');

        fetchLyricsWithFallback(details.artist, trackTitle).then(res => {
            if (mounted) {
                setLyrics(res);
                setLyricsLoading(false);
            }
        });

        return () => { mounted = false; };
    }, [currentTrackInfo?.track?.title, details?.artist, showLyrics, fetchLyricsWithFallback]);

    // Fetch lyrics when toggling lyrics on
    useEffect(() => {
        if (showLyrics && !lyrics && !lyricsLoading && currentTrackInfo?.track?.title && details?.artist) {
            let mounted = true;
            setLyricsLoading(true);
            fetchLyricsWithFallback(details.artist, currentTrackInfo.track.title).then(res => {
                if (mounted) {
                    setLyrics(res);
                    setLyricsLoading(false);
                }
            });
            return () => { mounted = false; };
        }
    }, [showLyrics, lyrics, lyricsLoading, currentTrackInfo, details, fetchLyricsWithFallback]);

    // Scroll lyrics to top when track changes
    useEffect(() => {
        if (lyricsRef.current) lyricsRef.current.scrollTop = 0;
    }, [lyricsTrack]);

    // Total side duration
    const sideDuration = selectedSide && sides[selectedSide]
        ? sides[selectedSide].reduce((sum, t) => sum + t.durationSeconds, 0)
        : 0;

    if (!details) return null;

    return (
        <>
            {expanded ? (
                <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col md:flex-row h-[100dvh] overflow-hidden animate-slide-up">
                    {/* Background Glass/Blur Effects */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-violet-900/20 blur-[120px]" />
                        <div className="absolute -bottom-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-pink-900/20 blur-[120px]" />
                    </div>

                    {/* Top Controls */}
                    <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-3 z-50">
                        <button
                            onClick={() => setExpanded(false)}
                            className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:scale-105"
                            title="Minimize Player"
                        >
                            <ChevronDown size={24} />
                        </button>
                        <button
                            onClick={onStop}
                            className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:scale-105"
                            title="Stop Spinning"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Left Side: Big Vinyl */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center min-h-[25vh] md:min-h-screen relative z-10 pt-12 md:pt-0">
                        <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-[420px] md:h-[420px]">

                            {/* Album Sleeve (Behind) */}
                            {details.cover && (
                                <div className={`absolute inset-0 rounded-sm shadow-2xl transition-all duration-1000 ease-in-out border border-white/10 z-0 ${isPlaying ? '-translate-x-4 md:-translate-x-12 rotate-[-4deg] opacity-90 scale-95' : 'translate-x-0 rotate-0 opacity-100 scale-100'}`}>
                                    <img src={details.cover} alt="Album Sleeve" className="w-full h-full object-cover rounded-sm" />
                                    <div className="absolute inset-0 bg-black/5 rounded-sm pointer-events-none" />
                                </div>
                            )}

                            {/* Spinning Record Wrapper (In front) */}
                            <div className={`absolute inset-0 z-10 transition-transform duration-1000 ease-in-out ${isPlaying ? 'translate-x-4 md:translate-x-12' : 'translate-x-0'}`}>
                                <div className={`w-full h-full rounded-full bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-[0_10px_40px_rgba(0,0,0,0.3)] ${isPlaying ? 'vinyl-spin' : ''}`}>
                                    <div className="absolute inset-[3px] rounded-full border border-gray-700/30 pointer-events-none" />
                                    <div className="absolute inset-[10px] sm:inset-[16px] rounded-full border border-gray-700/20 pointer-events-none" />
                                    <div className="absolute inset-[24px] sm:inset-[32px] rounded-full border border-gray-700/30 pointer-events-none" />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-24 h-24 md:w-36 md:h-36 rounded-full overflow-hidden border border-gray-700 shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
                                            {details.cover ? (
                                                <img src={details.cover} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-violet-600 to-pink-500" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gray-950 border border-gray-700" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Info & Controls */}
                    <div className="flex-1 flex flex-col justify-start max-w-2xl px-6 pb-4 md:p-12 z-10 mx-auto md:mx-0 w-full min-h-0 overflow-hidden">
                        <div className="mb-2 text-center md:text-left shrink-0">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Volume2 size={20} className={`flex-shrink-0 ${isPlaying ? 'text-violet-400 animate-pulse' : 'text-gray-500'}`} />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
                                    Now Spinning
                                </span>
                            </div>
                            <h2
                                className="text-2xl md:text-6xl font-black text-white leading-tight mb-0.5 truncate cursor-pointer hover:text-violet-300 transition-colors title-wrap"
                                onClick={() => {
                                    setExpanded(false);
                                    if (onViewAlbum) onViewAlbum();
                                }}
                                title={details.title}
                                style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                            >
                                {details.title}
                            </h2>
                            <h3
                                className="text-xl md:text-2xl text-gray-400 truncate cursor-pointer hover:text-violet-300 transition-colors"
                                onClick={() => {
                                    setExpanded(false);
                                    if (onArtistClick) onArtistClick(details.artist);
                                }}
                            >
                                {details.artist}
                            </h3>
                        </div>

                        {/* Side Tabs */}
                        {hasSides && (
                            <div className="flex items-center md:justify-start justify-center gap-2 mb-4 shrink-0 flex-wrap">
                                {sideKeys.map(side => (
                                    <button
                                        key={side}
                                        onClick={() => handleSideChange(side)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedSide === side
                                            ? 'bg-violet-500/20 text-violet-300 border-violet-500/30 shadow-lg shadow-violet-500/10'
                                            : 'bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border ${selectedSide === side ? 'border-violet-400 bg-violet-500/30 text-white' : 'border-gray-500 bg-gray-800/50'
                                            }`}>
                                            {side}
                                        </div>
                                        Side {side}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tracklist & Lyrics Container */}
                        <div className="rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md overflow-hidden flex flex-col flex-1 min-h-0 max-h-[440px] md:max-h-none mb-4">

                            {/* Tab Headers */}
                            <div className="flex border-b border-white/10 shrink-0">
                                <button
                                    onClick={() => setShowLyrics(false)}
                                    className={`flex-1 py-4 text-sm font-bold transition-colors ${!showLyrics ? 'text-violet-300 border-b-2 border-violet-400 bg-white/[0.02]' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Tracklist
                                </button>
                                <button
                                    onClick={() => setShowLyrics(true)}
                                    className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-colors ${showLyrics ? 'text-pink-400 border-b-2 border-pink-400 bg-white/[0.02]' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Music2 size={16} /> Lyrics
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="overflow-y-auto p-2 scrollbar-thin flex-1 relative min-h-[200px]">
                                {!showLyrics ? (
                                    selectedSide && sides[selectedSide] ? (
                                        <div className="space-y-1">
                                            {sides[selectedSide].map((track, idx) => {
                                                const isCurrent = currentTrackInfo?.index === idx && isPlaying;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isCurrent
                                                            ? 'bg-violet-500/15 text-violet-200 shadow-sm'
                                                            : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                                                            }`}
                                                    >
                                                        {/* Progress background for current track */}
                                                        {isCurrent && currentTrackInfo.trackDuration > 0 && (
                                                            <div
                                                                className="absolute inset-0 bg-violet-500/10 rounded-xl transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                                                                style={{ width: `${Math.min(currentTrackInfo.progress * 100, 100)}%` }}
                                                            />
                                                        )}

                                                        <div className="relative flex items-center w-full gap-3">
                                                            {isCurrent ? (
                                                                <Volume2 size={16} className="text-violet-400 animate-pulse flex-shrink-0" />
                                                            ) : (
                                                                <span className="w-5 text-right font-medium text-gray-600 flex-shrink-0">{track.position || idx + 1}</span>
                                                            )}
                                                            <span className={`flex-1 min-w-0 truncate ${isCurrent ? 'font-bold' : ''}`}>
                                                                {track.title}
                                                            </span>
                                                            <span className="text-sm font-medium tabular-nums opacity-60">
                                                                {track.duration || '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                                            Select a side to view tracks
                                        </div>
                                    )
                                ) : (
                                    <div ref={lyricsRef} className="p-4 h-full">
                                        {lyricsLoading ? (
                                            <div className="flex h-full items-center justify-center flex-col gap-3">
                                                <Loader2 size={24} className="text-pink-400 animate-spin" />
                                                <span className="text-sm text-gray-400 font-medium">Loading {currentTrackInfo?.track?.title}...</span>
                                            </div>
                                        ) : (
                                            <p className="text-sm md:text-base text-gray-300 leading-relaxed whitespace-pre-line text-center">
                                                {lyrics}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Player Controls Bar */}
                        <div className="w-full border-t border-white/10 p-4 shrink-0 bg-gray-950/30 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4 rounded-2xl md:rounded-b-2xl">
                            <div className="flex items-center gap-5 relative z-10">
                                <button
                                    onClick={handlePlay}
                                    disabled={!selectedSide}
                                    className={`flex items-center justify-center w-14 h-14 shrink-0 rounded-full transition-all ${isPlaying
                                        ? 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95'
                                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:scale-105 active:scale-95'
                                        } disabled:opacity-30 disabled:hover:scale-100`}
                                >
                                    {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                                </button>

                                <div className="flex-1 min-w-0">
                                    {currentTrackInfo ? (
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-sm font-bold text-white truncate pr-2">
                                                {currentTrackInfo.done ? 'Side complete' : currentTrackInfo.track?.title || 'Unknown Track'}
                                            </p>
                                            <p className="text-xs font-medium text-gray-400 tabular-nums shrink-0">
                                                {formatTime(elapsed)} {sideDuration > 0 ? `/ ${formatTime(sideDuration)}` : ''}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mb-2">
                                            <p className="text-sm font-bold text-gray-500">No track playing</p>
                                        </div>
                                    )}

                                    {/* Overall progress bar */}
                                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-200 ease-out"
                                            style={{ width: `${Math.min((elapsed / (sideDuration || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* --- Minimized Player --- */
                <div className="now-spinning-overlay fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 animate-slide-up sm:max-w-[320px] sm:w-full">
                    <div
                        className="relative rounded-t-2xl sm:rounded-2xl bg-gray-900/95 backdrop-blur-xl border-t sm:border border-white/10 shadow-2xl shadow-black/50 overflow-hidden cursor-pointer hover:bg-gray-800/95 transition-colors group"
                        onClick={() => setExpanded(true)}
                    >
                        {/* Close button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onStop(); }}
                            className="absolute top-1/2 -translate-y-1/2 right-3 z-10 p-2 rounded-full hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Stop spinning"
                        >
                            <X size={16} className="text-gray-400 hover:text-white" />
                        </button>

                        <div className="flex items-center gap-3 p-3 pr-12 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3">
                            {/* Spinning Vinyl */}
                            <div className="relative flex-shrink-0 w-12 h-12">
                                <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-lg ${isPlaying ? 'vinyl-spin' : ''}`}>
                                    <div className="absolute inset-[2px] rounded-full border border-gray-700/30" />
                                    <div className="absolute inset-[4px] rounded-full border border-gray-700/20" />
                                    <div className="absolute inset-[6px] rounded-full border border-gray-700/30" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-4 h-4 rounded-full overflow-hidden border border-gray-700">
                                            {details.cover ? (
                                                <img src={details.cover} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-violet-600 to-pink-500" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-1 h-1 rounded-full bg-gray-950 border border-gray-700" />
                                    </div>
                                </div>

                                {/* Play/Pause Overlay on Hover */}
                                <div
                                    className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                                >
                                    {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
                                </div>
                            </div>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Volume2 size={10} className={`flex-shrink-0 ${isPlaying ? 'text-violet-400 animate-pulse' : 'text-gray-500'}`} />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-violet-400">
                                        Now Spinning
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-white truncate leading-tight">
                                    {details.title}
                                </p>
                                <p className="text-xs text-gray-400 truncate">
                                    {details.artist}
                                </p>
                            </div>

                            <div className="pr-3 text-gray-500 group-hover:text-white transition-colors">
                                <ChevronDown size={20} className="rotate-180" />
                            </div>
                        </div>

                        {/* Slim progress bar at bottom */}
                        {isPlaying && sideDuration > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500"
                                    style={{ width: `${Math.min((elapsed / sideDuration) * 100, 100)}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Vinyl Collection Page ──────────────────────────────────────
export const SpinVinyl = () => {
    useSpinPWA();
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState('');
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalItems, setTotalItems] = useState(0);
    const [nowSpinning, setNowSpinning] = useState(null);
    const [spinningDetails, setSpinningDetails] = useState(null);
    const [spinningTrackData, setSpinningTrackData] = useState(null);
    const [selectedAlbum, setSelectedAlbum] = useState(null); // For detail modal

    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authUsername, setAuthUsername] = useState('');
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // View & Sort State
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('vinylView') || 'grid');
    const [sortBy, setSortBy] = useState(() => localStorage.getItem('vinylSort') || 'year-desc');
    const [showSortMenu, setShowSortMenu] = useState(false);

    const currentSort = SORT_OPTIONS.find(s => s.value === sortBy) || SORT_OPTIONS[0];

    useEffect(() => { localStorage.setItem('vinylView', viewMode); }, [viewMode]);
    useEffect(() => { localStorage.setItem('vinylSort', sortBy); }, [sortBy]);

    // ─── Check Authentication Status ───────────────────────────
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/discogs?action=status');
                const data = await res.json();
                if (data.authenticated) {
                    setIsAuthenticated(true);
                    setAuthUsername(data.username);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (err) {
                console.error('Auth check failed:', err);
                setIsAuthenticated(false);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    // ─── Fetch ALL pages of the collection ─────────────────────
    const fetchCollection = useCallback(async (sort = currentSort) => {
        if (!isAuthenticated) return;

        setLoading(true);
        setError(null);
        setLoadingProgress('Loading page 1…');
        try {
            // Fetch first page to get total pages
            const res1 = await fetch(`/api/discogs?action=collection&page=1&per_page=100&sort=${sort.apiSort}&sort_order=${sort.apiOrder}`);
            if (res1.status === 401) {
                setIsAuthenticated(false);
                throw new Error('Session expired. Please log in again.');
            }
            if (!res1.ok) throw new Error(`API error: ${res1.status}`);
            const data1 = await res1.json();
            const pages = data1.pagination?.pages || 1;
            const total = data1.pagination?.items || 0;
            let allReleases = [...(data1.releases || [])];

            setTotalItems(total);

            // Fetch remaining pages
            for (let p = 2; p <= pages; p++) {
                setLoadingProgress(`Loading page ${p} of ${pages}…`);
                const res = await fetch(`/api/discogs?action=collection&page=${p}&per_page=100&sort=${sort.apiSort}&sort_order=${sort.apiOrder}`);
                if (!res.ok) throw new Error(`API error on page ${p}: ${res.status}`);
                const data = await res.json();
                allReleases = [...allReleases, ...(data.releases || [])];
            }

            setReleases(allReleases);
            setTotalItems(allReleases.length);
        } catch (err) {
            console.error('Failed to fetch collection:', err);
            setError(err.message);
        } finally { setLoading(false); setLoadingProgress(''); }
    }, [isAuthenticated, currentSort]); // Added dependencies

    useEffect(() => {
        if (isAuthenticated) {
            fetchCollection();
        }
    }, [fetchCollection, isAuthenticated]);

    // Close sort menu on outside click
    useEffect(() => {
        if (!showSortMenu) return;
        const handleClick = () => setShowSortMenu(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [showSortMenu]);

    // ─── Album click → open detail modal ────────────────────────
    const handleAlbumClick = (release) => {
        setSelectedAlbum(release);
    };

    // ─── "Spin This" from modal ─────────────────────────────────
    const handleSpin = (release, detail) => {
        const info = release.basic_information || {};
        const spinInfo = {
            id: release.id,
            title: cleanName(info.title || detail?.title || 'Unknown'),
            artist: (info.artists || []).map(a => cleanName(a.name)).join(', ') || 'Unknown',
            year: info.year || detail?.year || '',
            cover: detail?.images?.[0]?.uri || info.cover_image || info.thumb || '',
            label: info.labels?.[0]?.name || '',
            format: info.formats?.[0]?.name || 'Vinyl',
        };

        setNowSpinning(spinInfo);
        setSpinningDetails(spinInfo);
        setSpinningTrackData(detail);
        setSelectedAlbum(null); // Close modal
        localStorage.setItem('nowSpinning', JSON.stringify(spinInfo));
    };

    const stopSpinning = () => {
        setNowSpinning(null);
        setSpinningDetails(null);
        setSpinningTrackData(null);
        localStorage.removeItem('nowSpinning');
    };

    // ─── Filter & Sort ──────────────────────────────────────────
    const filteredAndSorted = useMemo(() => {
        let result = [...releases];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => {
                const info = r.basic_information || {};
                const artist = (info.artists || []).map(a => cleanName(a.name)).join(' ').toLowerCase();
                const title = cleanName(info.title || '').toLowerCase();
                const label = (info.labels || []).map(l => cleanName(l.name)).join(' ').toLowerCase();
                return artist.includes(q) || title.includes(q) || label.includes(q);
            });
        }
        const sortOption = SORT_OPTIONS.find(s => s.value === sortBy) || SORT_OPTIONS[0];
        result.sort((a, b) => {
            const infoA = a.basic_information || {};
            const infoB = b.basic_information || {};
            let valA, valB;
            switch (sortOption.field) {
                case 'artist': valA = (infoA.artists || []).map(x => cleanName(x.name)).join(', ').toLowerCase(); valB = (infoB.artists || []).map(x => cleanName(x.name)).join(', ').toLowerCase(); break;
                case 'title': valA = cleanName(infoA.title || '').toLowerCase(); valB = cleanName(infoB.title || '').toLowerCase(); break;
                case 'year': valA = infoA.year || 0; valB = infoB.year || 0; break;
                case 'added': valA = a.date_added || ''; valB = b.date_added || ''; break;
                case 'label': valA = (infoA.labels?.[0]?.name || '').toLowerCase(); valB = (infoB.labels?.[0]?.name || '').toLowerCase(); break;
                default: return 0;
            }
            if (valA < valB) return sortOption.order === 'asc' ? -1 : 1;
            if (valA > valB) return sortOption.order === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [releases, searchQuery, sortBy]);

    const handleSortChange = (option) => {
        setSortBy(option.value);
        setShowSortMenu(false);
        if (option.apiSort !== currentSort.apiSort || option.apiOrder !== currentSort.apiOrder) {
            fetchCollection(option);
        }
    };

    // ─── Render Unauthenticated State (Login Page) ──────────────
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Disc3 size={48} className="text-violet-500 animate-spin-slow" />
                    <p className="text-gray-400 font-medium tracking-wide">Connecting...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.15),transparent_60%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.1),transparent_50%)] pointer-events-none" />

                <div className="max-w-md w-full relative z-10 text-center flex flex-col items-center">
                    <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-xl shadow-pink-500/20 border border-white/10">
                        <Disc3 size={48} className="text-white drop-shadow-lg" />
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                        Spin Vinyl
                    </h1>

                    <p className="text-gray-400 text-lg mb-10 max-w-sm mx-auto">
                        Your physical record collection, beautifully visualized for a digital listening experience.
                    </p>

                    <PWAHelp />

                    <a
                        href="/api/discogs?action=login"
                        className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/10"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3.3c4.805 0 8.7 3.895 8.7 8.7 0 4.805-3.895 8.7-8.7 8.7-4.805 0-8.7-3.895-8.7-8.7 0-4.805 3.895-8.7 8.7-8.7z" />
                            <path d="M14.54 13.06c0-1.04-.62-1.74-1.66-1.74H10.1v3.48h2.78c1.04 0 1.66-.7 1.66-1.74zm-2.82.7h-1.62v-1.4h1.62c.48 0 .68.2.68.7s-.2.7-.68.7zm5.94-.7c0 1.76-1.22 2.84-2.92 2.84H8V9.9h6.74c1.7 0 2.92 1.08 2.92 2.84zm-1.16 0c0-1.04-.62-1.74-1.66-1.74h-2.78v3.48h2.78c1.04 0 1.66-.7 1.66-1.74z" />
                        </svg>
                        Connect to Discogs
                    </a>

                    <p className="text-xs text-gray-500 mt-6">
                        Read-only access to view your collection.
                    </p>
                </div>
            </div>
        );
    }

    // ─── Render Authenticated State ──────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
            {/* Hero — compact on mobile */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.15),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.1),transparent_50%)]" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-16 pb-4 sm:pb-12">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-8 sm:mb-12">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg border border-white/10">
                                {nowSpinning?.cover ? (
                                    <img src={nowSpinning.cover} alt="" className="w-full h-full object-cover animate-spin-slow" style={{ animationDuration: '4s' }} />
                                ) : (
                                    <>
                                        <Disc3 size={20} className="text-white sm:hidden" />
                                        <Disc3 size={28} className="text-white hidden sm:block md:hidden" />
                                        <Disc3 size={32} className="text-white hidden md:block" />
                                    </>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight sm:leading-none">Spin Vinyl</h1>
                                <p className="text-xs sm:text-sm text-violet-300/60 font-medium tracking-widest uppercase mt-0.5 sm:mt-1">The Ultimate Discogs® Listening Companion</p>
                            </div>
                        </div>

                        {/* Profile / Logout */}
                        <div className="flex items-center gap-3">
                            {releases.length > 0 && (
                                <button
                                    onClick={() => { const pick = releases[Math.floor(Math.random() * releases.length)]; handleAlbumClick(pick); }}
                                    className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-violet-600/80 to-pink-600/80 hover:from-violet-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.03] active:scale-[0.97] min-h-[44px] flex-shrink-0"
                                >
                                    <Shuffle size={16} />
                                    <span className="hidden sm:inline">Random Pick</span>
                                    <span className="sm:hidden">Random</span>
                                </button>
                            )}
                            <div className="hidden sm:flex flex-col items-end border-l border-white/10 pl-3 ml-1">
                                <span className="text-sm font-bold text-white">{authUsername}</span>
                                <span className="text-[10px] uppercase tracking-wider text-green-400 font-bold flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Connected
                                </span>
                            </div>
                            <button
                                onClick={async () => {
                                    await fetch('/api/discogs?action=logout');
                                    setIsAuthenticated(false);
                                    setReleases([]);
                                    setTotalItems(0);
                                }}
                                className="p-2 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
                            >
                                <span className="hidden sm:inline">Disconnect</span>
                                <span className="sm:hidden">Exit</span>
                            </button>
                        </div>
                    </div>


                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-32">
                    {/* Toolbar — single row on mobile */}
                    <div className="sticky top-0 z-30 py-3 sm:py-4 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 -mx-3 sm:-mx-6 px-3 sm:px-6 mb-4 sm:mb-8">
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search…"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm"
                                />
                            </div>
                            {/* Sort */}
                            <div className="relative flex-shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}
                                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors min-h-[44px]">
                                    <ArrowUpDown size={16} className="text-gray-500" />
                                    <span className="hidden sm:inline">{currentSort.label}</span>
                                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                                </button>
                                {showSortMenu && (
                                    <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-52 rounded-xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/50 overflow-hidden z-50 animate-slide-up"
                                        onClick={e => e.stopPropagation()}>
                                        <div className="p-1">
                                            {SORT_OPTIONS.map(option => {
                                                const Icon = option.icon;
                                                const isActive = sortBy === option.value;
                                                return (
                                                    <button key={option.value} onClick={() => handleSortChange(option)}
                                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] ${isActive ? 'bg-violet-500/20 text-violet-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                                        <Icon size={14} className={isActive ? 'text-violet-400' : 'text-gray-600'} />
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* View toggle */}
                            <div className="flex rounded-xl border border-white/10 overflow-hidden flex-shrink-0">
                                <button onClick={() => setViewMode('grid')} className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`} title="Grid view">
                                    <LayoutGrid size={16} />
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-3 transition-colors border-l border-white/10 ${viewMode === 'list' ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`} title="List view">
                                    <List size={16} />
                                </button>
                            </div>
                        </div>
                        {(searchQuery || sortBy !== 'artist-asc') && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                <span>{filteredAndSorted.length} of {releases.length} records</span>
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors min-h-[32px]">
                                        "{searchQuery}" <X size={12} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-24 sm:py-32 gap-4">
                            <Disc3 size={40} className="text-violet-400 animate-spin" />
                            <p className="text-gray-500 text-sm">{loadingProgress || 'Loading your collection…'}</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && !loading && (
                        <div className="max-w-md mx-auto text-center py-20">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                                <Disc size={28} className="text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
                            <p className="text-gray-400 text-sm mb-6">{error}</p>
                            <button onClick={() => fetchCollection()} className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors">Try Again</button>
                        </div>
                    )}

                    {/* GRID View */}
                    {!loading && !error && viewMode === 'grid' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4 md:gap-6">
                            {filteredAndSorted.map((release) => {
                                const info = release.basic_information || {};
                                const artist = (info.artists || []).map(a => cleanName(a.name)).join(', ');
                                const isSpinning = nowSpinning?.id === release.id;
                                return (
                                    <button key={release.instance_id || release.id} onClick={() => handleAlbumClick(release)}
                                        className={`group text-left rounded-xl overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/60 ${isSpinning ? 'ring-2 ring-violet-500 shadow-lg shadow-violet-500/20 scale-[1.02]' : 'hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40'}`}>
                                        <div className="aspect-square relative overflow-hidden bg-gray-800">
                                            <AlbumArt release={release} alt={`${cleanName(info.title)} by ${artist}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" fallbackSize={40} />
                                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isSpinning ? 'bg-violet-900/40' : 'bg-black/0 group-hover:bg-black/50'}`}>
                                                {isSpinning ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/90 text-white text-xs font-bold">
                                                        <Volume2 size={14} className="animate-pulse" /> NOW SPINNING
                                                    </div>
                                                ) : (
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold">
                                                        <Music2 size={14} /> VIEW ALBUM
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-white/[0.03]">
                                            <p className="text-sm font-semibold text-white truncate leading-tight" title={cleanName(info.title)}>{cleanName(info.title) || 'Unknown'}</p>
                                            <p
                                                className="text-xs text-gray-400 truncate mt-0.5 hover:text-violet-300 hover:underline transition-colors pointer-events-auto relative z-10 w-fit"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSearchQuery(artist);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                title={`Search collection for ${artist}`}
                                            >
                                                {artist || 'Unknown'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 relative z-10">
                                                {info.year > 0 && <span className="text-[10px] text-gray-500 font-medium">{info.year}</span>}
                                                {info.formats?.[0]?.name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium">{info.formats[0].name}</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* LIST View */}
                    {!loading && !error && viewMode === 'list' && (
                        <>
                            <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_80px_120px_100px] gap-4 px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-gray-500 border-b border-white/5 mb-1">
                                <div className="w-12" /><div>Title</div><div>Artist</div><div>Year</div><div>Label</div><div className="text-right">Format</div>
                            </div>
                            <div className="divide-y divide-white/5">
                                {filteredAndSorted.map((release) => {
                                    const info = release.basic_information || {};
                                    const artist = (info.artists || []).map(a => cleanName(a.name)).join(', ');
                                    const isSpinning = nowSpinning?.id === release.id;
                                    return (
                                        <button key={release.instance_id || release.id} onClick={() => handleAlbumClick(release)}
                                            className={`w-full group text-left grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr_80px_120px_100px] gap-3 sm:gap-4 items-center px-4 py-3 transition-all duration-200 rounded-lg focus:outline-none ${isSpinning ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-white/[0.03] border-l-2 border-transparent'}`}>
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 relative">
                                                <AlbumArt release={release} alt="" className="w-full h-full object-cover" fallbackSize={16} />
                                                {isSpinning && <div className="absolute inset-0 bg-violet-500/30 flex items-center justify-center"><Volume2 size={12} className="text-white animate-pulse" /></div>}
                                            </div>
                                            <div className="min-w-0 sm:contents">
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isSpinning ? 'text-violet-300' : 'text-white group-hover:text-violet-300'} transition-colors`} title={cleanName(info.title)}>{cleanName(info.title) || 'Unknown'}</p>
                                                    <p
                                                        className="text-xs text-gray-500 truncate sm:hidden mt-0.5 hover:text-violet-300 hover:underline transition-colors pointer-events-auto relative z-10 w-fit"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSearchQuery(artist);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                    >
                                                        {artist} {info.year > 0 ? `· ${info.year}` : ''}
                                                    </p>
                                                </div>
                                                <p
                                                    className="hidden sm:block text-sm text-gray-400 truncate hover:text-violet-300 hover:underline transition-colors pointer-events-auto relative z-10 w-fit"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSearchQuery(artist);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                >
                                                    {artist || 'Unknown'}
                                                </p>
                                                <p className="hidden sm:block text-sm text-gray-500 tabular-nums">{info.year > 0 ? info.year : '—'}</p>
                                                <p className="hidden sm:block text-xs text-gray-500 truncate">{info.labels?.[0]?.name || '—'}</p>
                                                <div className="hidden sm:flex justify-end">
                                                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${isSpinning ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-gray-500'}`}>{info.formats?.[0]?.name || 'Vinyl'}</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Empty search */}
                    {!loading && !error && filteredAndSorted.length === 0 && searchQuery && (
                        <div className="text-center py-20"><p className="text-gray-500">No records match "{searchQuery}"</p></div>
                    )}


                </div>
            </div>

            {/* Album Detail Modal */}
            {selectedAlbum && (
                <AlbumDetailModal
                    release={selectedAlbum}
                    onClose={() => setSelectedAlbum(null)}
                    onSpin={handleSpin}
                    onArtistSearch={(artist) => {
                        setSearchQuery(artist);
                        setSelectedAlbum(null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                />
            )}

            {/* Now Spinning Widget */}
            <NowSpinningWidget
                details={spinningDetails}
                trackData={spinningTrackData}
                onStop={stopSpinning}
                onViewAlbum={() => {
                    if (spinningDetails && releases) {
                        const release = releases.find(r => r.id === spinningDetails.id);
                        if (release) handleAlbumClick(release);
                    }
                }}
                onArtistClick={(artistName) => {
                    setSearchQuery(artistName);
                    setSelectedAlbum(null); // close modal if open to see results
                    window.scrollTo({ top: 0, behavior: 'smooth' }); // scroll to top to see search
                }}
            />
        </div>
    );
};
