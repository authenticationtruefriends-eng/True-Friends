import https from 'https';
import http from 'http';
import dns from 'dns';

const API_KEY = "uwxLBqJk73AbDKAPltLjSddu73pu5naL";
const HOST = "api.giphy.com"; // Standard HOST without protocol
const PATH = `/v1/gifs/trending?api_key=${API_KEY}&limit=1`;
const GIPHY_URL = `https://${HOST}${PATH}`; // Full URL

console.log("🔍 deeply analyzing network connections & Proxy Bypasses...");
console.log("---------------------------------------------------");

// Helper to wrap requests in Promise
function checkUrl(url, label) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };

        console.log(`Testing ${label}...`);
        const req = protocol.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const success = res.statusCode >= 200 && res.statusCode < 300;
                console.log(`   [${label}] Status: ${res.statusCode} ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
                if (success && data.length > 100) console.log(`   [${label}] Data received (seems valid JSON)`);
                resolve(success);
            });
        });

        req.on('error', (e) => {
            console.log(`   [${label}] ERROR: ${e.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`   [${label}] TIMEOUT`);
            resolve(false);
        });
    });
}

async function runDiagnostics() {
    // 1. Direct DNS
    const dnsPromise = new Promise(resolve => dns.lookup(HOST, (err, addr) => {
        if (err) console.log(`[DNS] Failed: ${err.code}`);
        else console.log(`[DNS] Resolved: ${addr}`);
        resolve();
    }));
    await dnsPromise;

    // 2. Direct HTTP/HTTPS
    await checkUrl(GIPHY_URL, "Direct HTTPS (Standard)");
    await checkUrl(`http://${HOST}${PATH}`, "Direct HTTP (Port 80)");

    // 3. Known Public Proxies
    console.log("\n--- Scanning for Bypass Tunnels ---");
    const proxies = [
        { name: "CorsProxy.io", url: `https://corsproxy.io/?${encodeURIComponent(GIPHY_URL)}` },
        { name: "AllOrigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(GIPHY_URL)}` },
        { name: "ThingProxy", url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(GIPHY_URL)}` },
        { name: "CodeTabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(GIPHY_URL)}` },
        { name: "CorsAnywhere (Heroku Demo)", url: `https://cors-anywhere.herokuapp.com/${GIPHY_URL}` }
    ];

    for (const p of proxies) {
        const works = await checkUrl(p.url, p.name);
        if (works) {
            console.log(`\n🎉 FOUND WORKING TUNNEL: ${p.name}`);
            console.log(`   We can use this proxy to fix your app immediately!`);
            return;
        }
    }

    console.log("\n❌ NO WORKING BYPASS FOUND.");
    console.log("   Your network is blocking all known proxies.");
    console.log("   VPN is the only solution.");
}

runDiagnostics();
