import React, { useState } from 'react';
import { 
    Menu, 
    X, 
    Twitter, 
    Github, 
    Mail, 
    FlaskConical, 
    ArrowLeft, 
    ArrowRight 
} from 'lucide-react';

// --- Icon Mapping ---
const iconMap = {
    menu: Menu,
    x: X,
    twitter: Twitter,
    github: Github,
    mail: Mail,
    'flask-conical': FlaskConical,
    'arrow-left': ArrowLeft,
    'arrow-right': ArrowRight
};

const Icon = ({ name, size = 24, color = "currentColor", className }) => {
    const LucideIcon = iconMap[name.toLowerCase()];
    if (!LucideIcon) return null;
    return <LucideIcon size={size} color={color} className={className} />;
};

// --- Mock Data ---
const INITIAL_POSTS = [
    {
        id: 1,
        title: "Why I Fired My Copywriter (Sort of)",
        excerpt: "Generative AI isn't replacing creativity, it's replacing the blank page. Here is how I use aim-low prompts to generate high-quality drafts.",
        category: "Philosophy",
        date: "Oct 24, 2025",
        color: "bg-yellow-300",
        image: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&auto=format&fit=crop&q=60",
        content: "Full content would go here. This represents the body of the article..."
    },
    {
        id: 2,
        title: "The 'Good Enough' Manifesto",
        excerpt: "Perfection is the enemy of shipped. How aiming low helps you ship products 10x faster using basic LLM wrappers.",
        category: "Strategy",
        date: "Oct 20, 2025",
        color: "bg-purple-300",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=60",
        content: "..."
    },
    {
        id: 3,
        title: "Building this Website in 4 Minutes",
        excerpt: "A meta-analysis of the code structure behind AimLow.ai. Spoiler: It is simpler than you think.",
        category: "Tech",
        date: "Oct 15, 2025",
        color: "bg-green-300",
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60",
        content: "..."
    }
];

const LAB_ITEMS = [
    {
        id: 1,
        title: "Headline Generator",
        desc: "Input a boring topic, get a clickbait title. Powered by a simple GPT wrapper.",
        status: "Live",
        color: "bg-blue-300"
    },
    {
        id: 2,
        title: "Image Alt-Text Fixer",
        desc: "Drag and drop images to automatically generate SEO-friendly alt text.",
        status: "Beta",
        color: "bg-red-300"
    },
    {
        id: 3,
        title: "The Jargon Destroyer",
        desc: "Past corporate speak, get plain English. Aim low, speak clearly.",
        status: "Planned",
        color: "bg-gray-300"
    }
];

// --- Components ---

const Header = ({ setView, currentView }) => (
    <header className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setView('home')}
            >
                <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-bold text-xl border-2 border-transparent group-hover:border-black group-hover:bg-white group-hover:text-black transition-colors">
                    AL
                </div>
                <h1 className="text-2xl font-black tracking-tighter uppercase">AimLow<span className="text-blue-600">.ai</span></h1>
            </div>
            
            <nav className="hidden md:flex gap-6 font-mono font-bold text-sm">
                <button 
                    onClick={() => setView('blog')}
                    className={`hover:underline decoration-2 underline-offset-4 ${currentView === 'blog' ? 'text-blue-600' : ''}`}
                >
                    THE LOG
                </button>
                <button 
                    onClick={() => setView('lab')}
                    className={`hover:underline decoration-2 underline-offset-4 ${currentView === 'lab' ? 'text-blue-600' : ''}`}
                >
                    THE LAB
                </button>
            </nav>

            <button className="md:hidden">
                <Icon name="menu" />
            </button>
        </div>
    </header>
);

