import React from 'react';
import { SEO } from '../seo-tools/SEOTags';
import { BlogCard } from '../components/BlogParts';

export const BlogPage = ({ posts }) => (
    <div className="max-w-6xl mx-auto px-4 py-12">
        <SEO title="The Log" description="Thoughts, experiments, and philosophy on AI efficiency." />
        <h2 className="text-6xl font-black uppercase mb-12 text-center">The Log</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {posts.map(post => <BlogCard key={post._id} post={post} />)}
        </div>
    </div>
);
