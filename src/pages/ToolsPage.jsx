import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ToolLibrary } from '../components/features/library/ToolLibrary';

export const ToolsPage = () => {
    return (
        <>
            <Helmet>
                <title>Trending AI Tools | AimLow AI</title>
                <meta name="description" content="Curated library of the best AI tools for music, writing, images, and productivity. Updated daily." />
            </Helmet>
            <ToolLibrary />
        </>
    );
};