const Hero = () => (
    <section className="bg-[#FEC43D] border-b-4 border-black py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block bg-white border-2 border-black px-4 py-1 font-mono text-sm mb-6 brutal-shadow">
                EST. 2025 // HUMAN-AI HYBRID
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.9] mb-6 uppercase">
                Do More <br/> With Less.
            </h2>
            <p className="text-xl font-mono max-w-2xl mx-auto mb-8 font-bold">
                We test the tools so you don't have to. Low effort, high impact AI workflows for the rest of us.
            </p>
            <div className="flex justify-center gap-4">
                <button className="bg-black text-white border-2 border-black px-8 py-3 font-bold hover:bg-white hover:text-black transition-colors brutal-shadow">
                    READ THE LOG
                </button>
                <button className="bg-white text-black border-2 border-black px-8 py-3 font-bold hover:bg-gray-100 transition-colors brutal-shadow">
                    ENTER THE LAB
                </button>
            </div>
        </div>
    </section>
);

const BlogCard = ({ post, onClick }) => (
    <article 
        onClick={() => onClick(post)}
        className="brutal-card flex flex-col h-full brutal-shadow cursor-pointer hover:-translate-y-1 transition-transform"
    >
        <div className="h-48 overflow-hidden border-b-3 border-black relative group">
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity z-10"></div>
            <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
            <div className={`absolute top-4 right-4 ${post.color} border-2 border-black px-3 py-1 font-mono text-xs font-bold z-20`}>
                {post.category}
            </div>
        </div>
        <div className="p-6 flex-1 flex flex-col">
            <div className="font-mono text-xs text-gray-500 mb-2">{post.date}</div>
            <h3 className="text-2xl font-black leading-tight mb-4 uppercase">{post.title}</h3>
            <p className="font-serif text-sm leading-relaxed mb-6 flex-1">{post.excerpt}</p>
            <div className="flex items-center gap-2 font-bold text-sm mt-auto group">
                Read Post <Icon name="arrow-right" size={16} />
            </div>
        </div>
    </article>
);

const LabCard = ({ item }) => (
    <div className={`brutal-card p-6 ${item.color} brutal-shadow`}>
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-black uppercase">{item.title}</h3>
            <span className="bg-black text-white text-xs px-2 py-1 font-mono">{item.status}</span>
        </div>
        <p className="font-bold mb-6 border-t-2 border-black pt-4">{item.desc}</p>
        <button className="w-full bg-white border-2 border-black py-2 font-bold hover:bg-black hover:text-white transition-colors">
            LAUNCH TOOL
        </button>
    </div>
);

const AdminPanel = ({ isOpen, onClose, onAddPost }) => {
    if (!isOpen) return null;
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onAddPost({
            title,
            excerpt,
            category: 'Update',
            date: new Date().toLocaleDateString(),
            color: 'bg-pink-300',
            image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60'
        });
        setTitle('');
        setExcerpt('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black uppercase">New Post</h2>
                    <button onClick={onClose}><Icon name="x" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block font-mono font-bold text-sm mb-1">Title</label>
                        <input 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full border-2 border-black p-2 font-bold focus:outline-none focus:bg-yellow-100"
                            placeholder="Enter catchy title..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block font-mono font-bold text-sm mb-1">Excerpt</label>
                        <textarea 
                            value={excerpt}
                            onChange={e => setExcerpt(e.target.value)}
                            className="w-full border-2 border-black p-2 font-bold focus:outline-none focus:bg-yellow-100 h-32"
                            placeholder="What's this about?"
                            required
                        ></textarea>
                    </div>
                    <button type="submit" className="w-full bg-black text-white py-3 font-bold hover:bg-blue-600 transition-colors">
                        PUBLISH TO FEED
                    </button>
                </form>
            </div>
        </div>
    );
};

