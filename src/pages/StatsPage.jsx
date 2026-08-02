import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BarChart2, CheckCircle, Clock, Disc3, DollarSign, Music2, RefreshCw, TrendingUp } from 'lucide-react';
import {
    getPeriodSpinCount, getTopAlbums, getGenreBreakdown,
    getDayMap, getUniqueAlbumsSpun, getStoredStats, getCurrentStreak,
} from '../lib/statsEngine.js';
import { readPriceCache, fetchReleasePrice } from '../lib/priceCache.js';

// ─── Helpers ─────────────────────────────────────────────────────

const toDateStr = (d) => d.toISOString().slice(0, 10);

/** Build array of 371 days (53 weeks) ending today, aligned to Sunday. */
const buildCalendarDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Align end to Saturday of this week
    const endPad = (6 - today.getDay() + 7) % 7; // 0 if already Saturday
    const endDay = new Date(today);
    endDay.setDate(today.getDate() + endPad);

    const days = [];
    for (let i = 52 * 7 + 6; i >= 0; i--) {
        const d = new Date(endDay);
        d.setDate(endDay.getDate() - i);
        days.push(toDateStr(d));
    }
    return days;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Stat Cards ───────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, accent }) => (
    <div className={`rounded-2xl border bg-white/[0.03] p-4 flex flex-col gap-2 border-white/10`}>
        <div className="flex items-center gap-2">
            <Icon size={16} className={accent} />
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</span>
        </div>
        <p className="text-2xl sm:text-3xl font-black text-white leading-none">{value}</p>
    </div>
);

// ─── Listening Calendar ───────────────────────────────────────────

