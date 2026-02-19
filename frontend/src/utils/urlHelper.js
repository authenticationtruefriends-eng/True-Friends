/**
 * Helper to ensure URLs are relative if they point to localhost.
 * This fixes the issue where mobile devices cannot load resources
 * that are hardcoded to 'localhost' in the database.
 */
export const getConstructedUrl = (url) => {
    if (!url) return '';

    // 1. Handle base64 or blob immediately
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    // Helper: Get Backend Origin
    const envUrl = import.meta.env.VITE_API_URL;
    const backendOrigin = envUrl ? envUrl.replace(/\/$/, "") : `${window.location.protocol}//${window.location.hostname}:5000`;

    try {
        // 2. Normalize Slashes (Windows fix)
        let cleanUrl = url.replace(/\\/g, '/');

        // 3. FIXED UPLOAD HANDLING:
        // Detect Cloudinary URLs and return directly
        if (cleanUrl.includes('cloudinary.com')) return cleanUrl;

        // Since Vite proxies /uploads to backend, we should ALWAYS return relative path
        // for uploads to avoid Port 5000 / IP Mismatch issues on mobile/LAN.
        if (cleanUrl.match(/\/uploads\/|uploads\//)) {
            // Ensure it starts with /uploads/
            const parts = cleanUrl.split(/uploads\//);
            const relativePath = parts[parts.length - 1]; // filename
            return `/uploads/${relativePath}`;
        }


        // 4. Handle standard absolute URLs
        if (cleanUrl.startsWith('http')) {
            const urlObj = new URL(cleanUrl);
            const isLocal =
                urlObj.hostname === 'localhost' ||
                urlObj.hostname === '127.0.0.1' ||
                urlObj.hostname.startsWith('192.168.') ||
                urlObj.hostname.startsWith('10.') ||
                urlObj.hostname.startsWith('172.') ||
                urlObj.port === '5000';

            if (isLocal) {
                // Return relative path if pathname starts with /uploads
                if (urlObj.pathname.startsWith('/uploads')) {
                    return urlObj.pathname;
                }
                // Otherwise use backendOrigin (This might still be issue for API calls if not proxied)
                // But for now, fixing uploads is priority.
                return backendOrigin + urlObj.pathname;
            }
            return cleanUrl;
        }

        // 5. Relative paths
        if (cleanUrl.startsWith('/')) {
            // For uploads, keep relative (Vite Proxied)
            if (cleanUrl.startsWith('/uploads/')) return cleanUrl;

            // For other API calls, maybe prepend backend? 
            // Actually, if we use proxy for everything, relative is safer.
            // But let's stick to fixing uploads first.
            return `${backendOrigin}${cleanUrl}`;
        }

        // 6. Just filename
        return `/uploads/${cleanUrl}`;


    } catch (e) {
        console.error("URL Construction Error:", e);
        return url;
    }
};

export const isExternalUrl = (url) => {
    if (!url) return false;

    // DiceBear is always external
    if (url.includes('dicebear.com')) return true;

    // Data/blob/relative are internal
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return false;

    // If it's a full http URL
    if (url.startsWith('http')) {
        // If it points to our current origin, it's NOT external (it's proxied)
        if (url.startsWith(window.location.origin)) return false;

        // If it points to a local IP or host, it's NOT external (it's our backend)
        const localPatterns = ['localhost', '127.0.0.1', '192.168.', '10.', '172.'];
        if (localPatterns.some(p => url.includes(p))) return false;

        return true;
    }

    return false;
};
