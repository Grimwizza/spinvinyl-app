import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { client, urlFor } from '../client';
import { PortableText } from '@portabletext/react';
import { SEO } from '../seo-tools/SEOTags';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

// --- Rich Text Styling ---
export const ptComponents = {
    types: { image: ({ value }) => value?.asset?._ref ? <img src={urlFor(value).width(800).fit('max').url()} alt={value.alt || ' '} className="my-8 w-full rounded-xl border border-border" /> : null },
    block: {
        h1: ({ children }) => <h1 className="text-3xl font-bold mt-12 mb-6 tracking-tight">{children}</h1>,
        h2: ({ children }) => <h2 className="text-2xl font-bold mt-10 mb-4 tracking-tight pb-2 border-b border-border inline-block">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xl font-bold mt-8 mb-3">{children}</h3>,
        normal: ({ children }) => <p className="mb-6 leading-relaxed text-lg text-muted-foreground">{children}</p>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic my-8 bg-muted/30 p-6 rounded-r-lg text-lg text-foreground">{children}</blockquote>,
    },
    list: { bullet: ({ children }) => <ul className="list-disc ml-6 mb-6 space-y-2 text-lg text-muted-foreground">{children}</ul>, number: ({ children }) => <ol className="list-decimal ml-6 mb-6 space-y-2 text-lg text-muted-foreground">{children}</ol> }
}

// --- Sub-Components ---
export const ShareBar = ({ title }) => {
    const location = useLocation();
    const currentUrl = `https://aimlow.ai${location.pathname}`;
    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedTitle = encodeURIComponent(title || "Check this out");
    return (
        <div className="mt-12 pt-8 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Share this Log</p>
            <div className="flex gap-4">
                <a href={`https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-2">
                        <Icon name="twitter" size={16} /> <span className="text-sm">Post</span>
                    </Button>
                </a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-2">
                        <Icon name="linkedin" size={16} /> <span className="text-sm">Share</span>
                    </Button>
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-2">
                        <Icon name="facebook" size={16} /> <span className="text-sm">Share</span>
                    </Button>
                </a>
            </div>
        </div>
    );
};

export const AuthorBio = ({ author }) => {
    if (!author) return null;
    const avatarUrl = author.image ? urlFor(author.image).width(200).height(200).url() : "https://via.placeholder.com/100";
    return (
        <div className="mt-16 border-t border-border pt-8">
            <Card className="flex flex-col sm:flex-row gap-6 items-center sm:items-start p-6 bg-secondary/10 border-transparent">
                <img src={avatarUrl} alt={author.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-background" />
                <div className="text-center sm:text-left">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1 tracking-wider">Written By</p>
                    <h3 className="text-xl font-bold mb-2">{author.name}</h3>
                    {author.bio && <div className="prose prose-sm prose-neutral dark:prose-invert"><PortableText value={author.bio} /></div>}
                </div>
            </Card>
        </div>
    );
};

// --- Main Components ---

export const BlogCard = ({ post }) => {
    const imageUrl = post.mainImage ? urlFor(post.mainImage).width(800).url() : 'https://via.placeholder.com/800x400?text=No+Image';
    const dateString = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : (post._createdAt ? new Date(post._createdAt).toLocaleDateString() : 'Draft');
    const slug = post.slug?.current || '#';
    return (
        <Link to={`/post/${slug}`} className="block h-full group">
            <Card className="flex flex-col h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border">
                <div className="h-48 overflow-hidden relative">
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10" />
                    <img src={imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-2.5 py-0.5 rounded-full text-xs font-semibold text-foreground z-20 shadow-sm border border-border/50">
                        LOG
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <div className="text-xs font-medium text-muted-foreground mb-3">{dateString}</div>
                    <h3 className="text-xl font-bold leading-tight mb-3 group-hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-1 line-clamp-3">{post.excerpt}</p>
                    <div className="flex items-center gap-2 font-medium text-sm text-primary mt-auto">
                        Read Post <Icon name="arrow-right" size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </Card>
        </Link>
    );
};

export const BlogPost = () => {
    const { slug } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPost = async () => {
            const query = `*[_type == "post" && slug.current == $slug][0] { 
                title, publishedAt, _createdAt, mainImage, 
                "excerpt": pt::text(body)[0...150] + "...", 
                body, 
                author->{name, image, bio} 
            }`;
            const data = await client.fetch(query, { slug });
            setPost(data);
            setLoading(false);
        };
        fetchPost();
    }, [slug]);

    if (loading) return <div className="py-20 text-center"><Icon name="loader" className="animate-spin mx-auto text-primary" /></div>;
    if (!post) return <div className="py-20 text-center font-bold text-muted-foreground">Post not found.</div>;

    const dateString = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : (post._createdAt ? new Date(post._createdAt).toLocaleDateString() : 'Draft');
    const imageUrl = post.mainImage ? urlFor(post.mainImage).width(1200).url() : null;

    return (
        <article className="max-w-3xl mx-auto px-6 py-12">
            <SEO title={post.title} description={post.excerpt} image={imageUrl} />
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
                <Icon name="arrow-left" size={16} /> Back to Log
            </Link>

            {imageUrl && (
                <div className="w-full aspect-video bg-muted mb-8 overflow-hidden rounded-xl border border-border shadow-sm">
                    <img src={imageUrl} className="w-full h-full object-cover" alt={post.title} />
                </div>
            )}

            <div className="flex items-center gap-4 mb-6 text-sm">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">Log</span>
                <span className="text-muted-foreground">{dateString}</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-8 text-foreground">{post.title}</h1>

            <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-p:text-muted-foreground prose-a:text-primary border-l-2 border-primary/20 pl-6">
                <PortableText value={post.body} components={ptComponents} />
            </div>

            <ShareBar title={post.title} />
            <AuthorBio author={post.author} />
        </article>
    );
};

export const LabCard = ({ item }) => (
    <Card className={`p-6 flex flex-col h-full hover:shadow-md transition-all`}>
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold">{item.title}</h3>
            <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-semibold ${item.status.toLowerCase().includes('beta') ? 'bg-yellow-500/10 text-yellow-600' : 'bg-green-500/10 text-green-600'}`}>
                {item.status}
            </span>
        </div>
        <p className="text-muted-foreground text-sm mb-6 pt-4 border-t border-border flex-1">{item.desc}</p>
        <Link to={`/apps/${item.slug}`} className="w-full">
            <Button className="w-full gap-2" variant="default">
                <Icon name="flask-conical" size={16} /> Launch Tool
            </Button>
        </Link>
    </Card>
);