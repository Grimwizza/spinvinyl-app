import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────
const WINDOW_SIZE  = 7;    // number of cards rendered in DOM at once
const HALF_WINDOW  = 3;    // slots either side of center
const CARD_W       = 200;  // px — card width
const CARD_H       = 200;  // px — album art height
const SWIPE_THRESH = 60;   // px — minimum swipe/drag to advance

// ─── Helpers ─────────────────────────────────────────────────────

const positiveMod = (n, m) => ((n % m) + m) % m;

/** Indices of the 7 cards in the current window, relative to centerIndex. */
const windowIndices = (center, total) =>
    Array.from({ length: WINDOW_SIZE }, (_, i) =>
        positiveMod(center - HALF_WINDOW + i, total)
    );

/** CSS transform + opacity for a card at the given slot offset (-3..+3). */
const cardStyle = (offset, dragDelta, isDragging) => {
    const absOffset  = Math.abs(offset);
    const translateX = offset * 180 + (isDragging ? dragDelta * (offset === 0 ? 1 : 0.25) : 0);
    const translateZ = -(absOffset * 80);
    const rotateY    = -(offset * 12);
    const scale      = 1 - absOffset * 0.1;
    const opacity    = 1 - absOffset * 0.2;

    return {
        transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
        opacity,
        zIndex: 10 - absOffset,
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.35s',
        position: 'absolute',
        left: '50%',
        top:  '50%',
        marginLeft: `-${CARD_W / 2}px`,
        marginTop:  `-${(CARD_H + 80) / 2}px`, // 80px = footer height
        width: `${CARD_W}px`,
        cursor: offset === 0 ? 'pointer' : 'pointer',
    };
};

// ─── CrateCard ───────────────────────────────────────────────────
const CrateCard = ({ release, isCenter }) => {
    const info   = release?.basic_information || {};
    const src    = info.cover_image || info.thumb;
    const title  = info.title  || 'Unknown';
    const artist = (info.artists || []).map(a => a.name?.replace(/\s*\(\d+\)$/, '')).join(', ') || 'Unknown';

    return (
        <div
            className={`rounded-xl overflow-hidden shadow-2xl border transition-colors ${
                isCenter
                    ? 'border-violet-500/60 shadow-violet-500/20'
                    : 'border-white/10'
            }`}
            style={{ width: CARD_W, userSelect: 'none' }}
        >
            {/* Album art */}
            <div style={{ width: CARD_W, height: CARD_H }} className="relative flex-shrink-0 bg-gray-900">
                {src ? (
                    <img src={src} alt={title} className="w-full h-full object-cover" loading="lazy" draggable={false} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Music2 size={36} className="text-gray-600" />
                    </div>
                )}
                {isCenter && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-center pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-300 opacity-80">
                            Tap to View
                        </span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-gray-900 px-3 py-2" style={{ height: 72 }}>
                <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{title}</p>
                <p className="text-gray-400 text-[10px] mt-0.5 truncate">{artist}</p>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────
export default function CrateView({ releases, onAlbumClick }) {
    const [centerIndex, setCenterIndex] = useState(0);
    const [isDragging,  setIsDragging]  = useState(false);
    const [dragStartX,  setDragStartX]  = useState(0);
    const [dragDelta,   setDragDelta]   = useState(0);
    const containerRef = useRef(null);

    const total = releases.length;

    // Clamp centerIndex when filtered list shrinks
    useEffect(() => {
        if (total === 0) return;
        setCenterIndex(i => Math.min(i, total - 1));
    }, [total]);

    const advance = useCallback((dir) => {
        if (total === 0) return;
        setCenterIndex(prev => positiveMod(prev + dir, total));
    }, [total]);

    // Keyboard navigation
    useEffect(() => {
        if (total === 0) return;
        const handler = (e) => {
            if (e.key === 'ArrowRight') advance(1);
            if (e.key === 'ArrowLeft')  advance(-1);
            if (e.key === 'Enter')      onAlbumClick(releases[centerIndex]);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [advance, centerIndex, releases, onAlbumClick, total]);

    // ── Touch handlers ────────────────────────────────────────────
    const handleTouchStart = (e) => {
        setDragStartX(e.touches[0].clientX);
        setIsDragging(true);
        setDragDelta(0);
    };
    const handleTouchMove = (e) => {
        if (!isDragging) return;
        setDragDelta(e.touches[0].clientX - dragStartX);
    };
    const handleTouchEnd = () => {
        if (dragDelta < -SWIPE_THRESH) advance(1);
        else if (dragDelta > SWIPE_THRESH) advance(-1);
        setIsDragging(false);
        setDragDelta(0);
    };

    // ── Mouse drag handlers (desktop) ─────────────────────────────
    const handleMouseDown = (e) => {
        setDragStartX(e.clientX);
        setIsDragging(true);
        setDragDelta(0);
    };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setDragDelta(e.clientX - dragStartX);
    };
    const handleMouseUp = () => {
        if (dragDelta < -SWIPE_THRESH) advance(1);
        else if (dragDelta > SWIPE_THRESH) advance(-1);
        setIsDragging(false);
        setDragDelta(0);
    };
    const handleMouseLeave = () => {
        if (isDragging) {
            setIsDragging(false);
            setDragDelta(0);
        }
    };

    if (total === 0) return null;

    const indices = windowIndices(centerIndex, total);

    return (
        <div className="select-none">
            {/* 3D scene */}
            <div
                ref={containerRef}
                style={{
                    perspective: '1200px',
                    perspectiveOrigin: '50% 40%',
                    touchAction: 'pan-y',
                    height: CARD_H + 80 + 32, // card + footer + breathing room
                    position: 'relative',
                    overflow: 'hidden',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <div style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}>
                    {indices.map((releaseIdx, slotIdx) => {
                        const offset  = slotIdx - HALF_WINDOW;
                        const release = releases[releaseIdx];
                        const isCenter = offset === 0;
                        return (
                            <div
                                key={`${release.instance_id ?? release.id}-${slotIdx}`}
                                style={cardStyle(offset, dragDelta, isDragging)}
                                onClick={() => {
                                    if (Math.abs(dragDelta) > 10) return; // suppress click after drag
                                    if (isCenter) onAlbumClick(release);
                                    else setCenterIndex(releaseIdx);
                                }}
                            >
                                <CrateCard release={release} isCenter={isCenter} />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
                <button
                    onClick={() => advance(-1)}
                    className="p-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:opacity-70"
                    aria-label="Previous"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-500 tabular-nums min-w-[80px] text-center">
                    {centerIndex + 1} / {total}
                </span>
                <button
                    onClick={() => advance(1)}
                    className="p-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:opacity-70"
                    aria-label="Next"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
