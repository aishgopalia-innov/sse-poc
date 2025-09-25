# Logs SSE POC Design
*Focused Real-time Log Streaming Across Datashop Micro Frontends*

## 🎯 **Problem Statement**

Multiple Datashop micro frontends have logs components that currently require manual refresh:

- **`datashop-indata`**: ETL pipeline logs
- **`datashop-faas`**: FAAS workflow logs  
- **`datashop-faas-function`**: Function execution logs
- **Future micro frontends**: Any service with logs

**Goal**: Enable real-time log streaming across all these components with a **single, shared SSE connection**.

---

## 🏗️ **Simplified Architecture**

### **Current State (Per Micro Frontend)**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   indata-ui     │    │    faas-ui      │    │  function-ui    │
│                 │    │                 │    │                 │
│ Manual Refresh  │    │ Manual Refresh  │    │ Manual Refresh  │
│ Polling API     │    │ Polling API     │    │ Polling API     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    ETL Service            FAAS Service           Function Service
```

### **Target State (Unified Logs SSE)**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Datashop Frontend                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ indata-ui   │ │  faas-ui    │ │function-ui  │  ...More      │
│  │ (ETL logs)  │ │(FAAS logs)  │ │(Func logs)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│         │               │               │                       │
│         └───────────────┼───────────────┘                       │
│                         │                                       │
│              ┌─────────────────┐                               │
│              │ Logs SSE Client │ ← Single Connection           │
│              │ (Shared)        │                               │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼ Single SSE Stream
┌─────────────────────────────────────────────────────────────────┐
│                   Logs SSE Gateway                             │
│              ┌─────────────────┐                               │
│              │ Log Router      │                               │
│              │ & Permissions   │                               │
│              └─────────────────┘                               │
│                         │                                       │
│     ┌───────────────────┼───────────────────┐                 │
│     │                   │                   │                 │
│     ▼                   ▼                   ▼                 │
│ ┌─────────┐        ┌─────────┐        ┌─────────┐             │
│ │L5-ETL   │        │FAAS     │        │Function │             │
│ │Service  │        │Service  │        │Service  │             │
│ └─────────┘        └─────────┘        └─────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 **Log Channel Design**

### **Channel Naming Convention**
```javascript
// ETL Logs
logs:etl:workspace123:workflow456

// FAAS Workflow Logs  
logs:faas:workspace123:workflow789

// Function Execution Logs
logs:function:workspace123:function456

// Service-level Logs (optional)
logs:etl:workspace123
logs:faas:workspace123
```

### **Channel Structure**
```
logs:{service}:{workspace_id}:{resource_id}

Where:
- service: etl, faas, function, analytics, etc.
- workspace_id: User's workspace identifier
- resource_id: workflow_id, function_id, pipeline_id, etc.
```

---

## 🔧 **Implementation Components**

### **1. Logs SSE Gateway Server**

#### **Key Features**
- **Single Purpose**: Only handles logs (not generic events)
- **Channel Routing**: Routes logs to correct micro frontend components
- **Permission Filtering**: Users only see logs they have access to
- **Service Authentication**: Backend services authenticate to publish logs

#### **Core Endpoints**
```javascript
// Frontend connects here
GET /api/logs/stream?channels=logs:etl:ws123:wf456,logs:faas:ws123:wf789

// Backend services publish here
POST /api/logs/publish
{
  "service": "etl",
  "workspace_id": "workspace123", 
  "workflow_id": "workflow456",
  "logData": { /* log entry */ }
}

// Health and admin
GET /health
GET /admin/logs/stats
```

### **2. Shared Logs SSE Client (React)**

#### **React Hook for Logs**
```javascript
// Hook specifically for logs
import { useLogsSSE } from '@datashop/logs-sse-client';

function LogsComponent({ service, workspace_id, workflow_id }) {
  const { logs, connectionStatus, isConnected } = useLogsSSE({
    service,           // 'etl', 'faas', 'function'
    workspace_id,
    workflow_id,       // or function_id
    maxLogs: 200,      // Keep last 200 logs
    persistence: true   // Save across tab switches
  });
  
  return (
    <div>
      <div>Status: {connectionStatus} {isConnected && '🔴 LIVE'}</div>
      <LogsTable logs={logs} />
    </div>
  );
}
```

#### **Provider for App Root**
```javascript
// App.js - Single SSE connection for entire app
import { LogsSSEProvider } from '@datashop/logs-sse-client';

function App() {
  return (
    <LogsSSEProvider gatewayUrl="/api/logs/stream">
      <Router>
        <Routes>
          <Route path="/indata/logs" element={<ETLLogsPage />} />
          <Route path="/faas/logs" element={<FAASLogsPage />} />
          <Route path="/functions/logs" element={<FunctionLogsPage />} />
        </Routes>
      </Router>
    </LogsSSEProvider>
  );
}
```

### **3. Backend Integration SDKs**

#### **Python SDK (for Flask services)**
```python
# For L5-ETL service
from logs_sse_publisher import LogsSSEPublisher

