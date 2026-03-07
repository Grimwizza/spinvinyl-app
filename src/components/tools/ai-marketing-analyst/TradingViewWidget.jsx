import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { Card } from '../../ui/Card';

export const TradingViewWidget = ({ ticker }) => {
    const container = useRef();
    const { theme } = useTheme();

    useEffect(() => {
        // Basic cleanup of ticker for TradingView symbol format
        const symbol = ticker.replace(/\s/g, '').toUpperCase();

        // Ensure container is empty before appending script
        if (container.current) {
            container.current.innerHTML = "";
        }

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        // Use key to force re-render if theme changes? No, innerHTML clear handles it.
        script.innerHTML = `
      {
        "autosize": true,
        "symbol": "${symbol}",
        "interval": "W",
        "timezone": "Etc/UTC",
        "theme": "${theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'}",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "hide_top_toolbar": true,
        "allow_symbol_change": false,
        "save_image": false,
        "calendar": false,
        "hide_volume": true,
        "support_host": "https://www.tradingview.com"
      }`;

        if (container.current) {
            container.current.appendChild(script);
        }
    }, [ticker, theme]); // Re-run when ticker or theme changes

    return (
        <Card className="h-[400px] w-full mb-8 overflow-hidden break-inside-avoid shadow-sm border-border">
            <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
                <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }}></div>
            </div>
        </Card>
    );
};
