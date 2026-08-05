
// ─── Groove Mark ──────────────────────────────────────────────────────────────
// Abstract mark: 3 concentric open arcs, gaps rotationally offset, evoking both a
// record groove and rotational motion — deliberately not a literal disc silhouette.
// Geometry mirrors public/spin-icon.svg so the in-app mark and the exported
// favicon/app-icon assets are the same design at every size.
const GrooveMark = ({ spinning }) => (
    <svg viewBox="0 0 512 512" className={`w-full h-full block ${spinning ? 'animate-[vinyl-spin_3s_linear_infinite]' : ''}`}>
        <rect x="0" y="0" width="512" height="512" rx="112" className="fill-stone-950" />
        <g fill="none" strokeLinecap="round">
            <circle cx="256" cy="256" r="220" strokeWidth="34" className="stroke-terracotta-600"
                strokeDasharray="1036.7 345.6" transform="rotate(150 256 256)" />
            <circle cx="256" cy="256" r="160" strokeWidth="34" className="stroke-terracotta-400"
                strokeDasharray="754.0 251.33" transform="rotate(30 256 256)" />
            <circle cx="256" cy="256" r="100" strokeWidth="34" className="stroke-brass-500"
                strokeDasharray="471.24 157.08" transform="rotate(-90 256 256)" />
        </g>
    </svg>
);

const SIZES = {
    sm: { icon: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-14 h-14', text: 'text-2xl' },
    lg: { icon: 'w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20', text: 'text-4xl sm:text-5xl md:text-6xl' },
    xl: { icon: 'w-24 h-24', text: 'text-4xl sm:text-5xl' },
};

// ─── Logo ─────────────────────────────────────────────────────────────────────
export default function Logo({ variant = 'full', size = 'md', animated = false, spinning = false, stacked = false, className = '' }) {
    const { icon: iconSize, text: textSize } = SIZES[size] || SIZES.md;

    const mark = (
        <div className={`relative shrink-0 rounded-[22%] overflow-hidden shadow-2xl border border-white/10 ${iconSize}`}>
            <GrooveMark spinning={spinning} />
            {animated && (
                <div
                    className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(242,233,220,0.14),transparent)] animate-spin-slow pointer-events-none"
                />
            )}
        </div>
    );

    const wordmark = (
        <h1 className={`font-serif font-black tracking-tight text-parchment leading-none ${textSize}`}>
            Spin Vinyl
        </h1>
    );

    if (variant === 'icon') return <div className={className}>{mark}</div>;
    if (variant === 'wordmark') return <div className={className}>{wordmark}</div>;

    return (
        <div className={`flex ${stacked ? 'flex-col items-center gap-6' : 'items-center gap-4'} ${className}`}>
            {mark}
            {wordmark}
        </div>
    );
}
