# 🚀 Demo: Logs SSE Gateway Integration

## 🎯 **What You'll See**

This demo shows the **complete Logs SSE Gateway architecture** working with datashop-indata:

1. **Channel-based SSE Gateway**: Routes logs based on `logs:etl:workspace:workflow`
2. **Datashop Proxy Integration**: Uses existing proxy infrastructure 
3. **Real-time Log Streaming**: L5-ETL logs appear instantly in UI
4. **Service Independence**: Gateway handles SSE complexity, services just publish

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Datashop InData Frontend                     │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Logs Page     │    │ SSEGatewayTest  │                    │
│  │                 │    │   Component     │                    │
│  └─────────────────┘    └─────────────────┘                    │
│           │                       │                             │
│           └───────────────────────┘                             │
│                       │                                         │
│                       ▼                                         │
│            /api/dapadmin/l5-etl/sse/logs/stream                │
│                  (Datashop Proxy)                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼ Forwards to
                ┌─────────────────────┐
                │  Logs SSE Gateway   │
                │  localhost:3002     │
                │                     │
                │  Channel Router:    │
                │  logs:etl:workspace │
                │  123:workflow456    │
                └─────────────────────┘
                           ▲
                           │ Publishes logs
                ┌─────────────────────┐
                │  L5-ETL Service     │
                │  (Simulated by      │
                │  test publisher)    │
                └─────────────────────┘
```

---

## 🚀 **Step-by-Step Demo**

### **Step 1: Start the Logs SSE Gateway**

```bash
# Terminal 1: Start the gateway
cd /Users/aish.gopalia/Documents/sse-poc/logs-sse-gateway
node server/logs-gateway.js

# Should see:
# 🚀 Logs SSE Gateway running on port 3002
# 📊 Health: http://localhost:3002/health
# 🔧 Stats: http://localhost:3002/admin/logs/stats
# 🧪 Test: http://localhost:3002/test/logs
```

### **Step 2: Verify Gateway is Running**

```bash
# Terminal 2: Test gateway endpoints
curl -s http://localhost:3002/ | jq .

# Should return:
{
  "message": "Logs SSE Gateway is running!",
  "endpoints": {
    "health": "/health",
    "logs_stream": "/api/logs/stream", 
    "logs_publish": "/api/logs/publish",
    "test_publish": "/test/logs",
    "admin_stats": "/admin/logs/stats"
  },
  "deployment": "production"
}
```

### **Step 3: Test SSE Connection**

```bash
# Terminal 2: Test SSE streaming
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3002/api/logs/stream?channels=logs:etl:workspace123:workflow456"

# Should see connection confirmation:
# data: {"type":"connection","status":"connected","channels":["logs:etl:workspace123:workflow456"],...}
```

### **Step 4: Open Datashop InData**

1. **Navigate to**: `http://localhost:3000` (your datashop instance)
2. **Go to**: Logs page in L3-L5 section
3. **Add the test component** (temporarily):

```javascript
// In the Logs page, import and add:
import SSEGatewayTest from './SSEGatewayTest';

// Add to render:
<SSEGatewayTest />
```

### **Step 5: Connect to Gateway via Proxy**

1. **In the SSEGatewayTest component**, click **"Connect to Gateway"**
2. **Should see**:
   - Status: **CONNECTED** 🔴 LIVE
   - Channel: **logs:etl:workspace123:workflow456**
   - Debug info showing the proxy URL

### **Step 6: Publish Test Logs**

```bash
# Terminal 3: Start publishing logs to gateway
cd /Users/aish.gopalia/Documents/sse-poc
node gateway-log-publisher.js

# Should see:
# 🚀 Starting Gateway Log Publisher Test
# 📡 Publishing to: http://localhost:3002
# 📋 Channel: logs:etl:workspace123:workflow456
#
# 📝 Publishing log 1: ETL pipeline started successfully (Log #1)
# ✅ Published successfully: { success: true, delivered: 1, channel: "logs:etl:workspace123:workflow456" }
```

### **Step 7: Verify Real-time Updates**

**In the datashop UI**, you should see:

1. **Live logs appearing** in the SSEGatewayTest component
2. **Real-time counter** increasing: "Received: 1, 2, 3..."
3. **Log messages** with proper formatting:
   ```
   Sep 25 2025 at 01:30 PM [INFO] ETL pipeline started successfully (Log #1)
   Sep 25 2025 at 01:30 PM [WARN] Data extraction from source completed (Log #2)
   ```
4. **No manual refresh needed** - updates appear instantly

### **Step 8: Test Continuous Publishing**

```bash
# Terminal 3: Start continuous publishing
node gateway-log-publisher.js continuous 3

# Publishes a log every 3 seconds
# 🔄 Starting continuous log publishing (every 3s)
# Press Ctrl+C to stop
#
# 📝 [2025-09-25T07:30:15.123Z] Publishing log 1: Processing batch records (Log #1)
# ✅ Delivered to 1 subscribers
```

