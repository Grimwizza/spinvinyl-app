import React from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../seo-tools/SEOTags';
import { Hero } from '../components/layout/Hero';
import { NewsFeed } from '../components/features/news-feed/NewsFeed';
import { LabCard, BlogCard } from '../components/BlogParts';
import { LAB_ITEMS } from '../data';

export const HomePage = ({ posts }) => (
    <>
        <SEO title="Home" />
        <Hero />

        {/* News Feed Section - distinct grey background */}
        <div className="bg-slate-50 dark:bg-zinc-900/50 border-y border-border">
            <NewsFeed limit={4} showAllLink={true} />
        </div>

        {/* Apps Section - Subtle Light Gray for separation without being dark */}
        <section className="relative py-24 px-4 overflow-hidden bg-slate-100 dark:bg-zinc-900 border-y border-border">
            {/* Background Gradient - subtle light mode mix */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-slate-100 dark:via-zinc-900 to-slate-100 dark:to-zinc-900 -z-10" />

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col items-center mb-16 text-center">
                    <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide uppercase mb-4 border border-primary/10">
                        Productivity Apps
                    </span>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
                        AimLow Apps
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        Explore our latest AI apps designed to automate your workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {LAB_ITEMS.filter(i => i.mode === 'work').slice(0, 3).map(item => <LabCard key={item.id} item={item} />)}
                </div>

                <div className="mt-12 text-center">
                    <Link to="/apps">
                        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground text-foreground h-10 px-8">
                            View All Apps
                        </button>
                    </Link>
                </div>
            </div>
        </section>

        {/* Blog Section - Clean White to contrast with dark section above */}
        <section className="bg-background py-24 px-4 border-t border-border">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">Recent Logs</h2>
                        <p className="text-muted-foreground">Detailed breakdowns and strategies from the team.</p>
                    </div>
                    <Link to="/blog" className="text-primary font-semibold hover:underline underline-offset-4 flex items-center gap-1">
                        View Log Archive <span>→</span>
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {posts.slice(0, 3).map(post => <BlogCard key={post._id} post={post} />)}
                </div>
            </div>
        </section>
    </>
);
