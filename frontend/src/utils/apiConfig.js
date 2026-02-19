export const getApiBase = () => {
    // 1. Allow runtime override (Critical for Hybrid/Local setups)
    const customUrl = localStorage.getItem("custom_api_url");
    if (customUrl) return customUrl.replace(/\/$/, "");

    // 2. Use VITE_API_URL set in Environment (Railway/Netlify)
    const envUrl = import.meta.env.VITE_API_URL;

    let finalUrl = "";
    if (envUrl) {
        finalUrl = envUrl.replace(/\/$/, "");
    }

    // Mixed Content Warning
    if (window.location.protocol === 'https:' && finalUrl.startsWith('http:')) {
        console.warn("⚠️ SECURITY WARNING: You are on HTTPS but the API is HTTP. This will be blocked!");
        console.warn("👉 Fix: Click 'Server Settings' and use your secure Tunnel URL (https://...).");
    }

    return finalUrl;
};

export const setApiBase = (url) => {
    if (!url) {
        localStorage.removeItem("custom_api_url");
    } else {
        localStorage.setItem("custom_api_url", url.trim().replace(/\/$/, ""));
    }
    // Force reload to apply
    window.location.reload();
};
