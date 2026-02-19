import https from 'https';

console.log('🧪 Testing Tenor API after DNS change...\n');

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";
const testUrl = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=3&media_filter=gif`;

const options = {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    rejectUnauthorized: false,
    family: 4
};

console.log('Testing Direct Tenor Connection...');
console.log('URL:', testUrl);
console.log('');

const startTime = Date.now();

https.get(testUrl, options, (res) => {
    const elapsed = Date.now() - startTime;
    console.log(`✅ Connection Status: ${res.statusCode} (${elapsed}ms)`);

    let data = '';
    res.on('data', (chunk) => data += chunk);

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(`✅ Response is Valid JSON`);
            console.log(`✅ GIFs Found: ${json.results?.length || 0}`);

            if (json.results && json.results.length > 0) {
                console.log(`\n📸 Sample GIF:`);
                console.log(`   Title: ${json.results[0].content_description}`);
                console.log(`   URL: ${json.results[0].media_formats?.gif?.url}`);
                console.log(`\n🎉 SUCCESS! Tenor API is now working on your home WiFi!`);
                console.log(`   Real GIFs should now appear in your app!`);
            } else {
                console.log(`\n⚠️  API responded but no results found.`);
            }
        } catch (e) {
            console.error(`❌ Parse Error:`, e.message);
            console.log(`   Response was not valid JSON (might be HTML block page)`);
        }
    });

}).on('error', (err) => {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Connection Failed (${elapsed}ms): ${err.message}`);
    console.error(`   Code: ${err.code}`);

    if (err.code === 'ETIMEDOUT') {
        console.log(`\n⚠️  Still blocked. Try these steps:`);
        console.log(`   1. Make sure you clicked "Save" in DNS settings`);
        console.log(`   2. Disconnect and reconnect to WiFi`);
        console.log(`   3. Run: ipconfig /flushdns`);
        console.log(`   4. Restart your computer (if above doesn't work)`);
    }
});
