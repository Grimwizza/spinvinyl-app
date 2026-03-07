
import React, { useState, useEffect, useRef } from 'react';
import { Clock, ExternalLink, Activity } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

export const UpdatesTimeline = () => {
    const [updates, setUpdates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const timelineRef = useRef(null);

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        scrollToTimeline();
    };

    const handleDateFilterChange = (newDateFilter) => {
        setDateFilter(newDateFilter);
        scrollToTimeline();
    };

    const scrollToTimeline = () => {
        if (timelineRef.current) {
            const yOffset = -200; // Offset for sticky header
            const element = timelineRef.current;
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const FILTERS = [
        { id: 'all', label: 'All Updates', logo: null },
        { id: 'openai', label: 'OpenAI', logo: 'https://www.google.com/s2/favicons?domain=openai.com&sz=128' },
        { id: 'anthropic', label: 'Anthropic', logo: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=128' },
        { id: 'deepmind', label: 'Google AI', logo: 'https://www.google.com/s2/favicons?domain=deepmind.google&sz=128' },
        { id: 'xai', label: 'Grok', logo: 'https://www.google.com/s2/favicons?domain=x.ai&sz=128' },
        { id: 'meta', label: 'Meta AI', logo: 'https://www.google.com/s2/favicons?domain=meta.com&sz=128' }
    ];

    const DATE_FILTERS = [
        { id: 'all', label: 'All Time' },
        { id: 'this_month', label: 'This Month' },
        { id: 'last_3_months', label: 'Last 3 Months' },
        { id: '2025', label: '2025' }
    ];

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                const res = await fetch('/api/updates');
                const data = await res.json();
                if (data.updates) setUpdates(data.updates);
            } catch (error) {
                console.error("Failed to fetch updates:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUpdates();
    }, []);

    const filteredUpdates = updates.filter(item => {
        // Filter by Source
        if (filter !== 'all' && item.sourceId !== filter) return false;

        // Filter by Date
        if (dateFilter === 'all') return true;

        const itemDate = new Date(item.pubDate);
        const now = new Date();

        if (dateFilter === 'this_month') {
            return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }

        if (dateFilter === 'last_3_months') {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            return itemDate >= threeMonthsAgo;
        }

        if (dateFilter === '2025') {
            return itemDate.getFullYear() === 2025;
        }

        return true;
    });

    const TimelineSkeleton = () => (
        <div className="relative pl-8 md:pl-0 animate-pulse">
            <div className="hidden md:block absolute left-[50%] top-0 bottom-0 w-0.5 bg-muted/30 transform -translate-x-1/2"></div>
            <div className="flex flex-col md:flex-row items-center justify-between w-full pb-12">
                <div className="w-full md:w-5/12 text-left md:text-right mb-4 md:mb-0 md:pr-12 flex flex-col items-start md:items-end">
                    <div className="h-6 w-24 bg-muted rounded-full mb-3"></div>
                    <div className="flex flex-row md:flex-col items-center gap-3 mt-1">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-muted"></div>
                    </div>
                </div>
                <div className="absolute left-0 md:left-[50%] top-0 md:top-6 w-3 h-3 bg-muted rounded-full transform -translate-x-[5px] md:-translate-x-1/2 z-10"></div>
                <div className="w-full md:w-5/12 md:pl-12">
                    <div className="h-48 bg-muted/50 rounded-xl w-full border border-border/50"></div>
                </div>
            </div>
        </div>
    );

    const UpdateItem = ({ item, isLast }) => (
        <div className="relative pl-8 md:pl-0 animate-in fade-in slide-in-from-bottom-4 duration-500 group">
            {/* Desktop Timeline Line */}
            <div className="hidden md:block absolute left-[50%] top-0 bottom-0 w-0.5 bg-primary transform -translate-x-1/2"></div>

            <div className={`flex flex-col md:flex-row items-center justify-between w-full pb-12 ${isLast ? '' : ''}`}>

                {/* Date Side (Left on Desktop) */}
                <div className="w-full md:w-5/12 text-left md:text-right mb-4 md:mb-0 md:pr-12 flex flex-col items-start md:items-end">
                    <div className="flex flex-col items-start md:items-center gap-3">
                        <div className="inline-flex items-center justify-center bg-muted/50 text-muted-foreground px-3 py-1 rounded-full text-xs font-medium tracking-wide border border-border/50">
                            {new Date(item.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>

                        {item.image ? (
                            <div className="relative overflow-hidden rounded-lg border border-border/50 shadow-sm mt-1 max-w-[200px]">
                                <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-full h-auto object-cover transition-transform duration-500 hover:scale-105"
                                    onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.style.display = 'none'; }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-2">
                                    <span className="text-white text-xs font-bold drop-shadow-md">{item.source}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-row md:flex-col items-center md:items-center gap-3 md:gap-1 mt-1">
                                {item.logo && (
                                    <img src={item.logo} alt={item.source} className="w-10 h-10 md:w-14 md:h-14 rounded-full border border-border bg-white object-contain p-1 shadow-sm" />
                                )}
                                <span className="font-bold text-lg md:text-xl text-foreground tracking-tight">{item.source}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Dot */}
                <div className="absolute left-0 md:left-[50%] top-0 md:top-6 w-3 h-3 bg-primary rounded-full ring-4 ring-background shadow-sm transform -translate-x-[5px] md:-translate-x-1/2 z-10 transition-transform duration-300 group-hover:scale-125"></div>

                {/* Content Side (Right on Desktop) */}
                <div className="w-full md:w-5/12 md:pl-12">
                    <Card className="hover:shadow-xl transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm group-hover:border-primary/30 group-hover:-translate-y-1">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-2 leading-tight tracking-tight">{item.title}</h3>
                            <div className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.content.replace(/<[^>]*>/g, '') }}></div>
                            <a href={item.link} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="w-full text-xs h-9 font-medium gap-2 text-foreground dark:text-foreground hover:bg-primary/5 hover:text-primary dark:hover:text-primary border-border">
                                    Read Log <ExternalLink size={12} className="opacity-50" />
                                </Button>
                            </a>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );

    return (
        <section className="py-16 px-6 max-w-5xl mx-auto min-h-screen">
            <div className="text-center mb-16">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-6">
                    <Activity size={32} className="text-primary" />
                </div>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 pb-4">
                    AI Changelog
                </h1>
                <p className="text-xl text-muted-foreground font-light max-w-lg mx-auto mb-12 leading-relaxed">
                    Change is coming quickly. Stay informed with these real-time updates from every major AI lab.
                </p>

                {/* FILTER BAR */}
                <div className="flex flex-col gap-4 animate-in fade-in duration-700">
                    {/* Source Filters */}
                    <div className="flex flex-wrap justify-center gap-3">
                        {FILTERS.map(f => (
                            <button
                                key={f.id}
                                onClick={() => handleFilterChange(f.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 text-sm font-medium ${filter === f.id
                                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                    : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                            >
                                {f.logo && <img src={f.logo} alt={f.label} className="w-4 h-4 object-contain bg-white rounded-full" />}
                                <span className="uppercase tracking-wide text-xs">{f.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Date Filters */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {DATE_FILTERS.map(d => (
                            <button
                                key={d.id}
                                onClick={() => handleDateFilterChange(d.id)}
                                className={`px-3 py-1.5 rounded-full border transition-all duration-200 text-xs font-medium ${dateFilter === d.id
                                    ? 'border-primary/50 bg-primary/10 text-primary'
                                    : 'border-border/50 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4" ref={timelineRef}>
                    {[1, 2, 3].map(i => <TimelineSkeleton key={i} />)}
                </div>
            ) : (
                <div className="relative min-h-[400px]" ref={timelineRef}>
                    {filteredUpdates.length > 0 ? (
                        filteredUpdates.map((item, idx) => (
                            <UpdateItem key={idx} item={item} isLast={idx === filteredUpdates.length - 1} />
                        ))
                    ) : (
                        <Card className="text-center py-20 bg-muted/20 border-border border-dashed animate-in fade-in" noShadow>
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="p-4 bg-background rounded-full shadow-sm">
                                    <Activity size={32} className="text-muted-foreground opacity-50" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">No updates found</h3>
                                    <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
                                        We couldn't find any recent updates for this lab. Check back soon!
                                    </p>
                                </div>
                                <Button variant="outline" className="mt-2" onClick={() => { handleFilterChange('all'); handleDateFilterChange('all'); }}>
                                    View All Updates
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </section>
    );
};