const ListeningCalendar = ({ dayMap }) => {
    const days = useMemo(() => buildCalendarDays(), []);
    const today = toDateStr(new Date());

    // Compute max for intensity scaling
    const maxCount = Math.max(1, ...Object.values(dayMap));

    // Group into weeks (columns of 7)
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    // Month labels — find first day of each month in the weeks
    const monthLabels = [];
    weeks.forEach((week, wi) => {
        week.forEach((day, di) => {
            if (day.endsWith('-01')) {
                const m = parseInt(day.slice(5, 7), 10) - 1;
                monthLabels.push({ week: wi, label: MONTHS[m] });
            }
        });
    });

    const getCellColor = (day) => {
        if (!dayMap[day]) return 'bg-white/5';
        const ratio = dayMap[day] / maxCount;
        if (ratio < 0.2) return 'bg-terracotta-900/50';
        if (ratio < 0.4) return 'bg-terracotta-700/70';
        if (ratio < 0.7) return 'bg-terracotta-500/80';
        return 'bg-terracotta-400';
    };

    const activeDays = Object.keys(dayMap).length;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white">Listening Calendar</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{activeDays} day{activeDays !== 1 ? 's' : ''} with listening activity</p>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-stone-600">Less</span>
                    {['bg-white/5', 'bg-terracotta-900/50', 'bg-terracotta-700/70', 'bg-terracotta-500/80', 'bg-terracotta-400'].map((c, i) => (
                        <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                    ))}
                    <span className="text-[10px] text-stone-600">More</span>
                </div>
            </div>

            {/* Month labels */}
            <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: `${weeks.length * 14 + weeks.length * 2}px` }}>
                    {/* Month label row */}
                    <div className="flex mb-1" style={{ gap: '2px' }}>
                        {weeks.map((_, wi) => {
                            const ml = monthLabels.find(m => m.week === wi);
                            return (
                                <div key={wi} style={{ width: 14, flexShrink: 0 }}>
                                    {ml && <span className="text-[9px] text-stone-500 leading-none">{ml.label}</span>}
                                </div>
                            );
                        })}
                    </div>

                    {/* Calendar grid — columns are weeks, rows are days */}
                    <div className="flex" style={{ gap: '2px' }}>
                        {weeks.map((week, wi) => (
                            <div key={wi} className="flex flex-col" style={{ gap: '2px' }}>
                                {week.map((day, di) => {
                                    const isToday = day === today;
                                    const count = dayMap[day] || 0;
                                    return (
                                        <div
                                            key={di}
                                            title={count > 0 ? `${day}: ${count} spin${count !== 1 ? 's' : ''}` : day}
                                            className={`rounded-sm transition-all ${getCellColor(day)} ${isToday ? 'ring-1 ring-terracotta-400' : ''}`}
                                            style={{ width: 14, height: 14, flexShrink: 0 }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Top Albums ───────────────────────────────────────────────────

const TopAlbums = ({ albums }) => {
    if (!albums.length) return null;
    const maxCount = albums[0]?.count || 1;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h3 className="text-sm font-bold text-white mb-4">Most Played Records</h3>
            <div className="space-y-3">
                {albums.map((a, i) => (
                    <div key={a.albumId} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-stone-600 w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate leading-tight">{a.albumTitle}</p>
                            <p className="text-xs text-stone-500 truncate">{a.artist}</p>
                            {/* Bar */}
                            <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-terracotta-500 to-brass-500 rounded-full"
                                    style={{ width: `${(a.count / maxCount) * 100}%`, transition: 'width 0.7s ease' }}
                                />
                            </div>
                        </div>
                        <span className="text-xs font-bold text-terracotta-400 flex-shrink-0">{a.count}×</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Genre Breakdown ──────────────────────────────────────────────

const GenreBreakdown = ({ genres }) => {
    if (!genres.length) return null;
    const topGenres = genres.slice(0, 8);
    const maxCount = topGenres[0]?.count || 1;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h3 className="text-sm font-bold text-white mb-4">Genre Breakdown</h3>
            <div className="space-y-2.5">
                {topGenres.map(({ genre, count }) => (
                    <div key={genre} className="flex items-center gap-3">
                        <p className="text-xs text-stone-400 w-24 flex-shrink-0 truncate">{genre}</p>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-brass-500 to-terracotta-500"
                                style={{ width: `${(count / maxCount) * 100}%`, transition: 'width 0.7s ease' }}
                            />
                        </div>
                        <span className="text-xs font-bold text-stone-500 w-6 text-right">{count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Collection Progress ──────────────────────────────────────────

const CollectionProgress = ({ spunCount, totalCount }) => {
    const pct = totalCount > 0 ? Math.min(100, Math.round((spunCount / totalCount) * 100)) : 0;
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex justify-between items-end mb-3">
                <div>
                    <h3 className="text-sm font-bold text-white">Collection Progress</h3>
                    <p className="text-xs text-stone-500 mt-0.5">Records you've actually listened to</p>
                </div>
                <p className="text-2xl font-black text-terracotta-400">{pct}%</p>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden mb-2">
                <div
                    className="h-full bg-gradient-to-r from-terracotta-500 to-brass-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-xs text-stone-500">
                <span className="text-white font-bold">{spunCount}</span> of{' '}
                <span className="text-white font-bold">{totalCount}</span> records spun
            </p>
        </div>
    );
};

// ─── Collection Value ──────────────────────────────────────────────
// Estimates total collection value from Discogs marketplace price data. Each
// release's price is cached individually (src/lib/priceCache.js, 4h TTL —
// safely under Discogs' 6h Content-freshness rule). This card's own summary
// re-computation cadence is separate: it's a long-lived rollup over whatever
// mix of fresh/stale per-release entries currently exist, not itself subject
// to that 6h rule.

const VALUE_SUMMARY_KEY = 'spinvinyl_collection_value_summary';
const VALUE_FETCH_DELAY_MS = 1100; // ~55 req/min — safely under Discogs' ~60 req/min budget

const readValueSummary = () => {
    try {
        const raw = localStorage.getItem(VALUE_SUMMARY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

const writeValueSummary = (summary) => {
    try { localStorage.setItem(VALUE_SUMMARY_KEY, JSON.stringify(summary)); } catch { }
};

/** Recompute the summary from whatever per-release price caches currently exist. */
const computeValueSummary = (releases) => {
    let total = 0, priced = 0, currency = 'USD';
    for (const r of releases) {
        const cached = readPriceCache(r.id);
        if (!cached) continue;
        const ownedCondition = r.notes?.find(f => f.field_id === 1)?.value;
        const priceObj = (ownedCondition && cached.suggestions?.[ownedCondition]) || cached.stats?.lowest_price;
        const value = Number(priceObj?.value);
        if (value > 0) {
            total += value;
            currency = priceObj.currency || currency;
            priced += 1;
        }
    }
    return { totalValue: total, pricedCount: priced, totalCount: releases.length, currency, updatedAt: new Date().toISOString() };
};

const CollectionValueCard = ({ releases }) => {
    const [summary, setSummary] = useState(() => readValueSummary());
    const [running, setRunning] = useState(false);
    const cancelledRef = useRef(false);
    const runningRef = useRef(false);

    const runBatch = async () => {
        if (runningRef.current || !releases?.length) return;
        runningRef.current = true;
        cancelledRef.current = false;
        setRunning(true);
        for (const r of releases) {
            if (cancelledRef.current) break;
            if (!readPriceCache(r.id)) {
                await fetchReleasePrice(r.id);
                if (cancelledRef.current) break;
                const next = computeValueSummary(releases);
                writeValueSummary(next);
                setSummary(next);
                await new Promise(res => setTimeout(res, VALUE_FETCH_DELAY_MS));
            }
        }
        runningRef.current = false;
        setRunning(false);
    };

    // Cancel any in-flight manual run if the card unmounts mid-refresh.
    useEffect(() => {
        return () => { cancelledRef.current = true; };
    }, []);

    if (!releases?.length) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <DollarSign size={14} className="text-brass-400" /> Collection Value
                    </h3>
                    {summary && (
                        <p className="text-xs text-stone-500 mt-0.5">
                            as of {new Date(summary.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {summary.pricedCount} of {summary.totalCount} priced
                        </p>
                    )}
                </div>
                <button
                    onClick={runBatch}
                    disabled={running}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Refresh collection value"
                >
                    <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
                </button>
            </div>
            {summary && summary.pricedCount > 0 ? (
                <p className="text-2xl sm:text-3xl font-black text-terracotta-400">
                    ~{summary.currency} {summary.totalValue.toFixed(2)}
                </p>
            ) : (
                <p className="text-sm text-stone-500">
                    {running ? 'Estimating value from Discogs marketplace data…' : "Tap refresh to estimate your collection's value."}
                </p>
            )}
        </div>
    );
};

// ─── Completed Collections ────────────────────────────────────────

const getCompletedArtists = () => {
    try {
        const raw = localStorage.getItem('spinvinyl_gaps_cache_v4');
        if (!raw) return [];
        const { data } = JSON.parse(raw);
        return (data || []).filter(g => g.pct === 100).map(g => g.artist);
    } catch { return []; }
};

const CompletedCollections = () => {
    const artists = useMemo(() => getCompletedArtists(), []);
    if (artists.length === 0) return null;

    return (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-white">Completed Artist Collections</h3>
                <span className="ml-auto text-xs font-bold text-green-400">{artists.length}</span>
            </div>
            <div className="space-y-2">
                {artists.map(artist => (
                    <div key={artist.id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                            <CheckCircle size={12} className="text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
                            <p className="text-xs text-stone-500">{artist.count} record{artist.count !== 1 ? 's' : ''} owned</p>
                        </div>
                        <span className="text-xs font-bold text-green-400">100%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Stats Page ──────────────────────────────────────────────

const StatsPage = ({ collectionCount, releases }) => {
    const todayCount = useMemo(() => getPeriodSpinCount('today'), []);
    const weekCount = useMemo(() => getPeriodSpinCount('week'), []);
    const monthCount = useMemo(() => getPeriodSpinCount('month'), []);
    const allCount = useMemo(() => getPeriodSpinCount('all'), []);
    const topAlbums = useMemo(() => getTopAlbums(5), []);
    const genres = useMemo(() => getGenreBreakdown(), []);
    const dayMap = useMemo(() => getDayMap(), []);
    const stats = useMemo(() => getStoredStats(), []);
    const spunCount = useMemo(() => getUniqueAlbumsSpun(), []);
    const streak = useMemo(() => getCurrentStreak(), []);

    const hasAnyData = stats.totalSessions > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-black text-white pb-32">
            {/* Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(201,162,75,0.12),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pt-safe-header pb-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brass-500 to-terracotta-500 flex items-center justify-center shadow-xl">
                            <BarChart2 size={24} className="text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-parchment">
                            Your Stats
                        </h1>
                    </div>
                    <p className="text-stone-500 text-sm">
                        {hasAnyData
                            ? `${stats.totalSessions} total spin${stats.totalSessions !== 1 ? 's' : ''} logged`
                            : 'Start spinning records to see your stats!'}
                    </p>
                    {streak > 0 && (
                        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
                            🔥 {streak}-day listening streak!
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 space-y-5">
                {/* Time Cards — 2×2 grid */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Today" value={`${todayCount}×`} icon={Clock} accent="text-terracotta-400" />
                    <StatCard label="This Week" value={`${weekCount}×`} icon={TrendingUp} accent="text-brass-400" />
                    <StatCard label="This Month" value={`${monthCount}×`} icon={Music2} accent="text-blue-400" />
                    <StatCard label="All Time" value={`${allCount}×`} icon={Disc3} accent="text-amber-400" />
                </div>

                {/* Listening Calendar */}
                <ListeningCalendar dayMap={dayMap} />

                {/* Top Albums */}
                {topAlbums.length > 0 && <TopAlbums albums={topAlbums} />}

                {/* Genre Breakdown */}
                {genres.length > 0 && <GenreBreakdown genres={genres} />}

                {/* Collection Progress */}
                <CollectionProgress spunCount={spunCount} totalCount={collectionCount || 0} />

                {/* Collection Value */}
                <CollectionValueCard releases={releases} />

                {/* Completed Artist Collections */}
                <CompletedCollections />

                {/* Empty state */}
                {!hasAnyData && (
                    <div className="text-center py-16 text-stone-600">
                        <Disc3 size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Spin some records to start building your stats!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsPage;
