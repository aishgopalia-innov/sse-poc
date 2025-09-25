# 🚀 Logs SSE Gateway

Real-time log streaming gateway for Datashop micro frontends using Server-Sent Events (SSE).

## 🌟 Features

- **Channel-based routing**: `logs:service:workspace:resource`
- **Multi-tenant support**: Isolated log streams per workspace
- **Real-time broadcasting**: Instant log delivery to connected clients
- **Service authentication**: Token-based publishing from backend services
- **Health monitoring**: Built-in health checks and admin statistics
- **Production ready**: Proper error handling, CORS, and scaling support

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Start in production mode
npm start
```

### Production Deployment

#### Deploy to Render

1. **Fork/Clone this repository**
2. **Connect to Render**:
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository
   - Select "logs-sse-gateway" folder
   - Render will automatically use `render.yaml` configuration

3. **Environment Variables** (automatically set via render.yaml):
   - `NODE_ENV=production`
   - `PORT=10000`
   - `ALLOWED_ORIGINS=*`

#### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Deploy to Heroku

```bash
# Install Heroku CLI and login
heroku create your-logs-sse-gateway
git push heroku main
```

## 📡 API Endpoints

### SSE Streaming
```
GET /api/logs/stream?channels=logs:etl:workspace123:workflow456
```

### Log Publishing
```
POST /api/logs/publish
Content-Type: application/json
X-Service-Token: your-service-token

{
  "service": "etl",
  "workspace_id": "workspace123", 
  "workflow_id": "workflow456",
  "logData": {
    "level": "INFO",
    "message": "ETL process completed",
    "timestamp": "2025-09-25T10:30:00Z"
  }
}
```

### Health & Monitoring
```
GET /health              # Health check
GET /admin/logs/stats    # Admin statistics
POST /test/logs          # Test log publishing
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins |
| `LOG_LEVEL` | `info` | Logging level |

### Service Tokens

Configure valid service tokens in the gateway:

```javascript
const validTokens = {
  'l5-etl-token': 'etl',
  'faas-token': 'faas', 
  'function-token': 'function',
  'analytics-token': 'analytics'
};
```

## 🏗️ Architecture

```
Backend Services → SSE Gateway → Frontend Clients
     ↓                ↓              ↑
  Publish Logs    Route Channels   Subscribe
```

### Channel Format
```
logs:{service}:{workspace_id}:{resource_id}
```

**Examples**:
- `logs:etl:workspace123:workflow456` - ETL workflow logs
- `logs:faas:workspace123:function789` - FAAS function logs
- `logs:analytics:workspace456` - Analytics service logs

## 💻 Usage Examples

### Frontend Integration (React)

```javascript
// Connect to SSE stream
const eventSource = new EventSource(
  'https://your-gateway.onrender.com/api/logs/stream?channels=logs:etl:workspace123:workflow456'
);

eventSource.onmessage = (event) => {
  const logData = JSON.parse(event.data);
  console.log('New log:', logData);
};
```

### Backend Publishing (Node.js)

```javascript
// Publish logs from your service
const response = await fetch('https://your-gateway.onrender.com/api/logs/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Token': 'l5-etl-token'
  },
  body: JSON.stringify({
    service: 'etl',
    workspace_id: 'workspace123',
    workflow_id: 'workflow456', 
    logData: {
      level: 'INFO',
      message: 'Processing batch completed',
      timestamp: new Date().toISOString()
    }
  })
});
```

### Backend Publishing (Python)

```python
import requests
import json
from datetime import datetime

# Publish logs from Python service
def publish_log(message, level='INFO'):
    response = requests.post(
        'https://your-gateway.onrender.com/api/logs/publish',
        headers={
            'Content-Type': 'application/json',
            'X-Service-Token': 'l5-etl-token'
        },
        json={
            'service': 'etl',
            'workspace_id': 'workspace123',
            'workflow_id': 'workflow456',
            'logData': {
                'level': level,
                'message': message,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
        }
    )
    return response.json()
```

## 🧪 Testing

### Health Check
```bash
curl https://your-gateway.onrender.com/health
```

### Test Log Publishing
```bash
curl -X POST https://your-gateway.onrender.com/test/logs \
  -H "Content-Type: application/json" \
  -d '{
    "service": "etl",
    "workspace_id": "workspace123", 
    "workflow_id": "workflow456"
  }'
```

### View Statistics
```bash
curl https://your-gateway.onrender.com/admin/logs/stats
```

## 📈 Performance & Scaling

### Current Limits (Single Instance)
- **Concurrent Connections**: ~1,000
- **Channels**: ~100 active channels
- **Messages/sec**: ~1,000

### Scaling Options
- **Horizontal**: Deploy multiple instances behind load balancer
- **Redis**: Add Redis for cross-instance communication
- **Message Queue**: Integrate Kafka/RabbitMQ for high throughput

## 🔒 Security

- **CORS**: Configurable allowed origins
- **Service Authentication**: Token-based publishing
- **User Authorization**: Workspace-based channel access
- **Rate Limiting**: Built-in connection limits

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create a GitHub issue
- Check existing documentation
- Review API examples above 