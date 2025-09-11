# Real-Time Log Streaming POC

A demo application that streams logs from a Python FastAPI backend to a React frontend using Server-Sent Events (SSE).

## Project Structure

```
poc/
├── backend/                 # Python FastAPI backend
│   ├── main.py             # FastAPI application with SSE endpoint
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Docker configuration for deployment
├── frontend/               # React frontend with Vite
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.jsx        # Main application component
│   │   └── main.jsx       # Entry point
│   ├── package.json       # Node.js dependencies
│   ├── vite.config.js     # Vite configuration
│   └── .env.example       # Environment variables template
└── README.md              # This file
```

## Features

### Backend (FastAPI)
- **SSE Endpoint**: `/logs/stream` - Streams logs every 5 seconds
- **Health Check**: `/health` - Verify backend status
- **CORS Support**: Configured for frontend integration
- **Proper SSE Format**: Uses standard `data: <message>\n\n` format
- **Deployment Ready**: Includes Dockerfile and requirements.txt

### Frontend (React + Vite)
- **Real-time Log Display**: Connects to backend SSE endpoint
- **Auto-scrolling**: Latest logs automatically scroll into view
- **Connection Management**: Connect/Disconnect button for manual control
- **Error Handling**: Automatic reconnection on connection failure
- **Styled UI**: Clean, scrollable log container
- **Environment Configuration**: Configurable backend URL via .env

## Local Development Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the FastAPI server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your backend URL:
```
VITE_BACKEND_URL=http://localhost:8000
```

5. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Deployment

### Backend Deployment (Render/Railway/Fly.io)

#### Option 1: Render
1. Connect your repository to Render
2. Create a new Web Service
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Deploy

#### Option 2: Using Docker
```bash
cd backend
docker build -t log-streaming-backend .
docker run -p 8000:8000 log-streaming-backend
```

### Frontend Deployment (Vercel)

1. Connect your repository to Vercel
2. Set framework preset to "Vite"
3. Set root directory to `frontend`
4. Add environment variable:
   - `VITE_BACKEND_URL`: Your deployed backend URL
5. Deploy

#### Manual Deployment
```bash
cd frontend
npm run build
# Upload dist/ folder to your hosting service
```

## API Endpoints

### Backend Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check endpoint
- `GET /logs/stream` - SSE endpoint for log streaming

### SSE Message Format

```
data: {"timestamp": "2023-12-07T10:30:00.123Z", "message": "Log message 1701943800"}

```

## Configuration

### Environment Variables

#### Frontend (.env)
```
VITE_BACKEND_URL=http://localhost:8000
```

For production, update this to your deployed backend URL:
```
VITE_BACKEND_URL=https://your-backend.onrender.com
```

## Development Notes

### CORS Configuration
The backend is configured to allow requests from common development ports:
- http://localhost:3000 (Next.js default)
- http://localhost:5173 (Vite default)
- http://127.0.0.1:5173

For production, update the CORS origins in `backend/main.py`.

### SSE Connection Management
- The frontend automatically reconnects if the connection is lost
- Manual connect/disconnect controls are provided
- Connection status is displayed in the UI

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the backend CORS configuration includes your frontend URL
2. **Connection Refused**: Verify the backend is running and the URL in `.env` is correct
3. **No Logs Appearing**: Check browser developer tools for SSE connection errors

### Testing the Backend
```bash
curl http://localhost:8000/health
curl http://localhost:8000/logs/stream
```

## License

This is a POC project for demonstration purposes. 
