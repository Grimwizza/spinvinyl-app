import React from 'react';
import { Icon } from '../ui/Icon';

import { Newsletter } from '../Newsletter';

export const Footer = () => (
    <footer className="bg-background border-t border-border py-12 mt-12 block w-full">
        <div className="max-w-[1400px] mx-auto px-6">
            <Newsletter />
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <h3 className="text-xl font-bold tracking-tight uppercase">AimLow<span className="text-primary">.ai</span></h3>
                    <p className="text-sm text-muted-foreground mt-2">© 2025 Aim Low, Inc.</p>
                </div>
                <div className="flex gap-4">
                    <a href="https://x.com/aimlow.ai" className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Icon name="twitter" size={18} />
                    </a>
                    <a href="https://facebook.com/aimlow.ai" className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Icon name="facebook" size={18} />
                    </a>
                    <a href="mailto:do_more@aimlow.ai" className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Icon name="mail" size={18} />
                    </a>
                </div>
                <a href="https://aimlow.sanity.studio" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Admin Login
                </a>
            </div>
        </div>
    </footer>
);
