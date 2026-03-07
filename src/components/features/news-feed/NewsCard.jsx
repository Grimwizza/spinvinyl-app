import React from 'react';
import { ExternalLink, Bookmark, BookmarkCheck, Share2, Clock } from 'lucide-react';
import { Card } from '../../ui/Card';

const SOURCE_LOGOS = {
    'TechCrunch': 'https://www.google.com/s2/favicons?domain=techcrunch.com&sz=128',
    'VentureBeat': 'https://www.google.com/s2/favicons?domain=venturebeat.com&sz=128',
    'The Verge': 'https://www.google.com/s2/favicons?domain=theverge.com&sz=128',
    'Wired': 'https://www.google.com/s2/favicons?domain=wired.com&sz=128',
    'Ars Technica': 'https://www.google.com/s2/favicons?domain=arstechnica.com&sz=128',
    'MIT Tech Review': 'https://www.google.com/s2/favicons?domain=technologyreview.com&sz=128',
    'Reuters Tech': 'https://www.google.com/s2/favicons?domain=reuters.com&sz=128',
    'IEEE Spectrum': 'https://www.google.com/s2/favicons?domain=spectrum.ieee.org&sz=128',
    'Engadget': 'https://www.google.com/s2/favicons?domain=engadget.com&sz=128',
    'ScienceDaily': 'https://www.google.com/s2/favicons?domain=sciencedaily.com&sz=128'
};

const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval >= 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval >= 1) return Math.floor(interval) + "m";
    return "now";
};

