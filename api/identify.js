// Fast/cheap vision-extraction task — reading text off a cover, not deep reasoning.
// Trivially swappable to a stronger model if accuracy on hard-to-read covers becomes an issue.
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You identify vinyl records from a photograph of their album cover, sleeve, or label. Look for artist name and album/release title text. Respond with ONLY a JSON object: {"artist": "...", "title": "..."}. Use null for a field you cannot read with reasonable confidence. Do not guess — an incorrect answer is worse than null. No markdown, no code fences, no explanation — JSON only.`;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Read fresh per-request, not as a module-level const — vite-api-proxy.js caches this
    // module after the first import, so a top-level const would freeze whatever value
    // process.env had at that first call and never see later .env edits.
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in environment.' });
    }

    let payload = {};
    if (typeof req.body === 'string') {
        try { payload = JSON.parse(req.body); } catch { /* ignore */ }
    } else if (req.body) {
        payload = req.body;
    }

    const { image } = payload;
    if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Missing image' });
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
        return res.status(400).json({ error: 'Invalid image data URL' });
    }
    const [, mediaType, base64Data] = match;

    try {
        console.log('[Identify] Calling Anthropic vision API');
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 256,
                system: SYSTEM_PROMPT,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
                        { type: 'text', text: 'Identify this record. JSON only.' },
                    ],
                }],
            }),
        });

        if (!anthropicRes.ok) {
            console.warn('[Identify] Anthropic API error:', anthropicRes.status, await anthropicRes.text());
            return res.status(502).json({ error: 'Vision API request failed' });
        }

        const data = await anthropicRes.json();

        if (data.stop_reason === 'refusal') {
            console.warn('[Identify] Model refused the request');
            return res.status(200).json({ artist: null, title: null });
        }

        const textBlock = (data.content || []).find(b => b.type === 'text');
        const raw = textBlock?.text?.trim() || '';

        let parsed;
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        } catch {
            console.warn('[Identify] Failed to parse model output as JSON:', raw);
            return res.status(200).json({ artist: null, title: null });
        }

        const artist = typeof parsed.artist === 'string' && parsed.artist.trim() ? parsed.artist.trim() : null;
        const title  = typeof parsed.title  === 'string' && parsed.title.trim()  ? parsed.title.trim()  : null;

        return res.status(200).json({ artist, title });
    } catch (error) {
        console.error('[Identify] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
