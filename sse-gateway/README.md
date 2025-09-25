# SSE Gateway POC
*Scalable Server-Sent Events for Datashop Micro Frontends*

## 🎯 **Overview**

The SSE Gateway provides a **centralized, scalable solution** for real-time updates across all Datashop micro frontends. It addresses the key concerns raised in the demo meeting:

- ✅ **Single Connection**: One SSE connection per user (solves browser limits)
- ✅ **Multi-Channel**: Subscribe to multiple event types through one connection
- ✅ **Access Control**: User-scoped event filtering and permissions
- ✅ **Service Independence**: Backend services publish with minimal changes
- ✅ **Easy Adoption**: Simple SDK and React hooks for quick integration

## 🏗️ **Architecture**

### **High-Level Flow**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Datashop Frontend                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ InData UI   │ │  FAAS UI    │ │Analytics UI │  ...More      │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│         │               │               │                       │
│         └───────────────┼───────────────┘                       │
│                         │                                       │
│              ┌─────────────────┐                               │
│              │  SSE Gateway    │ ← Single Connection           │
│              │   Client        │                               │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼ HTTP SSE Stream
┌─────────────────────────────────────────────────────────────────┐
│                    SSE Gateway Server                           │
│              ┌─────────────────┐                               │
│              │ Message Router  │                               │
│              │ & Permissions   │                               │
│              └─────────────────┘                               │
│                         │                                       │
│     ┌───────────────────┼───────────────────┐                 │
│     │                   │                   │                 │
│     ▼                   ▼                   ▼                 │
│ ┌─────────┐        ┌─────────┐        ┌─────────┐             │
│ │L5-ETL   │        │FAAS     │        │Analytics│             │
│ │Service  │        │Service  │        │Service  │             │
│ └─────────┘        └─────────┘        └─────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### **Channel-Based Messaging**
```javascript
// Channel naming convention
logs:workspace123:workflow456     // Workflow-specific logs
metrics:workspace123              // Workspace-wide metrics  
workflows:workspace123:workflow456 // Workflow events
alerts:user789                    // User-specific alerts
dashboards:dashboard123           // Dashboard updates
```

## 🚀 **Quick Start**

### **1. Start SSE Gateway**
```bash
cd sse-gateway
npm install
npm start

# Gateway runs on http://localhost:3001
# Health check: http://localhost:3001/health
```

### **2. Backend Integration (Python)**
```python
# In your Flask service
from sse_publisher import SSEPublisher

# Initialize publisher
sse = SSEPublisher(
    gateway_url='http://localhost:3001',
    service_token='l5-etl-service-token',
    service_name='l5-etl-service'
)

# Publish log event
sse.publish_log('workspace123', 'workflow456', {
    'level': 'INFO',
    'message': 'ETL step completed',
    'pipeline': 'ETL_PROCESSING',
    'status': '2m 15s'
})
```

### **3. Frontend Integration (React)**
```javascript
// Wrap your app with SSE Provider
import { SSEProvider } from './client/SSEProvider';

function App() {
  return (
    <SSEProvider gatewayUrl="/api/sse">
      <YourAppComponents />
    </SSEProvider>
  );
}

// Use in components
import { useSSESubscription } from './client/useSSESubscription';

function LogsComponent({ workspace_id, workflow_id }) {
  const sseData = useSSESubscription([
    `logs:${workspace_id}:${workflow_id}`
  ], {
    accumulate: true,
    maxItems: 200
  });
  
  return (
    <div>
      <div>Status: {sseData.connectionStatus}</div>
      <div>Live Logs: {sseData.data.length}</div>
      {sseData.data.map(log => (
        <div key={log.timestamp}>{log.message}</div>
      ))}
    </div>
  );
}
```

## 📁 **Project Structure**

```
sse-gateway/
├── package.json              # Dependencies and scripts
├── README.md                 # This file
├── server/
│   ├── gateway.js           # Main gateway server
│   ├── middleware/          # SSE middleware components
│   ├── channels/           # Channel management
│   └── auth/               # Authentication helpers
├── client/
│   ├── SSEProvider.js      # React provider for SSE
│   ├── useSSESubscription.js # React hook for subscriptions
│   └── withSSE.js          # HOC wrapper
├── sdk/
│   ├── python/
│   │   └── sse_publisher.py # Python SDK for Flask services
│   └── nodejs/
│       └── SSEPublisher.js  # Node.js SDK for Express services
└── examples/
    ├── logs-integration-example.js    # Logs component example
    ├── workflow-monitor-example.js    # Multi-channel example
    └── service-integration-example.py # Backend integration example
```

