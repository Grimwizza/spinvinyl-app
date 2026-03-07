import React from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../seo-tools/SEOTags';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LAB_ITEMS } from '../data';

const LabToolCard = ({ item }) => (
    <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 p-6">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold leading-tight">{item.title}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${item.status.toLowerCase().includes('beta') ? 'bg-yellow-500/10 text-yellow-600' : 'bg-green-500/10 text-green-600'}`}>
                {item.status}
            </span>
        </div>
        <p className="text-sm text-muted-foreground mb-6 flex-1 text-balance">{item.desc}</p>
        <Link to={`/apps/${item.slug}`} className="w-full mt-auto">
            <Button className="w-full gap-2 group" variant="default">
                Launch Tool <Icon name="arrow-right" size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Button>
        </Link>
    </Card>
);

const FeatureCard = () => (
    <div className="w-full bg-primary text-primary-foreground p-8 md:p-12 mb-16 relative overflow-hidden rounded-xl shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 bg-primary-foreground/10 text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold mb-6 backdrop-blur-md border border-primary-foreground/20">
                    <Icon name="sparkles" size={12} /> Flagship Tool
                </div>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-white">AI Marketing Analyst</h2>
                <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-xl leading-relaxed">
                    Generate consultant-grade brand reports, 4P analysis, and SWOT charts in seconds.
                </p>
                <Link to="/apps/ai-marketing-analyst">
                    <Button variant="secondary" size="lg" className="h-12 px-8 font-semibold shadow-md gap-2">
                        Start Analysis <Icon name="arrow-right" size={16} />
                    </Button>
                </Link>
            </div>
            {/* Visual Abstract Graphic */}
            <div className="w-64 h-64 relative hidden md:flex items-center justify-center">
                <div className="absolute inset-0 bg-primary-foreground/10 rounded-full blur-3xl" />
                <div className="relative z-10 bg-primary-foreground/20 p-8 rounded-2xl backdrop-blur-sm border border-primary-foreground/30 shadow-xl rotate-3 transition-transform hover:rotate-6 duration-500">
                    <Icon name="briefcase" size={64} className="text-white" />
                </div>
                <div className="absolute -z-10 bg-primary-foreground/10 p-8 rounded-2xl backdrop-blur-sm border border-primary-foreground/20 shadow-lg -rotate-6 scale-90" />
            </div>
        </div>

        {/* Background Texture */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
    </div>
);

export const AppsPage = () => {
    const allTools = LAB_ITEMS.filter(item => item.slug !== 'ai-marketing-analyst');

    return (
        <div className="max-w-6xl mx-auto px-6 py-16 min-h-screen">
            <SEO title="AimLow Apps" description="Professional AI tools to help you do more with less." />

            <div className="text-center mb-16">
                <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter text-foreground">AimLow Apps</h1>
                <p className="text-xl text-muted-foreground font-light max-w-lg mx-auto">
                    Experimental Tools for the Modern Hybrid.
                </p>
            </div>

            <FeatureCard />

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {allTools.map(item => <LabToolCard key={item.id} item={item} />)}
            </div>
        </div>
    );
};
