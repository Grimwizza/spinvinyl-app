import React, { useState } from 'react';
import { SEO } from '../../seo-tools/SEOTags';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export const ContentSimplifier = ({ onBack }) => {
    const [text, setText] = useState('');
    const [result, setResult] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!text) return;
        setIsGenerating(true);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'jargon-destroyer', payload: { text } })
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || "Server Error");
            if (data.result) setResult(data.result);
        } catch (err) {
            console.error(err);
            alert(`Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <SEO title="Content Simplifier" description="Translate corporate speak into plain English." />

            <div className="flex justify-between items-center mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                    <Icon name="arrow-left" size={18} /> Back to Lab
                </button>
            </div>

            <div className="mb-12 text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 border border-primary/20">
                    <Icon name="sparkles" size={14} /> BETA Free
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">Content Simplifier</h1>
                <p className="text-xl text-muted-foreground">Paste corporate fluff. Get the truth in plain English.</p>
            </div>

            <Card className="mb-12 p-1 shadow-lg border-border/60 bg-card/50 backdrop-blur-sm">
                <form onSubmit={handleGenerate} className="p-4 flex flex-col gap-4">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full h-40 text-lg p-4 rounded-lg bg-muted/30 border-transparent focus:border-primary/30 focus:bg-background transition-all focus:outline-none resize-none text-foreground placeholder:text-muted-foreground leading-relaxed"
                        placeholder="e.g. We need to leverage our synergies to facilitate a paradigm shift..."
                        name="jargon-text"
                        id="jargon-input"
                    ></textarea>
                    <Button
                        type="submit"
                        isLoading={isGenerating}
                        size="lg"
                        className="w-full font-bold text-base py-6 shadow-md"
                        icon="zap"
                    >
                        SIMPLIFY CONTENT
                    </Button>
                </form>
            </Card>

            {result && (
                <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-8 border-primary/20 bg-primary/5">
                    <h3 className="font-bold uppercase text-xs text-primary/70 mb-4 tracking-widest">Simplified Content:</h3>
                    <p className="text-2xl font-semibold tracking-tight text-foreground leading-tight">{result}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-6 pl-0 hover:bg-transparent text-primary hover:text-primary/80 gap-2"
                        onClick={() => navigator.clipboard.writeText(result)}
                        icon="copy"
                    >
                        Copy to Clipboard
                    </Button>
                </Card>
            )}
        </div>
    );
};