## 🔧 **Configuration**

### **Environment Variables**

#### **Gateway Server**
```bash
PORT=3001                                    # Gateway port
ALLOWED_ORIGINS=http://localhost:3000        # CORS origins
REDIS_URL=redis://localhost:6379            # Redis for scaling (optional)
LOG_LEVEL=info                              # Logging level
```

#### **Backend Services**
```bash
SSE_GATEWAY_URL=http://localhost:3001       # Gateway URL
SSE_SERVICE_TOKEN=l5-etl-service-token      # Service authentication
SERVICE_NAME=l5-etl-service                 # Service identifier
```

#### **Frontend Applications**
```bash
REACT_APP_SSE_GATEWAY_URL=/api/sse          # Gateway endpoint (proxied)
```

## 🎯 **Key Features**

### **1. Single Connection Architecture**
- **Browser Limit Solution**: One SSE connection per user
- **Channel Multiplexing**: Multiple event types through single stream
- **Automatic Management**: Connection handled at app root level

### **2. Permission-Based Access Control**
```javascript
// User only receives events they have permission to see
const allowedChannels = getUserAllowedChannels(user, requestedChannels);

// Server-side filtering ensures security
if (!userCanAccessWorkflow(userId, workspaceId, workflowId)) {
  // Don't send this log event to this user
}
```

### **3. Service Independence**
```python
# Services publish events with minimal code
sse_publisher.publish_log(workspace_id, workflow_id, log_data)

# Gateway handles all SSE complexity:
# - Connection management
# - User permissions  
# - Message routing
# - Error handling
```

### **4. Easy Frontend Integration**
```javascript
// Components just use the hook
const sseData = useSSESubscription(['logs:ws123:wf456']);

// Automatic features:
// - Connection management
// - Data persistence
// - Error handling
// - Reconnection logic
```

## 🧪 **Testing the POC**

### **1. Start Gateway**
```bash
cd sse-gateway
npm install
npm start
```

### **2. Test Health**
```bash
curl http://localhost:3001/health
```

### **3. Test SSE Connection**
```bash
# Open SSE connection
curl -N -H "Accept: text/event-stream" \
  -H "X-User-Id: user123" \
  "http://localhost:3001/api/sse?channels=logs:workspace123:workflow456"
```

### **4. Publish Test Event**
```bash
# In another terminal
curl -X POST http://localhost:3001/test/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "logs:workspace123:workflow456",
    "data": {
      "level": "INFO",
      "message": "Test log message",
      "timestamp": 1695384000000
    }
  }'
```

### **5. Check Admin Stats**
```bash
# View connections
curl http://localhost:3001/admin/connections

# View channels  
curl http://localhost:3001/admin/channels
```

## 🎯 **Integration Examples**

### **datashop-indata Integration**
```javascript
// Update existing Logs component
import { useSSESubscription } from '@datashop/sse-gateway-client';

const Logs = ({ workspace_id, workflow_id }) => {
  // Get real-time logs
  const liveData = useSSESubscription([
    `logs:${workspace_id}:${workflow_id}`
  ], {
    persistence: true,
    persistenceKey: `logs-${workspace_id}-${workflow_id}`
  });
  
  // Combine with API logs
  const allLogs = [...liveData.data, ...apiLogs];
  
  return <LogsTable logs={allLogs} isLive={liveData.isConnected} />;
};
```

### **datashop-faas Integration**
```javascript
// Workflow monitoring with multiple channels
const WorkflowMonitor = ({ workspace_id, workflow_id }) => {
  const workflowEvents = useSSESubscription([
    `workflows:${workspace_id}:${workflow_id}`,
    `logs:${workspace_id}:${workflow_id}`
  ]);
  
  return (
    <div>
      <WorkflowStatus events={workflowEvents.data} />
      <RealTimeLogs logs={workflowEvents.data.filter(e => e.type === 'log')} />
    </div>
  );
};
```

