import React from 'react';


export const COLORS = ['#000000', '#FEC43D', '#2563EB', '#999999', '#555555'];

// Matches ```json ... ``` or just ``` ... ``` blocks
// Using hex code \x60 for backticks to prevent file truncation/issues
export const JSON_REGEX = new RegExp('\x60\x60\x60(?:json)?\\s*([\\s\\S]*?)\x60\x60\x60', 'g');

export const cleanReportContent = (content) => {
    let shareData = [];
    let salesData = [];
    let ticker = null;
    let salesTitle = "Estimated Annual Sales (Billions)";
    let keyMetrics = null;
    let cleanText = content;

    const jsonMatch = JSON_REGEX.exec(content);

    // Method 1: Strict Regex Match (Preferred)
    if (jsonMatch && jsonMatch[1]) {
        try {
            const jsonData = JSON.parse(jsonMatch[1]);
            if (jsonData.market_share) shareData = jsonData.market_share;
            if (jsonData.annual_sales) salesData = jsonData.annual_sales;
            if (jsonData.ticker) ticker = jsonData.ticker;
            if (jsonData.sales_chart_title) salesTitle = jsonData.sales_chart_title;
            if (jsonData.key_metrics) keyMetrics = jsonData.key_metrics;

            cleanText = content.replace(jsonMatch[0], '');
        } catch (e) {
            console.error("Regex parse failed, trying fallback", e);
        }
    }

    // Method 2: Fallback Brute Force (Look for first { and last })
    if (!shareData.length && !salesData.length && content.includes('{')) {
        try {
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (end > start) {
                const potentialJson = content.substring(start, end + 1);
                // Simple validation to ensure it looks like our schema
                if (potentialJson.includes('market_share') || potentialJson.includes('annual_sales')) {
                    const jsonData = JSON.parse(potentialJson);
                    if (jsonData.market_share) shareData = jsonData.market_share;
                    if (jsonData.annual_sales) salesData = jsonData.annual_sales;
                    if (jsonData.ticker) ticker = jsonData.ticker;
                    if (jsonData.sales_chart_title) salesTitle = jsonData.sales_chart_title;
                    if (jsonData.key_metrics) keyMetrics = jsonData.key_metrics;

                    // Remove the raw JSON block
                    cleanText = content.replace(potentialJson, '');

                    // Also try to clean up any leftover backticks around it
                    cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
                }
            }
        } catch (e) {
            console.error("Fallback parse failed", e);
        }
    }

    // FIX: The AI sometimes generates markdown links with spaces in the URL (e.g. [Brand](analyze:Brand Name))
    // Standard markdown breaks on spaces in URLs. We need to encode them.
    cleanText = cleanText.replace(/\[([^\]]+)\]\((analyze:[^)]+)\)/g, (match, text, url) => {
        return `[${text}](${url.replace(/ /g, '%20')})`;
    });

    return {
        cleanText,
        shareData,
        salesData,
        ticker,
        salesTitle,
        keyMetrics
    };
};

export const getMarkdownComponents = (runAnalysis, currentBrand) => ({
    h1: ({ node, ...props }) => <h1 className="text-3xl font-bold tracking-tight mt-8 mb-4 border-b border-border pb-2 text-foreground" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold tracking-tight mt-8 mb-4 border-b border-border/50 pb-2 flex items-center gap-2 text-foreground" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-xl font-semibold tracking-tight mt-6 mb-3 text-foreground" {...props} />,
    p: ({ node, ...props }) => <p className="mb-4 leading-7 text-muted-foreground" {...props} />,
    ul: ({ node, ...props }) => <ul className="grid grid-cols-1 gap-2 list-none pl-0 mb-6" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-6 font-semibold space-y-2 text-foreground" {...props} />,
    li: ({ node, ...props }) => <li className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm hover:border-border transition-colors text-foreground" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-primary bg-muted/20 p-4 my-6 italic text-muted-foreground rounded-r-lg" {...props} />,
    strong: ({ node, ...props }) => <strong className="font-bold text-foreground" {...props} />,
    code: ({ node, inline, ...props }) => inline
        ? <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm text-primary font-semibold" {...props} />
        : <pre className="bg-muted text-foreground p-4 overflow-x-auto font-mono text-sm my-4 rounded-lg border border-border"><code {...props} /></pre>,
    a: ({ node, href, children, ...props }) => {
        if (href && href.startsWith('analyze:')) {
            const compName = href.replace('analyze:', '');
            return (
                <button
                    onClick={() => runAnalysis(compName, currentBrand)}
                    className="text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded font-semibold transition-colors cursor-pointer text-left inline-flex items-center gap-1 border border-transparent hover:border-primary/20"
                    title={`Run Strategy vs ${currentBrand}`}
                >
                    {children} ↗
                </button>
            );
        }
        return <a href={href} className="text-primary font-medium hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    }
});
