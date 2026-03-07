import React, { useState, useRef } from 'react';
import { SEO } from '../../seo-tools/SEOTags';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export const AltTextFixer = ({ onBack }) => {
    const [image, setImage] = useState(null);
    const [result, setResult] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setImage(reader.result); setResult(''); };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!image) return;
        setIsGenerating(true);
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'alt-text', payload: { image } })
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
        <div className="max-w-3xl mx-auto px-4 py-12">
            <SEO title="Alt-Text Fixer" description="Generate SEO-friendly image descriptions." />

            <button onClick={onBack} className="flex items-center gap-2 font-mono font-bold mb-8 hover:text-blue-600 transition-colors">
                <Icon name="arrow-left" size={20} /> Back to Lab
            </button>

            <Card className="mb-8 bg-red-300">
                <h1 className="text-4xl font-black uppercase mb-2">Alt-Text Fixer</h1>
                <p className="font-mono font-bold mb-6">Upload an image. Get perfect SEO descriptions.</p>

                <div
                    className="bg-white border-2 border-black p-8 text-center border-dashed border-4 border-gray-200 hover:border-black transition-colors cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    onClick={() => fileInputRef.current.click()}
                >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" name="image-upload" id="alt-text-upload" />
                    {image ? (
                        <img src={image} className="max-h-64 mx-auto border-2 border-black" alt="Preview" />
                    ) : (
                        <div className="flex flex-col items-center text-gray-400">
                            <Icon name="upload" size={48} />
                            <p className="font-bold mt-2">Click to Upload Image</p>
                        </div>
                    )}
                </div>

                {image && (
                    <Button
                        onClick={handleGenerate}
                        isLoading={isGenerating}
                        className="w-full mt-4"
                        size="lg"
                    >
                        ANALYZE IMAGE
                    </Button>
                )}
            </Card>

            {result && (
                <Card>
                    <h3 className="font-black uppercase text-sm text-gray-500 mb-2">Generated Alt-Text:</h3>
                    <p className="font-mono text-xl font-bold">{result}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-4 pl-0 hover:bg-transparent"
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
