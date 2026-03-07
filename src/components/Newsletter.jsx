import React, { useState } from 'react';
import { Mail, Check, Loader2, Unlock } from 'lucide-react';

export const Newsletter = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) return;
        setStatus('loading');

        try {
            // Reuse the existing subscribe API (Google Sheets)
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) throw new Error('Failed to join');

            // CRITICAL: Grant Beta Access locally so tools unlock immediately
            localStorage.setItem('aimlow_beta_access', 'granted');

            setStatus('success');
            setEmail('');
        } catch (error) {
            console.error(error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row items-center gap-12 bg-secondary/5 border border-border rounded-xl p-8 md:p-12 mb-12">

                {/* Left: The Pitch */}
                <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                        Unlock Pro Tools & <br /> Join the Newsletter.
                    </h2>
                    <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto md:mx-0">
                        Join the Beta Program today. Get unlimited access to our "AI Marketing Analyst" and future premium tools while we build.
                    </p>
                </div>

                {/* Right: The Form */}
                <div className="flex-1 w-full max-w-md">
                    {status === 'success' ? (
                        <div className="bg-primary text-primary-foreground p-8 rounded-xl text-center shadow-lg animate-in">
                            <Check size={48} className="mx-auto mb-4" />
                            <h3 className="text-2xl font-bold">Access Granted.</h3>
                            <p className="mt-2 text-primary-foreground/90">Welcome to the Beta. Your tools are unlocked.</p>
                        </div>
                    ) : (
                        <div className="bg-background text-card-foreground p-6 rounded-xl border border-border shadow-sm">
                            <form onSubmit={handleSubmit} className="relative">
                                <label htmlFor="beta-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">Email Address</label>
                                <div className="flex flex-col gap-4">
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                        <input
                                            type="email"
                                            id="beta-email"
                                            name="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="flex h-12 w-full rounded-md border border-input bg-background/50 px-3 py-1 pl-10 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-12 px-8"
                                    >
                                        {status === 'loading' ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><Unlock size={18} /> Join Beta</span>}
                                    </button>
                                </div>

                                {status === 'error' && (
                                    <p className="absolute -bottom-8 left-0 w-full text-center font-medium text-destructive text-sm">
                                        Something went wrong. Try again.
                                    </p>
                                )}
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};