### **datashop-analytics Integration**
```javascript
// Real-time dashboard updates
const AnalyticsDashboard = ({ workspace_id, dashboard_id }) => {
  const metricsData = useSSESubscription([
    `metrics:${workspace_id}`,
    `dashboards:${dashboard_id}`
  ], {
    accumulate: false, // Always show latest
    transform: aggregateMetrics
  });
  
  return <Dashboard data={metricsData.lastMessage} isLive={metricsData.isConnected} />;
};
```

## 🔒 **Security Features**

### **User Authentication**
- Integrates with existing Datashop authentication
- User context passed through headers
- Same security model as REST APIs

### **Channel Permissions**
```javascript
// Users only see data they have access to
const userChannels = getUserAllowedChannels(user, requestedChannels);

// Channel access validation
validateUserChannelAccess(user, 'logs:workspace123:workflow456')
// → Checks if user has access to workspace123 and workflow456
```

### **Service Authorization**
```javascript
// Services must authenticate to publish
const servicePermissions = {
  'l5-etl-service': ['logs:*', 'metrics:*'],
  'faas-service': ['workflows:*', 'functions:*'],
  'analytics-service': ['metrics:*', 'dashboards:*']
};
```

## 📊 **Monitoring & Admin**

### **Health Endpoint**
```bash
GET /health
{
  "status": "healthy",
  "connections": 15,
  "channels": 8,
  "stats": {
    "totalConnections": 127,
    "messagesPublished": 1543
  }
}
```

### **Admin Endpoints**
```bash
# View active connections
GET /admin/connections

# View channel statistics
GET /admin/channels
```

## 🚀 **Production Deployment**

### **Gateway Deployment**
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### **Kubernetes Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sse-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sse-gateway
  template:
    spec:
      containers:
      - name: sse-gateway
        image: datashop/sse-gateway:latest
        ports:
        - containerPort: 3001
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
```

## 🎯 **POC Success Criteria**

### **Technical Validation**
- [ ] **Single Connection**: Multiple micro frontends share one SSE connection
- [ ] **Channel Routing**: Messages reach correct components based on channels
- [ ] **Access Control**: Users only receive events they have permission to see
- [ ] **Service Integration**: Backend services can publish with minimal code changes
- [ ] **Performance**: Handle 100+ concurrent connections with <1s latency

### **User Experience Validation**
- [ ] **Real-time Updates**: Events appear in UI within 5 seconds
- [ ] **Cross-Component**: Updates work across different micro frontends
- [ ] **Persistence**: State maintained across tab switches and navigation
- [ ] **Reliability**: Auto-reconnection and error handling work smoothly

### **Developer Experience Validation**
- [ ] **Easy Integration**: Components can add SSE with 2-3 lines of code
- [ ] **Service Adoption**: Backend services can publish events with minimal setup
- [ ] **Documentation**: Clear examples and integration guides
- [ ] **Debugging**: Admin endpoints provide useful connection and channel info

## 🔍 **Next Steps**

### **Week 1: Core Implementation**
1. **Complete Gateway Server**: Finish channel management and permissions
2. **React Client Library**: Complete hooks and provider implementation
3. **Python SDK**: Finish Flask integration helpers
4. **Basic Testing**: Unit tests and integration validation

### **Week 2: Integration Examples**
1. **Update datashop-indata**: Integrate logs component with gateway
2. **Add FAAS Integration**: Workflow monitoring example
3. **Analytics Example**: Real-time dashboard updates
4. **Cross-Service Demo**: Show multi-service event streaming

### **Week 3: Production Readiness**
1. **Performance Testing**: Load testing with multiple connections
2. **Security Hardening**: Production auth integration
3. **Monitoring Setup**: Metrics, logging, and admin tools
4. **Documentation**: Complete integration guides for all teams

## 🎊 **Expected Outcomes**

### **Proof of Concept Validation**
- **Architecture Feasibility**: Gateway approach works for micro frontends
- **Performance Validation**: Can handle expected load with good UX
- **Integration Simplicity**: Teams can adopt with minimal effort
- **Security Model**: Proper access control and permissions

### **Production Readiness**
- **Clear Implementation Path**: From POC to production deployment
- **Team Buy-in**: Demonstrated value and ease of adoption
- **Scalability Validation**: Can grow with organization needs
- **Risk Mitigation**: Proven architecture and patterns

---

*SSE Gateway POC*  
*Ready for implementation and testing*  
*Timeline: 2-3 weeks for complete validation* 