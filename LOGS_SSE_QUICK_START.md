# Logs SSE POC - Quick Start Guide
*Real-time logs across all Datashop micro frontends*

## 🎯 **What This Solves**

**Problem**: Multiple micro frontends (`datashop-indata`, `datashop-faas`, `datashop-faas-function`) have logs that require manual refresh.

**Solution**: **Single SSE connection** streams logs to all micro frontends in real-time.

---

## 🚀 **Quick Demo**

### **1. Start the Logs SSE Gateway**
```bash
cd logs-sse-gateway
npm install
npm start

# Gateway runs on http://localhost:3002
# Health: http://localhost:3002/health
```

### **2. Test the Gateway**
```bash
# Test SSE connection
curl -N -H "Accept: text/event-stream" \
  -H "X-User-Id: user123" \
  "http://localhost:3002/api/logs/stream?channels=logs:etl:workspace123:workflow456"

# Publish a test log (in another terminal)
curl -X POST http://localhost:3002/test/logs \
  -H "Content-Type: application/json" \
  -d '{
    "service": "etl",
    "workspace_id": "workspace123",
    "workflow_id": "workflow456", 
    "logData": {
      "level": "INFO",
      "message": "Test ETL log message",
      "timestamp": 1695384000000
    }
  }'
```

### **3. Integration Examples**

#### **datashop-indata (ETL Logs)**
```javascript
// Add to existing Logs component
import { useLogsSSE } from '@datashop/logs-sse-client';

const Logs = ({ workspace_id, workflow_id }) => {
  // Get real-time ETL logs
  const { logs, isConnected, connectionStatus } = useLogsSSE({
    service: 'etl',
    workspace_id,
    workflow_id,
    maxLogs: 200,
    persistence: true
  });
  
  return (
    <div>
      <div className="logs-status">
        Status: {connectionStatus} {isConnected && '🔴 LIVE'}
      </div>
      <LogsTable logs={logs} />
    </div>
  );
};
```

#### **datashop-faas (Workflow Logs)**
```javascript
// Add to FAAS workflow logs
import { useLogsSSE } from '@datashop/logs-sse-client';

const WorkflowLogs = ({ workspace_id, workflow_id }) => {
  const { logs, isConnected } = useLogsSSE({
    service: 'faas',
    workspace_id,
    workflow_id,
    maxLogs: 100
  });
  
  return (
    <div>
      <h3>Workflow Logs {isConnected && '🔴 LIVE'}</h3>
      {logs.map(log => (
        <div key={log.timestamp}>{log.message}</div>
      ))}
    </div>
  );
};
```

#### **datashop-faas-function (Function Logs)**
```javascript
// Add to function execution logs
import { useLogsSSE } from '@datashop/logs-sse-client';

const FunctionLogs = ({ workspace_id, function_id }) => {
  const { logs, isConnected } = useLogsSSE({
    service: 'function',
    workspace_id,
    workflow_id: function_id, // Using workflow_id param for function_id
    maxLogs: 500
  });
  
  return (
    <div className="function-logs">
      <h4>Function Logs {isConnected && '🔴 LIVE'}</h4>
      <div className="console">
        {logs.map(log => (
          <div key={log.id}>[{log.level}] {log.message}</div>
        ))}
      </div>
    </div>
  );
};
```

#### **App Root (Single Connection)**
```javascript
// Wrap entire app with single SSE provider
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

---

## 📋 **Channel Convention**

### **Channel Format**
```
logs:{service}:{workspace_id}:{resource_id}

Examples:
- logs:etl:workspace123:workflow456      # ETL workflow logs
- logs:faas:workspace123:workflow789     # FAAS workflow logs  
- logs:function:workspace123:function456 # Function execution logs
```

### **Service Types**
- **`etl`**: L5-ETL service logs (pipelines, workflows)
- **`faas`**: FAAS service logs (workflows, orchestration)
- **`function`**: Function execution logs (individual function runs)

---

## 🔧 **Backend Integration**

### **Python (Flask) - L5-ETL Service**
```python
# Simple log publishing
import requests

def publish_etl_log(workspace_id, workflow_id, log_data):
    requests.post('http://logs-sse-gateway:3002/api/logs/publish', 
        headers={'X-Service-Token': 'l5-etl-token'},
        json={
            'service': 'etl',
            'workspace_id': workspace_id,
            'workflow_id': workflow_id,
            'logData': log_data
        }
    )

