# Quick Setup Guide

## 🚀 Running the Project Locally

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm

### 1. Backend Setup (Terminal 1)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
✅ Backend will be running at: http://localhost:8000

### 2. Frontend Setup (Terminal 2)
```bash
cd frontend
npm install
cp .env.example .env  # Optional: modify VITE_BACKEND_URL if needed
npm run dev
```
✅ Frontend will be running at: http://localhost:5173

### 3. Test the Application

1. **Open your browser**: http://localhost:5173
2. **Click "Connect"** to start streaming logs
3. **Watch logs appear** every 5 seconds in real-time
4. **Use controls** to Connect/Disconnect, Test Backend, or Clear Logs

### 4. API Testing (Optional)

Test backend endpoints directly:
```bash
# Health check
curl http://localhost:8000/health

# Root endpoint
curl http://localhost:8000/

# SSE stream (will stream continuously)
curl http://localhost:8000/logs/stream
```

### 🎯 What You Should See

- **Backend**: JSON responses from API endpoints
- **Frontend**: A beautiful gradient UI with:
  - Connection status indicator
  - Real-time log streaming every 5 seconds
  - Auto-scrolling log container
  - Control buttons for managing the connection

### 🔧 Troubleshooting

1. **CORS Issues**: Make sure both servers are running on the correct ports
2. **Connection Failed**: Verify backend is running and accessible
3. **No Logs**: Check browser console for errors
4. **Port Conflicts**: Change ports in the configuration if needed

### 🚀 Ready for Deployment

- **Backend**: Deploy to Render/Railway/Fly.io using the included Dockerfile
- **Frontend**: Deploy to Vercel using the included vercel.json
- **Environment**: Update `VITE_BACKEND_URL` in frontend to point to your deployed backend

Enjoy your real-time log streaming application! 🎉 