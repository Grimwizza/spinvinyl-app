import React from 'react';
import { Helmet } from 'react-helmet-async';

export const SEO = ({ title, description, image, url }) => {
    // Default values if specific ones aren't provided
    const siteTitle = "AimLow.ai";
    const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} - Do More With Less`;
    const metaDesc = description || "We test the tools so you don't have to. Low effort, high impact AI workflows.";
    const metaImage = image || "https://aimlow.ai/og-image.jpg"; 
    const metaUrl = url || "https://aimlow.ai";

    return (
        <Helmet>
            {/* Standard Metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDesc} />
            <link rel="canonical" href={metaUrl} />

            {/* Facebook / LinkedIn (Open Graph) */}
            <meta property="og:type" content="website" />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDesc} />
            <meta property="og:image" content={metaImage} />
            <meta property="og:url" content={metaUrl} />

            {/* Twitter Cards */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDesc} />
            <meta name="twitter:image" content={metaImage} />
        </Helmet>
    );
};