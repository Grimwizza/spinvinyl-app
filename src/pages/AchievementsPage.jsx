import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { BADGES, BADGE_CATEGORIES, RARITY_COLORS } from '../lib/badgeDefinitions.js';
import { getEarnedBadges } from '../lib/badgeEngine.js';

const RARITY_LABELS = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    legendary: 'Legendary',
};

const BadgeCard = ({ badge, earned }) => {
    const r = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common;

    return (
        <div
            className={`relative rounded-2xl border p-4 transition-all duration-300 flex flex-col items-center text-center gap-2 ${earned
                ? `${r.bg} ${r.border} shadow-lg ${r.glow}`
                : 'bg-white/[0.02] border-white/5 opacity-50'
                }`}
        >
            {/* Rarity pip */}
            <div className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${earned ? `${r.bg} ${r.text}` : 'bg-white/5 text-gray-600'}`}>
                {RARITY_LABELS[badge.rarity]}
            </div>

            {/* Emoji */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border ${earned ? `${r.bg} ${r.border}` : 'bg-gray-800 border-white/5'}`}
                style={earned ? {} : { filter: 'grayscale(1)' }}>
                {earned ? badge.emoji : '🔒'}
            </div>

            {/* Name */}
            <p className={`text-sm font-bold leading-tight ${earned ? 'text-white' : 'text-gray-600'}`}>
                {badge.name}
            </p>

            {/* Description */}
            <p className={`text-xs leading-snug ${earned ? 'text-gray-400' : 'text-gray-700'}`}>
                {earned ? badge.description : '???'}
            </p>
        </div>
    );
};

const AchievementsPage = ({ collectionCount }) => {
    const earnedBadges = useMemo(() => getEarnedBadges(), []);
    const earnedIds = new Set(earnedBadges.map(b => b.id));
    const total = BADGES.length;
    const earnedCount = earnedIds.size;
    const pct = Math.round((earnedCount / total) * 100);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white pb-32">
            {/* Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.15),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.1),transparent_50%)]" />

                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-xl">
                            <Trophy size={24} className="text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                            Achievements
                        </h1>
                    </div>

                    {/* Progress summary */}
                    <p className="text-gray-400 text-sm mb-4">
                        <span className="text-white font-bold">{earnedCount}</span> of <span className="text-white font-bold">{total}</span> badges earned
                    </p>

                    {/* Progress bar */}
                    <div className="max-w-xs mx-auto h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{pct}% complete</p>
                </div>
            </div>

            {/* Badge sections by category */}
            <div className="max-w-3xl mx-auto px-4 space-y-10">
                {BADGE_CATEGORIES.map(category => {
                    const categoryBadges = BADGES.filter(b => b.category === category);
                    const categoryEarned = categoryBadges.filter(b => earnedIds.has(b.id)).length;
                    return (
                        <div key={category}>
                            <div className="flex items-center gap-3 mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">{category}</h2>
                                <div className="flex-1 h-px bg-white/5" />
                                <span className="text-xs text-gray-500 font-medium">{categoryEarned}/{categoryBadges.length}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {categoryBadges.map(badge => (
                                    <BadgeCard key={badge.id} badge={badge} earned={earnedIds.has(badge.id)} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AchievementsPage;