function App() {
    const [view, setView] = useState('home');
    const [posts, setPosts] = useState(INITIAL_POSTS);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);

    const handleAddPost = (newPost) => {
        setPosts([
            { ...newPost, id: Date.now() },
            ...posts
        ]);
    };

    const handlePostClick = (post) => {
        setSelectedPost(post);
        setView('post');
        window.scrollTo(0,0);
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header setView={setView} currentView={view} />
            
            <main className="flex-1">
                {view === 'home' && (
                    <>
                        <Hero />
                        <section className="max-w-6xl mx-auto px-4 py-16">
                            <div className="flex justify-between items-end mb-12 border-b-2 border-black pb-4">
                                <h2 className="text-4xl font-black uppercase">Recent Logs</h2>
                                <button onClick={() => setView('blog')} className="font-mono font-bold underline decoration-2">View All</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {posts.slice(0, 3).map(post => (
                                    <BlogCard key={post.id} post={post} onClick={handlePostClick} />
                                ))}
                            </div>
                        </section>
                        <section className="bg-black text-white py-16 px-4 border-y-4 border-black">
                            <div className="max-w-6xl mx-auto">
                                <h2 className="text-4xl font-black uppercase mb-12 text-center text-[#FEC43D]">Lab Experiments</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {LAB_ITEMS.map(item => (
                                        <LabCard key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {view === 'blog' && (
                    <div className="max-w-6xl mx-auto px-4 py-12">
                        <h2 className="text-6xl font-black uppercase mb-12 text-center">The Log</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {posts.map(post => (
                                <BlogCard key={post.id} post={post} onClick={handlePostClick} />
                            ))}
                        </div>
                    </div>
                )}

                {view === 'lab' && (
                    <div className="max-w-6xl mx-auto px-4 py-12">
                        <h2 className="text-6xl font-black uppercase mb-12 text-center">The Lab</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {LAB_ITEMS.map(item => (
                                <LabCard key={item.id} item={item} />
                            ))}
                            <div className="brutal-card border-dashed border-4 border-gray-300 p-8 flex items-center justify-center min-h-[300px]">
                                <div className="text-center text-gray-400">
                                    <Icon name="flask-conical" size={48} className="mx-auto mb-4"/>
                                    <p className="font-mono font-bold">More experiments cooking...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'post' && selectedPost && (
                    <article className="max-w-3xl mx-auto px-4 py-12">
                        <button onClick={() => setView('blog')} className="flex items-center gap-2 font-mono font-bold mb-8 hover:text-blue-600">
                            <Icon name="arrow-left" size={20} /> Back to Log
                        </button>
                        <div className="w-full aspect-video bg-gray-200 border-2 border-black mb-8 overflow-hidden rounded-none">
                            <img src={selectedPost.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center gap-4 mb-6 font-mono text-sm">
                            <span className={`px-3 py-1 border-2 border-black font-bold ${selectedPost.color}`}>{selectedPost.category}</span>
                            <span className="text-gray-500">{selectedPost.date}</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase leading-none mb-8">{selectedPost.title}</h1>
                        <div className="prose prose-lg font-serif border-l-4 border-[#FEC43D] pl-6">
                            <p className="text-xl font-bold mb-6">{selectedPost.excerpt}</p>
                            <p>{selectedPost.content}</p>
                            <p className="mt-6">This is where the rest of the markdown content would be rendered. Since aimlow.ai is about efficiency, imagine a perfectly generated article here that solves your problem in under 3 minutes reading time.</p>
                        </div>
                    </article>
                )}
            </main>

            <footer className="bg-white border-t-4 border-black py-12 mt-12">
                <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <h3 className="text-2xl font-black uppercase">AimLow<span className="text-blue-600">.ai</span></h3>
                        <p className="font-mono text-sm text-gray-500 mt-2">© 2025 Aim Low, Inc.</p>
                    </div>
                    <div className="flex gap-4">
                        <a href="#" className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"><Icon name="twitter" size={20} /></a>
                        <a href="#" className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"><Icon name="github" size={20} /></a>
                        <a href="#" className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"><Icon name="mail" size={20} /></a>
                    </div>
                    <button 
                        onClick={() => setIsAdminOpen(true)}
                        className="font-mono text-xs font-bold text-gray-400 hover:text-black"
                    >
                        ADMIN LOGIN
                    </button>
                </div>
            </footer>

            <AdminPanel 
                isOpen={isAdminOpen} 
                onClose={() => setIsAdminOpen(false)} 
                onAddPost={handleAddPost}
            />
        </div>
    );
}

export default App;