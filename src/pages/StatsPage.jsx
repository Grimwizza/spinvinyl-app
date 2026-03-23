import React, { useMemo } from 'react';
import { BarChart2, CheckCircle, Clock, Disc3, Music2, TrendingUp } from 'lucide-react';
import {
    getPeriodTotalSeconds, getTopAlbums, getGenreBreakdown,
    getDayMap, getUniqueAlbumsSpun, getStoredStats, formatDuration, getCurrentStreak,
} from '../lib/statsEngine.js';

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
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        </div>
        <p className="text-2xl sm:text-3xl font-black text-white leading-none">{value}</p>
    </div>
);

// ─── Listening Calendar ───────────────────────────────────────────

const ListeningCalendar = ({ dayMap }) => {
    const days = useMemo(() => buildCalendarDays(), []);
    const today = toDateStr(new Date());

    // Compute max for intensity scaling
    const maxSeconds = Math.max(1, ...Object.values(dayMap));

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
        const ratio = dayMap[day] / maxSeconds;
        if (ratio < 0.2) return 'bg-violet-900/50';
        if (ratio < 0.4) return 'bg-violet-700/70';
        if (ratio < 0.7) return 'bg-violet-500/80';
        return 'bg-violet-400';
    };

    const activeDays = Object.keys(dayMap).length;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white">Listening Calendar</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{activeDays} day{activeDays !== 1 ? 's' : ''} with listening activity</p>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-600">Less</span>
                    {['bg-white/5', 'bg-violet-900/50', 'bg-violet-700/70', 'bg-violet-500/80', 'bg-violet-400'].map((c, i) => (
                        <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                    ))}
                    <span className="text-[10px] text-gray-600">More</span>
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
                                    {ml && <span className="text-[9px] text-gray-500 leading-none">{ml.label}</span>}
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
                                    const secs = dayMap[day] || 0;
                                    return (
                                        <div
                                            key={di}
                                            title={secs > 0 ? `${day}: ${formatDuration(secs)}` : day}
                                            className={`rounded-sm transition-all ${getCellColor(day)} ${isToday ? 'ring-1 ring-violet-400' : ''}`}
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
                        <span className="text-xs font-bold text-gray-600 w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate leading-tight">{a.albumTitle}</p>
                            <p className="text-xs text-gray-500 truncate">{a.artist}</p>
                            {/* Bar */}
                            <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                                    style={{ width: `${(a.count / maxCount) * 100}%`, transition: 'width 0.7s ease' }}
                                />
                            </div>
                        </div>
                        <span className="text-xs font-bold text-violet-400 flex-shrink-0">{a.count}×</span>
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
                        <p className="text-xs text-gray-400 w-24 flex-shrink-0 truncate">{genre}</p>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500"
                                style={{ width: `${(count / maxCount) * 100}%`, transition: 'width 0.7s ease' }}
                            />
                        </div>
                        <span className="text-xs font-bold text-gray-500 w-6 text-right">{count}</span>
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
                    <p className="text-xs text-gray-500 mt-0.5">Records you've actually listened to</p>
                </div>
                <p className="text-2xl font-black text-violet-400">{pct}%</p>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden mb-2">
                <div
                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-xs text-gray-500">
                <span className="text-white font-bold">{spunCount}</span> of{' '}
                <span className="text-white font-bold">{totalCount}</span> records spun
            </p>
        </div>
    );
};

// ─── Completed Collections ────────────────────────────────────────

const getCompletedArtists = () => {
    try {
        const raw = localStorage.getItem('spinvinyl_gaps_cache');
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
                            <p className="text-xs text-gray-500">{artist.count} record{artist.count !== 1 ? 's' : ''} owned</p>
                        </div>
                        <span className="text-xs font-bold text-green-400">100%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Stats Page ──────────────────────────────────────────────

const StatsPage = ({ collectionCount }) => {
    const todaySec = useMemo(() => getPeriodTotalSeconds('today'), []);
    const weekSec = useMemo(() => getPeriodTotalSeconds('week'), []);
    const monthSec = useMemo(() => getPeriodTotalSeconds('month'), []);
    const allSec = useMemo(() => getPeriodTotalSeconds('all'), []);
    const topAlbums = useMemo(() => getTopAlbums(5), []);
    const genres = useMemo(() => getGenreBreakdown(), []);
    const dayMap = useMemo(() => getDayMap(), []);
    const stats = useMemo(() => getStoredStats(), []);
    const spunCount = useMemo(() => getUniqueAlbumsSpun(), []);
    const streak = useMemo(() => getCurrentStreak(), []);

    const hasAnyData = stats.totalSessions > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white pb-32">
            {/* Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.12),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center shadow-xl">
                            <BarChart2 size={24} className="text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                            Your Stats
                        </h1>
                    </div>
                    <p className="text-gray-500 text-sm">
                        {hasAnyData
                            ? `${stats.totalSessions} total session${stats.totalSessions !== 1 ? 's' : ''} · ${formatDuration(stats.totalPlaySeconds)} of music`
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
                    <StatCard label="Today" value={formatDuration(todaySec)} icon={Clock} accent="text-violet-400" />
                    <StatCard label="This Week" value={formatDuration(weekSec)} icon={TrendingUp} accent="text-pink-400" />
                    <StatCard label="This Month" value={formatDuration(monthSec)} icon={Music2} accent="text-blue-400" />
                    <StatCard label="All Time" value={formatDuration(allSec)} icon={Disc3} accent="text-amber-400" />
                </div>

                {/* Listening Calendar */}
                <ListeningCalendar dayMap={dayMap} />

                {/* Top Albums */}
                {topAlbums.length > 0 && <TopAlbums albums={topAlbums} />}

                {/* Genre Breakdown */}
                {genres.length > 0 && <GenreBreakdown genres={genres} />}

                {/* Collection Progress */}
                <CollectionProgress spunCount={spunCount} totalCount={collectionCount || 0} />

                {/* Completed Artist Collections */}
                <CompletedCollections />

                {/* Empty state */}
                {!hasAnyData && (
                    <div className="text-center py-16 text-gray-600">
                        <Disc3 size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Spin some records to start building your stats!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsPage;
