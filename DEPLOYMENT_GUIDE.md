# 🚀 Logs SSE Gateway Deployment Guide

## 📋 **Prerequisites**

- GitHub account
- Render account (free tier available)
- Git installed locally

---

## 🌐 **Option 1: Deploy to Render (Recommended)**

### **Step 1: Prepare Repository**

```bash
# Navigate to your gateway directory
cd /Users/aish.gopalia/Documents/sse-poc/logs-sse-gateway

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit - Logs SSE Gateway"

# Create GitHub repository and push
# (Replace with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/logs-sse-gateway.git
git branch -M main
git push -u origin main
```

### **Step 2: Deploy on Render**

1. **Go to [render.com](https://render.com)** and sign up/login
2. **Click "New +" → "Web Service"**
3. **Connect GitHub repository**:
   - Select your `logs-sse-gateway` repository
   - Branch: `main`
   - Root Directory: leave empty (or `/logs-sse-gateway` if it's a subfolder)

4. **Configure Service**:
   - **Name**: `logs-sse-gateway`
   - **Environment**: `Node`
   - **Build Command**: `npm install --production`
   - **Start Command**: `npm start`

5. **Environment Variables** (automatically set via render.yaml):
   - `NODE_ENV=production`
   - `PORT=10000`
   - `ALLOWED_ORIGINS=*`

6. **Click "Create Web Service"**

### **Step 3: Get Your Deployed URL**

After deployment (5-10 minutes), you'll get a URL like:
```
https://logs-sse-gateway-xyz.onrender.com
```

### **Step 4: Test Deployment**

```bash
# Test health check
curl https://logs-sse-gateway-xyz.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "connections": 0,
  "channels": 0,
  "stats": {...},
  "uptime": 12345
}
```

---

## 🌐 **Option 2: Deploy to Railway**

### **Step 1: Install Railway CLI**

```bash
npm install -g @railway/cli
railway login
```

### **Step 2: Deploy**

```bash
cd /Users/aish.gopalia/Documents/sse-poc/logs-sse-gateway
railway init
railway up
```

### **Step 3: Set Environment Variables**

```bash
railway variables set NODE_ENV=production
railway variables set ALLOWED_ORIGINS="*"
```

---

## 🌐 **Option 3: Deploy to Heroku**

### **Step 1: Install Heroku CLI**

Download from [heroku.com/cli](https://devcenter.heroku.com/articles/heroku-cli)

### **Step 2: Deploy**

```bash
cd /Users/aish.gopalia/Documents/sse-poc/logs-sse-gateway

# Login to Heroku
heroku login

# Create app
heroku create your-logs-sse-gateway

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGINS="*"

# Deploy
git push heroku main
```

---

## 🔧 **Update Your POC to Use Deployed Gateway**

### **Step 1: Update Frontend (LogsSSEClient.js)**

```javascript
// In LogsSSEClient.js, update the SSE URL
const sseUrl = `${BASE_URL}/dapadmin/l5-etl/sse/logs/stream?workspace_id=${workspaceId}&workflow_id=${workflowId}`;
```

### **Step 2: Update Backend Proxy (module.js)**

```javascript
// In datashop-indata/server/controllers/l5-etls/module.js
const SSE_BACKEND_URL = process.env.SSE_BACKEND_URL || 'https://logs-sse-gateway-xyz.onrender.com';
```

### **Step 3: Update Log Publisher**

```bash
# Set environment variable for deployed gateway
export GATEWAY_URL=https://logs-sse-gateway-xyz.onrender.com

# Run publisher
node gateway-log-publisher.js continuous 5
```

Or update the script directly:

```javascript
// In gateway-log-publisher.js
const GATEWAY_URL = process.env.GATEWAY_URL || 'https://logs-sse-gateway-xyz.onrender.com';
```

---

## 🧪 **Testing the Deployed Gateway**

### **1. Health Check**
```bash
curl https://logs-sse-gateway-xyz.onrender.com/health
```

### **2. Admin Statistics**
```bash
curl https://logs-sse-gateway-xyz.onrender.com/admin/logs/stats
```

### **3. Test Log Publishing**
```bash
curl -X POST https://logs-sse-gateway-xyz.onrender.com/test/logs \
  -H "Content-Type: application/json" \
  -d '{
    "service": "etl",
    "workspace_id": "workspace123",
    "workflow_id": "workflow456"
  }'
```

### **4. Test SSE Connection**
```bash
# In one terminal - connect to SSE stream
curl -N -H "Accept: text/event-stream" \
  "https://logs-sse-gateway-xyz.onrender.com/api/logs/stream?channels=logs:etl:workspace123:workflow456"

# In another terminal - publish a test log
curl -X POST https://logs-sse-gateway-xyz.onrender.com/test/logs \
  -H "Content-Type: application/json" \
  -d '{"service": "etl", "workspace_id": "workspace123", "workflow_id": "workflow456"}'
```

### **5. Test with Log Publisher**
```bash
# Set gateway URL and run publisher
export GATEWAY_URL=https://logs-sse-gateway-xyz.onrender.com
node gateway-log-publisher.js continuous 3
```

---

## 🔄 **Complete Integration Flow**

Once deployed, your architecture will be:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Datashop Frontend                            │
│                                                                 │
│  EventSource → /api/dapadmin/l5-etl/sse/logs/stream           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Datashop Backend Proxy                         │
│                                                                 │
│  Forwards to → https://logs-sse-gateway-xyz.onrender.com      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Deployed Logs SSE Gateway                         │
│              https://logs-sse-gateway-xyz.onrender.com        │
│                                                                 │
│  • Channel routing: logs:etl:workspace:workflow                │
│  • Real-time broadcasting                                      │
│  • Health monitoring                                           │
└─────────────────────────▲───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                L5-ETL Service (Simulated)                      │
│                                                                 │
│  gateway-log-publisher.js → Publishes to deployed gateway     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 **Monitoring & Maintenance**

### **Render Dashboard**
- Monitor deployments at [dashboard.render.com](https://dashboard.render.com)
- View logs, metrics, and performance
- Auto-deploys on git push

### **Health Monitoring**
```bash
# Set up monitoring script
#!/bin/bash
GATEWAY_URL="https://logs-sse-gateway-xyz.onrender.com"

while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY_URL/health)
  if [ $STATUS -eq 200 ]; then
    echo "$(date): Gateway is healthy"
  else
    echo "$(date): Gateway is down (HTTP $STATUS)"
  fi
  sleep 60
done
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Build Fails**
   ```bash
   # Check package.json has correct scripts
   "scripts": {
     "start": "node server/logs-gateway.js"
   }
   ```

2. **Port Issues**
   - Render uses PORT environment variable
   - Make sure gateway listens on `process.env.PORT`

3. **CORS Issues**
   - Set `ALLOWED_ORIGINS=*` for testing
   - Restrict to specific domains for production

4. **Connection Issues**
   - Check firewall settings
   - Verify HTTPS is used for production

### **Debug Commands**
```bash
# Check gateway logs on Render
# Go to dashboard → your service → Logs

# Test connectivity
curl -v https://logs-sse-gateway-xyz.onrender.com/health

# Check if SSE endpoint is working
curl -N -v -H "Accept: text/event-stream" \
  "https://logs-sse-gateway-xyz.onrender.com/api/logs/stream?channels=logs:etl:test:test"
```

---

## ✅ **Success Checklist**

- [ ] Gateway deployed successfully
- [ ] Health endpoint returns 200
- [ ] SSE endpoint accepts connections
- [ ] Log publishing works
- [ ] Frontend can connect via proxy
- [ ] Real-time logs appear in UI
- [ ] Multiple browser windows work
- [ ] Statistics endpoint shows data

---

**🎉 Your Logs SSE Gateway is now deployed and ready for production use!**

**Deployed URL**: `https://logs-sse-gateway-xyz.onrender.com` 