**Watch the UI update in real-time** every 3 seconds!

---

## 🧪 **Advanced Testing**

### **Multiple Channels**

Test different workspace/workflow combinations:

```bash
# Publish to different channel
curl -X POST http://localhost:3002/api/logs/publish \
  -H "Content-Type: application/json" \
  -H "X-Service-Token: l5-etl-token" \
  -d '{
    "service": "etl",
    "workspace_id": "workspace456", 
    "workflow_id": "workflow789",
    "logData": {
      "date": "Sep 25 2025 at 01:35 PM",
      "level": "ERROR",
      "pipeline": "DATA_VALIDATION", 
      "status": "failed",
      "message": "Validation failed for batch 123"
    }
  }'
```

### **Multiple Subscribers**

1. **Open multiple browser tabs** with the Logs page
2. **Connect all to the gateway**
3. **Publish a log** - should appear in **all tabs simultaneously**
4. **Check admin stats**:

```bash
curl -s http://localhost:3002/admin/logs/stats | jq .

# Should show multiple connections:
{
  "totalConnections": 2,
  "totalChannels": 1,
  "channels": [
    {
      "channel": "logs:etl:workspace123:workflow456",
      "subscriberCount": 2,
      "subscribers": ["user123", "user123"]
    }
  ]
}
```

### **Service Authentication**

Test different service tokens:

```bash
# Valid token
curl -X POST http://localhost:3002/api/logs/publish \
  -H "X-Service-Token: l5-etl-token" \
  -d '{"service": "etl", "workspace_id": "test", "workflow_id": "test", "logData": {}}'

# Invalid token (should fail)
curl -X POST http://localhost:3002/api/logs/publish \
  -H "X-Service-Token: invalid-token" \
  -d '{"service": "etl", "workspace_id": "test", "workflow_id": "test", "logData": {}}'
```

---

## 📊 **Expected Results**

### ✅ **Technical Validation**
- [ ] Gateway starts and serves endpoints correctly
- [ ] SSE connections establish through datashop proxy
- [ ] Channel routing works (`logs:etl:workspace123:workflow456`)
- [ ] Log publishing delivers to connected subscribers
- [ ] Real-time updates appear in datashop UI instantly
- [ ] Multiple subscribers receive same messages
- [ ] Service authentication prevents unauthorized publishing

### ✅ **User Experience**
- [ ] **"Connect to Gateway"** button works smoothly
- [ ] **Status indicators** show connection state clearly
- [ ] **Live logs** appear without manual refresh
- [ ] **Channel info** displays correctly in debug section
- [ ] **Error handling** shows meaningful messages
- [ ] **Disconnect** works cleanly

### ✅ **Architecture Benefits**
- [ ] **Single Connection**: One SSE per user, multiple channels possible
- [ ] **Channel Isolation**: Different workspaces/workflows get separate streams
- [ ] **Service Independence**: L5-ETL just publishes, gateway handles SSE complexity
- [ ] **Proxy Integration**: Uses existing datashop infrastructure
- [ ] **Production Ready**: Proper headers, error handling, health checks

---

## 🎯 **Demo Script**

### **For Stakeholders (5-minute demo)**

1. **Show the problem**: "Currently, logs require manual refresh"
2. **Start gateway**: "This is our new Logs SSE Gateway"
3. **Connect UI**: "Now we connect through existing datashop proxy"
4. **Publish logs**: "L5-ETL service publishes logs to gateway"
5. **Show real-time**: "Logs appear instantly, no refresh needed"
6. **Multiple tabs**: "Works across all micro frontends"
7. **Show benefits**: "Single connection, channel routing, service independence"

### **For Technical Team (15-minute demo)**

1. **Architecture overview**: Show the complete flow diagram
2. **Gateway features**: Channels, authentication, health monitoring
3. **Proxy integration**: How it solves CSP and uses existing infra
4. **Code walkthrough**: Show gateway, proxy, and frontend code
5. **Live testing**: Connect, publish, verify real-time updates
6. **Advanced features**: Multiple channels, subscribers, error handling
7. **Production path**: Deployment, monitoring, L5-ETL integration

---

## 🚀 **Next Steps After Demo**

### **Immediate (This Week)**
1. **Deploy Gateway**: Use Render/Railway for production testing
2. **Update Proxy**: Point to deployed gateway URL
3. **Test Integration**: Verify end-to-end flow with deployed services

### **Short Term (2-3 weeks)**
1. **L5-ETL Integration**: Add gateway publishing to real L5-ETL service
2. **Authentication**: Integrate with datashop user authentication
3. **Monitoring**: Add metrics, logging, admin dashboard

### **Long Term (1-2 months)**
1. **Scale to Other Services**: Add FAAS, Analytics log streaming
2. **Advanced Features**: Log filtering, search, historical replay
3. **Production Deployment**: Kubernetes, load balancing, high availability

---

*🎉 **The Logs SSE Gateway is working!** 🎉*  
*Channel-based real-time log streaming for datashop micro frontends* 