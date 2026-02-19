# Local AI Assistant - Installation & Customization Guide

## 🚀 Quick Start

### Step 1: Install Ollama

**Windows:**

1. Download Ollama from: <https://ollama.ai/download>
2. Run the installer
3. Ollama will start automatically

**Verify installation:**

```powershell
ollama --version
```

### Step 2: Download AI Model

```powershell
# Download Llama 3 (recommended, ~4GB)
ollama pull llama3

# Or choose a different model:
ollama pull mistral      # Fast and efficient
ollama pull phi3         # Lightweight, good for low-end hardware
ollama pull gemma        # Google's open model
```

### Step 3: Verify Ollama is Running

```powershell
# Check if Ollama is running
ollama list

# Test the model
ollama run llama3 "Hello, how are you?"
```

### Step 4: Start Your Backend

```powershell
cd backend
node index.js
```

### Step 5: Test AI Friend

Open your chat app and message "AI Friend" - it should respond using your local AI!

---

## 🎨 Customization Options

### Change AI Model

Edit `.env` file:

```env
AI_MODEL=llama3        # Default
# AI_MODEL=mistral     # Faster responses
# AI_MODEL=phi3        # Lightweight
# AI_MODEL=gemma       # Alternative
```

**Available models:** Run `ollama list` to see what you have installed.

### Adjust Creativity (Temperature)

```env
AI_TEMPERATURE=0.7     # Default (balanced)
# AI_TEMPERATURE=0.3   # More focused, consistent
# AI_TEMPERATURE=0.9   # More creative, varied
```

- **0.0-0.3:** Focused, deterministic, consistent
- **0.4-0.7:** Balanced (recommended)
- **0.8-1.0:** Creative, unpredictable, varied

### Control Response Length

```env
AI_MAX_TOKENS=500      # Default
# AI_MAX_TOKENS=200    # Shorter responses
# AI_MAX_TOKENS=1000   # Longer, detailed responses
```

### Customize AI Personality

Edit the `AI_SYSTEM_PROMPT` in `.env`:

**Example 1: Professional Assistant**

```env
AI_SYSTEM_PROMPT=You are a professional AI assistant. Provide clear, concise, and formal responses. Avoid emojis. Be helpful and efficient.
```

**Example 2: Casual Friend**

```env
AI_SYSTEM_PROMPT=You're a chill friend who loves to chat! Use lots of emojis 😄, be super casual, and keep things fun and light. Don't be too formal!
```

**Example 3: Technical Expert**

```env
AI_SYSTEM_PROMPT=You are a technical expert specializing in programming and technology. Provide detailed, accurate technical information. Use code examples when helpful.
```

**Example 4: Motivational Coach**

```env
AI_SYSTEM_PROMPT=You are an enthusiastic motivational coach! Be positive, encouraging, and inspiring. Help users achieve their goals with uplifting advice! 💪🌟
```

---

## 🔧 Advanced Configuration

### Change Ollama Server URL

If running Ollama on a different machine:

```env
OLLAMA_URL=http://192.168.1.100:11434
```

### Install Multiple Models

```powershell
# Install different models for different purposes
ollama pull llama3        # General purpose
ollama pull codellama     # Code assistance
ollama pull mistral       # Fast responses
```

Switch between them by changing `AI_MODEL` in `.env`.

---

## 📊 Model Comparison

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **llama3** | 4GB | Medium | Excellent | General chat, best quality |
| **mistral** | 4GB | Fast | Very Good | Quick responses |
| **phi3** | 2GB | Very Fast | Good | Low-end hardware |
| **gemma** | 3GB | Medium | Very Good | Alternative to Llama |
| **codellama** | 4GB | Medium | Excellent | Code help |

---

## 🎯 Personality Presets

Copy these into your `.env` file's `AI_SYSTEM_PROMPT`:

### 1. Friendly Helper (Default)

```
You are "AI Friend", a helpful, friendly, and supportive AI assistant. Be warm, conversational, and use emojis occasionally. Keep responses concise (2-4 sentences). Be honest about being an AI.
```

### 2. Professional Assistant

```
You are a professional AI assistant. Provide clear, accurate, and well-structured responses. Maintain a formal but friendly tone. Avoid excessive emojis. Focus on being helpful and efficient.
```

### 3. Casual Buddy

```
Hey! You're a super chill AI buddy who loves to chat! 😎 Keep things casual and fun. Use emojis, slang, and be relatable. Don't overthink it - just vibe with the conversation!
```

### 4. Wise Mentor

```
You are a wise and thoughtful mentor. Provide insightful advice with patience and understanding. Share wisdom through stories and examples. Be encouraging and supportive in your guidance.
```

### 5. Tech Expert

```
You are a technical AI expert specializing in technology and programming. Provide detailed, accurate technical information. Use code examples when relevant. Be precise and thorough in explanations.
```

---

## 🐛 Troubleshooting

### AI Not Responding

**Check Ollama is running:**

```powershell
ollama list
```

**If not running, start it:**

```powershell
ollama serve
```

### "Model not found" Error

**Install the model:**

```powershell
ollama pull llama3
```

### Slow Responses

**Try a lighter model:**

```env
AI_MODEL=phi3
```

**Or reduce max tokens:**

```env
AI_MAX_TOKENS=200
```

### Fallback Responses Only

This means Ollama isn't running. Check:

1. Ollama is installed
2. Ollama service is running
3. Model is downloaded (`ollama list`)

---

## 💡 Tips for Best Results

1. **Start with default settings** - They're optimized for most use cases
2. **Experiment with temperature** - Small changes make big differences
3. **Keep system prompts concise** - Shorter prompts work better
4. **Use appropriate models** - Llama3 for quality, Phi3 for speed
5. **Monitor resource usage** - AI uses RAM, close other apps if needed

---

## 🔄 Switching Models On-The-Fly

You can change models without restarting:

1. Edit `.env` file
2. Change `AI_MODEL=newmodel`
3. Save file
4. Backend will use new model on next message

---

## 📈 Performance Optimization

### For Faster Responses

- Use `phi3` or `mistral` models
- Lower `AI_MAX_TOKENS` to 200-300
- Set `AI_TEMPERATURE` to 0.3-0.5

### For Better Quality

- Use `llama3` model
- Increase `AI_MAX_TOKENS` to 800-1000
- Set `AI_TEMPERATURE` to 0.7-0.8

### For Balanced

- Use `llama3` model
- Keep `AI_MAX_TOKENS` at 500
- Keep `AI_TEMPERATURE` at 0.7

---

## 🎉 You're All Set

Your AI Friend is now:

- ✅ Running locally (no API costs!)
- ✅ Fully customizable (personality, model, behavior)
- ✅ Private (data never leaves your server)
- ✅ Unlimited (no quotas!)

**Enjoy your personal AI assistant!** 🤖✨