# Initialize
logs_publisher = LogsSSEPublisher(
    gateway_url='http://logs-sse-gateway:3002',
    service_token='l5-etl-token',
    service_name='etl'
)

# Publish logs
def write_workflow_log(workspace_id, workflow_id, log_data):
    # Write to database as usual
    db.logs.insert(log_data)
    
    # Also publish to SSE (non-blocking)
    logs_publisher.publish_log(
        workspace_id=workspace_id,
        workflow_id=workflow_id,
        log_data=log_data
    )
```

#### **Node.js SDK (for Express services)**
```javascript
// For FAAS services
const LogsSSEPublisher = require('@datashop/logs-sse-publisher');

const logsPublisher = new LogsSSEPublisher({
  gatewayUrl: 'http://logs-sse-gateway:3002',
  serviceToken: 'faas-token',
  serviceName: 'faas'
});

// Publish function execution logs
async function logFunctionExecution(workspace_id, function_id, log_data) {
  // Save to database
  await db.function_logs.create(log_data);
  
  // Publish to SSE
  await logsPublisher.publishFunctionLog(workspace_id, function_id, log_data);
}
```

---

## 🎯 **Integration Examples**

### **datashop-indata (ETL Logs)**
```javascript
// /packages/core/datashop-indata/ui/pipelines/components/L3-L5/Logs/index.js
import { useLogsSSE } from '@datashop/logs-sse-client';

const Logs = ({ pipelineID, pipelineName, workspace_id, workflow_id }) => {
  // Get initial logs from API
  const [apiLogs, setApiLogs] = useState([]);
  
  // Get real-time logs from SSE
  const { logs: sseLogs, isConnected, connectionStatus } = useLogsSSE({
    service: 'etl',
    workspace_id,
    workflow_id,
    maxLogs: 200,
    persistence: true,
    persistenceKey: `etl-logs-${workspace_id}-${workflow_id}`
  });
  
  // Combine both
  const allLogs = [...sseLogs, ...apiLogs];
  
  return (
    <div>
      {/* SSE Status */}
      <div className="logs-status">
        <span className={`status ${connectionStatus}`}>
          {connectionStatus.toUpperCase()}
        </span>
        {isConnected && <span className="live">🔴 LIVE</span>}
        <span>Total: {allLogs.length} logs</span>
      </div>
      
      {/* Existing logs table */}
      <LogsTable logs={allLogs} />
    </div>
  );
};
```

### **datashop-faas (Workflow Logs)**
```javascript
// /packages/core/datashop-faas/ui/workflows/components/WorkflowLogs.js
import { useLogsSSE } from '@datashop/logs-sse-client';

