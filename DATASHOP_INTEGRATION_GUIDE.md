# Datashop-InData Logs SSE Gateway Integration Guide

## 🎯 **What's Implemented**

We've successfully implemented the **Logs SSE Gateway** in datashop-indata that:

1. **Uses your deployed backend**: [https://sse-poc-golj.onrender.com/](https://sse-poc-golj.onrender.com/)
2. **Routes through Datashop proxy**: Solves CSP issues by using existing proxy infrastructure
3. **Channel-based routing**: Uses `logs:etl:workspace123:workflow456` format
4. **Real-time ETL logs**: Shows live logs from L5-ETL service simulation

---

## 🏗️ **Architecture Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Datashop InData Frontend                     │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Logs Page     │    │  LogsSSEClient  │                    │
│  │   (Existing)    │    │   (New)         │                    │
│  └─────────────────┘    └─────────────────┘                    │
│           │                       │                             │
│           └───────────────────────┘                             │
│                       │                                         │
│                       ▼                                         │
│            /api/dapadmin/l5-etl/sse/logs/stream                │
│                  (Proxy Route)                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼ Proxy forwards to
                ┌─────────────────────┐
                │  SSE Backend        │
                │  (Your deployed)    │
                │  sse-poc-golj.      │
                │  onrender.com       │
                └─────────────────────┘
                           ▲
                           │ Publishes logs
                ┌─────────────────────┐
                │  L5-ETL Service     │
                │  (Simulated)        │
                └─────────────────────┘
```

---

## 📁 **Files Created/Modified**

### ✅ **Backend (Proxy)**
- **`server/controllers/l5-etls/module.js`**: Updated SSE proxy with channel support
- **`server/routes/l5-etls/module.js`**: Already has the route `/sse/logs/stream`

### ✅ **Frontend (New Components)**
- **`ui/pipelines/components/L3-L5/Logs/LogsSSEClient.js`**: SSE client for logs
- **`ui/pipelines/components/L3-L5/Logs/LogsWithSSE.js`**: Wrapper component

### ✅ **Testing**
- **`test-log-publisher.js`**: Simulates L5-ETL publishing logs

---

## 🚀 **How to Test**

### **Step 1: Test the SSE Connection**

1. **Open datashop-indata** and navigate to the **Logs page**
2. **Look for the SSE Status Bar** at the top (if using the wrapper)
3. **Click "Connect Live Logs"**
4. **Should see**: Status changes to "CONNECTED 🔴 LIVE"

### **Step 2: Test Log Publishing**

Run the test publisher to simulate L5-ETL service:

```bash
cd /Users/aish.gopalia/Documents/sse-poc
node test-log-publisher.js
```

**Expected output**:
```
🚀 Starting Log Publisher Test
📡 Publishing to: https://sse-poc-golj.onrender.com
📋 Channel: logs:etl:workspace123:workflow456

📝 Publishing log 1: ETL pipeline started successfully (Log #1)
✅ Published successfully: { success: true, ... }
📝 Publishing log 2: Data extraction from source completed (Log #2)
✅ Published successfully: { success: true, ... }
...
```

### **Step 3: Verify Real-time Updates**

1. **Keep datashop-indata Logs page open**
2. **Run the publisher script**
3. **Should see**: Live logs appearing in real-time in the UI
4. **Logs should show**: ETL messages with timestamps

---

## 🔧 **Integration Points**

### **Channel Format**
```javascript
// ETL logs channel format
const channel = `logs:etl:${workspaceId}:${workflowId}`;

// Examples:
logs:etl:workspace123:workflow456  // Current test
logs:etl:prod_workspace:etl_job_789 // Production example
```

### **Proxy Route**
```javascript
// Frontend connects to:
GET /api/dapadmin/l5-etl/sse/logs/stream?workspace_id=workspace123&workflow_id=workflow456

// Proxy forwards to:
GET https://sse-poc-golj.onrender.com/logs/stream?channels=logs:etl:workspace123:workflow456
```

### **L5-ETL Integration**
```python
# When L5-ETL writes logs, also publish to SSE:
import requests

def publish_etl_log(workspace_id, workflow_id, log_data):
    try:
        requests.post('https://sse-poc-golj.onrender.com/logs/stream', 
            headers={'X-Service-Token': 'l5-etl-token'},
            json={
                'service': 'etl',
                'workspace_id': workspace_id,
                'workflow_id': workflow_id,
                'logData': log_data
            },
            timeout=5
        )
    except:
        pass  # Don't fail ETL if SSE is down
```

---

## 🎯 **Expected Demo Flow**

### **Scenario: Real-time ETL Monitoring**

1. **User opens Logs page** in datashop-indata
2. **Sees existing mock logs** (normal operation)
3. **Clicks "Connect Live Logs"** 
4. **SSE connection established** through proxy
5. **ETL workflow starts** (simulated by test script)
6. **Live logs appear** in real-time above existing logs
7. **User sees**: ETL progress without manual refresh

### **Visual Indicators**
- **🔴 LIVE** indicator when connected
- **Status**: CONNECTED/CONNECTING/ERROR
- **Live logs section** with yellow background
- **Real-time updates** every 2 seconds (from test script)

---

## 🐛 **Troubleshooting**

### **Connection Issues**
```bash
# Test the deployed backend directly
curl -N -H "Accept: text/event-stream" \
  "https://sse-poc-golj.onrender.com/logs/stream?channels=logs:etl:workspace123:workflow456"

# Should see:
data: {"type":"connection","status":"connected",...}
```

### **Proxy Issues**
```bash
# Test the datashop proxy
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/dapadmin/l5-etl/sse/logs/stream?workspace_id=workspace123&workflow_id=workflow456"
```

### **Debug Info**
- **Open browser DevTools** → Network tab
- **Look for**: `/sse/logs/stream` EventSource connection
- **Should see**: `text/event-stream` content type
- **Check console** for SSE connection logs

---

## 📊 **Success Metrics**

### ✅ **Technical Validation**
- [ ] SSE connection establishes through proxy
- [ ] Channel routing works (`logs:etl:workspace123:workflow456`)
- [ ] Real-time logs appear in UI
- [ ] No CSP blocking issues
- [ ] Proxy forwards correctly to [https://sse-poc-golj.onrender.com/](https://sse-poc-golj.onrender.com/)

### ✅ **User Experience**
- [ ] "Connect Live Logs" button works
- [ ] Status indicators show connection state
- [ ] Live logs display above existing logs
- [ ] No manual refresh needed
- [ ] Graceful error handling

### ✅ **Integration**
- [ ] Uses existing Datashop proxy infrastructure
- [ ] Works with current workspace/workflow context
- [ ] Non-breaking addition to existing Logs page
- [ ] Ready for L5-ETL service integration

---

## 🎊 **Next Steps**

### **For Production**
1. **Integrate with real L5-ETL service**:
   ```python
   # Add to L5-ETL log writing functions
   from sse_publisher import publish_etl_log
   
   def write_workflow_log(workspace_id, workflow_id, log_data):
       # Existing database write
       db.logs.insert(log_data)
       
       # New: publish to SSE
       publish_etl_log(workspace_id, workflow_id, log_data)
   ```

2. **Update workspace/workflow context**:
   - Use real `workspaceId` and `workflowId` from Redux state
   - Handle dynamic channel switching

3. **Production deployment**:
   - Deploy SSE Gateway as a service
   - Update proxy to point to production SSE Gateway
   - Add proper authentication and monitoring

---

*Logs SSE Gateway Integration*  
*Ready for testing and demo*  
*Deployed backend: [https://sse-poc-golj.onrender.com/](https://sse-poc-golj.onrender.com/)* 