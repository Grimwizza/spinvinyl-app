import ParticleBackground from '../ui/ParticleBackground';
import { Link } from 'react-router-dom';

export const Hero = () => (
    <section className="bg-black border-b border-white/10 py-24 px-4 relative overflow-hidden min-h-[600px] flex items-center">
        {/* Interactive 3D Background */}
        <div className="absolute inset-0 z-0 opacity-60">
            <ParticleBackground />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10 pointer-events-none">
            <div className="pointer-events-auto inline-flex items-center gap-2 bg-white/10 border border-white/10 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 backdrop-blur-sm text-gray-200 shadow-sm">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                EST. 2025 // HUMAN-AI HYBRID
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-white uppercase drop-shadow-sm">
                AimLow<span className="text-primary">.ai</span>
            </h1>

            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent pb-2">
                Do More <br /> With Less.
            </h2>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
                The latest AI news, content, and tools curated to help you maximize your output with minimal effort.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pointer-events-auto">
                <Link to="/feed" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                    Read News Feed
                </Link>
                <Link to="/tools" className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 bg-white/5 px-8 text-sm font-medium shadow-sm transition-colors hover:bg-white/10 text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 backdrop-blur-sm">
                    Try AI Tools
                </Link>
            </div>
        </div>
    </section>
);