const WorkflowLogs = ({ workspace_id, workflow_id }) => {
  const { logs, isConnected, lastLog } = useLogsSSE({
    service: 'faas',
    workspace_id,
    workflow_id,
    maxLogs: 100
  });
  
  return (
    <div>
      <div className="workflow-logs-header">
        <h3>Workflow Logs</h3>
        {isConnected && <span className="live-indicator">🔴 LIVE</span>}
      </div>
      
      <div className="logs-list">
        {logs.map(log => (
          <div key={log.timestamp} className="log-entry">
            <span className={`level ${log.level}`}>{log.level}</span>
            <span className="message">{log.message}</span>
            <span className="time">{log.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **datashop-faas-function (Function Logs)**
```javascript
// /packages/core/datashop-faas-function/ui/execution/components/FunctionLogs.js
import { useLogsSSE } from '@datashop/logs-sse-client';

const FunctionLogs = ({ workspace_id, function_id, execution_id }) => {
  const { logs, isConnected, connectionStatus } = useLogsSSE({
    service: 'function',
    workspace_id,
    workflow_id: function_id, // Using workflow_id param for function_id
    maxLogs: 500, // Functions might have more logs
    filter: (log) => log.execution_id === execution_id // Filter by execution
  });
  
  return (
    <div className="function-logs">
      <div className="logs-header">
        <h4>Function Execution Logs</h4>
        <div className="status">
          <span className={connectionStatus}>{connectionStatus}</span>
          {isConnected && <span className="live">🔴 LIVE</span>}
        </div>
      </div>
      
      <div className="logs-console">
        {logs.map(log => (
          <div key={log.id} className="console-line">
            <span className="timestamp">{log.timestamp}</span>
            <span className={`level ${log.level}`}>[{log.level}]</span>
            <span className="message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 🚀 **Implementation Plan**

### **Week 1: Core Infrastructure**

#### **Day 1-2: Logs SSE Gateway**
```bash
# Create logs-sse-gateway
mkdir logs-sse-gateway
cd logs-sse-gateway
npm init -y
npm install express cors

# Implement:
# - server/logs-gateway.js
# - Basic SSE connection handling
# - Log publishing endpoint
# - Channel routing
```

#### **Day 3-4: React Client Library**
```bash
# Create client library
mkdir logs-sse-client
cd logs-sse-client

# Implement:
# - LogsSSEProvider.js
# - useLogsSSE.js
# - Connection management
# - Log persistence
```

#### **Day 5: Backend SDKs**
```bash
# Create publisher SDKs
mkdir logs-sse-publisher

# Implement:
# - python/logs_publisher.py
# - nodejs/LogsPublisher.js
# - Simple integration helpers
```

### **Week 2: Integration & Testing**

#### **Day 1-2: datashop-indata Integration**
- Update existing Logs component
- Add SSE client library
- Test with L5-ETL service

#### **Day 3-4: datashop-faas Integration**  
- Add logs SSE to workflow logs
- Integrate with FAAS service
- Test cross-service functionality

#### **Day 5: datashop-faas-function Integration**
- Add function execution logs
- Test high-volume log streaming
- Performance validation

### **Week 3: Production Readiness**

#### **Day 1-2: Performance Testing**
- Load testing with multiple connections
- Memory usage optimization
- Connection stability testing

#### **Day 3-4: Security & Deployment**
- Authentication integration
- Service token validation
- Docker containers and deployment

#### **Day 5: Documentation & Demo**
- Integration guides for teams
- Demo preparation
- Performance metrics

---

## 🧪 **POC Validation**

### **Technical Success Criteria**
- [ ] **Single Connection**: All micro frontends share one SSE connection
- [ ] **Log Routing**: Logs reach correct components based on service/workspace/workflow
- [ ] **Performance**: Handle 50+ concurrent users with <2s log delivery
- [ ] **Persistence**: Logs maintained across tab switches and navigation
- [ ] **Service Integration**: Backend services can publish logs with 2-3 lines of code

### **User Experience Success Criteria**
- [ ] **Real-time**: Logs appear within 5 seconds of generation
- [ ] **Cross-Service**: User can see logs from ETL, FAAS, and Functions simultaneously
- [ ] **Reliability**: Auto-reconnection works smoothly
- [ ] **Performance**: No noticeable UI lag with high log volume

### **Developer Experience Success Criteria**
- [ ] **Easy Integration**: Components add real-time logs with 1 hook
- [ ] **Service Adoption**: Backend teams can integrate in <1 day
- [ ] **Debugging**: Clear connection status and error messages
- [ ] **Maintenance**: Admin endpoints provide useful stats

---

## 🎯 **Demo Scenarios**

### **Scenario 1: Cross-Service Monitoring**
```
1. User opens datashop-indata ETL logs page
2. Starts ETL workflow → sees real-time ETL logs
3. ETL triggers FAAS workflow → switches to FAAS logs tab
4. Sees real-time FAAS logs (same SSE connection)
5. FAAS calls functions → switches to function logs tab
6. Sees real-time function execution logs
7. All using single SSE connection, no manual refresh needed
```

### **Scenario 2: Multi-User Collaboration**
```
1. User A monitors ETL workflow logs
2. User B monitors same workflow from FAAS perspective  
3. Both see real-time updates simultaneously
4. Different users, same logs, proper permission filtering
```

### **Scenario 3: High-Volume Logging**
```
1. Function executes with high log output (100+ logs/sec)
2. User sees real-time updates without UI lag
3. Logs are properly throttled/batched for performance
4. Connection remains stable under load
```

---

## 📊 **Expected Benefits**

### **User Benefits**
- **No More Manual Refresh**: Real-time log updates
- **Unified Experience**: Same real-time behavior across all micro frontends
- **Better Debugging**: Immediate feedback during pipeline/function execution
- **Cross-Service Visibility**: Monitor end-to-end workflows in real-time

### **Developer Benefits**
- **Simple Integration**: One hook to add real-time logs to any component
- **Shared Infrastructure**: No need to implement SSE per micro frontend
- **Easy Backend Integration**: Minimal code changes to publish logs
- **Consistent Patterns**: Same SSE approach across all Datashop services

### **System Benefits**
- **Single Connection**: Solves browser connection limits
- **Efficient Resource Usage**: One SSE stream serves all log components
- **Scalable Architecture**: Can handle organization-wide log streaming
- **Future-Proof**: Foundation for real-time features beyond logs

---

*Logs SSE POC Design*  
*Timeline: 3 weeks for complete implementation*  
*Focus: Logs only, maximum simplicity, proven patterns* 