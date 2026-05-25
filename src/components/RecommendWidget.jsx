import React, { useState, useMemo, useCallback } from 'react';
import { Shuffle, Music2 } from 'lucide-react';
import {
    getForgottenGems,
    getMoodPicks,
    getRandomPick,
    getTimeSlot,
    TIME_SLOT_LABELS,
} from '../lib/recommendEngine.js';

const TABS = ['gems', 'mood', 'random'];
const TAB_LABELS = { gems: 'Forgotten Gems', random: 'Surprise Me' };
const PREF_KEY = 'sv_rec_tab';

// ─── Inline album art (no external API fallback needed — collection items always have cover_image) ──
const CardArt = ({ release }) => {
    const info = release?.basic_information || {};
    const src  = info.cover_image || info.thumb;
    const title = info.title || '';
    if (src) {
        return <img src={src} alt={title} className="w-full h-full object-cover" loading="lazy" />;
    }
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <Music2 size={28} className="text-gray-600" />
        </div>
    );
};

// ─── Single recommendation card ───────────────────────────────────
const RecommendCard = ({ release, playCount, onSpin }) => {
    const info   = release?.basic_information || {};
    const title  = info.title || 'Unknown';
    const artist = (info.artists || []).map(a => a.name?.replace(/\s*\(\d+\)$/, '')).join(', ') || 'Unknown';

    return (
        <div className="flex-shrink-0 w-36 bg-gray-900 border border-white/10 rounded-xl overflow-hidden snap-start flex flex-col">
            <div className="w-36 h-36 flex-shrink-0 relative">
                <CardArt release={release} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{title}</p>
                <p className="text-gray-400 text-[10px] leading-tight truncate">{artist}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${playCount === 0 ? 'text-violet-400' : 'text-gray-500'}`}>
                    {playCount === 0 ? 'Never played' : `Played ${playCount}×`}
                </p>
                <button
                    onClick={() => onSpin(release)}
                    className="mt-auto w-full py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[11px] font-bold hover:bg-violet-500/30 transition-colors active:opacity-70"
                >
                    Spin This
                </button>
            </div>
        </div>
    );
};

// ─── Main Widget ─────────────────────────────────────────────────
export default function RecommendWidget({ releases, albumPlayCounts, nowSpinningId, onSpinThis }) {
    const [tab, setTab] = useState(() => {
        const saved = localStorage.getItem(PREF_KEY);
        return TABS.includes(saved) ? saved : 'gems';
    });
    const [randomPick, setRandomPick] = useState(() =>
        getRandomPick(releases, nowSpinningId)
    );

    const slot = useMemo(() => getTimeSlot(), []);

    const gems = useMemo(() =>
        getForgottenGems(releases, albumPlayCounts, 6),
        [releases, albumPlayCounts]
    );

    const mood = useMemo(() =>
        getMoodPicks(releases, albumPlayCounts, slot, 6),
        [releases, albumPlayCounts, slot]
    );

    const handleTabChange = useCallback((t) => {
        setTab(t);
        localStorage.setItem(PREF_KEY, t);
    }, []);

    const handleShuffle = useCallback(() => {
        setRandomPick(getRandomPick(releases, nowSpinningId));
    }, [releases, nowSpinningId]);

    if (!releases.length) return null;

    const visibleAlbums = tab === 'gems' ? gems : tab === 'mood' ? mood : [];

    return (
        <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Spin Something</h2>
            </div>

            {/* Tab row */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
                <button
                    onClick={() => handleTabChange('gems')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${tab === 'gems' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                    Forgotten Gems
                </button>
                <button
                    onClick={() => handleTabChange('mood')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${tab === 'mood' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                    {TIME_SLOT_LABELS[slot]} Mood
                </button>
                <button
                    onClick={() => handleTabChange('random')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${tab === 'random' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                    Surprise Me
                </button>
            </div>

            {/* List or random card */}
            {tab !== 'random' ? (
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 no-scrollbar">
                    {visibleAlbums.map(release => (
                        <RecommendCard
                            key={release.instance_id || release.id}
                            release={release}
                            playCount={albumPlayCounts[String(release.id)] || 0}
                            onSpin={onSpinThis}
                        />
                    ))}
                    {visibleAlbums.length === 0 && (
                        <p className="text-gray-500 text-sm py-4">No albums found for this mood yet.</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    {randomPick && (
                        <RecommendCard
                            release={randomPick}
                            playCount={albumPlayCounts[String(randomPick.id)] || 0}
                            onSpin={onSpinThis}
                        />
                    )}
                    <button
                        onClick={handleShuffle}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:opacity-70"
                        title="Pick another random record"
                    >
                        <Shuffle size={22} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Shuffle</span>
                    </button>
                </div>
            )}
        </section>
    );
}
