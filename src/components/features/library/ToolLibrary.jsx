import React, { useState, useEffect } from 'react';
import { Star, Zap, ExternalLink, PenTool, Code, Image, Video, Music, Search, Sparkles, X, DollarSign, Briefcase, PieChart, Megaphone, Mic, GraduationCap, Box, ChevronDown } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

const CATEGORY_ICONS = {
    writing: PenTool,
    coding: Code,
    images: Image,
    video: Video,
    music: Music,
    audio: Mic,
    '3d': Box,
    marketing: Megaphone,
    research: Search,
    education: GraduationCap,
    finance: PieChart,
    business: Briefcase
};

export const ToolLibrary = () => {
    const [library, setLibrary] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [pricingFilter, setPricingFilter] = useState('all');
    const [showPricingDropdown, setShowPricingDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTool, setSelectedTool] = useState(null);

    useEffect(() => {
        const fetchLibrary = async () => {
            try {
                const res = await fetch('/api/tools');
                const data = await res.json();
                if (data?.categories) setLibrary(data.categories);
            } catch (error) {
                console.error("Failed to fetch library:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLibrary();
    }, []);

    const ToolCard = ({ tool, featured }) => (
        <Card
            className={`h-full flex flex-col transition-all duration-300 cursor-pointer group relative overflow-hidden ${featured ? 'border-primary/50 bg-secondary/10 shadow-md' : 'hover:shadow-md hover:border-primary/30'}`}
            onClick={() => setSelectedTool(tool)}
        >
            {tool.rating && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/95 backdrop-blur px-2 py-1 rounded-md border border-border/50 text-xs font-medium z-10 shadow-sm">
                    <Star size={10} className="fill-yellow-500 text-yellow-500" />
                    {tool.rating}
                </div>
            )}
            <div className="flex items-start justify-between mb-4 p-5 pb-0">
                <div className="flex items-center gap-4 w-full">
                    <img
                        src={tool.image}
                        alt={tool.title}
                        className="w-12 h-12 rounded-lg object-cover border border-border bg-background"
                        onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=AI' }}
                    />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg leading-tight mb-1">{tool.title}</h3>

                        <div className="flex flex-wrap gap-2 mt-1">
                            {tool.pricing && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border w-fit ${tool.pricing === 'Free' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    tool.pricing === 'Paid' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                        'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                    }`}>
                                    {tool.pricing === 'Paid' ? <DollarSign size={8} /> : <Zap size={8} />} {tool.pricing}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="px-5 pb-5 pt-2 flex flex-col flex-1">
                <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2">
                    {tool.description}
                </p>
                <div className="mt-auto">
                    <Button className="w-full gap-2 group pointer-events-none" variant={featured ? 'default' : 'outline'} size="sm">
                        Try Tool <ExternalLink size={14} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                </div>
            </div>
        </Card>
    );

    const ToolModal = () => {
        if (!selectedTool) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedTool(null)}>
                <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setSelectedTool(null)}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-4 mb-6">
                        <img
                            src={selectedTool.image}
                            alt={selectedTool.title}
                            className="w-16 h-16 rounded-xl object-cover border border-border bg-background shadow-sm"
                            onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=AI' }}
                        />
                        <div>
                            <h2 className="text-2xl font-bold">{selectedTool.title}</h2>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedTool.pricing && (
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${selectedTool.pricing === 'Free' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                        selectedTool.pricing === 'Paid' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                        }`}>
                                        {selectedTool.pricing === 'Paid' ? <DollarSign size={10} /> : <Zap size={10} />} {selectedTool.pricing}
                                    </span>
                                )}
                            </div>

                            {/* Maker & Rating Row */}
                            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                                {selectedTool.maker && (
                                    <span className="flex items-center gap-1">
                                        Made by <span className="font-medium text-foreground">{selectedTool.maker}</span>
                                    </span>
                                )}
                                {selectedTool.rating && (
                                    <span className="flex items-center gap-1">
                                        • <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                        <span className="font-medium text-foreground">{selectedTool.rating}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Use Cases */}
                    {selectedTool.useCases && selectedTool.useCases.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {selectedTool.useCases.map((useCase, idx) => (
                                <span key={idx} className="bg-secondary/50 text-secondary-foreground text-xs px-2.5 py-1 rounded-md font-medium">
                                    {useCase}
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="text-muted-foreground leading-relaxed mb-8">
                        {selectedTool.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" onClick={() => setSelectedTool(null)}>
                            Close
                        </Button>
                        <a href={selectedTool.link} target="_blank" rel="noopener noreferrer" className="w-full">
                            <Button className="w-full gap-2">
                                Visit Website <ExternalLink size={16} />
                            </Button>
                        </a>
                    </div>
                </div>
            </div >
        );
    };

    const CategoryButton = ({ id, name, icon: Icon, isActive, onClick }) => (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
        >
            {Icon && <Icon size={16} />}
            {name}
        </button>
    );

    const getDisplayTools = () => {
        let allEssentials = [];
        let allTrending = [];

        // 1. Gather all potential tools based on category
        if (activeCategory === 'all') {
            Object.values(library).forEach(cat => {
                allEssentials.push(...(cat.essentials || []));
                allTrending.push(...(cat.trending || []));
            });
        } else {
            const cat = library[activeCategory];
            if (cat) {
                allEssentials = cat.essentials || [];
                allTrending = cat.trending || [];
            }
        }

        // 2. Filter Function for Search and Pricing
        const filterFn = (t) => {
            const matchesSearch = !searchQuery.trim() ||
                (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesPricing = pricingFilter === 'all' ||
                (pricingFilter === 'Free' && (t.pricing === 'Free' || t.pricing === 'Freemium')) || // Include Freemium in Free
                (pricingFilter === 'Paid' && t.pricing === 'Paid');

            return matchesSearch && matchesPricing;
        };

        // 3. Apply Filters
        let filteredEssentials = allEssentials.filter(filterFn);
        let filteredTrending = allTrending.filter(filterFn);

        // 4. Apply Default Limit (slicing) if NO search and default view to keep page manageable BUT balanced
        // If we are showing 'all' categories and have no search query, we want a curated preview.
        // Previously we sliced explicitly. Now we want "balance".
        // If we heavily filter with pricing, we shouldn't slice artificially.
        if (activeCategory === 'all' && !searchQuery.trim() && pricingFilter === 'all') {
            const slicedE = [];
            const slicedT = [];
            Object.values(library).forEach(cat => {
                slicedE.push(...(cat.essentials || []).slice(0, 2));
                // We want more trending tools now. Let's take top 2 trending from each cat too.
                slicedT.push(...(cat.trending || []).slice(0, 2));
            });
            // Return all of them to maintain balance (approx 24 vs 24 if full)
            return { essentials: slicedE, trending: slicedT };
        }

        return { essentials: filteredEssentials, trending: filteredTrending };
    };

    const displayData = getDisplayTools();
    const categoryList = Object.entries(library).map(([key, val]) => ({
        id: key,
        name: val.name,
        icon: CATEGORY_ICONS[key]
    }));

    const hasResults = displayData.essentials.length > 0 || displayData.trending.length > 0;

    return (
        <section className="py-16 px-6 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight flex items-center justify-center gap-3">
                    <Sparkles className="text-primary" /> Trending AI Tools
                </h1>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg mb-8">
                    Discover the tools shaping the future. From proven essentials to what's trending now.
                </p>

                {/* UNIFIED FILTER TOOLBAR */}
                <div className="max-w-xl mx-auto mb-10 flex flex-col sm:flex-row gap-3 z-20 relative">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                        <input
                            type="text"
                            placeholder="Search tools..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        />
                    </div>

                    {/* Pricing Dropdown */}
                    <div className="relative min-w-[160px]">
                        <button
                            onClick={() => setShowPricingDropdown(!showPricingDropdown)}
                            className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                            <span className="truncate">
                                {pricingFilter === 'all' ? 'Any Price' : pricingFilter === 'Free' ? 'Free & Freemium' : 'Paid Only'}
                            </span>
                            <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${showPricingDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showPricingDropdown && (
                            <div className="absolute top-full right-0 mt-1 w-full sm:w-48 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 duration-150 p-1 z-30">
                                {['all', 'Free', 'Paid'].map((price) => (
                                    <button
                                        key={price}
                                        onClick={() => {
                                            setPricingFilter(price);
                                            setShowPricingDropdown(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${pricingFilter === price
                                            ? 'bg-secondary text-secondary-foreground font-medium'
                                            : 'hover:bg-muted text-foreground'
                                            }`}
                                    >
                                        {price === 'all' ? 'Any Price' : price === 'Free' ? 'Free & Freemium' : 'Paid Only'}
                                        {pricingFilter === price && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-2 mb-12 overflow-x-auto pb-4 w-full md:flex-wrap md:justify-center md:pb-0 px-2 no-scrollbar snap-x">
                <CategoryButton
                    id="all"
                    name="All"
                    icon={Sparkles}
                    isActive={activeCategory === 'all'}
                    onClick={() => setActiveCategory('all')}
                />
                {categoryList.map(cat => (
                    <CategoryButton
                        key={cat.id}
                        id={cat.id}
                        name={cat.name}
                        icon={cat.icon}
                        isActive={activeCategory === cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                    />
                ))}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
                    </div>
                </div>
            ) : !hasResults ? (
                <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
                    <Search className="mx-auto text-muted-foreground mb-4 opacity-50" size={48} />
                    <h3 className="text-xl font-semibold mb-2">No tools found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or category filter.</p>
                    <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}>
                        Clear Filters
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* LEFT: Essentials */}
                    {(displayData.essentials.length > 0 || !searchQuery) && (
                        <div className={`lg:pr-8 ${displayData.trending.length > 0 ? 'lg:border-r border-border' : ''}`}>
                            <div className="flex items-center gap-2 mb-8 border-b border-border pb-4">
                                <Star className="text-primary fill-primary" />
                                <h2 className="text-xl font-bold tracking-tight">
                                    {activeCategory === 'all' ? 'Essential Picks' : `Essential ${library[activeCategory]?.name || ''} Tools`}
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {displayData.essentials.map((tool, idx) => (
                                    <ToolCard key={idx} tool={{ ...tool, isEssential: true }} featured={true} />
                                ))}
                            </div>
                            {displayData.essentials.length === 0 && searchQuery && (
                                <p className="text-muted-foreground italic">No essential tools match your search.</p>
                            )}
                        </div>
                    )}

                    {/* RIGHT: Trending */}
                    {(displayData.trending.length > 0 || !searchQuery) && (
                        <div className="mt-8 lg:mt-0">
                            <div className="flex items-center gap-2 mb-8 border-b border-border pb-4">
                                <Zap className="text-blue-500" />
                                <h2 className="text-xl font-bold tracking-tight">Trending Now</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {displayData.trending.map((tool, idx) => (
                                    <ToolCard key={idx} tool={tool} featured={false} />
                                ))}
                            </div>
                            {displayData.trending.length === 0 && searchQuery && (
                                <p className="text-muted-foreground italic">No trending tools match your search.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ToolModal />
        </section>
    );
};
