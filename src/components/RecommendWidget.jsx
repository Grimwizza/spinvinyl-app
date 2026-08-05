import { useState, useMemo, useCallback } from 'react';
import { Shuffle, Music2, Clock, ChevronLeft, X } from 'lucide-react';
import {
    getForgottenGems,
    getMoodPicks,
    getRandomPick,
    getTimeSlot,
    TIME_SLOT_LABELS,
} from '../lib/recommendEngine.js';

// ─── Inline album art (no external API fallback needed — collection items always have cover_image) ──
const CardArt = ({ release }) => {
    const info = release?.basic_information || {};
    const src  = info.cover_image || info.thumb;
    const title = info.title || '';
    if (src) {
        return <img src={src} alt={title} className="w-full h-full object-cover" loading="lazy" />;
    }
    return (
        <div className="w-full h-full flex items-center justify-center bg-stone-800">
            <Music2 size={28} className="text-stone-600" />
        </div>
    );
};

// ─── Single recommendation card ───────────────────────────────────
const RecommendCard = ({ release, playCount, onSpin }) => {
    const info   = release?.basic_information || {};
    const title  = info.title || 'Unknown';
    const artist = (info.artists || []).map(a => a.name?.replace(/\s*\(\d+\)$/, '')).join(', ') || 'Unknown';

    return (
        <div className="flex-shrink-0 w-36 bg-stone-900 border border-white/10 rounded-xl overflow-hidden snap-start flex flex-col">
            <div className="w-36 h-36 flex-shrink-0 relative">
                <CardArt release={release} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{title}</p>
                <p className="text-stone-400 text-[10px] leading-tight truncate">{artist}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${playCount === 0 ? 'text-terracotta-400' : 'text-stone-500'}`}>
                    {playCount === 0 ? 'Never played' : `Played ${playCount}×`}
                </p>
                <button
                    onClick={() => onSpin(release)}
                    className="mt-auto w-full py-1.5 rounded-lg bg-terracotta-500/20 border border-terracotta-500/30 text-terracotta-300 text-[11px] font-bold hover:bg-terracotta-500/30 transition-colors active:opacity-70"
                >
                    Spin This
                </button>
            </div>
        </div>
    );
};

const categoryLabel = (cat, slot) => {
    if (cat === 'gems') return 'Forgotten Gems';
    if (cat === 'mood') return `${TIME_SLOT_LABELS[slot]} Mood`;
    if (cat === 'random') return 'Surprise Me';
    return 'Spin Something';
};

// ─── Main Widget: trigger button + 2-step bottom sheet ────────────
export default function RecommendWidget({ releases, albumPlayCounts, onSpinThis }) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetView, setSheetView] = useState('picker'); // 'picker' | 'results'
    const [activeCategory, setActiveCategory] = useState(null); // 'gems' | 'mood' | 'random'
    const [randomPick, setRandomPick] = useState(() => getRandomPick(releases));

    const slot = useMemo(() => getTimeSlot(), []);

    const gems = useMemo(() =>
        getForgottenGems(releases, albumPlayCounts, 6),
        [releases, albumPlayCounts]
    );

    const mood = useMemo(() =>
        getMoodPicks(releases, albumPlayCounts, slot, 6),
        [releases, albumPlayCounts, slot]
    );

    const openSheet = useCallback(() => {
        setSheetView('picker');
        setActiveCategory(null);
        setSheetOpen(true);
    }, []);

    const selectCategory = useCallback((cat) => {
        setActiveCategory(cat);
        if (cat === 'random') setRandomPick(getRandomPick(releases));
        setSheetView('results');
    }, [releases]);

    const handleShuffle = useCallback(() => {
        setRandomPick(getRandomPick(releases));
    }, [releases]);

    if (!releases.length) return null;

    const resultsList = activeCategory === 'gems' ? gems : activeCategory === 'mood' ? mood : [];

    return (
        <>
            <button
                onClick={openSheet}
                className="w-full flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-stone-200 hover:bg-white/10 hover:border-terracotta-500/30 transition-colors active:opacity-70 group"
            >
                <Shuffle size={18} className="text-terracotta-400 group-hover:rotate-12 transition-transform" />
                <span className="text-sm font-bold">Spin Something</span>
            </button>

            {sheetOpen && (
                <div className="fixed inset-0 z-[200] flex items-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
                    <div className="relative w-full bg-stone-900 border-t border-white/10 rounded-t-2xl p-6 flex flex-col gap-4 max-h-[85vh] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto flex-shrink-0" />

                        <div className="flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-1">
                                {sheetView === 'results' && (
                                    <button
                                        onClick={() => setSheetView('picker')}
                                        className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                <h2 className="text-lg font-black text-white">
                                    {sheetView === 'picker' ? 'Spin Something' : categoryLabel(activeCategory, slot)}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSheetOpen(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-y-auto">
                            {sheetView === 'picker' ? (
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => selectCategory('gems')}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-terracotta-500/30 transition-colors text-left active:opacity-70"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-terracotta-500/20 flex items-center justify-center flex-shrink-0">
                                            <Music2 size={18} className="text-terracotta-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">Forgotten Gems</p>
                                            <p className="text-xs text-stone-400">Records you rarely spin</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => selectCategory('mood')}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-terracotta-500/30 transition-colors text-left active:opacity-70"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-brass-500/20 flex items-center justify-center flex-shrink-0">
                                            <Clock size={18} className="text-brass-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{TIME_SLOT_LABELS[slot]} Mood</p>
                                            <p className="text-xs text-stone-400">Matched to the time of day</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => selectCategory('random')}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-terracotta-500/30 transition-colors text-left active:opacity-70"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                            <Shuffle size={18} className="text-stone-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">Surprise Me</p>
                                            <p className="text-xs text-stone-400">One random pick from your shelf</p>
                                        </div>
                                    </button>
                                </div>
                            ) : activeCategory === 'random' ? (
                                <div className="flex flex-col items-center gap-4 py-2">
                                    {randomPick && (
                                        <RecommendCard
                                            release={randomPick}
                                            playCount={albumPlayCounts[String(randomPick.id)] || 0}
                                            onSpin={onSpinThis}
                                        />
                                    )}
                                    <button
                                        onClick={handleShuffle}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-colors active:opacity-70"
                                        title="Pick another random record"
                                    >
                                        <Shuffle size={16} />
                                        <span className="text-sm font-bold">Shuffle again</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-3 justify-center">
                                    {resultsList.map(release => (
                                        <RecommendCard
                                            key={release.instance_id || release.id}
                                            release={release}
                                            playCount={albumPlayCounts[String(release.id)] || 0}
                                            onSpin={onSpinThis}
                                        />
                                    ))}
                                    {resultsList.length === 0 && (
                                        <p className="text-stone-500 text-sm py-4">No albums found for this mood yet.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
