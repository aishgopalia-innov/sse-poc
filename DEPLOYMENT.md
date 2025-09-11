# 🚀 Free Deployment Guide

This guide will help you deploy your Real-Time Log Streaming POC for **completely free** using modern cloud platforms.

## 📋 Prerequisites

1. **GitHub Account** (free)
2. **Render Account** (free) - for backend
3. **Vercel Account** (free) - for frontend

## 🔧 Step 1: Push to GitHub

1. **Create a new repository** on GitHub (public or private)
2. **Push your code:**

```bash
# Add your GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🖥️ Step 2: Deploy Backend (Render - FREE)

### Option A: Render (Recommended - Easiest)

1. **Go to [Render.com](https://render.com)** and sign up with GitHub
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name:** `log-streaming-backend`
   - **Environment:** `Python 3`
   - **Region:** `Oregon (US West)`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python main.py`
   - **Plan:** `Free` (0$/month)

5. **Click "Create Web Service"**
6. **Wait for deployment** (3-5 minutes)
7. **Copy your backend URL** (e.g., `https://your-app.onrender.com`)

### Option B: Railway (Alternative)

1. **Go to [Railway.app](https://railway.app)** and sign up with GitHub
2. **Click "New Project" → "Deploy from GitHub repo"**
3. **Select your repository**
4. **Railway will auto-detect Python and deploy**
5. **Set environment variables if needed**
6. **Copy your backend URL**

## 🌐 Step 3: Deploy Frontend (Vercel - FREE)

1. **Go to [Vercel.com](https://vercel.com)** and sign up with GitHub
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Configure the project:**
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Add Environment Variable:**
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** `https://your-backend-url.onrender.com` (from Step 2)

6. **Click "Deploy"**
7. **Wait for deployment** (2-3 minutes)
8. **Your app is live!** 🎉

## ✅ Step 4: Test Your Deployment

1. **Open your Vercel URL** (e.g., `https://your-app.vercel.app`)
2. **Click "Test Backend"** - should show success
3. **Click "Connect"** - should start streaming logs
4. **Verify logs are appearing** every 5 seconds

## 🔧 Troubleshooting

### Backend Issues:
- **Build fails:** Check `requirements.txt` format
- **Port errors:** Render automatically sets `PORT` env var
- **CORS errors:** Backend allows all origins for deployment

### Frontend Issues:
- **Can't connect to backend:** Check `VITE_BACKEND_URL` environment variable
- **Build fails:** Ensure all dependencies are in `package.json`

### Common Solutions:
```bash
# If backend build fails, try updating requirements.txt:
cd backend
pip freeze > requirements.txt

# If frontend build fails, try:
cd frontend
npm install
npm run build
```

## 🎯 Free Tier Limits

### Render (Backend):
- ✅ **750 hours/month** (enough for 24/7)
- ✅ **512MB RAM**
- ✅ **Custom domains**
- ⚠️ **Sleeps after 15 min inactivity** (wakes up automatically)

### Vercel (Frontend):
- ✅ **100GB bandwidth/month**
- ✅ **Unlimited static sites**
- ✅ **Custom domains**
- ✅ **Global CDN**

## 🚀 Going Live Checklist

- [ ] Backend deployed on Render
- [ ] Frontend deployed on Vercel
- [ ] Environment variables configured
- [ ] CORS working between frontend/backend
- [ ] SSE connection working
- [ ] Logs streaming every 5 seconds

## 🔄 Updates & Redeployment

**For Backend Updates:**
1. Push changes to GitHub
2. Render auto-deploys from `main` branch

**For Frontend Updates:**
1. Push changes to GitHub
2. Vercel auto-deploys from `main` branch

## 💡 Pro Tips

1. **Custom Domains:** Both Render and Vercel support free custom domains
2. **Environment Variables:** Use Render/Vercel dashboards to manage env vars
3. **Monitoring:** Both platforms provide logs and monitoring dashboards
4. **SSL:** Both platforms provide free SSL certificates
5. **Auto-Deploy:** Both platforms auto-deploy when you push to GitHub

## 🆘 Need Help?

1. **Check the logs** in Render/Vercel dashboards
2. **Verify environment variables** are set correctly
3. **Test locally first** before deploying
4. **Check CORS settings** if frontend can't connect to backend

---

🎉 **Congratulations!** Your real-time log streaming app is now live and free forever! 