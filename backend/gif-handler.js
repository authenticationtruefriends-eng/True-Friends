import https from 'https';

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";

// Helper: Convert Tenor response to frontend format
export const convertTenorData = (tenorData) => ({
    data: (tenorData.results || []).map(item => ({
        id: item.id,
        title: item.content_description || 'GIF',
        images: {
            fixed_height: {
                url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || '',
                width: "200",
                height: "200"
            },
            original: {
                url: item.media_formats?.gif?.url || '',
                width: "400",
                height: "400"
            }
        }
    })),
    meta: { msg: "Powered by Tenor" }
});

// Helper: Generate local fallback
export const generateFallback = (q) => ({
    data: Array.from({ length: 20 }, (_, i) => ({
        id: `fallback-${i}`,
        title: `Fun Emoji ${i + 1}`,
        images: {
            fixed_height: {
                url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(q || 'happy')}-${i}&backgroundColor=transparent`,
                width: "100",
                height: "100"
            },
            original: {
                url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(q || 'happy')}-${i}&backgroundColor=transparent`,
                width: "100",
                height: "100"
            }
        }
    })),
    meta: { msg: "Local Fallback Emojis" }
});

// Helper: Fetch with timeout
export const fetchWithTimeout = (url, options, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), timeout);

        https.get(url, options, (response) => {
            clearTimeout(timer);
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve({ statusCode: response.statusCode, data }));
        }).on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
};

// Main handler with fallback chain
export async function handleGiphyRequest(req, res) {
    const { q, limit, type } = req.query;

    const searchFilter = (type === 'stickers' || type === 'sticker') ? '&searchfilter=sticker' : '';

    const searchEndpoint = q
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=${limit || 20}&media_filter=gif${searchFilter}`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=${limit || 20}&media_filter=gif${searchFilter}`;

    const options = {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        rejectUnauthorized: false,
        family: 4
    };

    // 🎯 FALLBACK CHAIN - Try sources in order until one works

    // SOURCE 1: Direct Tenor (fastest when network allows)
    try {
        console.log(`🎬 [1/3] Trying Direct Tenor: ${q || 'Featured'}`);
        const result = await fetchWithTimeout(searchEndpoint, options, 3000);

        if (result.statusCode >= 200 && result.statusCode < 300) {
            const tenorData = JSON.parse(result.data);
            if (tenorData.results && tenorData.results.length > 0) {
                console.log(`✅ Direct Tenor Success: ${tenorData.results.length} GIFs`);
                return res.json(convertTenorData(tenorData));
            }
        }
    } catch (e) {
        console.log(`⚠️ Direct Tenor failed: ${e.message}`);
    }

    // SOURCE 2: CORS Anywhere Proxy (bypasses most firewalls)
    try {
        console.log(`🎬 [2/3] Trying CORS Proxy...`);
        const proxyUrl = `https://cors-anywhere.herokuapp.com/${searchEndpoint}`;
        const result = await fetchWithTimeout(proxyUrl, options, 4000);

        if (result.statusCode >= 200 && result.statusCode < 300) {
            const tenorData = JSON.parse(result.data);
            if (tenorData.results && tenorData.results.length > 0) {
                console.log(`✅ CORS Proxy Success: ${tenorData.results.length} GIFs`);
                return res.json(convertTenorData(tenorData));
            }
        }
    } catch (e) {
        console.log(`⚠️ CORS Proxy failed: ${e.message}`);
    }

    // SOURCE 3: AllOrigins Proxy (backup)
    try {
        console.log(`🎬 [3/3] Trying AllOrigins Proxy...`);
        const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchEndpoint)}`;
        const result = await fetchWithTimeout(allOriginsUrl, options, 4000);

        if (result.statusCode >= 200 && result.statusCode < 300) {
            const tenorData = JSON.parse(result.data);
            if (tenorData.results && tenorData.results.length > 0) {
                console.log(`✅ AllOrigins Success: ${tenorData.results.length} GIFs`);
                return res.json(convertTenorData(tenorData));
            }
        }
    } catch (e) {
        console.log(`⚠️ AllOrigins failed: ${e.message}`);
    }

    // SOURCE 4: Local Fallback (always works)
    console.log(`🎨 All sources failed - Using Local Fallback`);
    res.json(generateFallback(q));
}
