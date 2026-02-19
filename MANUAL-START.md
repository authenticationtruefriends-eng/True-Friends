# 🚀 Quick Start - Manual Method

If the batch file doesn't work, follow these steps manually:

## Open 4 Separate Command Prompts

### Terminal 1: Backend Server

```bash
cd C:\Users\Admin\OneDrive\Desktop\project\true-friends\backend
node index.js
```

### Terminal 2: Frontend Server

```bash
cd C:\Users\Admin\OneDrive\Desktop\project\true-friends\frontend
npm run dev
```

### Terminal 3: Backend Tunnel (IMPORTANT - COPY THIS URL!)

```bash
cd C:\Users\Admin\OneDrive\Desktop\project\true-friends
npx localtunnel --port 5000
```

**→ Copy the URL that appears here!** (e.g., `https://big-phones-brush.loca.lt`)

### Terminal 4: Frontend Tunnel

```bash
cd C:\Users\Admin\OneDrive\Desktop\project\true-friends
npx localtunnel --port 5173
```

---

## Configure Your Website

1. Go to `https://truefriendss.com:5173` (or use the Frontend Tunnel URL)
2. **Triple-click the logo** (click 3 times fast)
3. **Paste the Backend Tunnel URL** from Terminal 3
4. Click OK
5. Refresh the page

---

## You're Done! 🎉

Login and Signup will now work!