# Usage in existing log writing
def write_workflow_log(workspace_id, workflow_id, log_data):
    # Write to database (existing code)
    db.logs.insert(log_data)
    
    # Also publish to SSE (new - non-blocking)
    try:
        publish_etl_log(workspace_id, workflow_id, log_data)
    except:
        pass  # Don't fail if SSE is down
```

### **Node.js (Express) - FAAS Service**
```javascript
// Simple log publishing
const publishFAASLog = async (workspace_id, workflow_id, logData) => {
  try {
    await fetch('http://logs-sse-gateway:3002/api/logs/publish', {
      method: 'POST',
      headers: {
        'X-Service-Token': 'faas-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service: 'faas',
        workspace_id,
        workflow_id,
        logData
      })
    });
  } catch (error) {
    // Don't fail if SSE is down
    console.warn('Failed to publish log to SSE:', error);
  }
};

// Usage in existing workflow logging
async function logWorkflowEvent(workspace_id, workflow_id, logData) {
  // Save to database (existing code)
  await db.workflow_logs.create(logData);
  
  // Also publish to SSE (new)
  await publishFAASLog(workspace_id, workflow_id, logData);
}
```

---

## 🎯 **Key Benefits**

### **Single Connection Architecture**
- ✅ **Browser Limits Solved**: One SSE connection serves all micro frontends
- ✅ **Efficient**: No multiple connections per component
- ✅ **Scalable**: Can handle organization-wide log streaming

### **Easy Integration** 
- ✅ **Frontend**: One hook (`useLogsSSE`) adds real-time logs to any component
- ✅ **Backend**: 2-3 lines of code to publish logs to SSE
- ✅ **Non-breaking**: Works alongside existing log systems

### **Real-time Experience**
- ✅ **No Manual Refresh**: Logs appear automatically
- ✅ **Cross-Service**: See ETL → FAAS → Function logs in real-time
- ✅ **Persistent**: Logs maintained across tab switches

---

## 🧪 **Demo Scenarios**

### **Scenario 1: Cross-Service Log Flow**
1. User starts ETL workflow in `datashop-indata`
2. Sees real-time ETL logs
3. ETL triggers FAAS workflow → switches to `datashop-faas`
4. Sees real-time FAAS logs (same SSE connection)
5. FAAS calls functions → switches to `datashop-faas-function`
6. Sees real-time function logs
7. **All using single SSE connection!**

### **Scenario 2: Multi-User Monitoring**
1. User A monitors ETL workflow logs
2. User B monitors same workflow from FAAS perspective
3. Both see real-time updates simultaneously
4. Proper permission filtering per user

### **Scenario 3: High-Volume Function Logs**
1. Function executes with 100+ logs/second
2. User sees real-time updates without UI lag
3. Connection remains stable under load

---

## 📊 **Success Metrics**

### **Technical Validation**
- [ ] Single SSE connection serves multiple micro frontends
- [ ] Logs route to correct components based on service/workspace/workflow
- [ ] Handle 50+ concurrent users with <2s log delivery
- [ ] Logs persist across tab switches and navigation

### **User Experience Validation**
- [ ] Logs appear within 5 seconds of generation
- [ ] Works across ETL, FAAS, and Function components
- [ ] Auto-reconnection works smoothly
- [ ] No UI lag with high log volume

### **Developer Experience Validation**
- [ ] Components add real-time logs with 1 hook
- [ ] Backend teams integrate in <1 day
- [ ] Clear connection status and error messages

---

## 🔍 **Next Steps**

### **Week 1: Core Implementation**
1. Complete logs SSE gateway server
2. Finish React client library 
3. Create Python/Node.js publisher SDKs
4. Basic testing and validation

### **Week 2: Micro Frontend Integration**
1. Integrate with `datashop-indata` logs
2. Add to `datashop-faas` workflow logs
3. Implement `datashop-faas-function` execution logs
4. Cross-service testing

### **Week 3: Production Readiness**
1. Performance testing with multiple connections
2. Security and authentication integration
3. Deployment setup and monitoring
4. Documentation and team training

---

*Logs SSE POC*  
*Focused, simple, and ready for implementation*  
*Timeline: 3 weeks for complete validation* 