import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    
    const { url } = req.query;
    if (!url || !url.startsWith('https://upcomingvinyl.com/record/')) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SpinVinyl/1.0 +https://aimlow.ai',
                'Accept': 'text/html',
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) throw new Error('Failed to fetch detail page');

        const html = await response.text();
        const $ = cheerio.load(html);

        const description = $('.item.description .desc').text().trim();
        
        const tracklist = [];
        $('.tracklist li span').each((_, el) => {
            tracklist.push($(el).text().trim());
        });

        return res.status(200).json({ description, tracklist });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
