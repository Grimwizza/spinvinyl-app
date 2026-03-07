import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';

import { ThemeToggle } from '../theme/ThemeToggle';

export const Logo = () => {
    const [error, setError] = useState(false);
    if (error) return <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl rounded-lg">AL</div>;
    return <img src="/logo.png" alt="AimLow Logo" className="h-10 w-auto object-contain dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" onError={() => setError(true)} />;
};

export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    return (
        <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
            <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
                <Link to="/" className="flex items-center gap-3 cursor-pointer group">
                    <Logo />
                    <h1 className="text-xl font-bold tracking-tight uppercase dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">AimLow<span className="text-primary">.ai</span></h1>
                </Link>
                <div className="flex items-center gap-6">
                    <nav className="hidden md:flex gap-8 font-medium text-sm text-muted-foreground">

                        <Link to="/tools" className="hover:text-foreground transition-colors">Trending AI Tools</Link>
                        <Link to="/feed" className="hover:text-foreground transition-colors">AI News Feed</Link>
                        <Link to="/updates" className="hover:text-foreground transition-colors">AI Changelog</Link>
                        <Link to="/apps/ai-hyperscale-map" className="hover:text-foreground transition-colors">AI Hyperscale Map</Link>
                        <Link to="/apps" className="hover:text-foreground transition-colors">AimLow Apps</Link>
                    </nav>
                    <div className="hidden md:block w-px h-6 bg-border"></div>
                    <ThemeToggle />
                    <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <Icon name="x" /> : <Icon name="menu" />}
                    </button>
                </div>
            </div>
            {isMenuOpen && (
                <div className="md:hidden border-b border-border bg-background absolute w-full left-0 shadow-lg p-6 animate-in">
                    <nav className="flex flex-col gap-6 font-medium text-lg">

                        <Link to="/tools" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">Trending AI Tools</Link>
                        <Link to="/feed" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">AI News Feed</Link>
                        <Link to="/updates" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">AI Changelog</Link>
                        <Link to="/apps/ai-hyperscale-map" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">AI Hyperscale Map</Link>
                        <Link to="/apps" onClick={() => setIsMenuOpen(false)} className="hover:text-primary">AimLow Apps</Link>
                    </nav>
                </div>
            )}
        </header>
    );
};
