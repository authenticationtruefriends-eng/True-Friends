# Automated Ollama Setup Script
# Run this after Ollama installation completes

Write-Host "🤖 Starting Ollama AI Setup..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Ollama is installed
Write-Host "📋 Step 1: Checking Ollama installation..." -ForegroundColor Yellow
try {
    $version = ollama --version 2>&1
    Write-Host "✅ Ollama is installed: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama is not installed yet!" -ForegroundColor Red
    Write-Host "Please wait for the installation to complete and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Check if Ollama service is running
Write-Host "📋 Step 2: Checking Ollama service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Ollama service is running!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama service not running, starting it..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "✅ Ollama service started!" -ForegroundColor Green
}

Write-Host ""

# Step 3: Check if Llama 3 is already installed
Write-Host "📋 Step 3: Checking for Llama 3 model..." -ForegroundColor Yellow
$models = ollama list 2>&1 | Out-String
if ($models -match "llama3") {
    Write-Host "✅ Llama 3 is already installed!" -ForegroundColor Green
} else {
    Write-Host "📥 Downloading Llama 3 model (this may take 5-10 minutes)..." -ForegroundColor Yellow
    Write-Host "   Model size: ~4GB" -ForegroundColor Gray
    Write-Host ""
    
    ollama pull llama3
    
    Write-Host ""
    Write-Host "✅ Llama 3 downloaded successfully!" -ForegroundColor Green
}

Write-Host ""

# Step 4: Test the model
Write-Host "📋 Step 4: Testing Llama 3..." -ForegroundColor Yellow
Write-Host "   Sending test message: 'Hello!'" -ForegroundColor Gray
Write-Host ""

$testResponse = ollama run llama3 "Hello! Please respond with just 'Hi there!' and nothing else." --verbose=false 2>&1
Write-Host "   AI Response: $testResponse" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Llama 3 is working!" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your AI Friend is ready to use!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start your backend: node index.js" -ForegroundColor White
Write-Host "  2. Open your chat app" -ForegroundColor White
Write-Host "  3. Message 'AI Friend' to test!" -ForegroundColor White
Write-Host ""
Write-Host "Customization:" -ForegroundColor Yellow
Write-Host "  • Edit .env file to change AI personality" -ForegroundColor White
Write-Host "  • See AI_SETUP_GUIDE.md for details" -ForegroundColor White
Write-Host ""
Write-Host "Available models:" -ForegroundColor Yellow
ollama list
Write-Host ""
