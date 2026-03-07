
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { UpdatesTimeline } from '../components/features/updates/UpdatesTimeline';

export const UpdatesPage = () => {
    return (
        <>
            <Helmet>
                <title>AI Changelog | AimLow AI</title>
                <meta name="description" content="Live timeline of updates from OpenAI, Anthropic, Google DeepMind, and Meta AI." />
            </Helmet>
            <UpdatesTimeline />
        </>
    );
};
