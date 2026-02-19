# 🚀 True Friends - Quick Start Guide

## Every Time You Want to Use Your Website

### Step 1: Start Everything

Double-click `start-tunnels.bat` in this folder.

This will open 2 windows:

- **Backend Tunnel** - Shows a URL like `https://abc-123.loca.lt`
- **Frontend Tunnel** - Shows a URL like `https://xyz-456.loca.lt`

### Step 2: Configure Backend URL

1. **Copy the Backend Tunnel URL** (from the Backend Tunnel window)
2. Go to **<https://truefriendss.com:5173>** (or the Frontend Tunnel URL)
3. **Triple-click the logo** (click 3 times fast)
4. **Paste the Backend URL** you copied
5. Click OK

### Step 3: Use Your Website

Login/Signup will now work perfectly! 🎉

---

## Alternative: Run Manually

If the batch file doesn't work, run these commands in separate terminals:

**Terminal 1 - Backend:**

```bash
cd backend
node index.js
```

**Terminal 2 - Backend Tunnel:**

```bash
npx localtunnel --port 5000
```

**Terminal 3 - Frontend:**

```bash
cd frontend
npm run dev
```

**Terminal 4 - Frontend Tunnel:**

```bash
npx localtunnel --port 5173
```

---

## Troubleshooting

**"Failed to fetch" error?**

- Make sure you copied the **Backend Tunnel URL** (not frontend)
- Triple-click the logo and paste it again
- Refresh the page

**Tunnel URLs keep changing?**

- This is normal with free tunnels
- You'll need to update the URL each time you restart

**Want a permanent solution?**

- Deploy backend to Railway (free tier)
- No more tunnel URLs needed!
