import React, { useEffect, useState } from 'react';
import { markBadgesSeen } from '../lib/badgeEngine.js';
import { RARITY_COLORS } from '../lib/badgeDefinitions.js';

/**
 * Animated badge unlock toast.
 * Props:
 *   badge     — badge object or null
 *   onDismiss — called when the toast finishes/dismissed
 */
const BadgeToast = ({ badge, onDismiss }) => {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (!badge) return;
        // Trigger entrance animation
        requestAnimationFrame(() => setVisible(true));

        const exit = setTimeout(() => {
            setExiting(true);
            setTimeout(() => {
                setVisible(false);
                setExiting(false);
                markBadgesSeen([badge.id]);
                onDismiss?.();
            }, 400);
        }, 4000);

        return () => clearTimeout(exit);
    }, [badge?.id]);

    if (!badge) return null;

    const rarity = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common;

    return (
        <div
            className={`fixed bottom-24 right-4 z-[200] transition-all duration-400 ease-out ${visible && !exiting
                ? 'translate-y-0 opacity-100 scale-100'
                : 'translate-y-8 opacity-0 scale-95'
                }`}
            style={{ pointerEvents: 'auto' }}
        >
            <div
                className={`relative rounded-2xl border ${rarity.border} bg-gray-950/95 backdrop-blur-xl overflow-hidden shadow-2xl ${rarity.glow ? `shadow-lg ${rarity.glow}` : ''} max-w-[280px] cursor-pointer`}
                onClick={() => {
                    setExiting(true);
                    setTimeout(() => {
                        setVisible(false);
                        setExiting(false);
                        markBadgesSeen([badge.id]);
                        onDismiss?.();
                    }, 300);
                }}
            >
                {/* Shimmer bar on top */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-pink-500 to-violet-500 animate-pulse`} />

                {/* Progress bar countdown */}
                <div className="absolute bottom-0 left-0 h-0.5 bg-white/10 right-0">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 to-pink-500"
                        style={{ animation: 'shrink-width 4s linear forwards' }}
                    />
                </div>

                <div className="flex gap-3 p-4 pr-5 items-center">
                    {/* Emoji */}
                    <div className={`w-12 h-12 rounded-xl ${rarity.bg} border ${rarity.border} flex items-center justify-center text-2xl flex-shrink-0`}>
                        {badge.emoji}
                    </div>

                    {/* Content */}
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-0.5">
                            🎉 Badge Unlocked!
                        </p>
                        <p className={`text-sm font-bold ${rarity.text} leading-tight`}>
                            {badge.name}
                        </p>
                        <p className="text-xs text-gray-400 leading-snug line-clamp-2 mt-0.5">
                            {badge.description}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BadgeToast;
