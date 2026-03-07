import React, { useState } from 'react';
import { SEO } from '../../seo-tools/SEOTags';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

export const HeadlineGenerator = ({ onBack }) => {
    const [topic, setTopic] = useState('');
    const [results, setResults] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!topic) return;
        setIsGenerating(true);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'headline', payload: { topic } })
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || "Server Error");
            if (data.result) setResults(data.result);
        } catch (err) {
            console.error(err);
            alert(`Error: ${err.message || "Failed to generate."}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <SEO title="Headline Generator" description="Turn boring topics into viral clickbait." />

            <div className="flex justify-between items-center mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                    <Icon name="arrow-left" size={18} /> Back to Lab
                </button>
            </div>

            <div className="mb-12 text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 border border-primary/20">
                    <Icon name="sparkles" size={14} /> BETA Free
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">Headline Generator</h1>
                <p className="text-xl text-muted-foreground">Turn boring topics into clickbait gold. Enter a topic to start.</p>
            </div>

            <Card className="mb-12 p-2 shadow-lg border-border/60 bg-card/50 backdrop-blur-sm max-w-2xl mx-auto">
                <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                        <Input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Walking dogs..."
                            name="topic"
                            id="headline-topic"
                            className="h-full px-4 py-3 bg-muted/30 border-transparent focus:border-primary/30 focus:bg-background transition-all"
                        />
                    </div>
                    <Button type="submit" isLoading={isGenerating} size="lg" className="px-8 font-bold text-base" icon="sparkles">
                        GENERATE
                    </Button>
                </form>
            </Card>

            <div className="space-y-4 max-w-2xl mx-auto">
                {results.map((title, idx) => (
                    <Card key={idx} className="flex justify-between items-center hover:bg-muted/50 transition-colors cursor-pointer group p-6 border-border/40" onClick={() => { navigator.clipboard.writeText(title); setCopiedIndex(idx) }}>
                        <span className="font-bold text-lg tracking-tight">{title}</span>
                        <div className="text-muted-foreground group-hover:text-primary transition-colors">
                            {copiedIndex === idx ? <Icon name="check" color="green" /> : <Icon name="copy" size={18} />}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
