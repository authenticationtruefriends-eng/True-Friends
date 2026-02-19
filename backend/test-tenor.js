import https from 'https';

console.log('🧪 Testing Tenor API Connection...\n');

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";
const testUrl = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=5&media_filter=gif`;

const options = {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    rejectUnauthorized: false,
    family: 4
};

https.get(testUrl, options, (res) => {
    console.log(`✅ Connection Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => data += chunk);

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(`✅ Response Valid JSON`);
            console.log(`✅ Results Found: ${json.results?.length || 0}`);

            if (json.results && json.results.length > 0) {
                console.log(`\n📸 Sample GIF:`);
                console.log(`   Title: ${json.results[0].content_description}`);
                console.log(`   URL: ${json.results[0].media_formats?.gif?.url}`);
                console.log(`\n🎉 SUCCESS! Tenor API is working!`);
            }
        } catch (e) {
            console.error(`❌ Parse Error:`, e.message);
        }
    });

}).on('error', (err) => {
    console.error(`❌ Connection Failed: ${err.message}`);
    console.error(`   Code: ${err.code}`);
    console.error(`\n⚠️  If this fails, Tenor is also blocked by your network.`);
});
