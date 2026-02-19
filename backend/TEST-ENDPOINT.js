// Quick test: Open this URL in your browser while backend is running:
// http://localhost:3000/api/giphy?q=happy&limit=5

// You should see JSON with either:
// 1. Real Tenor GIFs (if network allows)
// 2. Fun emoji fallback (if network blocks everything)

// If you see an error or nothing, there's a code issue.
// If you see the fallback emojis, the code works but your network blocks all GIF services.

console.log("Test the endpoint by visiting:");
console.log("http://localhost:3000/api/giphy?q=happy&limit=5");
console.log("\nIn your browser while the backend is running.");
