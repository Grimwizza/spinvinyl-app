import React from 'react';
import { SEO } from '../seo-tools/SEOTags';
import { NewsFeed } from '../components/features/news-feed/NewsFeed';

export const FeedPage = ({ posts }) => (
    <div className="min-h-screen bg-background">
        <SEO title="AI News Feed" description="Live AI news aggregator from top tech sources." />
        <NewsFeed internalPosts={posts} />
    </div>
);
