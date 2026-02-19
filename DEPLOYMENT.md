# True Friends - Deployment Checklist

## ✅ Pre-Deployment Setup Complete

- [x] Created `.gitignore` files
- [x] Created Railway config files
- [x] Created `.env.example` files

## 📋 Next Steps for Deployment

### Step 1: Push to GitHub

1. **Initialize Git** (if not done):

   ```bash
   cd c:\Users\vishn\OneDrive\Desktop\project\true-friends
   git init
   git add .
   git commit -m "Initial commit - ready for deployment"
   ```

2. **Create GitHub Repository**:
   - Go to <https://github.com/new>
   - Name: `true-friends-chat` (or any name you like)
   - Make it **Private** (recommended)
   - Don't initialize with README
   - Click "Create repository"

3. **Push your code**:

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/true-friends-chat.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Railway

1. **Sign up**: Go to <https://railway.app> and sign in with GitHub

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `true-friends-chat`

3. **Deploy Backend**:
   - Railway will auto-detect Node.js
   - Click on the service → "Variables"
   - Add these environment variables:

     ```
     EMAIL_USER = your_gmail@gmail.com
     EMAIL_PASS = your_app_password
     SECRET_KEY = true_friends_secret_key_2024
     PORT = 5000
     ```

   - Click "Deploy"
   - Copy the backend URL (e.g., `https://your-app.up.railway.app`)

4. **Deploy Frontend**:
   - In same project, click "New"
   - Select "GitHub Repo" again
   - Choose same repo
   - Click "Settings" → "Service Settings"
   - Set Root Directory: `/frontend`
   - Add environment variable:

     ```
     VITE_API_URL = [YOUR_BACKEND_URL_FROM_STEP_3]
     ```

   - Click "Deploy"

5. **Get Your URLs**:
   - Backend: `https://your-backend.up.railway.app`
   - Frontend: `https://your-frontend.up.railway.app`

### Step 3: Share with Friends

Share the frontend URL with your friends. They can access it anytime!

---

## 🔧 Important Notes

- **Free Tier**: Railway gives $5/month credit (enough for small projects)
- **Auto-Deploy**: Every time you push to GitHub, Railway auto-deploys
- **Environment Variables**: Never commit `.env` files to GitHub
- **Data Persistence**: Your `data/` folder won't persist on free tier. Consider using Railway's database add-ons for production.

---

## 🆘 Troubleshooting

**If frontend can't connect to backend:**

1. Check VITE_API_URL is set correctly in Railway
2. Make sure backend is deployed and running
3. Check Railway logs for errors

**If email doesn't work:**

1. Verify EMAIL_USER and EMAIL_PASS are set in Railway
2. Make sure you're using Gmail App Password (not regular password)