export const NewsCard = ({
    article,
    isRead,
    onRead,
    isBookmarked = false,
    onBookmark,
    onShare,
    readingTime = 2,
    isSelected = false,
    layout = 'grid'
}) => {
    const sourceFallback = SOURCE_LOGOS[article.source] || '/logo.jpg';
    const displayImage = (!article.image || article.image.includes('ui-avatars')) ? sourceFallback : article.image;
    const isLogo = displayImage === sourceFallback;

    const handleBookmarkClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onBookmark?.(article.link);
    };

    const handleShareClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onShare?.(article);
    };

    if (layout === 'list') {
        return (
            <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onRead(article.link)}
                className={`group block w-full select-none outline-none ${isRead ? 'opacity-60 grayscale' : 'opacity-100'}`}
            >
                <div className={`
                    w-full border rounded-xl overflow-hidden flex flex-row transition-all duration-300 transform
                    bg-card/40 backdrop-blur-md 
                    border-white/10 dark:border-white/5 
                    hover:border-primary/30 hover:shadow-[0_8px_30px_-10px_rgba(var(--primary-rgb),0.3)] hover:-translate-x-1
                    group-focus:ring-2 group-focus:ring-ring group-focus:ring-offset-2 
                    ${isSelected ? 'ring-2 ring-ring ring-offset-2' : ''}
                    h-[180px]
                `}>
                    <div className="relative w-[240px] shrink-0 h-full overflow-hidden bg-muted flex items-center justify-center border-r border-white/5">
                        <img
                            src={displayImage}
                            alt=""
                            className={`w-full h-full transition-transform duration-700 ease-out group-hover:scale-110 ${isLogo ? 'object-contain p-8 opacity-80' : 'object-cover'}`}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = sourceFallback;
                                e.target.className = "w-full h-full object-contain p-8 bg-muted opacity-50";
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* Source badge (List mode) */}
                        <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-md shadow-sm rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase z-20 text-foreground border border-white/10">
                            {article.source}
                        </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1 relative">
                        {/* Action buttons (List mode) */}
                        <div className="absolute top-4 right-4 flex gap-2 z-20">
                            <button
                                onClick={handleBookmarkClick}
                                className={`p-1.5 rounded-full shadow-sm border backdrop-blur-md transition-colors ${isBookmarked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/50 hover:bg-background border-white/10 text-muted-foreground hover:text-foreground'}`}
                            >
                                {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                            </button>
                            <button
                                onClick={handleShareClick}
                                className="p-1.5 rounded-full shadow-sm border border-white/10 bg-background/50 backdrop-blur-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Share2 size={14} />
                            </button>
                        </div>

                        <div className="flex gap-2 text-xs text-muted-foreground mb-2 items-center">
                            <span className="font-medium text-primary">{timeAgo(article.pubDate)} ago</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock size={12} /> {readingTime} min read
                            </span>
                        </div>

                        <h3 className="text-xl font-bold leading-tight mb-2 line-clamp-1 group-hover:text-primary transition-colors tracking-tight pr-16">
                            {article.title}
                        </h3>

                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                            {article.summary}
                        </p>

                        <div className="mt-auto flex items-center text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            Read Article <ExternalLink size={12} className="ml-1" />
                        </div>
                    </div>
                </div>
            </a>
        );
    }

    // Grid Layout (Default)
    return (
        <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onRead(article.link)}
            className={`group block w-full break-inside-avoid-column mb-6 select-none outline-none ${isRead ? 'opacity-60 grayscale' : 'opacity-100'}`}
        >
            <div className={`
                w-full border rounded-xl overflow-hidden flex flex-col relative transition-all duration-300 transform
                bg-card/40 backdrop-blur-md 
                border-white/10 dark:border-white/5 
                hover:border-primary/30 hover:shadow-[0_8px_30px_-10px_rgba(var(--primary-rgb),0.3)] hover:-translate-y-1
                group-focus:ring-2 group-focus:ring-ring group-focus:ring-offset-2 
                ${isSelected ? 'ring-2 ring-ring ring-offset-2' : ''}
            `}>

                {/* Source badge */}
                <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-md shadow-sm rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase z-20 text-foreground border border-white/10">
                    {article.source}
                </div>

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-2 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 translate-y-2 md:translate-y-4 group-hover:translate-y-0">
                    <button
                        onClick={handleBookmarkClick}
                        className={`p-2 rounded-full shadow-lg border backdrop-blur-md transition-all duration-300 hover:scale-110 ${isBookmarked ? 'bg-primary text-primary-foreground border-primary shadow-primary/25' : 'bg-background/80 border-white/10 hover:bg-background text-foreground'}`}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark for later'}
                    >
                        {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    </button>
                    <button
                        onClick={handleShareClick}
                        className="p-2 rounded-full shadow-lg border border-white/10 bg-background/80 backdrop-blur-md hover:bg-background text-foreground transition-all duration-300 hover:scale-110"
                        title="Share article"
                    >
                        <Share2 size={14} />
                    </button>
                </div>

                <div className="relative group-hover:brightness-110 transition-all duration-500">
                    <div className="h-48 w-full overflow-hidden relative bg-muted flex items-center justify-center">
                        <img
                            src={displayImage}
                            alt=""
                            className={`w-full h-full transition-transform duration-700 ease-out group-hover:scale-110 ${isLogo ? 'object-contain p-10 opacity-80' : 'object-cover'}`}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = sourceFallback;
                                e.target.className = "w-full h-full object-contain p-8 bg-muted opacity-50";
                            }}
                        />
                    </div>
                    {/* Overlay gradient for text readability if we go over image, but here just a subtle shine */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold leading-tight mb-3 line-clamp-3 group-hover:text-primary transition-colors tracking-tight">
                        {article.title}
                    </h3>
                    <div className="flex items-center justify-between mt-auto text-xs text-muted-foreground pt-4 border-t border-border/50">
                        <div className="flex items-center gap-3">
                            <span className="font-medium">{timeAgo(article.pubDate)} ago</span>
                            <span className="flex items-center gap-1 opacity-70">
                                <Clock size={12} />
                                {readingTime} min
                            </span>
                        </div>
                        <span className="flex items-center gap-1 font-semibold text-foreground group-hover:text-primary transition-colors">
                            Read <ExternalLink size={12} />
                        </span>
                    </div>
                </div>
            </div>
        </a>
    );
};
