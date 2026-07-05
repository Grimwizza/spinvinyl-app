import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ─── Constants ─────────────────────────────────────────────────
const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ALPHA_SORT_FIELDS = new Set(['artist', 'title', 'label']);

/** Extract the grouping letter from a release based on the active sort field. */
const getLetterForRelease = (release, sortField) => {
    const info = release?.basic_information || {};
    let value = '';
    switch (sortField) {
        case 'artist':
            value = (info.artists || []).map(a => (a.name || '').replace(/\s*\(\d+\)$/, '')).join(', ');
            break;
        case 'title':
            value = (info.title || '').replace(/\s*\(\d+\)$/, '');
            break;
        case 'label':
            value = info.labels?.[0]?.name || '';
            break;
        default:
            return '#';
    }
    const first = value.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(first) ? first : '#';
};

// ─── SectionDivider ────────────────────────────────────────────
export const SectionDivider = ({ letter, count }) => (
    <div
        id={`section-${letter}`}
        className="section-divider sticky z-20 flex items-center gap-3 px-1 py-2 sm:py-2.5 -mx-1"
    >
        <span className="text-lg font-black text-violet-400 tracking-tight w-8 text-center flex-shrink-0">
            {letter}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-violet-500/30 via-white/5 to-transparent" />
        <span className="text-[10px] text-gray-500 font-medium tabular-nums pr-1">
            {count}
        </span>
    </div>
);

// ─── AlphaRail (sidebar) ───────────────────────────────────────
export default function AlphaNav({ items, sortField, sortOrder, onJumpToLetter, onJumpToCrateIndex }) {
    const isAlpha = ALPHA_SORT_FIELDS.has(sortField);
    const railRef = useRef(null);
    const [activeLetter, setActiveLetter] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragLetter, setDragLetter] = useState(null);

    // Build letter→firstIndex map
    const letterMap = useMemo(() => {
        if (!isAlpha || !items.length) return new Map();
        const map = new Map();
        items.forEach((r, i) => {
            const letter = getLetterForRelease(r, sortField);
            if (!map.has(letter)) map.set(letter, i);
        });
        return map;
    }, [items, sortField, isAlpha]);

    // Active letters present in the collection
    const presentLetters = useMemo(() => {
        const set = new Set(letterMap.keys());
        return ALPHABET.filter(l => set.has(l));
    }, [letterMap]);

    // Track active section via IntersectionObserver
    useEffect(() => {
        if (!isAlpha) return;
        const headers = document.querySelectorAll('[id^="section-"]');
        if (!headers.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the topmost visible header
                let topEntry = null;
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
                            topEntry = entry;
                        }
                    }
                });
                if (topEntry) {
                    const letter = topEntry.target.id.replace('section-', '');
                    setActiveLetter(letter);
                }
            },
            { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
        );

        headers.forEach(h => observer.observe(h));
        return () => observer.disconnect();
    }, [isAlpha, items, sortField]);

    // ── Drag/touch letter scrubbing ─────────────────────────────
    const getLetterFromY = useCallback((clientY) => {
        if (!railRef.current) return null;
        const buttons = railRef.current.querySelectorAll('[data-letter]');
        for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            if (clientY >= rect.top && clientY <= rect.bottom) {
                return btn.dataset.letter;
            }
        }
        return null;
    }, []);

    const handleRailPointerDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        const letter = getLetterFromY(e.clientY ?? e.touches?.[0]?.clientY);
        if (letter) {
            setDragLetter(letter);
            if (onJumpToCrateIndex && letterMap.has(letter)) {
                onJumpToCrateIndex(letterMap.get(letter));
            } else {
                onJumpToLetter(letter);
            }
        }
    }, [getLetterFromY, onJumpToLetter, onJumpToCrateIndex, letterMap]);

    const handleRailPointerMove = useCallback((e) => {
        if (!isDragging) return;
        e.preventDefault();
        const letter = getLetterFromY(e.clientY ?? e.touches?.[0]?.clientY);
        if (letter && letter !== dragLetter) {
            setDragLetter(letter);
            if (onJumpToCrateIndex && letterMap.has(letter)) {
                onJumpToCrateIndex(letterMap.get(letter));
            } else {
                onJumpToLetter(letter);
            }
        }
    }, [isDragging, dragLetter, getLetterFromY, onJumpToLetter, onJumpToCrateIndex, letterMap]);

    const handleRailPointerUp = useCallback(() => {
        setIsDragging(false);
        setDragLetter(null);
    }, []);

    // Attach window-level pointer events for drag continuity
    useEffect(() => {
        if (!isDragging) return;
        const handleMove = (e) => handleRailPointerMove(e);
        const handleUp = () => handleRailPointerUp();
        window.addEventListener('pointermove', handleMove, { passive: false });
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, handleRailPointerMove, handleRailPointerUp]);

    // ── Non-alpha: scroll position indicator ────────────────────
    const [scrollPct, setScrollPct] = useState(0);

    useEffect(() => {
        if (isAlpha) return;
        const handleScroll = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (maxScroll <= 0) { setScrollPct(0); return; }
            setScrollPct(Math.min(100, (window.scrollY / maxScroll) * 100));
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isAlpha]);

    if (!items.length) return null;

    // ── Alpha rail ──────────────────────────────────────────────
    if (isAlpha) {
        return (
            <div
                ref={railRef}
                className="alpha-rail"
                onPointerDown={handleRailPointerDown}
                onTouchStart={handleRailPointerDown}
                role="navigation"
                aria-label="Alphabetical index"
            >
                {/* Drag indicator bubble */}
                {isDragging && dragLetter && (
                    <div className="alpha-drag-bubble">
                        {dragLetter}
                    </div>
                )}
                {presentLetters.map(letter => {
                    const isActive = activeLetter === letter;
                    const isDragTarget = dragLetter === letter;
                    return (
                        <button
                            key={letter}
                            data-letter={letter}
                            className={`alpha-letter ${isActive ? 'alpha-letter--active' : ''} ${isDragTarget ? 'alpha-letter--drag' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onJumpToCrateIndex && letterMap.has(letter)) {
                                    onJumpToCrateIndex(letterMap.get(letter));
                                } else {
                                    onJumpToLetter(letter);
                                }
                            }}
                            aria-label={`Jump to ${letter === '#' ? 'numbers' : letter}`}
                            tabIndex={-1}
                        >
                            {letter}
                        </button>
                    );
                })}
            </div>
        );
    }

    // ── Non-alpha scroll indicator ──────────────────────────────
    return (
        <div className="alpha-rail alpha-rail--scroll-indicator" aria-hidden="true">
            <div className="scroll-track">
                <div
                    className="scroll-thumb"
                    style={{ top: `${scrollPct}%` }}
                />
            </div>
        </div>
    );
}

// ─── Utility: group items by letter ────────────────────────────
export function groupByLetter(items, sortField) {
    if (!ALPHA_SORT_FIELDS.has(sortField) || !items.length) return null;

    const groups = [];
    let currentLetter = null;
    let currentItems = [];

    items.forEach((r) => {
        const letter = getLetterForRelease(r, sortField);
        if (letter !== currentLetter) {
            if (currentItems.length) groups.push({ letter: currentLetter, items: currentItems });
            currentLetter = letter;
            currentItems = [r];
        } else {
            currentItems.push(r);
        }
    });
    if (currentItems.length) groups.push({ letter: currentLetter, items: currentItems });

    return groups;
}

/** Check if a sort field is alphabetical */
export const isAlphaSort = (field) => ALPHA_SORT_FIELDS.has(field);
