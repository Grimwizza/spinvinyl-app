import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Filter, Keyboard, LayoutGrid, List } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

const CATEGORIES = ["All", "Saved", "Models", "Image & Video", "Agents", "Research", "Companies", "Policy", "Hardware"];

export const FilterBar = ({
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    activeSource,
    setActiveSource,
    sources,
    categoryCounts = {},
    viewMode = 'grid',
    setViewMode
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Always show at the very top
            if (currentScrollY < 100) {
                setIsVisible(true);
            } else {
                // Show when scrolling up, hide when scrolling down
                if (currentScrollY < lastScrollY.current) {
                    setIsVisible(true);
                } else if (currentScrollY > lastScrollY.current && Math.abs(currentScrollY - lastScrollY.current) > 10) {
                    // Added a small threshold for scroll down to avoid jitter
                    setIsVisible(false);
                }
            }
            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div
            className={`
                mb-8 space-y-4 sticky top-[72px] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 -mx-6 px-6 border-b border-border 
                transition-transform duration-300 ease-in-out
                ${isVisible ? 'translate-y-0' : '-translate-y-[150%] md:translate-y-0'}
            `}
        >
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search intel... (use j/k)"
                        icon="search"
                        className="bg-background"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    <div className="relative min-w-[200px] flex-1 md:flex-none">
                        <select
                            value={activeSource}
                            onChange={(e) => setActiveSource(e.target.value)}
                            className="w-full h-12 appearance-none rounded-md border border-input bg-background px-3 py-2 pl-4 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <option value="All Sources">All Sources</option>
                            {sources.map(source => (
                                <option key={source} value={source}>{source}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                            <Filter size={18} />
                        </div>
                    </div>

                    <div className="flex bg-muted/50 p-1 rounded-lg border border-border items-center">
                        <button
                            onClick={() => setViewMode && setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode && setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                {CATEGORIES.map(cat => {
                    const count = categoryCounts[cat] || 0;
                    return (
                        <Button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            size="sm"
                            variant={activeCategory === cat ? 'primary' : 'outline'}
                            className={`rounded-full ${activeCategory === cat ? '' : 'border-transparent bg-secondary/50 hover:bg-secondary text-secondary-foreground'}`}
                        >
                            {cat}
                            {cat !== 'All' && count > 0 && (
                                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${activeCategory === cat ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/50 text-muted-foreground'}`}>
                                    {count}
                                </span>
                            )}
                        </Button>
                    );
                })}

                {/* Keyboard shortcuts hint */}
                <div className="hidden md:flex items-center gap-1 ml-auto text-xs text-muted-foreground font-mono opacity-70">
                    <Keyboard size={14} />
                    <span>j/k nav • Enter open • b save</span>
                </div>
            </div>
        </div>
    );
};
